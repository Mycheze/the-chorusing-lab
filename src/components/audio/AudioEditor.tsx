"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Scissors,
  Volume2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ClipExtractModal } from "./ClipExtractModal";

interface AudioEditorProps {
  file: File;
  sourceUrl?: string;
}

interface AudioRegion {
  id: string;
  start: number;
  end: number;
}

export function AudioEditor({ file, sourceUrl }: AudioEditorProps) {
  console.log(
    "🚀 AudioEditor: Component mounted with file:",
    file.name,
    file.size
  );

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const regionsPluginRef = useRef<any>(null);
  const fileUrlRef = useRef<string | null>(null);
  const initializationRef = useRef<boolean>(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState<AudioRegion | null>(
    null
  );
  const [extractModalOpen, setExtractModalOpen] = useState(false);
  const [extractedAudioBlob, setExtractedAudioBlob] = useState<Blob | null>(
    null
  );
  const [extractedTranscript, setExtractedTranscript] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState(1);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 AudioEditor: Starting cleanup");

    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
        console.log("✅ AudioEditor: WaveSurfer destroyed");
      } catch (e) {
        console.log("⚠️ AudioEditor: Error during WaveSurfer destroy:", e);
      }
      wavesurferRef.current = null;
    }

    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      console.log("✅ AudioEditor: Object URL revoked");
      fileUrlRef.current = null;
    }

    initializationRef.current = false;
    setIsReady(false);
    setIsPlaying(false);
    setSelectedRegion(null);
  }, []);

  // Initialize WaveSurfer
  useEffect(() => {
    console.log("🔧 AudioEditor: useEffect triggered");
    console.log(
      "🔍 AudioEditor: waveformRef.current exists:",
      !!waveformRef.current
    );

    if (initializationRef.current || !waveformRef.current || !file) {
      console.log("⚠️ AudioEditor: Skipping initialization");
      return;
    }

    const initializeWaveSurfer = async () => {
      try {
        console.log("🎯 AudioEditor: Starting WaveSurfer initialization");

        initializationRef.current = true;
        setIsLoading(true);
        setError(null);

        const container = waveformRef.current;
        if (!container) {
          throw new Error("Waveform container ref not available");
        }
        console.log("✅ AudioEditor: Container found");

        // Dynamic import WaveSurfer and Regions plugin
        console.log(
          "📦 AudioEditor: Importing WaveSurfer and regions plugin..."
        );
        const [WaveSurferModule, RegionsModule] = await Promise.all([
          import("wavesurfer.js"),
          import("wavesurfer.js/dist/plugins/regions.js"),
        ]);

        const WaveSurfer = WaveSurferModule.default;
        const RegionsPlugin = RegionsModule.default;
        console.log("✅ AudioEditor: WaveSurfer and RegionsPlugin imported");

        // Create regions plugin
        const regionsPlugin = RegionsPlugin.create();
        regionsPluginRef.current = regionsPlugin;

        // Create object URL for the file
        console.log("🔗 AudioEditor: Creating object URL");
        const objectUrl = URL.createObjectURL(file);
        fileUrlRef.current = objectUrl;

        // Test audio element first
        console.log("🧪 AudioEditor: Testing audio element");
        const testAudio = new Audio();

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Audio test timeout"));
          }, 10000);

          testAudio.addEventListener("loadedmetadata", () => {
            console.log(
              "✅ AudioEditor: Test audio loaded, duration:",
              testAudio.duration
            );
            clearTimeout(timeout);
            resolve(undefined);
          });

          testAudio.addEventListener("error", (e) => {
            console.log("❌ AudioEditor: Test audio failed:", e);
            clearTimeout(timeout);
            reject(new Error("Test audio failed to load"));
          });

          testAudio.src = objectUrl;
        });

        // Create WaveSurfer instance with regions plugin (HIGH QUALITY)
        console.log(
          "🌊 AudioEditor: Creating WaveSurfer with high-quality settings"
        );
        const wavesurfer = WaveSurfer.create({
          container: container,
          height: 150,
          waveColor: "#e5e7eb",
          progressColor: "#4f46e5",
          cursorColor: "#1f2937",
          cursorWidth: 2,
          interact: true,
          hideScrollbar: false,
          normalize: false, // DISABLE normalization - preserves audio quality
          mediaControls: false,
          autoplay: false,
          plugins: [regionsPlugin],
          sampleRate: undefined, // Use original sample rate
        });

        console.log("✅ AudioEditor: WaveSurfer instance created with regions");
        wavesurferRef.current = wavesurfer;

        // Set up WaveSurfer event listeners
        wavesurfer.on("ready", () => {
          console.log("🎉 AudioEditor: WaveSurfer ready");
          const audioBuffer = wavesurfer.getDecodedData();
          if (audioBuffer) {
            console.log("📊 Audio Debug Info:");
            console.log("  - Original file size:", file.size, "bytes");
            console.log("  - Sample rate:", audioBuffer.sampleRate, "Hz");
            console.log("  - Channels:", audioBuffer.numberOfChannels);
            console.log("  - Length:", audioBuffer.length, "samples");
            console.log("  - Duration:", audioBuffer.duration, "seconds");
            console.log(
              "  - AudioContext sample rate:",
              new AudioContext().sampleRate,
              "Hz"
            );
          }
          setIsReady(true);
          setIsLoading(false);
          setDuration(wavesurfer.getDuration());
        });

        wavesurfer.on("play", () => setIsPlaying(true));
        wavesurfer.on("pause", () => setIsPlaying(false));
        wavesurfer.on("finish", () => setIsPlaying(false));
        wavesurfer.on("timeupdate", (time: number) => setCurrentTime(time));

        wavesurfer.on("error", (err: Error) => {
          console.log("❌ AudioEditor: WaveSurfer error:", err);
          if (err.name === "AbortError") return;

          const errorMessage = err.message || "Failed to load audio";
          setError(errorMessage);
          setIsLoading(false);
          initializationRef.current = false;
        });

        wavesurfer.on("loading", (percent: number) => {
          console.log("📥 AudioEditor: Loading progress:", percent + "%");
        });

        // Set up regions plugin event listeners
        regionsPlugin.on("region-created", (region: any) => {
          console.log(
            "📍 AudioEditor: Region created:",
            region.start,
            "-",
            region.end
          );

          // Clear any existing regions (we only want one at a time)
          const regions = regionsPlugin.getRegions();
          regions.forEach((r: any) => {
            if (r.id !== region.id) {
              r.remove();
            }
          });

          setSelectedRegion({
            id: region.id,
            start: region.start,
            end: region.end,
          });
        });

        regionsPlugin.on("region-updated", (region: any) => {
          console.log(
            "📍 AudioEditor: Region updated:",
            region.start,
            "-",
            region.end
          );
          setSelectedRegion({
            id: region.id,
            start: region.start,
            end: region.end,
          });
        });

        regionsPlugin.on("region-removed", () => {
          console.log("📍 AudioEditor: Region removed");
          setSelectedRegion(null);
        });

        // Enable region creation by clicking and dragging
        regionsPlugin.enableDragSelection({
          color: "rgba(79, 70, 229, 0.3)",
        });

        // Load the audio file
        console.log("📂 AudioEditor: Loading audio file");
        await wavesurfer.load(objectUrl);
        console.log("✅ AudioEditor: Audio loaded successfully");
      } catch (err) {
        console.log("💥 AudioEditor: Error in initialization:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to initialize audio editor";
        setError(errorMessage);
        setIsLoading(false);
        initializationRef.current = false;
      }
    };

    const timer = setTimeout(initializeWaveSurfer, 100);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [file, cleanup]);

  // Control functions
  const togglePlayPause = useCallback(() => {
    if (!wavesurferRef.current) return;

    if (isPlaying) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play();
    }
  }, [isPlaying]);

  const stop = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.stop();
  }, []);

  const restart = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.seekTo(0);
  }, []);

  const changeVolume = useCallback((newVolume: number) => {
    if (!wavesurferRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    wavesurferRef.current.setVolume(clampedVolume);
    setVolumeLevel(clampedVolume);
  }, []);

  // Region control functions
  const setRegionStart = useCallback(() => {
    if (!wavesurferRef.current || !regionsPluginRef.current) return;

    const current = currentTime;
    const end = selectedRegion
      ? selectedRegion.end
      : Math.min(current + 5, duration);

    regionsPluginRef.current.clearRegions();
    regionsPluginRef.current.addRegion({
      start: current,
      end: end,
      color: "rgba(79, 70, 229, 0.3)",
      drag: true,
      resize: true,
    });
  }, [currentTime, selectedRegion, duration]);

  const setRegionEnd = useCallback(() => {
    if (!wavesurferRef.current || !regionsPluginRef.current) return;

    const current = currentTime;
    const start = selectedRegion
      ? selectedRegion.start
      : Math.max(current - 5, 0);

    regionsPluginRef.current.clearRegions();
    regionsPluginRef.current.addRegion({
      start: start,
      end: current,
      color: "rgba(79, 70, 229, 0.3)",
      drag: true,
      resize: true,
    });
  }, [currentTime, selectedRegion]);

  const adjustRegionStart = useCallback(
    (delta: number) => {
      if (!selectedRegion || !regionsPluginRef.current) return;

      const newStart = Math.max(0, selectedRegion.start + delta);
      if (newStart >= selectedRegion.end) return;

      const regions = regionsPluginRef.current.getRegions();
      const region = regions.find((r: any) => r.id === selectedRegion.id);
      if (region) {
        region.setOptions({ start: newStart });
      }
    },
    [selectedRegion]
  );

  const adjustRegionEnd = useCallback(
    (delta: number) => {
      if (!selectedRegion || !regionsPluginRef.current) return;

      const newEnd = Math.min(duration, selectedRegion.end + delta);
      if (newEnd <= selectedRegion.start) return;

      const regions = regionsPluginRef.current.getRegions();
      const region = regions.find((r: any) => r.id === selectedRegion.id);
      if (region) {
        region.setOptions({ end: newEnd });
      }
    },
    [selectedRegion, duration]
  );

  const clearSelection = useCallback(() => {
    if (!regionsPluginRef.current) return;
    regionsPluginRef.current.clearRegions();
  }, []);

  const playRegion = useCallback(() => {
    if (!wavesurferRef.current || !selectedRegion) return;

    const wavesurfer = wavesurferRef.current;
    const regionEnd = selectedRegion.end;

    // Create a listener to stop at region end
    const stopAtRegionEnd = (currentTime: number) => {
      if (currentTime >= regionEnd) {
        wavesurfer.pause();
        // Remove the listener after stopping
        wavesurfer.un("timeupdate", stopAtRegionEnd);
      }
    };

    // Add the listener
    wavesurfer.on("timeupdate", stopAtRegionEnd);

    // Also clean up listener if user manually pauses/stops
    const cleanup = () => {
      wavesurfer.un("timeupdate", stopAtRegionEnd);
      wavesurfer.un("pause", cleanup);
      wavesurfer.un("finish", cleanup);
    };

    wavesurfer.on("pause", cleanup);
    wavesurfer.on("finish", cleanup);

    // Start playback from region start
    wavesurfer.seekTo(selectedRegion.start / duration);
    wavesurfer.play();
  }, [selectedRegion, duration]);

  // Zoom control functions
  const zoomIn = useCallback(() => {
    if (!wavesurferRef.current) return;
    const newZoom = Math.min(zoomLevel * 2, 1000); // Max zoom 1000px per second
    setZoomLevel(newZoom);
    wavesurferRef.current.zoom(newZoom);
  }, [zoomLevel]);

  const zoomOut = useCallback(() => {
    if (!wavesurferRef.current) return;
    const newZoom = Math.max(zoomLevel / 2, 1); // Min zoom 1px per second
    setZoomLevel(newZoom);
    wavesurferRef.current.zoom(newZoom);
  }, [zoomLevel]);

  const zoomToFit = useCallback(() => {
    if (!wavesurferRef.current || !waveformRef.current) return;
    // Calculate zoom to fit entire waveform in container
    const containerWidth = waveformRef.current.offsetWidth;
    const newZoom = Math.max(1, containerWidth / duration);
    setZoomLevel(newZoom);
    wavesurferRef.current.zoom(newZoom);
  }, [duration]);

  // Clip extraction - creates optimized audio
  const handleExtractClip = useCallback(async () => {
    if (!wavesurferRef.current || !selectedRegion) return;

    try {
      console.log(
        "✂️ AudioEditor: Extracting clip from",
        selectedRegion.start,
        "to",
        selectedRegion.end
      );

      const audioBuffer = wavesurferRef.current.getDecodedData();
      if (!audioBuffer) {
        throw new Error("No audio data available");
      }

      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(selectedRegion.start * sampleRate);
      const endSample = Math.floor(selectedRegion.end * sampleRate);
      const length = endSample - startSample;

      if (length <= 0) {
        throw new Error("Invalid region selection");
      }

      console.log(
        `📊 AudioEditor: Extracting ${length} samples at ${sampleRate}Hz`
      );
      console.log(
        `🔊 Original buffer info: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`
      );

      // Create AudioContext with the SAME sample rate as original
      const audioContext = new AudioContext({
        sampleRate: audioBuffer.sampleRate,
      });

      // Create new audio buffer for the selected region
      const clipBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        length,
        sampleRate
      );

      // Copy audio data sample-by-sample (no processing to preserve quality)
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        const clipChannelData = clipBuffer.getChannelData(channel);

        // Direct copy without any processing to preserve quality
        for (let i = 0; i < length; i++) {
          clipChannelData[i] = channelData[startSample + i];
        }
      }

      console.log("🔄 AudioEditor: Converting to audio blob...");

      // Convert to WAV blob first (for processing by ClipExtractModal)
      const blob = await bufferToWaveBlob(clipBuffer);

      console.log(
        `✅ AudioEditor: Audio blob created, size: ${blob.size} bytes`
      );

      // Verify the blob is valid by testing it
      const testUrl = URL.createObjectURL(blob);
      const testAudio = new Audio();

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(testUrl);
          reject(new Error("Generated audio clip test timeout"));
        }, 3000);

        testAudio.addEventListener("loadedmetadata", () => {
          console.log(
            "✅ AudioEditor: Generated clip verified, duration:",
            testAudio.duration
          );
          clearTimeout(timeout);
          URL.revokeObjectURL(testUrl);
          resolve(undefined);
        });

        testAudio.addEventListener("error", (e) => {
          console.log("❌ AudioEditor: Generated clip test failed:", e);
          clearTimeout(timeout);
          URL.revokeObjectURL(testUrl);
          reject(new Error("Generated audio clip is invalid"));
        });

        testAudio.src = testUrl;
      });

      // Close the AudioContext to free resources
      await audioContext.close();

      setExtractedAudioBlob(blob);
      setExtractedTranscript("");
      setExtractModalOpen(true);
    } catch (err) {
      console.log("💥 AudioEditor: Clip extraction failed:", err);
      setError(
        `Failed to extract audio clip: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  }, [selectedRegion]);

  // Keyboard shortcuts - moved after function definitions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isReady) return;

      // Don't trigger shortcuts if user is typing
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlayPause();
          break;
        case "BracketLeft":
          e.preventDefault();
          if (e.shiftKey) {
            adjustRegionStart(-0.1);
          } else {
            setRegionStart();
          }
          break;
        case "BracketRight":
          e.preventDefault();
          if (e.shiftKey) {
            adjustRegionEnd(0.1);
          } else {
            setRegionEnd();
          }
          break;
        case "Enter":
          e.preventDefault();
          if (selectedRegion) {
            handleExtractClip();
          }
          break;
        case "Escape":
          e.preventDefault();
          clearSelection();
          break;
        case "Equal": // + key
        case "NumpadAdd":
          e.preventDefault();
          zoomIn();
          break;
        case "Minus":
        case "NumpadSubtract":
          e.preventDefault();
          zoomOut();
          break;
        case "Digit0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomToFit();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isReady,
    selectedRegion,
    togglePlayPause,
    setRegionStart,
    setRegionEnd,
    adjustRegionStart,
    adjustRegionEnd,
    clearSelection,
    handleExtractClip,
    zoomIn,
    zoomOut,
    zoomToFit,
  ]);

  // Helper function to convert AudioBuffer to WAV blob (will be processed by modal)
  const bufferToWaveBlob = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Use 16-bit for intermediate processing (will be converted by modal)
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // Helper to write string to buffer
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV file header (44 bytes) for 16-bit
    writeString(0, "RIFF"); // ChunkID
    view.setUint32(4, bufferSize - 8, true); // ChunkSize (little-endian)
    writeString(8, "WAVE"); // Format
    writeString(12, "fmt "); // Subchunk1ID
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numberOfChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample (16-bit)
    writeString(36, "data"); // Subchunk2ID
    view.setUint32(40, dataSize, true); // Subchunk2Size

    // Convert float32 audio data to 16-bit int and write to buffer
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        // Get sample value and clamp to [-1, 1]
        let sample = Math.max(
          -1,
          Math.min(1, audioBuffer.getChannelData(channel)[i])
        );

        // Convert to 16-bit signed integer (range: -32768 to 32767)
        const intSample = Math.round(sample * 32767);
        const clampedSample = Math.max(-32768, Math.min(32767, intSample));

        // Write 16-bit sample as 2 bytes (little-endian)
        view.setInt16(offset, clampedSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms
      .toString()
      .padStart(2, "0")}`;
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    initializationRef.current = false;
  };

  return (
    <>
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6">
        {/* File Info */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{file.name}</h2>
            <p className="text-sm text-gray-600">
              {formatTime(duration)} • {(file.size / (1024 * 1024)).toFixed(1)}{" "}
              MB
            </p>
          </div>
          {selectedRegion && (
            <div className="text-right">
              <p className="text-sm font-medium text-indigo-600">
                Selected:{" "}
                {formatTime(selectedRegion.end - selectedRegion.start)}
              </p>
              <p className="text-xs text-gray-500">
                {formatTime(selectedRegion.start)} -{" "}
                {formatTime(selectedRegion.end)}
              </p>
            </div>
          )}
        </div>

        {/* Waveform */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden relative">
          {/* Zoom Controls */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white rounded-md shadow-sm border border-gray-200 p-1">
            <button
              onClick={zoomOut}
              disabled={!isReady || zoomLevel <= 1}
              className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom Out"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                />
              </svg>
            </button>
            <span className="text-xs text-gray-600 px-1">
              {zoomLevel.toFixed(0)}x
            </span>
            <button
              onClick={zoomIn}
              disabled={!isReady || zoomLevel >= 1000}
              className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom In"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                />
              </svg>
            </button>
            <button
              onClick={zoomToFit}
              disabled={!isReady}
              className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              title="Zoom to Fit"
            >
              Fit
            </button>
          </div>

          <div ref={waveformRef} className="w-full min-h-[150px]" />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90">
              <div className="flex items-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="ml-3 text-gray-600">
                  Loading audio file...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 bg-opacity-90">
              <div className="flex items-center text-red-600 mb-4">
                <AlertCircle className="w-6 h-6" />
                <span className="ml-3">{error}</span>
              </div>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        {isReady && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="audio-control-btn"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={stop}
                className="audio-control-btn"
                aria-label="Stop"
              >
                <Square className="w-4 h-4" />
              </button>

              <button
                onClick={restart}
                className="audio-control-btn"
                aria-label="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {selectedRegion && (
                <button
                  onClick={playRegion}
                  className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium"
                >
                  Play Selection
                </button>
              )}
            </div>

            <div className="text-sm text-gray-600 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volumeLevel}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Region Controls */}
        {isReady && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Region Selection</h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={setRegionStart}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium"
              >
                Set Start [
              </button>

              <button
                onClick={setRegionEnd}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium"
              >
                Set End ]
              </button>

              <button
                onClick={clearSelection}
                disabled={!selectedRegion}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm font-medium disabled:opacity-50"
              >
                Clear Selection
              </button>

              <button
                onClick={handleExtractClip}
                disabled={!selectedRegion}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Scissors className="w-4 h-4" />
                Extract Clip
              </button>
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <p>
                <strong>💡 How to select:</strong> Click and drag on the
                waveform to select a region
              </p>
              <p>
                <kbd className="keyboard-hint">Space</kbd> Play/Pause •{" "}
                <kbd className="keyboard-hint">[</kbd> Set start •{" "}
                <kbd className="keyboard-hint">]</kbd> Set end
              </p>
              <p>
                <kbd className="keyboard-hint">Shift + [/]</kbd> Fine-tune by
                0.1s • <kbd className="keyboard-hint">Enter</kbd> Extract clip •{" "}
                <kbd className="keyboard-hint">Esc</kbd> Clear selection
              </p>
              <p>
                <kbd className="keyboard-hint">+/-</kbd> Zoom in/out •{" "}
                <kbd className="keyboard-hint">Ctrl+0</kbd> Zoom to fit
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Extract Modal */}
      {extractModalOpen && extractedAudioBlob && selectedRegion && (
        <ClipExtractModal
          isOpen={extractModalOpen}
          onClose={() => {
            setExtractModalOpen(false);
            setExtractedTranscript("");
          }}
          audioBlob={extractedAudioBlob}
          duration={selectedRegion.end - selectedRegion.start}
          originalFilename={file.name}
          initialTranscript={extractedTranscript}
          initialSourceUrl={sourceUrl}
          onSuccess={() => {
            setExtractModalOpen(false);
            setExtractedTranscript("");
            clearSelection();
          }}
        />
      )}
    </>
  );
}
