"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Upload,
  Scissors,
  Play,
  AlertCircle,
  AudioLines,
  Library,
  LogIn,
  UserPlus,
  Youtube,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { AudioEditor } from "@/components/audio/AudioEditor";
import { UserMenu } from "@/components/auth/UserMenu";
import { AuthModal } from "@/components/auth/AuthModal";
import { UploadModal } from "@/components/upload/UploadModal";
import { useAuth } from "@/lib/auth";
import {
  convertAudioToCompatibleFormat,
  needsConversion,
} from "@/lib/audio/convert-audio";

type InputMode = "file" | "youtube";

export default function ClipCreatorPage() {
  const { user, isLoading, getAuthHeaders } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("file");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeCookies, setYoutubeCookies] = useState("");
  const [showCookieHelp, setShowCookieHelp] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const openAuthModal = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 100 * 1024 * 1024; // 100MB for source files
    const supportedFormats = ["mp3", "wav", "m4a", "ogg", "webm"];

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !supportedFormats.includes(extension)) {
      setFileError(
        `Unsupported format. Supported: ${supportedFormats.join(", ")}`
      );
      return;
    }

    if (file.size > maxSize) {
      setFileError("File too large. Maximum size is 100MB.");
      return;
    }

    // Verify audio file is readable (no duration limit for local processing)
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);

    audio.addEventListener("loadedmetadata", () => {
      setSelectedFile(file);
      setFileError(null);
      URL.revokeObjectURL(objectUrl);
    });

    audio.addEventListener("error", () => {
      setFileError("Could not read audio file. Please try a different file.");
      URL.revokeObjectURL(objectUrl);
    });

    audio.src = objectUrl;
  };

  const handleNewFile = () => {
    setSelectedFile(null);
    setSourceUrl("");
    setFileError(null);
    setYoutubeUrl("");
  };

  const handleYouTubeDownload = async () => {
    if (!youtubeUrl.trim() || !user) return;

    setDownloading(true);
    setFileError(null);

    try {
      const response = await fetch("/api/youtube/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          url: youtubeUrl.trim(),
          cookies: youtubeCookies.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to download YouTube video");
      }

      const data = await response.json();

      // Validate response
      if (!data.audio || !data.audio.data) {
        throw new Error("Invalid response: missing audio data");
      }

      console.log("📥 YouTube download response:", {
        filename: data.audio.filename,
        mimeType: data.audio.mimeType,
        size: data.audio.size,
        dataLength: data.audio.data.length,
      });

      // Convert base64 audio to File object
      try {
        const audioData = Uint8Array.from(atob(data.audio.data), (c) =>
          c.charCodeAt(0)
        );
        console.log("✅ Decoded audio data:", audioData.length, "bytes");

        const audioBlob = new Blob([audioData], { type: data.audio.mimeType });
        console.log(
          "✅ Created blob:",
          audioBlob.size,
          "bytes, type:",
          audioBlob.type
        );

        let audioFile = new File([audioBlob], data.audio.filename, {
          type: data.audio.mimeType,
        });
        console.log(
          "✅ Created file:",
          audioFile.name,
          audioFile.size,
          "bytes, type:",
          audioFile.type
        );

        // Check if conversion is needed (MP4 container formats)
        const shouldConvert =
          data.needsConversion ||
          needsConversion(audioFile.name, audioFile.type);

        if (shouldConvert) {
          console.log(
            "🔄 MP4 file detected, converting to browser-compatible format..."
          );
          setConverting(true);
          setConversionProgress(0);

          try {
            const convertedFile = await convertAudioToCompatibleFormat(
              audioFile,
              {
                onProgress: (progress) => {
                  setConversionProgress(progress);
                },
              }
            );

            console.log(
              "✅ Conversion complete:",
              audioFile.name,
              "→",
              convertedFile.name
            );
            audioFile = convertedFile; // Use converted file instead
          } catch (conversionError) {
            console.error("❌ Conversion failed:", conversionError);
            // If conversion fails, we'll still try to use the original file
            // The AudioEditor will show an error if it can't load it
            setFileError(
              "Downloaded successfully, but conversion failed. The file may not work in your browser. " +
                (conversionError instanceof Error
                  ? conversionError.message
                  : "Unknown error")
            );
          } finally {
            setConverting(false);
            setConversionProgress(0);
          }
        }

        setSelectedFile(audioFile);
        // Store the YouTube URL as the source URL for extracted clips
        setSourceUrl(data.videoInfo?.url || youtubeUrl.trim());
        if (!shouldConvert || !fileError) {
          setFileError(null);
        }
      } catch (decodeError) {
        console.error("❌ Failed to decode audio data:", decodeError);
        throw new Error(
          `Failed to decode audio: ${
            decodeError instanceof Error ? decodeError.message : "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("YouTube download error:", error);
      setFileError(
        error instanceof Error
          ? error.message
          : "Failed to download YouTube video"
      );
    } finally {
      setDownloading(false);
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Sign In Required
            </h1>
            <p className="text-gray-600 mb-6">
              You need to be signed in to create audio clips.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header with Auth */}
      <header className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <AudioLines className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Chorus Lab</h1>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <>
                <Link
                  href="/library"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Library className="w-4 h-4" />
                  Clip Library
                </Link>
                <Link
                  href="/clip-creator"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Scissors className="w-4 h-4" />
                  Clip Creator
                </Link>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Clip
                </button>
                {selectedFile && (
                  <button
                    onClick={handleNewFile}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <Upload className="w-4 h-4" />
                    Load New File
                  </button>
                )}
              </>
            )}

            {isLoading ? (
              <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
            ) : user ? (
              <UserMenu />
            ) : (
              <>
                <button
                  onClick={() => openAuthModal("login")}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button
                  onClick={() => openAuthModal("register")}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          {!selectedFile ? (
            /* File Upload Area */
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Create Audio Clips
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Load an audio file or YouTube video to extract short clips
                  perfect for chorusing practice. Select regions from longer
                  recordings and save them with metadata.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="max-w-md mx-auto mb-6">
                <div className="flex rounded-lg bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setInputMode("file")}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      inputMode === "file"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("youtube")}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      inputMode === "youtube"
                        ? "bg-white text-indigo-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    YouTube URL
                  </button>
                </div>
              </div>

              <div className="max-w-md mx-auto">
                {inputMode === "file" ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Audio File
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        accept=".mp3,.wav,.m4a,.ogg,.webm"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="audio-file-input"
                      />

                      <div>
                        <Play className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <label
                          htmlFor="audio-file-input"
                          className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Choose audio file
                        </label>
                        <p className="text-sm text-gray-500 mt-2">
                          MP3, WAV, M4A, OGG, WebM (max 100MB)
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube Video URL
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Youtube className="w-5 h-5 text-red-600" />
                        <input
                          type="url"
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          disabled={downloading}
                        />
                      </div>

                      {/* Cookie input (optional) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700">
                            Cookies (Optional - improves success rate)
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowCookieHelp(!showCookieHelp)}
                            className="text-xs text-indigo-600 hover:text-indigo-700"
                          >
                            {showCookieHelp ? "Hide" : "How?"}
                          </button>
                        </div>
                        {showCookieHelp && (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                            <p className="font-medium mb-2">
                              How to export YouTube cookies:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                              <li>
                                Install a browser extension like &quot;Get
                                cookies.txt LOCALLY&quot; (Chrome/Edge) or
                                &quot;cookies.txt&quot; (Firefox)
                              </li>
                              <li>
                                Go to youtube.com and make sure you&apos;re
                                logged in
                              </li>
                              <li>
                                Click the extension icon and export cookies for
                                youtube.com
                              </li>
                              <li>Paste the cookies content here</li>
                            </ol>
                            <p className="mt-2 text-xs">
                              Cookies help avoid YouTube&apos;s bot detection.
                              They&apos;re only used for downloading and
                              aren&apos;t stored.
                            </p>
                          </div>
                        )}
                        <textarea
                          value={youtubeCookies}
                          onChange={(e) => setYoutubeCookies(e.target.value)}
                          placeholder="Paste Netscape format cookies here (optional)"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                          disabled={downloading}
                        />
                      </div>

                      <button
                        onClick={handleYouTubeDownload}
                        disabled={
                          !youtubeUrl.trim() || downloading || converting
                        }
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {converting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Converting... {Math.round(conversionProgress)}%
                          </>
                        ) : downloading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Youtube className="w-4 h-4" />
                            Download Audio
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {fileError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{fileError}</span>
                  </div>
                )}
              </div>

              <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Load Audio
                  </h3>
                  <p className="text-sm text-gray-600">
                    Upload your audio file locally (no server upload until you
                    save a clip)
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Scissors className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Select Region
                  </h3>
                  <p className="text-sm text-gray-600">
                    Click and drag to select the perfect clip, then fine-tune
                    with keyboard shortcuts
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Play className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Extract & Save
                  </h3>
                  <p className="text-sm text-gray-600">
                    Add metadata and save your clip to the library for chorusing
                    practice
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Audio Editor */
            <AudioEditor file={selectedFile} sourceUrl={sourceUrl} />
          )}
        </div>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />

      {user && (
        <UploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {}}
        />
      )}
    </main>
  );
}
