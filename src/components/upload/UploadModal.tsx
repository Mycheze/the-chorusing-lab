'use client';

import { useState, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle, Music } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import type { AudioMetadata } from '@/types/audio';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface UploadFormData {
  title: string;
  duration: string; // kept for compatibility but not used
  language: string;
  speakerGender: 'male' | 'female' | 'other' | '';
  speakerAgeRange: 'teen' | 'younger-adult' | 'adult' | 'senior' | '';
  speakerDialect: string;
  transcript: string;
  sourceUrl: string;
  tags: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB - increased from 1MB
const SUPPORTED_FORMATS = ['mp3', 'wav', 'm4a', 'ogg', 'webm'];

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const { user, getAuthHeaders } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UploadFormData>({
    title: '',
    duration: '',
    language: '', // No default language selected
    speakerGender: '',
    speakerAgeRange: '',
    speakerDialect: '',
    transcript: '',
    sourceUrl: '',
    tags: '',
  });

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`;
    }

    // Check file format by extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
      return `Unsupported format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`;
    }

    // Check for format mismatches by MIME type
    const expectedMimeTypes: Record<string, string[]> = {
      'mp3': ['audio/mpeg', 'audio/mp3'],
      'wav': ['audio/wav', 'audio/wave'],
      'm4a': ['audio/m4a', 'audio/mp4', 'audio/x-m4a'],
      'ogg': ['audio/ogg'],
      'webm': ['audio/webm']
    };

    const allowedMimeTypes = expectedMimeTypes[extension];
    if (allowedMimeTypes && !allowedMimeTypes.includes(file.type)) {
      return `Format mismatch: File has .${extension} extension but is actually ${file.type}. Please convert to proper ${extension.toUpperCase()} format or rename with correct extension.`;
    }

    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('🔍 FILE DEBUG START');
    console.log('File name:', file.name);
    console.log('File size:', file.size);
    console.log('File type:', file.type);
    console.log('File lastModified:', file.lastModified);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      setCalculatedDuration(null);
      return;
    }

    setSelectedFile(file);
    setError(null);
    
    // Auto-fill title from filename if empty
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setFormData(prev => ({ ...prev, title: nameWithoutExt }));
    }

    // Calculate duration with extensive debugging
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    
    console.log('🎵 Object URL created:', objectUrl);
    
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      console.log('🧹 Object URL cleaned up');
    };
    
    const timeout = setTimeout(() => {
      console.log('⏰ TIMEOUT: Audio loading took too long');
      cleanup();
      setError('Timeout: Could not load audio file within 10 seconds.');
      setCalculatedDuration(null);
    }, 10000);
    
    // Add all possible event listeners for debugging
    audio.addEventListener('loadstart', () => {
      console.log('📥 loadstart: Started loading audio');
    });
    
    audio.addEventListener('durationchange', () => {
      console.log('⏱️ durationchange: Duration changed to:', audio.duration);
    });
    
    audio.addEventListener('loadedmetadata', () => {
      console.log('📊 loadedmetadata event fired');
      console.log('  - duration:', audio.duration);
      console.log('  - duration type:', typeof audio.duration);
      console.log('  - isNaN(duration):', isNaN(audio.duration));
      console.log('  - isFinite(duration):', isFinite(audio.duration));
      console.log('  - duration > 0:', audio.duration > 0);
      console.log('  - readyState:', audio.readyState);
      console.log('  - networkState:', audio.networkState);
      
      clearTimeout(timeout);
      cleanup();
      
      const duration = audio.duration;
      
      // More detailed validation with logging
      if (!duration) {
        console.log('❌ Duration is falsy:', duration);
        setError('Audio duration is falsy. File may have no audio content.');
        setCalculatedDuration(null);
        return;
      }
      
      if (isNaN(duration)) {
        console.log('❌ Duration is NaN:', duration);
        setError('Audio duration is NaN. File metadata may be corrupted.');
        setCalculatedDuration(null);
        return;
      }
      
      if (!isFinite(duration)) {
        console.log('❌ Duration is not finite (Infinity or -Infinity):', duration);
        setError('Audio duration is infinite. File may have streaming/live content or corrupted metadata.');
        setCalculatedDuration(null);
        return;
      }
      
      if (duration <= 0) {
        console.log('❌ Duration is zero or negative:', duration);
        setError('Audio duration is zero or negative. File may be empty or corrupted.');
        setCalculatedDuration(null);
        return;
      }
      
      if (duration > 300) {
        console.log('❌ Duration too long:', duration);
        setError('Audio file too long. Maximum duration is 5 minutes for direct uploads. Use Clip Creator for longer files.');
        setCalculatedDuration(null);
        return;
      }
      
      console.log('✅ Duration validation passed:', duration);
      setCalculatedDuration(duration);
    });

    audio.addEventListener('loadeddata', () => {
      console.log('📥 loadeddata: First frame loaded');
    });

    audio.addEventListener('canplay', () => {
      console.log('▶️ canplay: Can start playing');
    });

    audio.addEventListener('canplaythrough', () => {
      console.log('▶️ canplaythrough: Can play without stopping');
    });

    audio.addEventListener('error', (e) => {
      console.log('❌ Audio error event:', e);
      console.log('Error details:', audio.error);
      if (audio.error) {
        console.log('  - code:', audio.error.code);
        console.log('  - message:', audio.error.message);
      }
      
      clearTimeout(timeout);
      cleanup();
      setError(`Audio error: ${audio.error?.message || 'Unknown error'}. File may be corrupted or unsupported.`);
      setCalculatedDuration(null);
    });

    audio.addEventListener('abort', () => {
      console.log('🛑 Audio loading aborted');
    });

    audio.addEventListener('stalled', () => {
      console.log('⏸️ Audio loading stalled');
    });

    audio.addEventListener('suspend', () => {
      console.log('⏸️ Audio loading suspended');
    });

    console.log('🎵 Setting audio source to:', objectUrl);
    audio.src = objectUrl;
    console.log('🔍 FILE DEBUG END');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = (language: string) => {
    setFormData(prev => ({ ...prev, language }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !user) return;

    // Validate required fields
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.language.trim()) {
      setError('Language is required');
      return;
    }

    if (!calculatedDuration || calculatedDuration <= 0 || isNaN(calculatedDuration) || !isFinite(calculatedDuration)) {
      setError('Could not determine audio duration. Please try a different file.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Prepare form data for upload
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('title', formData.title.trim());
      
      // Ensure duration is valid
      const finalDuration = calculatedDuration || 0;
      if (finalDuration <= 0 || isNaN(finalDuration) || !isFinite(finalDuration)) {
        setError('Invalid audio duration. Please try a different file.');
        return;
      }
      
      uploadFormData.append('duration', finalDuration.toString());
      uploadFormData.append('language', formData.language);
      uploadFormData.append('speakerGender', formData.speakerGender);
      uploadFormData.append('speakerAgeRange', formData.speakerAgeRange);
      uploadFormData.append('speakerDialect', formData.speakerDialect.trim());
      uploadFormData.append('transcript', formData.transcript.trim());
      uploadFormData.append('sourceUrl', formData.sourceUrl.trim());
      uploadFormData.append('tags', formData.tags.trim());

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      // Success!
      onSuccess?.();
      onClose();
      resetForm();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setCalculatedDuration(null);
    setFormData({
      title: '',
      duration: '',
      language: '',
      speakerGender: '',
      speakerAgeRange: '',
      speakerDialect: '',
      transcript: '',
      sourceUrl: '',
      tags: '',
    });
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Audio Clip
          </h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.webm"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      {calculatedDuration && (
                        <span> • {calculatedDuration.toFixed(1)}s</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Choose audio file
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    MP3, WAV, M4A, OGG, WebM (max 2MB)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    💡 For longer files, use the Clip Creator to extract shorter segments
                  </p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Basic Info */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter clip title"
            />
            {calculatedDuration && (
              <p className="text-xs text-gray-500 mt-1">Duration: {calculatedDuration.toFixed(1)} seconds</p>
            )}
          </div>

          {/* Language */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
              Language *
            </label>
            <LanguageSelector
              value={formData.language}
              onChange={handleLanguageChange}
              required
              className="w-full"
            />
          </div>

          {/* Speaker Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="speakerGender" className="block text-sm font-medium text-gray-700 mb-1">
                Speaker Gender
              </label>
              <select
                id="speakerGender"
                name="speakerGender"
                value={formData.speakerGender}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="speakerAgeRange" className="block text-sm font-medium text-gray-700 mb-1">
                Speaker Age Range
              </label>
              <select
                id="speakerAgeRange"
                name="speakerAgeRange"
                value={formData.speakerAgeRange}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select age range</option>
                <option value="teen">Teen</option>
                <option value="younger-adult">Younger Adult</option>
                <option value="adult">Adult</option>
                <option value="senior">Senior</option>
              </select>
            </div>
          </div>

          {/* Speaker Dialect */}
          <div>
            <label htmlFor="speakerDialect" className="block text-sm font-medium text-gray-700 mb-1">
              Speaker Dialect
            </label>
            <input
              type="text"
              id="speakerDialect"
              name="speakerDialect"
              value={formData.speakerDialect}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., American, British, Mexican, Moravian"
            />
          </div>

          {/* Transcript */}
          <div>
            <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 mb-1">
              Transcript
            </label>
            <textarea
              id="transcript"
              name="transcript"
              value={formData.transcript}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="What is said in this audio clip?"
            />
          </div>

          {/* Source URL */}
          <div>
            <label htmlFor="sourceUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Source URL
            </label>
            <input
              type="url"
              id="sourceUrl"
              name="sourceUrl"
              value={formData.sourceUrl}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://... (where this audio came from)"
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="beginner, pronunciation, greetings, formal"
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading || !user}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Clip
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}