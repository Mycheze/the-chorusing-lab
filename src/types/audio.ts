// Core audio types for Chorus Lab

export interface AudioClip {
  id: string;
  title: string;
  duration: number; // in seconds, user-input
  filename: string; // local file reference
  originalFilename: string; // user's original filename
  fileSize: number; // in bytes
  metadata: AudioMetadata;
  uploadedBy: string; // user ID
  createdAt: string;
  updatedAt: string;
}

export interface AudioMetadata {
  language: string; // Now supports any language, not just hardcoded ones
  speakerGender?: 'male' | 'female' | 'other';
  speakerAgeRange?: 'teen' | 'younger-adult' | 'adult' | 'senior'; // Updated age ranges
  speakerDialect?: string;
  transcript?: string;
  sourceUrl?: string;
  tags: string[]; // comma-separated tags converted to array
}

export interface AudioUpload {
  file: File;
  title: string;
  duration: number;
  metadata: AudioMetadata;
}

export interface AudioRegion {
  id: string;
  start: number;
  end: number;
  loop: boolean;
  color?: string;
  label?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLooping: boolean;
  volume: number;
  playbackRate: number;
  activeRegion?: AudioRegion;
}

export interface AudioSettings {
  userVolume: number;
  audioVolume: number;
  enableMonitoring: boolean;
  monitoringLatencyMs: number;
  keyboardShortcuts: KeyboardShortcuts;
}

export interface KeyboardShortcuts {
  playPause: string;
  restart: string;
  toggleLoop: string;
  skipBack: string;
  skipForward: string;
  volumeUp: string;
  volumeDown: string;
  setRegionStart: string;
  setRegionEnd: string;
}

export interface WaveformConfig {
  height: number;
  waveColor: string;
  progressColor: string;
  cursorColor: string;
  backgroundColor: string;
  responsive: boolean;
  normalize: boolean;
}

export interface AudioAnalysis {
  peaks: number[];
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
  bitrate?: number;
}

// Filter and sort options for browse
export interface AudioFilters {
  language?: string; // Now supports any language string
  speakerGender?: 'male' | 'female' | 'other';
  speakerAgeRange?: 'teen' | 'younger-adult' | 'adult' | 'senior'; // Updated age ranges
  speakerDialect?: string;
  tags?: string[];
  uploadedBy?: string;
}

export interface AudioSort {
  field: 'title' | 'duration' | 'language' | 'createdAt';
  direction: 'asc' | 'desc';
}

// User filter preferences (saved to database)
export interface FilterPreferences {
  language?: string;
  speakerGender?: 'male' | 'female' | 'other';
  speakerAgeRange?: 'teen' | 'younger-adult' | 'adult' | 'senior';
  speakerDialect?: string;
}

// Event types for audio player
export type AudioPlayerEvent = 
  | 'play'
  | 'pause'
  | 'stop'
  | 'seek'
  | 'region-update'
  | 'ready'
  | 'loading'
  | 'error';

export interface AudioPlayerEventData {
  currentTime: number;
  duration: number;
  region?: AudioRegion;
  error?: string;
}

// Transcription practice types
export interface TranscriptionPracticeState {
  isRevealed: boolean;
  userInput: string;
  showComparison: boolean;
  isSubmitting: boolean;
  error?: string;
  comparison?: TranscriptionComparison;
}

export interface TranscriptionComparison {
  accuracy: number;
  diffs: TranscriptionDiff[];
  totalCharacters: number;
  correctCharacters: number;
}

export interface TranscriptionDiff {
  type: 'match' | 'replace' | 'delete' | 'insert';
  originalText: string;
  userText: string;
  startIndex: number;
  endIndex: number;
}