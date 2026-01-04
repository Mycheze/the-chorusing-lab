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
} from "lucide-react";
import Link from "next/link";
import { AudioEditor } from "@/components/audio/AudioEditor";
import { UserMenu } from "@/components/auth/UserMenu";
import { AuthModal } from "@/components/auth/AuthModal";
import { UploadModal } from "@/components/upload/UploadModal";
import { useAuth } from "@/lib/auth";

export default function ClipCreatorPage() {
  const { user, isLoading, getAuthHeaders } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const openAuthModal = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const processFile = (file: File) => {
    // Validate file
    const supportedFormats = ["mp3", "wav", "m4a", "ogg", "webm"];

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !supportedFormats.includes(extension)) {
      setFileError(
        `Unsupported format. Supported: ${supportedFormats.join(", ")}`
      );
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleNewFile = () => {
    setSelectedFile(null);
    setSourceUrl("");
    setFileError(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      processFile(file);
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
            <>
              {/* File Upload Area */}
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Create Audio Clips
                  </h2>
                  <p className="text-gray-600 max-w-2xl mx-auto">
                    Load an audio file to extract short clips perfect for chorusing practice. 
                    Select regions from longer recordings and save them with metadata.
                  </p>
                </div>

                <div className="max-w-md mx-auto">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Audio File
                  </label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
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
                        MP3, WAV, M4A, OGG, WebM
                      </p>
                    </div>
                  </div>

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

              {/* Download Instructions */}
              <div className="mt-8 max-w-4xl mx-auto bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  How to Download Audio
                </h3>
                <div className="space-y-4 text-sm text-gray-700">
                  <p>
                    Audio can be downloaded from a few sources. The easiest are podcasts, since their audio is very easy to find and download. Check out this website (
                    <a 
                      href="https://podcasttomp3.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 underline"
                    >
                      https://podcasttomp3.com/
                    </a>
                    ) to download audio. Search for the podcast, choose an episode and click download!
                  </p>
                  <p>
                    YouTube videos can also be a good source of audio, but downloading YouTube videos is much more difficult. It&apos;s a sensitive subject for YouTube as downloading videos can break copyright. But as you&apos;re using the audio for personal, educational purposes, you don&apos;t need to worry.
                  </p>
                  <p>
                    The best tool for downloading YouTube videos is called yt-dlp. It&apos;s freely available here:{" "}
                    <a 
                      href="https://github.com/yt-dlp/yt-dlp" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 underline"
                    >
                      https://github.com/yt-dlp/yt-dlp
                    </a>
                  </p>
                  <p>
                    Or, you can try your luck searching for &quot;YouTube audio downloader&quot; or &quot;YouTube to mp3.&quot; These sites periodically get taken down, but there are always new ones you can find. They often have ads or other money making techniques on them, so use at your own risk. Downloading audio from podcasts is much safer and easier.
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                  <a
                    href="https://podcasttomp3.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                  >
                    Download podcast audio
                  </a>
                  <a
                    href="https://github.com/yt-dlp/yt-dlp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                  >
                    yt-dlp Github page
                  </a>
                  <a
                    href="https://duckduckgo.com/?origin=funnel_home_website&t=h_&q=youtube+audio+downloader+mp3&ia=web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                  >
                    Search for web downloader
                  </a>
                </div>
              </div>
            </>
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
