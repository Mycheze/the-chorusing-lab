import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/supabase";
import youtubeDlExec, { create as createYoutubeDl } from "youtube-dl-exec";
import {
  createWriteStream,
  readFileSync,
  unlinkSync,
  existsSync,
  readdirSync,
  statSync,
  chmodSync,
  writeFileSync,
} from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { platform, arch } from "os";

// YouTube URL validation regex
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;

/**
 * Validate YouTube URL
 */
function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_REGEX.test(url);
}

/**
 * Download yt-dlp binary directly from GitHub releases
 * This is a fallback for serverless environments where postinstall scripts don't work
 */
async function downloadYtDlpBinary(targetPath: string): Promise<void> {
  const osPlatform = platform();
  const osArch = arch();

  // Determine the binary name and platform identifier
  let platformId: string;
  let binaryName: string;

  if (osPlatform === "linux") {
    if (osArch === "x64") {
      platformId = "linux";
      binaryName = "yt-dlp";
    } else if (osArch === "arm64") {
      platformId = "linux_aarch64";
      binaryName = "yt-dlp";
    } else {
      throw new Error(`Unsupported Linux architecture: ${osArch}`);
    }
  } else if (osPlatform === "darwin") {
    if (osArch === "x64") {
      platformId = "macos";
      binaryName = "yt-dlp";
    } else if (osArch === "arm64") {
      platformId = "macos_legacy";
      binaryName = "yt-dlp";
    } else {
      throw new Error(`Unsupported macOS architecture: ${osArch}`);
    }
  } else {
    throw new Error(`Unsupported platform: ${osPlatform}`);
  }

  // Get latest release from GitHub
  const releaseUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_${platformId}`;

  console.log(`📥 Downloading yt-dlp from: ${releaseUrl}`);

  try {
    const response = await fetch(releaseUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download: ${response.status} ${response.statusText}`
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(targetPath, buffer);
    chmodSync(targetPath, 0o755); // Make executable
    console.log(`✅ yt-dlp binary downloaded to: ${targetPath}`);
  } catch (error) {
    console.error("❌ Failed to download yt-dlp binary:", error);
    throw error;
  }
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

      // First, try using the postinstall script if available
      if (postinstallExists) {
        try {
          execSync(`node "${postinstallScript}"`, {
            stdio: "inherit",
            cwd: packageDir,
          });
          console.log("✅ Binary downloaded via postinstall script");

          // Verify it was created
          if (existsSync(binPath)) {
            // Success, continue
          } else {
            throw new Error("Binary was not created after postinstall");
          }
        } catch (postinstallError: any) {
          console.warn(
            "⚠️ Postinstall script failed, trying direct download:",
            postinstallError.message
          );
          // Fall through to direct download
        }
      }

      // If still not found, download directly from GitHub
      if (!existsSync(binPath)) {
        try {
          // In serverless environments, always use /tmp since node_modules is read-only
          // Check if we're in a serverless environment (Vercel uses /var/task)
          const isServerless = process.cwd().includes("/var/task");

          if (isServerless) {
            // Always use /tmp in serverless environments - skip trying node_modules
            binPath = join(tmpdir(), "yt-dlp");
            console.log(
              `⚠️ Serverless environment detected, using temp directory: ${binPath}`
            );
          } else {
            // Try to create bin directory in package location
            const binDir = dirname(binPath);
            if (!existsSync(binDir)) {
              try {
                execSync(`mkdir -p "${binDir}"`, { stdio: "inherit" });
                console.log(`✅ Created bin directory: ${binDir}`);
              } catch (mkdirError: any) {
                // If we can't create the bin directory, use /tmp
                console.warn(
                  `⚠️ Cannot create bin directory (${mkdirError.message}), using temp directory`
                );
                binPath = join(tmpdir(), "yt-dlp");
                console.log(`⚠️ Using temp directory for binary: ${binPath}`);
              }
            }
          }

          await downloadYtDlpBinary(binPath);

          // Verify it was created
          if (!existsSync(binPath)) {
            throw new Error("Binary was not created after direct download");
          }

          console.log(`✅ Binary ready at: ${binPath}`);
        } catch (downloadError: any) {
          console.error("❌ Failed to download binary:", downloadError);
          return NextResponse.json(
            {
              error: `yt-dlp binary not found and could not be downloaded: ${downloadError.message}. The YouTube download feature requires yt-dlp to be available.`,
            },
            { status: 500 }
          );
        }
      }
    }

    // Store the final binPath for use with youtube-dl-exec
    // This will be the path we actually use, whether from package or /tmp
    const finalBinPath = binPath;

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
      console.log("📊 Using binary at:", finalBinPath);
      console.log("📊 Binary exists:", existsSync(finalBinPath));

      // Create a custom youtube-dl-exec instance with our binary path if needed
      const execOptions = {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        addHeader: ["referer:youtube.com", "user-agent:Mozilla/5.0"],
      };

      // If binary is in /tmp or not in node_modules, use create() to specify custom path
      let execFunction;
      if (
        finalBinPath &&
        (finalBinPath.includes("/tmp") ||
          !finalBinPath.includes("node_modules"))
      ) {
        console.log(
          "📊 Creating custom youtube-dl-exec instance with path:",
          finalBinPath
        );
        execFunction = createYoutubeDl(finalBinPath);
      } else {
        execFunction = youtubeDlExec;
      }

      const infoResult = await execFunction(url, execOptions);

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
      console.log("🎵 Output path:", audioFilePath);

      const downloadOptions = {
        extractAudio: true,
        audioFormat: "m4a",
        output: audioFilePath,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        addHeader: ["referer:youtube.com", "user-agent:Mozilla/5.0"],
      };

      // Use the same execFunction we created earlier (with custom binary if needed)
      await execFunction(url, downloadOptions);

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
      console.error("❌ Error details:", {
        message: error?.message,
        stack: error?.stack,
        code: error?.code,
        statusCode: error?.statusCode,
        stderr: error?.stderr?.toString?.() || error?.stderr,
        stdout: error?.stdout?.toString?.() || error?.stdout,
      });

      // Handle specific error cases
      const errorMessage =
        error?.message || error?.toString() || "Unknown error";

      if (
        errorMessage.includes("Private video") ||
        errorMessage.includes("unavailable") ||
        errorMessage.includes("Video unavailable") ||
        errorMessage.includes("Video is private")
      ) {
        return NextResponse.json(
          { error: "This video is private or unavailable" },
          { status: 404 }
        );
      }

      if (errorMessage.includes("403") || error?.statusCode === 403) {
        return NextResponse.json(
          {
            error:
              "Access denied. The video may be restricted or unavailable in your region.",
          },
          { status: 403 }
        );
      }

      if (errorMessage.includes("yt-dlp") || errorMessage.includes("binary")) {
        return NextResponse.json(
          {
            error: `yt-dlp error: ${errorMessage}. Please check the server logs for details.`,
          },
          { status: 500 }
        );
      }

      // Return more detailed error message
      return NextResponse.json(
        {
          error: `Failed to download video: ${errorMessage}. Check server logs for more details.`,
          details:
            process.env.NODE_ENV === "development"
              ? {
                  stack: error?.stack,
                  code: error?.code,
                }
              : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ YouTube download error:", error);
    console.error("❌ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
