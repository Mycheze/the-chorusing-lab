// Minimal WaveSurfer type declarations for the methods used in this codebase.
// These cover the WaveSurfer API surface actually used in ChorusingPlayer.tsx.

export interface WaveSurferBackend {
  media?: HTMLMediaElement;
  el?: HTMLMediaElement;
  mediaElement?: HTMLMediaElement;
  gainNode?: GainNode;
  ac?: AudioContext;
}

export interface WaveSurferRegion {
  id: string;
  start: number;
  end: number;
  remove(): void;
}

export interface WaveSurferRegionsPlugin {
  create(): WaveSurferRegionsPlugin;
  on(event: string, callback: (...args: unknown[]) => void): void;
  getRegions(): WaveSurferRegion[];
  enableDragSelection(options: { color: string }): void;
  enable(): void;
  disable(): void;
}

export interface WaveSurferInstance {
  load(url: string): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  destroy(): void;
  getDuration(): number;
  getCurrentTime(): number;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  seekTo(progress: number): void;
  setTime(time: number): void;
  isPlaying(): boolean;
  on(event: string, callback: (...args: unknown[]) => void): void;
  un(event: string, callback: (...args: unknown[]) => void): void;
  getMediaElement(): HTMLMediaElement;
  /** Internal backend reference - access with care */
  backend?: WaveSurferBackend;
}
