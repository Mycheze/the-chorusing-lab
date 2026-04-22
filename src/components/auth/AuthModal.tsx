'use client';

import { X, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login } = useAuth();
  const isDev = process.env.NODE_ENV === 'development';

  if (!isOpen) return null;

  const handleDevLogin = async () => {
    await fetch('/api/auth/dev-login', { method: 'POST', credentials: 'include' });
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            Sign in to Chorus Lab
          </h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 text-center mb-6">
            Use your Refold account to sign in.
          </p>
          <button
            onClick={() => login()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium"
          >
            <LogIn className="w-5 h-5" />
            Log in with Refold
          </button>
          {isDev && (
            <button
              onClick={handleDevLogin}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
            >
              Dev Admin Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
