'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Update mode when initialMode changes or when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  const toggleMode = () => {
    setMode(prev => prev === 'login' ? 'register' : 'login');
  };

  const handleSuccess = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === 'login' ? 'Welcome Back' : 'Join Chorus Lab'}
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
          {mode === 'login' ? (
            <LoginForm onToggleMode={toggleMode} onSuccess={handleSuccess} />
          ) : (
            <RegisterForm onToggleMode={toggleMode} onSuccess={handleSuccess} />
          )}
        </div>
      </div>
    </div>
  );
}