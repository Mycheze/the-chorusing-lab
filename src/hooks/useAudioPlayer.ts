// src/hooks/useAudioPlayer.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { createWaveSurferConfig } from "@/lib/audio/config";
import type { PlaybackState } from "@/types/audio";

interface UseAudioPlayerProps {
  url?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onFinish?: () => void;
  onError?: (error: string) => void;
}

export function useAudioPlayer({
  url,
  onReady,
  onPlay,
  onPause,
  onFinish,
  onError,
}: UseAudioPlayerProps = {}) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false); // Use ref instead of state to avoid dependency loop

  // Store callbacks in refs to avoid re-initialization
  const callbacksRef = useRef({ onReady, onPlay, onPause, onFinish, onError });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onReady, onPlay, onPause, onFinish, onError };
  }, [onReady, onPlay, onPause, onFinish, onError]);

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLooping: false,
    volume: 1,
    playbackRate: 1,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Safe state updates that check if component is still mounted
  const safeSetState = useCallback((updater: () => void) => {
    if (isMountedRef.current) {
      updater();
    }
  }, []);

  // Initialize WaveSurfer instance (only once)
  useEffect(() => {
    if (!waveformRef.current || isInitializedRef.current) return;

    const initializeWaveSurfer = async () => {
      try {
        const wavesurfer = WaveSurfer.create(
          createWaveSurferConfig(waveformRef.current!)
        );

        // Only proceed if component is still mounted
        if (!isMountedRef.current) {
          wavesurfer.destroy();
          return;
        }

        wavesurferRef.current = wavesurfer;
        isInitializedRef.current = true;

        // If we have a URL, load it immediately after initialization
        if (url && wavesurferRef.current) {
          setLoading(true);
          setError(null);
          setIsReady(false);
          try {
            wavesurferRef.current.load(url);
          } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
              const errorMessage = err.message || "Failed to load audio URL";
              if (isMountedRef.current) {
                setError(errorMessage);
                setLoading(false);
              }
              callbacksRef.current.onError?.(errorMessage);
            }
          }
        }

        // Set up event listeners with safe state updates
        wavesurfer.on("ready", () => {
          safeSetState(() => {
            setIsReady(true);
            setLoading(false);
            setError(null);
            setPlaybackState((prev) => ({
              ...prev,
              duration: wavesurferRef.current?.getDuration() || 0,
            }));
          });
          callbacksRef.current.onReady?.();
        });

        wavesurfer.on("play", () => {
          safeSetState(() => {
            setPlaybackState((prev) => ({ ...prev, isPlaying: true }));
          });
          callbacksRef.current.onPlay?.();
        });

        wavesurfer.on("pause", () => {
          safeSetState(() => {
            setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
          });
          callbacksRef.current.onPause?.();
        });

        wavesurfer.on("finish", () => {
          safeSetState(() => {
            setPlaybackState((prev) => ({
              ...prev,
              isPlaying: false,
              currentTime: 0,
            }));
          });
          callbacksRef.current.onFinish?.();
        });

        wavesurfer.on("timeupdate", (currentTime: number) => {
          safeSetState(() => {
            setPlaybackState((prev) => ({ ...prev, currentTime }));
          });
        });

        wavesurfer.on("error", (err: Error) => {
          // Ignore AbortError - it's expected during cleanup
          if (err.name === "AbortError") {
            return;
          }

          const errorMessage = err.message || "Failed to load audio";
          safeSetState(() => {
            setError(errorMessage);
            setLoading(false);
            setIsReady(false);
          });
          callbacksRef.current.onError?.(errorMessage);
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to initialize audio player";
        safeSetState(() => {
          setError(errorMessage);
          setLoading(false);
        });
        callbacksRef.current.onError?.(errorMessage);
      }
    };

    // Small delay to ensure DOM is ready and avoid race conditions
    const timer = setTimeout(initializeWaveSurfer, 0);

    return () => {
      clearTimeout(timer);
      isMountedRef.current = false;

      // Safe cleanup with proper error handling
      if (wavesurferRef.current && isInitializedRef.current) {
        const instance = wavesurferRef.current;
        wavesurferRef.current = null;
        isInitializedRef.current = false;

        // Use a microtask to ensure cleanup happens after current execution
        Promise.resolve().then(() => {
          try {
            // Stop any playback first
            if (instance.isPlaying?.()) {
              instance.stop();
            }
          } catch (e) {
            // Ignore stop errors
          }

          try {
            // Then destroy - this may throw AbortError which is fine
            instance.destroy();
          } catch (e) {
            // Expected during React Strict Mode - WaveSurfer cleans up pending operations
            if (e instanceof Error && e.name !== "AbortError") {
              console.debug("WaveSurfer cleanup:", e.message);
            }
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeSetState]); // Only depend on safeSetState. url is handled by separate load effect, isInitialized uses ref

  // Load audio URL (separate effect)
  useEffect(() => {
    if (!wavesurferRef.current || !url || !isInitializedRef.current) {
      return;
    }

    setLoading(true);
    setError(null);
    setIsReady(false);

    try {
      wavesurferRef.current.load(url);
    } catch (err) {
      // Handle load errors
      if (err instanceof Error && err.name !== "AbortError") {
        const errorMessage = err.message || "Failed to load audio URL";
        if (isMountedRef.current) {
          setError(errorMessage);
          setLoading(false);
        }
        callbacksRef.current.onError?.(errorMessage);
      }
    }
  }, [url]); // Only depend on url, not isInitialized (use ref instead)

  // Mark component as unmounted when effect cleanup runs
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Control functions
  const play = useCallback(() => {
    if (wavesurferRef.current && isReady && isMountedRef.current) {
      try {
        wavesurferRef.current.play();
      } catch (err) {
        console.debug("Play error:", err);
      }
    }
  }, [isReady]);

  const pause = useCallback(() => {
    if (wavesurferRef.current && isReady && isMountedRef.current) {
      try {
        wavesurferRef.current.pause();
      } catch (err) {
        console.debug("Pause error:", err);
      }
    }
  }, [isReady]);

  const stop = useCallback(() => {
    if (wavesurferRef.current && isReady && isMountedRef.current) {
      try {
        wavesurferRef.current.stop();
      } catch (err) {
        console.debug("Stop error:", err);
      }
    }
  }, [isReady]);

  const seekTo = useCallback(
    (time: number) => {
      if (
        wavesurferRef.current &&
        isReady &&
        playbackState.duration > 0 &&
        isMountedRef.current
      ) {
        try {
          wavesurferRef.current.seekTo(time / playbackState.duration);
        } catch (err) {
          console.debug("Seek error:", err);
        }
      }
    },
    [isReady, playbackState.duration]
  );

  const setVolume = useCallback(
    (volume: number) => {
      if (wavesurferRef.current && isReady && isMountedRef.current) {
        try {
          const clampedVolume = Math.max(0, Math.min(1, volume));
          wavesurferRef.current.setVolume(clampedVolume);
          safeSetState(() => {
            setPlaybackState((prev) => ({ ...prev, volume: clampedVolume }));
          });
        } catch (err) {
          console.debug("Volume error:", err);
        }
      }
    },
    [isReady, safeSetState]
  );

  const togglePlayPause = useCallback(() => {
    if (playbackState.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [playbackState.isPlaying, play, pause]);

  return {
    waveformRef,
    playbackState,
    loading,
    error,
    isReady,
    controls: {
      play,
      pause,
      stop,
      seekTo,
      setVolume,
      togglePlayPause,
    },
  };
}
