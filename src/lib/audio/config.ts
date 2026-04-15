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

// Audio format support
export const supportedFormats = ['mp3', 'wav', 'm4a', 'ogg', 'webm'];