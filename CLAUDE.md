# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chorus Lab is a language learning web application built around the "chorusing" technique — playing and repeating audio clips for pronunciation mastery. Users upload, organize, browse, and practice with audio clips featuring native speaker recordings with transcripts.

## Project Structure

This is a **single Next.js 14 application** (not a monorepo).

```
/
├── src/
│   ├── app/               # Next.js app router (pages + API routes)
│   │   ├── api/           # API endpoints (auth, clips, bulk-upload, stats, tracking, etc.)
│   │   ├── chorus/        # Chorusing practice pages
│   │   ├── bulk-upload/   # Bulk upload page
│   │   ├── clip-creator/  # Clip creation tool
│   │   ├── library/       # Clip library/browsing
│   │   └── stats/         # Usage statistics
│   ├── components/        # React components
│   │   ├── audio/         # Audio player, waveform visualization
│   │   ├── auth/          # Auth modal, user menu
│   │   ├── browse/        # Discovery/filtering
│   │   ├── bulk-upload/   # Bulk upload UI
│   │   ├── chorus/        # Chorusing player, transcription practice
│   │   └── ui/            # Shared UI utilities
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Business logic and utilities
│   │   ├── auth.tsx       # Auth context and hooks
│   │   ├── supabase.ts    # Supabase client initialization
│   │   ├── server-database.ts  # Server-side database layer
│   │   ├── audio/         # Audio processing (conversion, config)
│   │   └── bulk-upload/   # CSV parsing, file matching
│   └── types/             # TypeScript type definitions
├── migrations/            # SQL database migrations
├── public/                # Static assets
└── ai-workflow/           # AI workflow system (see below)
```

## Common Commands

```bash
npm run dev              # Dev server (Next.js)
npm run build            # Production build (also serves as type check)
npm run lint             # ESLint
npm start                # Start production server
```

There is no dedicated test runner or test framework configured in this project currently.

## Key Technologies

| Technology        | Purpose                                   |
| ----------------- | ----------------------------------------- |
| Next.js 14.1      | React framework (App Router)              |
| TypeScript 5      | Type safety                               |
| Supabase          | PostgreSQL database, auth, file storage   |
| Tailwind CSS 3.3  | Utility-first styling                     |
| WaveSurfer.js 7.7 | Audio waveform visualization and playback |
| @descript/kali    | Audio/speech processing                   |
| Lucide React      | Icons                                     |

## Architecture

### Database

Supabase (hosted PostgreSQL) with:

- `profiles` — user accounts with preferences
- `audio_clips` — clip metadata (duration, language, speaker, transcript, tags)
- `clip_stars` — favorited clips
- Stats and tracking tables

Auth is handled by Supabase Auth (email/password). Admin roles are controlled via `ADMIN_USER_IDS` env var.

### Server/Client Pattern

- API routes in `src/app/api/` handle server-side logic
- `src/lib/server-database.ts` is the central database access layer
- Client components use `src/lib/supabase.ts` for direct Supabase client access
- Auth context in `src/lib/auth.tsx` manages client-side auth state

### Audio Handling

- Custom webpack config for audio file types (mp3, wav, ogg, m4a, webm)
- Server actions with 50MB body size limit for audio uploads
- Supabase Storage for file hosting
- WaveSurfer.js for interactive waveform playback

## Key Conventions

### TypeScript

- Avoid `as` type assertions — use type guards or fix underlying types
- Use discriminated unions with explicit `type` fields over type guards
- Prefer `switch` statements over `if/else` chains (explicit default case)

### React/Next.js

- Favor React Server Components where possible
- Use `@/*` path alias for imports (maps to `src/*`)
- Components are organized by feature area under `src/components/`

## Environment Setup

1. Node.js 18+ (see `engines` in package.json)
2. Copy `.env.example` to `.env.local` and fill in Supabase keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_USER_IDS` (optional, comma-separated)
3. `npm install`
4. `npm run dev`

## AI Workflow System

The orchestrator + specialist workflow system lives in `ai-workflow/v2/`:

- `/rf-next` to start or resume work
- `/rf-investigate`, `/rf-plan`, `/rf-code`, etc. for manual specialist dispatch
- Runtime state in `.ai/`
- See `ai-workflow/v2/library.md` for available building blocks
