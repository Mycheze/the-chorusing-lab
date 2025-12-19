// src/lib/audio/config.ts
import type { WaveformConfig } from '@/types/audio';

export const defaultWaveformConfig: WaveformConfig = {
  height: 128,
  waveColor: '#e5e7eb', // gray-200
  progressColor: '#4f46e5', // indigo-600
  cursorColor: '#1f2937', // gray-800
  backgroundColor: '#f9fafb', // gray-50
  responsive: true,
  normalize: true,
};

export const waveformThemes = {
  default: defaultWaveformConfig,
  dark: {
    ...defaultWaveformConfig,
    waveColor: '#374151', // gray-700
    progressColor: '#6366f1', // indigo-500
    cursorColor: '#f3f4f6', // gray-100
    backgroundColor: '#111827', // gray-900
  },
  minimal: {
    ...defaultWaveformConfig,
    height: 96,
    waveColor: '#d1d5db', // gray-300
    progressColor: '#059669', // emerald-600
    cursorColor: '#065f46', // emerald-800
  }
};

// WaveSurfer.js specific configuration
export const createWaveSurferConfig = (container: HTMLDivElement) => ({
  container,
  height: 128,
  waveColor: '#e5e7eb',
  progressColor: '#4f46e5',
  cursorColor: '#1f2937',
  cursorWidth: 2,
  interact: true,
  hideScrollbar: true,
  normalize: true,
  backend: 'WebAudio' as const,
  mediaControls: false,
  autoplay: false,
  responsive: true,
  // Safe pixel ratio that works with SSR
  pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
});

// Demo audio URLs for testing
export const demoAudioUrls = {
  bell: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
  sample: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3',
};

// Audio format support
export const supportedFormats = ['mp3', 'wav', 'm4a', 'ogg', 'webm'];

// Optimized settings for chorusing
export const chorusingDefaults = {
  minPxPerSec: 50, // Good granularity for short clips
  maxCanvasWidth: 4000, // Prevent performance issues
  fillParent: true,
  scrollParent: true,
  autoCenter: true,
};