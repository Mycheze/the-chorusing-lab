# Chorus Lab - Implementation Roadmap

## 🎯 Current Status: Phase 1 & 2 Mostly Complete ✅

### ✅ Completed Features

**Core Audio:**

- ✅ Audio Player Component (`AudioPlayer.tsx`, `useAudioPlayer.ts`, `config.ts`)
- ✅ WaveSurfer.js integration with waveform visualization
- ✅ Audio Region Selection (drag selection in `ChorusingPlayer` and `AudioEditor`)
- ✅ Clip Creator (`AudioEditor.tsx` for extracting clips from long files)

**Upload & Processing:**

- ✅ File Upload & Processing (`UploadModal.tsx`, `/api/upload/route.ts`)
- ✅ Audio Metadata System (full metadata tagging in upload forms)
- ✅ Multi-format support (MP3, WAV, M4A, OGG, WebM)

**Backend & Infrastructure:**

- ✅ Supabase Integration (database, auth, storage)
- ✅ User authentication system
- ✅ Row Level Security (RLS) policies

**Social Features:**

- ✅ Audio Library & Discovery (`AudioBrowser.tsx` with filtering/search)
- ✅ Transcription Testing (`TranscriptionPractice.tsx`)
- ✅ Star/unstar clips functionality
- ✅ Edit clip metadata

### ⚠️ Partially Complete

**Keyboard Controls:**

- ✅ Component-specific shortcuts exist (`AudioEditor`, `TranscriptionPractice`)
- ❌ No global keyboard shortcut system
- ❌ `ChorusingPlayer` has NO keyboard shortcuts (only button controls)
- ❌ No `KeyboardHints.tsx` component

### ❌ Remaining Work

**High Priority:**

- ❌ Global keyboard shortcut system (`useKeyboardShortcuts.ts`, `KeyboardHints.tsx`)
- ❌ Add keyboard shortcuts to `ChorusingPlayer`

**Medium Priority:**

- ❌ Audio Monitoring UI (latency compensation, input level monitoring, microphone input)

**Future (Phase 3):**

- ❌ Desktop App Foundation (Tauri integration, zero-latency monitoring)

---

## 📅 Phase 1: Core Audio Features

### 1. **Audio Player Component** ✅ COMPLETE

**Status: DONE**

**Deliverables:**

- ✅ `src/components/audio/AudioPlayer.tsx` - Core player with WaveSurfer.js integration
- ✅ `src/hooks/useAudioPlayer.ts` - State management for playback
- ✅ `src/lib/audio/config.ts` - WaveSurfer configuration
- ✅ `src/components/chorus/ChorusingPlayer.tsx` - Main practice player with waveform

**Technical Requirements:**

- ✅ WaveSurfer.js integration with proper TypeScript types
- ✅ Real-time waveform rendering
- ✅ Basic playback controls (play, pause, seek, restart, loop)
- ✅ Audio loading states and error handling
- ✅ Responsive design for mobile/desktop

### 2. **Keyboard Controls System** ⚠️ PARTIAL

**Priority: HIGH** | **Complexity: Medium** | **Status: IN PROGRESS**

**Current State:**

- ✅ Component-specific shortcuts exist:
  - `AudioEditor`: Space, `[`/`]` for regions, Enter to extract, Escape to clear, +/- for zoom
  - `TranscriptionPractice`: `T` to toggle reveal, Ctrl+Enter to submit
- ❌ No global keyboard shortcut system
- ❌ No unified `useKeyboardShortcuts.ts` hook
- ❌ No `KeyboardHints.tsx` component for displaying shortcuts
- ❌ `ChorusingPlayer` has NO keyboard shortcuts (only button controls)

**Remaining Deliverables:**

- `src/hooks/useKeyboardShortcuts.ts` - Global hotkey system
- `src/components/ui/KeyboardHints.tsx` - Visual shortcut display
- Integration with `ChorusingPlayer` for keyboard-driven workflow

**Planned Key Shortcuts for ChorusingPlayer:**

- `Space` - Play/Pause
- `R` - Restart from beginning
- `L` - Toggle loop mode
- `←/→` - Skip back/forward 2 seconds
- `↑/↓` - Volume control
- `S/E` - Set region start/end points (if not using drag selection)

### 3. **Audio Region Selection** ✅ COMPLETE

**Status: DONE**

**Deliverables:**

- ✅ Waveform region selection with visual feedback (drag selection in `ChorusingPlayer`)
- ✅ Loop region functionality (loops selected region when enabled)
- ✅ Region editing (drag to adjust start/end in WaveSurfer regions plugin)
- ✅ Clip extraction from regions (`AudioEditor` with `ClipExtractModal`)

**User Experience:**

