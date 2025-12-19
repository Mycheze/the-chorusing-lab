"use client";

import { useState } from "react";
import {
  AudioLines,
  LogIn,
  UserPlus,
  Upload,
  Library,
  Mic,
  Activity,
  Zap,
  BookOpen,
  Scissors,
} from "lucide-react";
import Link from "next/link";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserMenu } from "@/components/auth/UserMenu";
import { UploadModal } from "@/components/upload/UploadModal";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const openAuthModal = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleUploadSuccess = () => {
    // Upload success handled by modal
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header with Auth */}
      <header className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AudioLines className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Chorus Lab</h1>
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
          {/* Hero Section */}
          <div className="text-center mb-12 mt-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Master Languages Through Chorusing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
              Practice pronunciation and listening skills with short audio
              clips. Repeat, perfect, and progress through the most effective
              language learning technique.
            </p>

            {!user && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => openAuthModal("register")}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium"
                >
                  Chorus for Free!
                </button>
                <Link
                  href="/library"
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium"
                >
                  Explore Library
                </Link>
              </div>
            )}
          </div>

          {/* Content Sections */}
          <div>
            <>
              {/* What is Chorusing */}
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                  What is Chorusing?
                </h2>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mic className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Listen</h3>
                    <p className="text-gray-600">
                      Play short audio clips (2-10 seconds) from native speakers
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Activity className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Repeat</h3>
                    <p className="text-gray-600">
                      Practice along with the audio to match rhythm and
                      pronunciation
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Master</h3>
                    <p className="text-gray-600">
                      Develop natural pronunciation and listening comprehension
                    </p>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-semibold text-indigo-900 mb-2">
                    Why Chorusing Works
                  </h4>
                  <p className="text-indigo-800">
                    By practicing with short, focused clips, you train your ear
                    and mouth together. This technique helps you internalize the
                    natural rhythm, stress patterns, and pronunciation of your
                    target language more effectively than traditional methods.
                  </p>
                </div>
              </div>

              {/* Getting Started */}
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Getting Started
                </h2>

                {user ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900">
                        Ready to practice!
                      </h3>
                      <p className="text-gray-600">
                        You&apos;re all set up. Here&apos;s what you can do:
                      </p>
                      <div className="space-y-3">
                        <Link
                          href="/library"
                          className="flex items-center gap-3 w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <Library className="w-5 h-5 text-indigo-600" />
                          <div>
                            <div className="font-medium">
                              Browse Audio Library
                            </div>
                            <div className="text-sm text-gray-600">
                              Explore clips from other learners
                            </div>
                          </div>
                        </Link>

                        <button
                          onClick={() => setUploadModalOpen(true)}
                          className="flex items-center gap-3 w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <Upload className="w-5 h-5 text-green-600" />
                          <div>
                            <div className="font-medium">
                              Upload Your First Clip
                            </div>
                            <div className="text-sm text-gray-600">
                              Add audio clips to practice with
                            </div>
                          </div>
                        </button>

                        <Link
                          href="/clip-creator"
                          className="flex items-center gap-3 w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <Scissors className="w-5 h-5 text-purple-600" />
                          <div>
                            <div className="font-medium">
                              Extract Clips from Long Files
                            </div>
                            <div className="text-sm text-gray-600">
                              Turn podcasts and lectures into practice clips
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-2">
                        Pro Tips
                      </h4>
                      <ul className="text-sm text-green-800 space-y-2">
                        <li>• Start with 3-5 second clips for best results</li>
                        <li>
                          • Focus on challenging sounds in your target language
                        </li>
                        <li>
                          • Practice the same clip multiple times in a row
                        </li>
                        <li>
                          • Use native speaker audio for authentic pronunciation
                        </li>
                        <li>• Tag your clips for easy organization</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center p-6 border border-gray-200 rounded-lg">
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-6 h-6 text-indigo-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        1. Sign Up
                      </h3>
                      <p className="text-gray-600 text-sm mb-4">
                        Create your free account to get started
                      </p>
                      <button
                        onClick={() => openAuthModal("register")}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                      >
                        Create Account
                      </button>
                    </div>

                    <div className="text-center p-6 border border-gray-200 rounded-lg">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        2. Upload Clips
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Add short audio clips to practice with
                      </p>
                    </div>

                    <div className="text-center p-6 border border-gray-200 rounded-lg">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <Mic className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        3. Start Practicing
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Listen, repeat, and improve your pronunciation
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          </div>
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
          onSuccess={handleUploadSuccess}
        />
      )}
    </main>
  );
}
