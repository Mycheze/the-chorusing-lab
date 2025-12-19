"use client";

import { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, CheckCircle, Scissors, Play } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import type { AudioMetadata } from "@/types/audio";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

interface ClipExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBlob: Blob;
  duration: number;
  originalFilename: string;
  initialTranscript?: string;
  initialSourceUrl?: string;
  onSuccess?: () => void;
}

interface ExtractFormData {
  title: string;
  language: string;
  speakerGender: "male" | "female" | "other" | "";
  speakerAgeRange: "teen" | "younger-adult" | "adult" | "senior" | "";
  speakerDialect: string;
  transcript: string;
  sourceUrl: string;
  tags: string;
}

export function ClipExtractModal({
  isOpen,
  onClose,
  audioBlob,
  duration,
  originalFilename,
  initialTranscript = "",
  initialSourceUrl = "",
  onSuccess,
}: ClipExtractModalProps) {
  const { user, getAuthHeaders } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
  const [converting, setConverting] = useState(false);

  const [formData, setFormData] = useState<ExtractFormData>({
    title: `Clip from ${originalFilename.replace(/\.[^/.]+$/, "")}`,
    language: "", // No default language selected
    speakerGender: "",
    speakerAgeRange: "",
    speakerDialect: "",
    transcript: initialTranscript,
    sourceUrl: initialSourceUrl,
    tags: "",
  });

  // Update transcript and sourceUrl when they change
  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        transcript: initialTranscript || prev.transcript,
        sourceUrl: initialSourceUrl || prev.sourceUrl,
      }));
    }
  }, [initialTranscript, initialSourceUrl, isOpen]);

  const convertToMp3 = useCallback(async () => {
    try {
      setConverting(true);
      setError(null);

      // Create an audio element from the WAV blob
      const audioElement = new Audio();
      const wavUrl = URL.createObjectURL(audioBlob);
      audioElement.src = wavUrl;

      // Wait for the audio to load
      await new Promise((resolve, reject) => {
        audioElement.addEventListener("loadeddata", resolve);
        audioElement.addEventListener("error", reject);
      });

      // Create an AudioContext and MediaStreamDestination
      const audioContext = new AudioContext();
      const mediaStreamDestination =
        audioContext.createMediaStreamDestination();

      // Create a MediaStreamAudioSourceNode from the audio element
      const source = audioContext.createMediaElementSource(audioElement);
      source.connect(mediaStreamDestination);
      source.connect(audioContext.destination); // Also connect to speakers so we can hear it

      // Set up MediaRecorder to record as MP3 (or webm if MP3 not supported)
      const mimeTypes = ["audio/mpeg", "audio/webm;codecs=opus", "audio/webm"];
      let selectedMimeType = "";

      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        throw new Error("No supported audio encoding format found");
      }

      const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000, // 128kbps - good quality, reasonable size
      });

      const chunks: Blob[] = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      mediaRecorder.addEventListener("stop", () => {
        const finalBlob = new Blob(chunks, { type: selectedMimeType });
        setMp3Blob(finalBlob);

        // Create preview URL
        const previewUrl = URL.createObjectURL(finalBlob);
        setAudioUrl(previewUrl);

        console.log(
          `Audio converted: ${audioBlob.size} bytes → ${finalBlob.size} bytes`
        );
        console.log(
          `Size reduction: ${(
            ((audioBlob.size - finalBlob.size) / audioBlob.size) *
            100
          ).toFixed(1)}%`
        );

        // Cleanup
        audioContext.close();
        URL.revokeObjectURL(wavUrl);
        setConverting(false);
      });

      // Start recording
      mediaRecorder.start();

      // Play the audio to trigger the recording
      audioElement.currentTime = 0;
      await audioElement.play();

      // Stop recording when audio finishes
      audioElement.addEventListener("ended", () => {
        mediaRecorder.stop();
      });
    } catch (error) {
      console.error("Audio conversion failed:", error);
      setError("Failed to process audio. Using original format.");
      setMp3Blob(audioBlob); // Fall back to original blob
      setAudioUrl(URL.createObjectURL(audioBlob));
      setConverting(false);
    }
  }, [audioBlob]);

  // Convert WAV blob to MP3 using MediaRecorder API
  useEffect(() => {
    if (isOpen && audioBlob) {
      convertToMp3();
    }
  }, [isOpen, audioBlob, convertToMp3]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = (language: string) => {
    setFormData((prev) => ({ ...prev, language }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Validate required fields
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.language.trim()) {
      setError("Language is required");
      return;
    }

    if (!duration || duration <= 0 || isNaN(duration)) {
      setError("Invalid clip duration. Please select a valid audio region.");
      return;
    }

    if (!mp3Blob) {
      setError("Audio processing still in progress. Please wait.");
      return;
    }

    setUploading(true);
    setError(null);

    console.log("🎬 Clip extract: Duration check:", {
      duration,
      type: typeof duration,
      isValid: !isNaN(duration) && duration > 0,
    });

    try {
      // Create a File object from the processed blob
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `${formData.title.replace(
        /[^a-zA-Z0-9\-_]/g,
        "_"
      )}_${timestamp}.mp3`;

      const clipFile = new File([mp3Blob], filename, {
        type: "audio/mpeg",
        lastModified: Date.now(),
      });

      console.log(
        "Uploading processed file:",
        filename,
        "Size:",
        clipFile.size,
        "Type:",
        clipFile.type
      );

      // Prepare form data for upload (reusing existing upload API)
      const uploadFormData = new FormData();
      uploadFormData.append("file", clipFile);
      uploadFormData.append("title", formData.title.trim());
      uploadFormData.append("duration", duration.toString());

      console.log("📤 Sending to server:", {
        title: formData.title.trim(),
        duration: duration,
        durationString: duration.toString(),
        fileName: clipFile.name,
        fileSize: clipFile.size,
      });
      uploadFormData.append("language", formData.language);
      uploadFormData.append("speakerGender", formData.speakerGender);
      uploadFormData.append("speakerAgeRange", formData.speakerAgeRange);
      uploadFormData.append("speakerDialect", formData.speakerDialect.trim());
      uploadFormData.append("transcript", formData.transcript.trim());
      uploadFormData.append("sourceUrl", formData.sourceUrl.trim());
      uploadFormData.append("tags", formData.tags.trim());

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      console.log("Upload successful:", result);

      // Success!
      onSuccess?.();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Upload error:", error);
      setError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      language: "",
      speakerGender: "",
      speakerAgeRange: "",
      speakerDialect: "",
      transcript: initialTranscript || "",
      sourceUrl: initialSourceUrl || "",
      tags: "",
    });
    setError(null);
    setMp3Blob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Save Extracted Clip
          </h1>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Audio Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Extracted Clip Preview
            </h3>

            {converting && (
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Processing audio...</span>
              </div>
            )}

            {audioUrl && !converting ? (
              <div className="space-y-3">
                {/* Simple HTML5 audio player for preview */}
                <audio controls className="w-full" preload="metadata">
                  <source src={audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>

                {/* Audio info */}
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>Duration: {duration.toFixed(1)}s</span>
                  <span>
                    Size: {mp3Blob ? (mp3Blob.size / 1024).toFixed(1) : "?"} KB
                  </span>
                  {mp3Blob && audioBlob && (
                    <span className="text-green-600 font-medium">
                      {(
                        ((audioBlob.size - mp3Blob.size) / audioBlob.size) *
                        100
                      ).toFixed(0)}
                      % smaller
                    </span>
                  )}
                </div>
              </div>
            ) : !converting ? (
              <div className="text-sm text-gray-500">
                Loading audio preview...
              </div>
            ) : null}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
          </div>

          {/* Language */}
          <div>
            <label
              htmlFor="language"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
              <label
                htmlFor="speakerGender"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
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
              <label
                htmlFor="speakerAgeRange"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
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
            <label
              htmlFor="speakerDialect"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <label
              htmlFor="transcript"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <label
              htmlFor="sourceUrl"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <label
              htmlFor="tags"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
            <p className="text-xs text-gray-500 mt-1">
              Separate tags with commas
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || converting || !user || !mp3Blob}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : converting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Save Clip
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