- ✅ Click and drag to select regions
- ✅ Visual highlighting of selected areas
- ✅ Automatic looping of selected regions
- ✅ Keyboard shortcuts for precise region setting (in `AudioEditor`)

### 4. **File Upload & Processing** ✅ COMPLETE

**Status: DONE**

**Deliverables:**

- ✅ `src/components/upload/UploadModal.tsx` - Drag-and-drop interface with metadata form
- ✅ `src/app/api/upload/route.ts` - Server-side processing
- ✅ `src/components/audio/ClipExtractModal.tsx` - Client-side audio processing for clip extraction
- ✅ Multi-format support (MP3, WAV, M4A, OGG, WebM)

**Features:**

- ✅ Drag-and-drop file upload
- ✅ Client-side format validation
- ✅ Server-side file storage (Supabase Storage)
- ✅ Client-side audio processing for clip extraction
- ✅ Progress indicators and error handling

### 5. **Audio Metadata System** ✅ COMPLETE

**Status: DONE**

**Deliverables:**

- ✅ Metadata forms in `UploadModal.tsx` and `ClipExtractModal.tsx`
- ✅ Database schema implemented in Supabase (`audio_clips` table with JSONB metadata)
- ✅ Audio clip management system (`AudioBrowser.tsx`, edit functionality)

**Metadata Fields (All Implemented):**

- ✅ Language and dialect
- ✅ Speaker demographics (gender, age range)
- ✅ Source information (sourceUrl)
- ✅ Custom tags (array of strings)
- ✅ Optional transcript
- ✅ Title, duration, file size tracking

---

## 📅 Phase 2: Social & Sharing Features

### 6. **Supabase Integration** ✅ COMPLETE

**Status: DONE**

- ✅ Database schema implementation (`profiles`, `audio_clips`, `clip_stars` tables)
- ✅ User authentication system (`src/lib/auth.tsx`, full auth flow)
- ✅ Audio file storage with CDN (Supabase Storage bucket)
- ✅ Row Level Security (RLS) policies configured

### 7. **Audio Library & Discovery** ✅ COMPLETE

**Status: DONE**

- ✅ Browse audio clips by language (`AudioBrowser.tsx`)
- ✅ Search and filtering system (language, gender, age, tags, starred, my uploads)
- ✅ User favorites/collections (star/unstar functionality)
- ✅ Sort by title, duration, language, creation date
- ✅ Edit clip metadata (for uploaders)

### 8. **Transcription Testing** ✅ COMPLETE

**Status: DONE**

- ✅ Hidden transcript reveal system (`TranscriptionPractice.tsx`)
- ✅ User input comparison with character-by-character diff
- ✅ Visual diff highlighting
- ✅ Update transcript functionality (for uploaders)
- ✅ Keyboard shortcuts (`T` to toggle, Ctrl+Enter to submit)

### 9. **Audio Monitoring UI** ❌ NOT STARTED

**Priority: MEDIUM** | **Complexity: Medium-High** | **Status: TODO**

**Remaining Deliverables:**

- Latency compensation interface
- Audio input level monitoring
- Browser limitation explanations
- Microphone input/recording capability

---

## 📅 Phase 3: Desktop App Foundation (Sessions 11+)

### 10. **Shared Component Library**

- Extract reusable components
- Platform-agnostic audio interfaces
- Tauri integration planning

---

## 🎯 Success Metrics Per Session

**Session Success Criteria:**

- ✅ Complete, working feature with no errors
- ✅ Proper TypeScript integration
- ✅ Mobile-responsive design
- ✅ Keyboard accessibility
- ✅ Performance optimized for audio processing

**User Testing Points:**

- Can user upload an audio file and see waveform?
- Are keyboard shortcuts intuitive and fast?
- Does region selection feel natural?
- Is the overall experience faster than existing tools?

---

## 🚀 Immediate Next Session Focus

**Recommended Priority Order:**

1. **Global Keyboard Shortcut System** (HIGH PRIORITY)

   - Create `useKeyboardShortcuts.ts` hook for unified shortcut management
   - Add keyboard shortcuts to `ChorusingPlayer` (currently missing)
   - Create `KeyboardHints.tsx` component to display available shortcuts
   - Standardize shortcuts across all audio components

2. **Audio Monitoring UI** (MEDIUM PRIORITY)

   - Implement microphone input/recording
   - Add latency compensation interface
   - Audio input level monitoring
   - Browser limitation explanations for users

3. **Desktop App Foundation** (FUTURE)
   - Extract reusable components
   - Platform-agnostic audio interfaces
   - Tauri integration planning
   - Zero-latency audio monitoring (desktop-only feature)

**Current State:** The app is fully functional for core chorusing practice. The main missing piece is a unified keyboard shortcut system to make the workflow faster and more keyboard-driven.
