"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Check,
  Edit,
  AlertCircle,
  Save,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type {
  AudioClip,
  TranscriptionPracticeState,
  TranscriptionComparison,
  TranscriptionDiff,
} from "@/types/audio";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { calculateAccuracy, generateDiff } from "@/lib/transcription-diff";

interface TranscriptionPracticeProps {
  clip: AudioClip & { url: string };
  onTranscriptionUpdate?: (newTranscript: string) => void;
}

export function TranscriptionPractice({
  clip,
  onTranscriptionUpdate,
}: TranscriptionPracticeProps) {
  const { user, getAuthHeaders } = useAuth();
  const [state, setState] = useState<TranscriptionPracticeState>({
    isRevealed: false,
    userInput: "",
    showComparison: false,
    isSubmitting: false,
  });

  const hasOriginalTranscript = Boolean(clip.metadata.transcript?.trim());

  // Calculate character-level diff between original and user text using optimal alignment
  const calculateDiff = useCallback(
    (original: string, userText: string): TranscriptionComparison => {
      // Use the new diff algorithm that handles insertions/deletions gracefully
      const diffs = generateDiff(original, userText);
      const accuracy = calculateAccuracy(original, userText);

      // Calculate total and correct characters from the normalized original text
      const normalizeText = (text: string) =>
        text.trim().toLowerCase().replace(/\s+/g, " ");
      const origNorm = normalizeText(original);
      const totalCharacters = origNorm.length;

      // Count correct characters from match segments
      const correctCharacters = diffs
        .filter((diff) => diff.type === "match")
        .reduce((sum, diff) => sum + diff.originalText.length, 0);

      return {
        accuracy,
        diffs,
        totalCharacters,
        correctCharacters,
      };
    },
    []
  );

  const toggleReveal = useCallback(() => {
    setState((prev) => ({ ...prev, isRevealed: !prev.isRevealed }));
  }, []);

  const handleUserInput = useCallback((value: string) => {
    setState((prev) => ({ ...prev, userInput: value, showComparison: false }));
  }, []);

  const checkTranscription = useCallback(() => {
    if (!hasOriginalTranscript || !state.userInput.trim()) return;

    const comparison = calculateDiff(
      clip.metadata.transcript!,
      state.userInput
    );
    setState((prev) => ({
      ...prev,
      comparison,
      showComparison: true,
    }));
  }, [
    hasOriginalTranscript,
    state.userInput,
    clip.metadata.transcript,
    calculateDiff,
  ]);

  const resetInput = useCallback(() => {
    setState((prev) => ({
      ...prev,
      userInput: "",
      showComparison: false,
      comparison: undefined,
    }));
  }, []);

  const submitNewTranscription = useCallback(async () => {
    if (!user || !state.userInput.trim()) return;

    setState((prev) => ({ ...prev, isSubmitting: true, error: undefined }));

    try {
      const response = await fetch(`/api/clips/${clip.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: clip.title,
          metadata: {
            ...clip.metadata,
            transcript: state.userInput.trim(),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save transcription");
      }

      // Success - update parent component
      onTranscriptionUpdate?.(state.userInput.trim());

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        showComparison: false,
        userInput: "",
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save transcription",
      }));
    }
  }, [user, state.userInput, clip, onTranscriptionUpdate, getAuthHeaders]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in the textarea
      if (e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case "KeyT":
          e.preventDefault();
          toggleReveal();
          break;
        case "Enter":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (hasOriginalTranscript && state.userInput.trim()) {
              checkTranscription();
            } else if (!hasOriginalTranscript && state.userInput.trim()) {
              submitNewTranscription();
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleReveal,
    checkTranscription,
    submitNewTranscription,
    hasOriginalTranscript,
    state.userInput,
  ]);

  const renderDiffText = (diffs: TranscriptionDiff[]) => {
    return (
      <div className="font-mono text-sm leading-relaxed">
        {diffs.map((diff, index) => {
          switch (diff.type) {
            case "match":
              return (
                <span key={index} className="bg-green-100 text-green-800">
                  {diff.originalText}
                </span>
              );
            case "replace":
              return (
                <span key={index} className="relative">
                  <span className="bg-red-100 text-red-800 line-through">
                    {diff.originalText}
                  </span>
                  <span className="bg-yellow-100 text-yellow-800 ml-1">
                    {diff.userText}
                  </span>
                </span>
              );
            case "delete":
              return (
                <span
                  key={index}
                  className="bg-red-100 text-red-800 line-through"
                >
                  {diff.originalText}
                </span>
              );
            case "insert":
              return (
                <span key={index} className="bg-blue-100 text-blue-800">
                  +{diff.userText}
                </span>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Transcription Practice
          </h3>
          <p className="text-sm text-gray-600">
            {hasOriginalTranscript
              ? "Type what you hear, then compare with the original"
              : "No transcription yet - add one to help other learners!"}
          </p>
        </div>
        {hasOriginalTranscript && (
          <button
            onClick={toggleReveal}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              state.isRevealed
                ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                : "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            }`}
          >
            {state.isRevealed ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            {state.isRevealed ? "Hide" : "Reveal"} Transcription
          </button>
        )}
      </div>

      {/* Original Transcription (when revealed) */}
      {hasOriginalTranscript && state.isRevealed && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">
            Original Transcription
          </h4>
          <p className="text-blue-800 leading-relaxed">
            &quot;{clip.metadata.transcript}&quot;
          </p>
        </div>
      )}

      {/* User Input */}
      <div>
        <label
          htmlFor="user-transcript"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {hasOriginalTranscript ? "What do you hear?" : "Add transcription"}
        </label>
        <textarea
          id="user-transcript"
          value={state.userInput}
          onChange={(e) => handleUserInput(e.target.value)}
          placeholder={
            hasOriginalTranscript
              ? "Type what you hear in the audio..."
              : "Type the transcription to help other learners..."
          }
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {hasOriginalTranscript ? (
          <>
            <button
              onClick={checkTranscription}
              disabled={!state.userInput.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Check My Answer
            </button>
            <button
              onClick={resetInput}
              disabled={!state.userInput.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </>
        ) : (
          <button
            onClick={submitNewTranscription}
            disabled={!state.userInput.trim() || state.isSubmitting || !user}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {state.isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Transcription
              </>
            )}
          </button>
        )}
      </div>

      {/* Error Message */}
      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{state.error}</span>
        </div>
      )}

      {/* Comparison Results */}
      {state.showComparison && state.comparison && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              Transcription Analysis
            </h4>
            <div className="text-right">
              <div
                className={`text-lg font-bold ${
                  state.comparison.accuracy >= 90
                    ? "text-green-600"
                    : state.comparison.accuracy >= 70
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {state.comparison.accuracy}% Accurate
              </div>
              <div className="text-xs text-gray-600">
                {state.comparison.correctCharacters} /{" "}
                {state.comparison.totalCharacters} characters
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">
              Character-by-character comparison:
            </h5>
            <div className="bg-white rounded-md p-3 border border-gray-200">
              {renderDiffText(state.comparison.diffs)}
            </div>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p>
              <span className="bg-green-100 text-green-800 px-1 rounded">
                Green
              </span>{" "}
              = Correct
            </p>
            <p>
              <span className="bg-red-100 text-red-800 px-1 rounded line-through">
                Red strikethrough
              </span>{" "}
              = Missing from your answer
            </p>
            <p>
              <span className="bg-yellow-100 text-yellow-800 px-1 rounded">
                Yellow
              </span>{" "}
              = Incorrect character
            </p>
            <p>
              <span className="bg-blue-100 text-blue-800 px-1 rounded">
                Blue +
              </span>{" "}
              = Extra character
            </p>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Info */}
      <div className="text-xs text-gray-600 bg-gray-50 rounded-md p-3">
        <p>
          <kbd className="keyboard-hint">T</kbd> Toggle transcription reveal •{" "}
          <kbd className="keyboard-hint">Ctrl+Enter</kbd>{" "}
          {hasOriginalTranscript ? "Check answer" : "Save transcription"}
        </p>
      </div>
    </div>
  );
}
