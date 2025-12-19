"use client";

import { useState, Suspense } from "react";
import { AudioLines, LogIn, UserPlus, Upload, Scissors } from "lucide-react";
import Link from "next/link";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserMenu } from "@/components/auth/UserMenu";
import { UploadModal } from "@/components/upload/UploadModal";
import { AudioBrowser } from "@/components/browse/AudioBrowser";
import { useAuth } from "@/lib/auth";

export default function LibraryPage() {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [refreshBrowser, setRefreshBrowser] = useState(0);

  const openAuthModal = (mode: "login" | "register") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleUploadSuccess = () => {
    setRefreshBrowser((prev) => prev + 1);
  };

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
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
            <Suspense
              fallback={
                <div className="text-center py-8">Loading audio library...</div>
              }
            >
              <AudioBrowser
                key={`${refreshBrowser}-${user?.id}`}
                onRefresh={() => setRefreshBrowser((prev) => prev + 1)}
              />
            </Suspense>
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
