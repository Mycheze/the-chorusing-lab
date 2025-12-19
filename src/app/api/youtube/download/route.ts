import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";
import youtubeDlExec from "youtube-dl-exec";
import {
  createWriteStream,
  readFileSync,
  unlinkSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

// YouTube URL validation regex
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;

/**
 * Validate YouTube URL
 */
function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    console.log("🎬 YouTube download request received");

    // Get auth token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or invalid Authorization header");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7);
    console.log("🔑 Authenticating user...");

    // Create authenticated Supabase client
    const authenticatedClient = createAuthenticatedClient(accessToken);

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await authenticatedClient.auth.getUser();

    if (authError || !user) {
      console.error("❌ Authentication failed:", authError?.message);
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    console.log("✅ User authenticated:", user.id);

    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not extract video ID from URL" },
        { status: 400 }
      );
    }

    console.log("📥 Downloading video:", videoId);

    // Ensure binary exists - if not, try to download it
    // Find the actual package directory - require.resolve doesn't work in Next.js webpack
    // So we'll search for it in node_modules
    let packageDir: string;
    let binPath: string;

    // Try require.resolve first
    try {
      const resolved = require.resolve("youtube-dl-exec");
      // Check if it's a real path (starts with /) or just a module name
      if (resolved.startsWith("/") || resolved.includes("node_modules")) {
        packageDir = dirname(resolved);
        // If we got the src/index.js, go up one level to get package root
        if (packageDir.endsWith("src")) {
          packageDir = dirname(packageDir);
        }
        // Verify it's correct by checking for package.json
        if (!existsSync(join(packageDir, "package.json"))) {
          throw new Error("Resolved path doesn't contain package.json");
        }
      } else {
        // It's just a string, not a real path - throw to use fallback
        throw new Error("require.resolve returned module name, not path");
      }
    } catch (e) {
      // Fallback: search in common locations
      const possiblePaths = [
        join(
          process.cwd(),
          "node_modules",
          ".pnpm",
          "youtube-dl-exec@3.0.27",
          "node_modules",
          "youtube-dl-exec"
        ),
        join(process.cwd(), "node_modules", "youtube-dl-exec"),
      ];

      // Find the first path that has package.json
      const foundPath = possiblePaths.find((p) =>
        existsSync(join(p, "package.json"))
      );
      if (foundPath) {
        packageDir = foundPath;
      } else {
        // Last resort: use the first path and hope for the best
        packageDir = possiblePaths[0];
      }
    }

    // Ensure packageDir is absolute
    if (!packageDir.startsWith("/")) {
      packageDir = join(process.cwd(), packageDir);
    }

    binPath = join(packageDir, "bin", "yt-dlp");
    const binPathExists = existsSync(binPath);
    const postinstallScript = join(packageDir, "scripts", "postinstall.js");
    const postinstallExists = existsSync(postinstallScript);

    // If binary doesn't exist, try to download it
    if (!binPathExists) {
      console.log("⚠️ yt-dlp binary not found, attempting to download...");
      if (!postinstallExists) {
        console.error("❌ Postinstall script not found at:", postinstallScript);
        return NextResponse.json(
          {
            error:
              "yt-dlp binary not found and postinstall script not available. Please run: pnpm rebuild youtube-dl-exec",
          },
          { status: 500 }
        );
      }

      try {
        execSync(`node "${postinstallScript}"`, {
          stdio: "inherit",
          cwd: packageDir,
        });
        console.log("✅ Binary downloaded successfully");

        // Verify it was created
        if (!existsSync(binPath)) {
          throw new Error("Binary was not created after download");
        }
      } catch (downloadError: any) {
        console.error("❌ Failed to download binary:", downloadError);
        return NextResponse.json(
          {
            error: `yt-dlp binary not found and could not be downloaded automatically: ${downloadError.message}. Please run: node "${postinstallScript}"`,
          },
          { status: 500 }
        );
      }
    }

    // Create temporary file path
    const tempDir = tmpdir();
    const timestamp = Date.now();
    const audioFilePath = join(tempDir, `audio-${timestamp}.m4a`);

    let videoTitle = "";
    let videoDuration = 0;
    let audioBuffer: Buffer;

    try {
      // First, get video info
      console.log("📊 Getting video info...");
      const infoResult = await youtubeDlExec(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        addHeader: ["referer:youtube.com", "user-agent:Mozilla/5.0"],
      });

      // Handle type: when dumpSingleJson is true, result is a Payload object
      const info =
        typeof infoResult === "string" ? JSON.parse(infoResult) : infoResult;
      videoTitle = (info as any).title || "Unknown";
      videoDuration = Math.floor((info as any).duration || 0);

      console.log(
        "✅ Video info retrieved:",
        videoTitle,
        `(${videoDuration}s)`
      );

      // Download audio (extract audio only, prefer m4a format)
      console.log("🎵 Downloading audio...");
      await youtubeDlExec(url, {
        extractAudio: true,
        audioFormat: "m4a",
        output: audioFilePath,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        addHeader: ["referer:youtube.com", "user-agent:Mozilla/5.0"],
      });

      // Read the audio file
      audioBuffer = readFileSync(audioFilePath);
      console.log("✅ Audio downloaded:", audioBuffer.length, "bytes");

      // Clean up audio file
      try {
        unlinkSync(audioFilePath);
      } catch (e) {
        console.warn("⚠️ Could not delete temp audio file:", e);
      }

      // Determine filename
      const filename = `${videoTitle.replace(/[^a-zA-Z0-9\-_]/g, "_")}.m4a`;

      // Convert buffer to base64 for JSON response
      const audioBase64 = audioBuffer.toString("base64");

      return NextResponse.json({
        success: true,
        audio: {
          data: audioBase64,
          filename,
          mimeType: "audio/mp4",
          size: audioBuffer.length,
        },
        videoInfo: {
          title: videoTitle,
          duration: videoDuration,
          videoId,
          url,
        },
      });
    } catch (error: any) {
      // Clean up temp files on error
      try {
        unlinkSync(audioFilePath);
      } catch (e) {
        // Ignore
      }

      console.error("❌ Failed to download video:", error);

      if (
        error.message?.includes("Private video") ||
        error.message?.includes("unavailable") ||
        error.message?.includes("Video unavailable")
      ) {
        return NextResponse.json(
          { error: "Video is unavailable or private" },
          { status: 404 }
        );
      }

      if (error.message?.includes("403") || error.statusCode === 403) {
        return NextResponse.json(
          {
            error:
              "YouTube blocked the request. Please try again later or use a different video.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error: `Failed to download video: ${
            error.message || "Unknown error"
          }`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("❌ YouTube download error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to download YouTube video",
      },
      { status: 500 }
    );
  }
}
