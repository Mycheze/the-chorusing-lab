// -------------------------------------------------------------------
//  File: src/components/chorus/ChorusingPlayer.tsx
// -------------------------------------------------------------------
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  Loader2,
  AlertCircle,
  Repeat,
  Gauge,
  Plus,
  Minus,
} from "lucide-react";
import type { AudioClip } from "@/types/audio";

/* ----------  ONE-AND-ONLY global WaveSurfer instance  -------------- */
let _activeWs: any | null = null;

interface ChorusingPlayerProps {
  clip: AudioClip & { url: string };
}
interface AudioRegion {
  id: string;
  start: number;
  end: number;
}

export function ChorusingPlayer({ clip }: ChorusingPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);
  const mounted = useRef(true);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [region, setRegion] = useState<AudioRegion | null>(null);
  const [loop, setLoop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const originalDurationRef = useRef<number>(0);

  // Use ref for loop state to avoid stale closures in event handlers
  const loopRef = useRef(false);

  // Sync loopRef with loop state
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  /* ----------  Robust destroy helper  ------------------------------ */
  const destroy = useCallback((ws?: any) => {
    try {
      ws?.destroy?.();
    } catch {
      /* noop */
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Mount / unmount life-cycle                                         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    // Capture ref value at the start of the effect for cleanup
    const waveformElement = waveformRef.current;

    const init = async () => {
      try {
        /* Tear down any ghost player first (Strict-mode double mount) */
        destroy(_activeWs);
        _activeWs = null;

        const [{ default: WaveSurfer }, { default: Regions }] =
          await Promise.all([
            import("wavesurfer.js"),
            import("wavesurfer.js/dist/plugins/regions.js"),
          ]);
        if (cancelled || !waveformElement) return;

        const regions = Regions.create();
        regionsRef.current = regions;

        // Use MediaElement backend to support preservesPitch for tempo changes
        // MediaElement backend works well with regions and supports native pitch preservation
        const ws = WaveSurfer.create({
          container: waveformElement,
          height: 120,
          waveColor: "#e5e7eb",
          progressColor: "#4f46e5",
          cursorColor: "#1f2937",
          cursorWidth: 2,
          interact: true,
          normalize: true,
          plugins: [regions],
          // Use MediaElement backend for preservesPitch support (tempo change without pitch shift)
          backend: "MediaElement" as const,
        });
        wsRef.current = ws;
        _activeWs = ws;
        (waveformElement as any).__WS = ws; // dev-tool handle

        // Try to set up gain node as early as possible - before audio is ready
        // This needs to happen before WaveSurfer fully initializes the media element
        ws.on("load", () => {
          // This fires when audio starts loading
          const backend = (ws as any).backend;
          // Try multiple ways to access the media element
          const mediaElement =
            backend?.media ||
            (ws as any).getMediaElement?.() ||
            backend?.el ||
            backend?.mediaElement;
          if (mediaElement && !gainNodeRef.current) {
            // Try to create gain node immediately when media element is available
            try {
              const audioContext = new (window.AudioContext ||
                (window as any).webkitAudioContext)();
              const source =
                audioContext.createMediaElementSource(mediaElement);
              const gainNode = audioContext.createGain();
              gainNode.gain.value = 1.0;

              source.connect(gainNode);
              gainNode.connect(audioContext.destination);

              audioContextRef.current = audioContext;
              mediaSourceRef.current = source;
              gainNodeRef.current = gainNode;

              (mediaElement as any).__sourceNode = source;
            } catch (err: any) {
              console.warn("Early gain node creation failed:", err.message);
            }
          }
        });

        ws.on("ready", () => {
          if (!mounted.current) return;
          const dur = ws.getDuration();
          originalDurationRef.current = dur;
          setDuration(dur);
          setLoading(false);
          setIsReady(true);
          // Initialize playback rate to 1.0
          try {
            ws.setPlaybackRate(1.0);
            // If using MediaElement backend, set preservesPitch for tempo change
            const backend = (ws as any).backend;
            // Try multiple ways to access the media element
            const mediaElement =
              backend?.media ||
              (ws as any).getMediaElement?.() ||
              backend?.el ||
              backend?.mediaElement;

            if (mediaElement) {
              mediaElement.preservesPitch = true;

              // Set up gain node if not already created (tried in "load" event)
              if (!gainNodeRef.current) {
                const setupGainNode = async () => {
                  try {
                    // Check if source node already exists
                    if ((mediaElement as any).__sourceNode) {
                      console.warn(
                        "Media element already has a source node - cannot create gain node"
                      );
                      return;
                    }

                    const audioContext = new (window.AudioContext ||
                      (window as any).webkitAudioContext)();
                    if (audioContext.state === "suspended") {
                      await audioContext.resume();
                    }

                    const source =
                      audioContext.createMediaElementSource(mediaElement);
                    (mediaElement as any).__sourceNode = source;

                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 1.0;

                    source.connect(gainNode);
                    gainNode.connect(audioContext.destination);

                    audioContextRef.current = audioContext;
                    mediaSourceRef.current = source;
                    gainNodeRef.current = gainNode;
                  } catch (err: any) {
                    console.error(
                      "❌ Failed to create gain node:",
                      err.message || err
                    );
                  }
                };
                setupGainNode();
              }
            }
          } catch (err) {
            // Ignore if playback rate setting fails
          }
        });
        ws.on("play", () => mounted.current && setIsPlaying(true));
        ws.on("pause", () => mounted.current && setIsPlaying(false));
        ws.on("finish", () => {
          if (!mounted.current) return;
          const currentLoop = loopRef.current; // Use ref to get current loop state
          const currentRegion = region; // Capture current region state
          const dur = ws.getDuration();

          if (currentLoop) {
            // Loop is enabled - handle looping directly in finish event
            // Temporarily disable regions to allow seeks
            const regions = regionsRef.current;
            let regionsWereEnabled = false;
            if (regions && typeof regions.disable === "function") {
              regions.disable();
              regionsWereEnabled = true;
            }

            try {
              const seekTime = currentRegion ? currentRegion.start : 0;
              if (dur > 0) {
                ws.seekTo(seekTime / dur);
                ws.play();
                // Don't set isPlaying(false) - keep it playing
              } else {
                setIsPlaying(false);
              }
            } catch (err) {
              setIsPlaying(false);
            }

            // Re-enable regions
            if (
              regions &&
              regionsWereEnabled &&
              typeof regions.enable === "function"
            ) {
              regions.enable();
            }
          } else {
            // Loop is disabled - stop playback
            setIsPlaying(false);
          }
        });
        ws.on("timeupdate", (t: number) => {
          if (!mounted.current) return;
          // t is the current time in the original audio timeline
          // For display purposes, when tempo is slowed (rate < 1), we want to show
          // the time as if it's moving slower to match the visual playhead
          // However, with MediaElement backend and preservesPitch, the timeupdate
          // should already account for this correctly
          // Actually, we need to show the "effective" time - when rate is 0.5x,
          // 5 seconds of audio takes 10 seconds to play, so we show 10 seconds
          // But the playhead position should be at 5/10 = 50% of the waveform
          // So we keep t as-is for playhead position, but adjust display time
          setCurrent(t);
        });

        regions.on("region-created", (r: any) => {
          regions
            .getRegions()
            .forEach((rg: any) => rg.id !== r.id && rg.remove());
          mounted.current &&
            setRegion({ id: r.id, start: r.start, end: r.end });
        });
        regions.on(
          "region-updated",
          (r: any) =>
            mounted.current &&
            setRegion({ id: r.id, start: r.start, end: r.end })
        );
        regions.on("region-removed", () => mounted.current && setRegion(null));

        regions.enableDragSelection({ color: "rgba(79,70,229,0.3)" });

        await ws.load(clip.url);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load audio");
          setLoading(false);
        }
      }
    };
    init();

    return () => {
      cancelled = true;
      mounted.current = false;

      /* ----  FIX: clear dev handle with a safe guard  --------------- */
      if (waveformElement) {
        (waveformElement as any).__WS = null;
      }

      /* destroy after browser is idle (avoids audio glitches) */
      requestIdleCallback(() => {
        destroy(wsRef.current);
        // Clean up audio context and nodes
        if (mediaSourceRef.current) {
          try {
            mediaSourceRef.current.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
          mediaSourceRef.current = null;
        }
        if (gainNodeRef.current) {
          try {
            gainNodeRef.current.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
          gainNodeRef.current = null;
        }
        if (audioContextRef.current) {
          try {
            audioContextRef.current.close();
          } catch (e) {
            // Ignore close errors
          }
          audioContextRef.current = null;
        }
      });
    };
  }, [clip.url, destroy]);

  /* ------------------------------------------------------------------ */
  /* Playback controls                                                  */
  /* ------------------------------------------------------------------ */
  const playPause = useCallback(async () => {
    const ws = wsRef.current;
    if (!isReady || !ws) return;

    // Resume audio context if suspended (required for autoplay policy)
    // This ensures playback works even if audio context was created before user interaction
    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      try {
        await audioContextRef.current.resume();
      } catch (err) {
        console.warn("Failed to resume audio context:", err);
      }
    }

    isPlaying ? ws.pause() : ws.play();
  }, [isReady, isPlaying]);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (!isReady || !ws) return;

    // CRITICAL: The regions plugin blocks seeks. Temporarily disable it.
    const regions = regionsRef.current;
    let regionsWereEnabled = false;

    if (regions && typeof regions.disable === "function") {
      regions.disable();
      regionsWereEnabled = true;
    }

    ws.pause();

    const dur = ws.getDuration();
    if (dur > 0) {
      // If region is selected, stop at region start; otherwise stop at beginning
      const seekTime = region ? region.start : 0;
      ws.seekTo(seekTime / dur);
      setCurrent(seekTime);
    } else {
      ws.stop();
      setCurrent(0);
    }

    // Re-enable regions if we disabled them
    if (regions && regionsWereEnabled && typeof regions.enable === "function") {
      regions.enable();
    }

    setIsPlaying(false);
  }, [isReady, region]);

  const restart = useCallback(async () => {
    const ws = wsRef.current;
    if (!isReady || !ws) return;

    // Resume audio context if suspended (required for autoplay policy)
    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      try {
        await audioContextRef.current.resume();
      } catch (err) {
        console.warn("Failed to resume audio context:", err);
      }
    }

    // CRITICAL: Temporarily disable regions to allow seeks
    const regions = regionsRef.current;
    let regionsWereEnabled = false;

    if (regions && typeof regions.disable === "function") {
      regions.disable();
      regionsWereEnabled = true;
    }

    ws.pause();

    const dur = ws.getDuration();
    if (dur > 0) {
      const seekTime = region ? region.start : 0;
      ws.seekTo(seekTime / dur);
      setCurrent(seekTime);

      // Re-enable regions
      if (
        regions &&
        regionsWereEnabled &&
        typeof regions.enable === "function"
      ) {
        regions.enable();
      }
    }
    ws.play();
    setIsPlaying(true);
  }, [isReady, region]);

  const changeVolume = useCallback(
    (v: number) => {
      const ws = wsRef.current;
      if (!isReady || !ws) return;
      // Clamp volume to 0-3.0 (0-300%)
      const vol = Math.max(0, Math.min(3, v));

      try {
        const backend = (ws as any).backend;

        // Try to get gain node from backend (WebAudio) or use our custom one (MediaElement)
        let gainNode = backend?.gainNode;

        // If no gainNode from backend, use our custom one for MediaElement
        if (!gainNode) {
          gainNode = gainNodeRef.current;
        }

        if (gainNode) {
          // Ensure audio context is running
          const audioContext = audioContextRef.current || backend?.ac;
          if (audioContext && audioContext.state === "suspended") {
            audioContext.resume().catch(console.error);
          }

          if (vol > 1.0) {
            // For volumes > 100%, set WaveSurfer to max (1.0) and apply additional gain
            ws.setVolume(1.0);
            // Use setValueAtTime for smooth transitions, or direct assignment for immediate change
            gainNode.gain.setValueAtTime(vol, audioContext?.currentTime || 0);
          } else {
            // For volumes <= 100%, use normal WaveSurfer volume
            ws.setVolume(vol);
            gainNode.gain.setValueAtTime(1.0, audioContext?.currentTime || 0); // Reset gain node to default
          }
        } else {
          // No gain node available, use standard WaveSurfer volume (limited to 100%)
          const volClamped = Math.max(0, Math.min(1, vol));
          ws.setVolume(volClamped);
          if (vol > 1.0) {
            console.warn(
              "No gain node available, volume limited to 100%. Gain node ref:",
              gainNodeRef.current
            );
          }
        }
        setVolume(vol);
      } catch (err) {
        console.error("Failed to set volume:", err);
        // Fallback to standard volume
        const volClamped = Math.max(0, Math.min(1, vol));
        ws.setVolume(volClamped);
        setVolume(volClamped);
      }
    },
    [isReady]
  );

  const changePlaybackRate = useCallback(
    (rate: number) => {
      const ws = wsRef.current;
      if (!isReady || !ws) return;
      // Clamp playback rate to 0.5x - 2.0x
      const clampedRate = Math.max(0.5, Math.min(2.0, rate));

      try {
        // Set playback rate
        ws.setPlaybackRate(clampedRate);

        // Enable preservesPitch for tempo change (speed without pitch shift)
        // MediaElement backend supports this natively
        const backend = (ws as any).backend;
        if (backend?.media) {
          backend.media.preservesPitch = true;
        }

        // Update effective duration based on playback rate
        // When rate is 0.5x, duration is 2x longer (takes longer to play)
        const effectiveDuration = originalDurationRef.current / clampedRate;
        setDuration(effectiveDuration);

        setPlaybackRate(clampedRate);
      } catch (err) {
        console.error("Failed to set playback rate:", err);
      }
    },
    [isReady]
  );

  const clearSelection = useCallback(() => {
    const regions = regionsRef.current;
    if (regions) {
      const allRegions = regions.getRegions();
      allRegions.forEach((r: any) => {
        if (typeof r.remove === "function") {
          r.remove();
        }
      });
    }
    setRegion(null);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Slider control buttons                                             */
  /* ------------------------------------------------------------------ */
  const handleVolumeAdjust = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const delta = e.shiftKey ? 0.1 : 0.05; // 10% or 5%
      const newVolume = volume + delta;
      changeVolume(newVolume);
    },
    [volume, changeVolume]
  );

  const handleVolumeDecrease = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const delta = e.shiftKey ? 0.1 : 0.05; // 10% or 5%
      const newVolume = volume - delta;
      changeVolume(newVolume);
    },
    [volume, changeVolume]
  );

  const handleVolumeReset = useCallback(() => {
    changeVolume(1.0);
  }, [changeVolume]);

  const handleSpeedAdjust = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const delta = e.shiftKey ? 0.1 : 0.05; // 10% or 5%
      const newRate = playbackRate + delta;
      changePlaybackRate(newRate);
    },
    [playbackRate, changePlaybackRate]
  );

  const handleSpeedDecrease = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const delta = e.shiftKey ? 0.1 : 0.05; // 10% or 5%
      const newRate = playbackRate - delta;
      changePlaybackRate(newRate);
    },
    [playbackRate, changePlaybackRate]
  );

  const handleSpeedReset = useCallback(() => {
    changePlaybackRate(1.0);
  }, [changePlaybackRate]);

  /* ------------------------------------------------------------------ */
  /* Keyboard shortcuts                                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isReady) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      // But allow shortcuts when using range inputs (sliders)
      if (
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLInputElement &&
          (e.target as HTMLInputElement).type !== "range")
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          playPause();
          break;
        case "KeyS":
          e.preventDefault();
          stop();
          break;
        case "KeyR":
          e.preventDefault();
          restart();
          break;
        case "KeyL":
          e.preventDefault();
          setLoop(!loop);
          break;
        case "KeyQ":
          e.preventDefault();
          if (region) {
            clearSelection();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReady, playPause, stop, restart, loop, region, clearSelection]);

  /* ------------------------------------------------------------------ */
  /* Loop checker and region boundary enforcement                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    // Keep interval running even if isPlaying becomes false temporarily
    // The finish event will handle looping, but we keep this as backup for region boundaries
    if (!wsRef.current) return;
    const ws = wsRef.current;
    const dur = ws.getDuration();
    if (dur <= 0) return;

    // Only run interval if we're playing OR if loop is enabled (to catch edge cases)
    const shouldRun = isPlaying || loopRef.current;
    if (!shouldRun) return;

    const id = window.setInterval(() => {
      // getCurrentTime returns time in original audio timeline
      // This is correct for region boundaries (regions are in original time)
      const t = ws.getCurrentTime();
      const currentIsPlaying = ws.isPlaying();
      const currentLoop = loopRef.current; // Use ref to get current loop state
      const currentRegion = region; // Capture region state

      if (currentRegion) {
        // If we have a region, enforce its boundaries
        // Region times are in original audio time, which matches getCurrentTime
        if (t >= currentRegion.end) {
          // Temporarily disable regions to allow seeks
          const regions = regionsRef.current;
          let regionsWereEnabled = false;
          if (regions && typeof regions.disable === "function") {
            regions.disable();
            regionsWereEnabled = true;
          }

          if (currentLoop) {
            // Loop: seek back to region start
            try {
              ws.seekTo(currentRegion.start / dur);
              ws.play();
            } catch (err) {
              // Ignore seek errors
            }
          } else {
            // No loop: stop at region end
            ws.pause();
            setIsPlaying(false);
          }

          // Re-enable regions
          if (
            regions &&
            regionsWereEnabled &&
            typeof regions.enable === "function"
          ) {
            regions.enable();
          }
        } else if (t < currentRegion.start) {
          // If somehow before region start, seek to start
          const regions = regionsRef.current;
          let regionsWereEnabled = false;
          if (regions && typeof regions.disable === "function") {
            regions.disable();
            regionsWereEnabled = true;
          }

          try {
            ws.seekTo(currentRegion.start / dur);
            if (!currentIsPlaying) ws.play();
          } catch (err) {
            // Ignore seek errors
          }

          if (
            regions &&
            regionsWereEnabled &&
            typeof regions.enable === "function"
          ) {
            regions.enable();
          }
        }
      } else if (currentLoop) {
        // No region, but looping: loop the whole clip
        // Use a more reliable check - check if we're at or past the end
        // Also check if audio actually finished (isPlaying becomes false)
        const isAtEnd =
          t >= dur - 0.01 || (!currentIsPlaying && t >= dur - 0.1);

        if (isAtEnd) {
          const regions = regionsRef.current;
          let regionsWereEnabled = false;
          if (regions && typeof regions.disable === "function") {
            regions.disable();
            regionsWereEnabled = true;
          }

          try {
            ws.seekTo(0);
            ws.play();
          } catch (err) {
            // Ignore seek errors
          }

          if (
            regions &&
            regionsWereEnabled &&
            typeof regions.enable === "function"
          ) {
            regions.enable();
          }
        }
      }
    }, 60);

    return () => clearInterval(id);
  }, [isPlaying, loop, region]); // Keep dependencies but use refs inside

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    const cs = Math.floor((s % 1) * 100)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}.${cs}`;
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
      {/* Waveform */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden relative">
        <div ref={waveformRef} data-debug-ws className="w-full min-h-[120px]" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/90">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-600">Loading…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/90">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <span className="ml-3 text-red-600">{error}</span>
          </div>
        )}
      </div>

      {isReady && (
        <div className="space-y-4">
          {/* Main controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={playPause} className="audio-control-btn">
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
              <button onClick={stop} className="audio-control-btn">
                <Square className="w-4 h-4" />
              </button>
              <button onClick={restart} className="audio-control-btn">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLoop(!loop)}
                className={`audio-control-btn ${
                  loop ? "bg-indigo-100 text-indigo-700" : ""
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
              {region && (
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md text-sm"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="font-mono text-sm text-gray-600">
              {fmt(current)} / {fmt(originalDurationRef.current || duration)}
              {playbackRate !== 1 && (
                <span className="text-xs text-gray-500 ml-1">
                  ({playbackRate.toFixed(1)}x)
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Volume Control */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-gray-500" />
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.05"
                    value={volume}
                    onChange={(e) => changeVolume(parseFloat(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-xs text-gray-600 min-w-[3rem]">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 ml-6 w-20">
                  <button
                    onClick={handleVolumeDecrease}
                    className="inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    aria-label="Decrease volume"
                    title="Decrease volume (Shift for 10%)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleVolumeAdjust}
                    className="inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    aria-label="Increase volume"
                    title="Increase volume (Shift for 10%)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleVolumeReset}
                    className="inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    aria-label="Reset volume to 100%"
                    title="Reset volume to 100%"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Speed Control */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-gray-500" />
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={playbackRate}
                    onChange={(e) =>
                      changePlaybackRate(parseFloat(e.target.value))
                    }
                    className="w-20"
                  />
                  <span className="text-xs text-gray-600 min-w-[2.5rem]">
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 ml-6 w-20">
                  <button
                    onClick={handleSpeedDecrease}
                    className="inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    aria-label="Decrease speed"
                    title="Decrease speed (Shift for 10%)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleSpeedAdjust}
                    className="inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    aria-label="Increase speed"
                    title="Increase speed (Shift for 10%)"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleSpeedReset}
                    className="inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                    aria-label="Reset speed to 1.0x"
                    title="Reset speed to 1.0x"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Info */}
          <div className="text-xs text-gray-600 bg-gray-50 rounded-md p-3">
            <p>
              <kbd className="keyboard-hint">Space</kbd> Play/Pause •{" "}
              <kbd className="keyboard-hint">S</kbd> Stop •{" "}
              <kbd className="keyboard-hint">R</kbd> Restart •{" "}
              <kbd className="keyboard-hint">L</kbd> Toggle Loop
              {region && (
                <>
                  {" • "}
                  <kbd className="keyboard-hint">Q</kbd> Clear Selection
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
