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
    const { url, cookies } = body;

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

    // Handle cookies if provided
    let cookiesFilePath: string | undefined;
    if (cookies && typeof cookies === "string" && cookies.trim()) {
      try {
        cookiesFilePath = join(tempDir, `cookies-${timestamp}.txt`);
        writeFileSync(cookiesFilePath, cookies.trim());
        console.log("🍪 Using provided cookies file");
      } catch (cookieError: any) {
        console.warn("⚠️ Failed to write cookies file:", cookieError.message);
        // Continue without cookies
      }
    }

    let videoTitle = "";
    let videoDuration = 0;
    let audioBuffer: Buffer;

    try {
      // First, get video info
      console.log("📊 Getting video info...");
      console.log("📊 Using binary at:", finalBinPath);
      console.log("📊 Binary exists:", existsSync(finalBinPath));

      // Create a custom youtube-dl-exec instance with our binary path if needed
      // Use more realistic browser headers to avoid bot detection
      const execOptions: any = {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        addHeader: [
          "referer:https://www.youtube.com/",
          "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language:en-US,en;q=0.5",
        ],
        // Additional options to reduce bot detection
        noPlaylist: true,
      };

      // Add cookies if provided (yt-dlp uses --cookies option)
      if (cookiesFilePath && existsSync(cookiesFilePath)) {
        execOptions.cookies = cookiesFilePath;
        console.log("🍪 Using cookies for authentication");
      }

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

      const downloadOptions: any = {
        // Use format selection to get audio-only without needing ffmpeg
        // Prefer audio formats that browsers can play directly
        // M4A (AAC) is most compatible, then MP3, then WebM
        format:
          "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio[ext=webm]/bestaudio/best[height<=480]",
        // Use output template to ensure we get the right extension
        output: join(tempDir, `audio-${timestamp}.%(ext)s`),
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        addHeader: [
          "referer:https://www.youtube.com/",
          "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language:en-US,en;q=0.5",
        ],
        // Additional options to reduce bot detection
        noPlaylist: true,
        // Skip post-processing to avoid needing ffmpeg
        postprocessorArgs: "ffmpeg:-vn", // Extract audio only if ffmpeg is available, but don't fail if not
      };

      // Add cookies if provided (yt-dlp uses --cookies option)
      if (cookiesFilePath && existsSync(cookiesFilePath)) {
        downloadOptions.cookies = cookiesFilePath;
      }

      // Use the same execFunction we created earlier (with custom binary if needed)
      await execFunction(url, downloadOptions);

      // Read the audio file - yt-dlp uses output template with %(ext)s
      // So the actual file will have the format's extension
      // Find the file that was actually created
      let actualAudioFile: string | null = null;

      // Check for files matching our timestamp pattern
      const tempFiles = readdirSync(tempDir);
      const audioFile = tempFiles.find((f) =>
        f.startsWith(`audio-${timestamp}`)
      );

      if (audioFile) {
        actualAudioFile = join(tempDir, audioFile);
        console.log("📁 Found downloaded file:", actualAudioFile);
      } else {
        // Fallback: look for any recent audio file
        const audioFiles = tempFiles.filter((f) =>
          /\.(m4a|webm|mp3|ogg|opus|m4a)$/i.test(f)
        );
        if (audioFiles.length > 0) {
          // Get the most recently modified
          const filesWithStats = audioFiles.map((f) => ({
            name: f,
            path: join(tempDir, f),
            mtime: statSync(join(tempDir, f)).mtime.getTime(),
          }));
          filesWithStats.sort((a, b) => b.mtime - a.mtime);
          actualAudioFile = filesWithStats[0].path;
          console.log("📁 Found audio file (fallback):", actualAudioFile);
        }
      }

      if (!actualAudioFile || !existsSync(actualAudioFile)) {
        console.error(
          "❌ No audio file found. Temp directory contents:",
          tempFiles
        );
        throw new Error(
          "Downloaded audio file not found. yt-dlp may have failed to download the file."
        );
      }

      audioBuffer = readFileSync(actualAudioFile);
      console.log("✅ Audio downloaded:", audioBuffer.length, "bytes");

      // Get the actual file extension
      const actualExt = actualAudioFile.split(".").pop()?.toLowerCase() || "mp3";
      
      // Validate that we got an audio-only format (not video MP4)
      // MP4 files often have metadata issues, prefer other formats
      if (actualExt === "mp4" || actualExt === "m4v") {
        console.warn("⚠️ Got MP4 file which may have metadata issues. File:", actualAudioFile);
        // We'll still try to use it, but log a warning
      }

      // Clean up audio file
      try {
        unlinkSync(actualAudioFile);
      } catch (e) {
        console.warn("⚠️ Could not delete temp audio file:", e);
      }

      // Determine filename with correct extension
      const filename = `${videoTitle.replace(
        /[^a-zA-Z0-9\-_]/g,
        "_"
      )}.${actualExt}`;

      // Determine MIME type based on extension
      const mimeTypes: Record<string, string> = {
        mp3: "audio/mpeg",
        webm: "audio/webm",
        m4a: "audio/mp4",
        ogg: "audio/ogg",
        opus: "audio/opus",
        // Avoid using video MIME types
        mp4: "audio/mp4", // This might still fail, but it's what we have
        m4v: "audio/mp4",
      };
      const mimeType = mimeTypes[actualExt] || "audio/mpeg";
      
      console.log("📦 Final audio file info:", {
        extension: actualExt,
        mimeType,
        filename,
        size: audioBuffer.length,
      });

      // Convert buffer to base64 for JSON response
      const audioBase64 = audioBuffer.toString("base64");

      return NextResponse.json({
        success: true,
        audio: {
          data: audioBase64,
          filename,
          mimeType,
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
        if (existsSync(audioFilePath)) {
          unlinkSync(audioFilePath);
        }
        if (cookiesFilePath && existsSync(cookiesFilePath)) {
          unlinkSync(cookiesFilePath);
        }
      } catch (e) {
        // Ignore cleanup errors
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

      // Handle YouTube bot detection
      if (
        errorMessage.includes("Sign in to confirm you're not a bot") ||
        errorMessage.includes("bot") ||
        errorMessage.includes("cookies")
      ) {
        return NextResponse.json(
          {
            error:
              "YouTube is blocking this request. The video may require authentication or may be temporarily unavailable. Please try again later or use a different video.",
          },
          { status: 403 }
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
