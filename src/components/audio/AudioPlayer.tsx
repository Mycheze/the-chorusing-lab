// src/components/audio/AudioPlayer.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

interface AudioPlayerProps {
  url?: string;
  title?: string;
  className?: string;
  showControls?: boolean;
  autoload?: boolean;
}

export function AudioPlayer({
  url,
  title = "Audio Player",
  className = "",
  showControls = true,
  autoload = true,
}: AudioPlayerProps) {
  const [currentUrl, setCurrentUrl] = useState(autoload ? url : undefined);

  // Stabilize callback functions to prevent infinite loops
  const handleReady = useCallback(() => {
    // Audio is ready for playback
  }, []);

  const handleError = useCallback((err: string) => {
    console.error("Audio playback error:", err);
  }, []);

  const { waveformRef, playbackState, loading, error, isReady, controls } =
    useAudioPlayer({
      url: currentUrl,
      onReady: handleReady,
      onError: handleError,
    });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLoadAudio = () => {
    if (url && !currentUrl) {
      setCurrentUrl(url);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {!autoload && !currentUrl && (
          <button
            onClick={handleLoadAudio}
            disabled={!url}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load Audio
          </button>
        )}
      </div>

      {/* Waveform Container */}
      <div className="relative bg-gray-50 rounded-lg border border-gray-200 mb-4 overflow-hidden">
        {/* Loading State */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading audio...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">Failed to load audio</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentUrl && !loading && !error && (
          <div className="h-32 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No audio loaded</p>
            </div>
          </div>
        )}

        {/* Waveform */}
        <div
          ref={waveformRef}
          className={`w-full ${currentUrl ? "min-h-[128px]" : "h-32"} ${
            !isReady && currentUrl ? "opacity-50" : ""
          }`}
        />
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={controls.togglePlayPause}
              disabled={!isReady || loading}
              className="audio-control-btn"
              aria-label={playbackState.isPlaying ? "Pause" : "Play"}
            >
              {playbackState.isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={controls.stop}
              disabled={!isReady || loading}
              className="audio-control-btn"
              aria-label="Stop"
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              onClick={() => controls.seekTo(0)}
              disabled={!isReady || loading}
              className="audio-control-btn"
              aria-label="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Time Display */}
          <div className="flex items-center gap-4">
            {isReady && (
              <div className="text-sm text-gray-600 font-mono">
                {formatTime(playbackState.currentTime)} /{" "}
                {formatTime(playbackState.duration)}
              </div>
            )}

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={playbackState.volume}
                onChange={(e) => controls.setVolume(parseFloat(e.target.value))}
                disabled={!isReady}
                className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
