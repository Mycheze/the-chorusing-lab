# Chorus Lab

A modern web application for language learning through chorusing - the technique of playing and repeating audio clips to master pronunciation and listening skills.

## 🎯 What is Chorusing?

Chorusing is a powerful language learning technique where you:

1. Listen to a short audio clip (2-10 seconds)
2. Repeat along with it multiple times
3. Practice until you can match the rhythm, intonation, and pronunciation perfectly

This app makes chorusing easy, fast, and social.

## ✨ Features

### Core Features

- **Audio Waveform Visualization**: See exactly what you're listening to
- **Keyboard-Driven Controls**: Lightning-fast workflow with hotkeys
- **Region Selection**: Choose exactly which part of audio to practice
- **Loop Controls**: Automatic repetition for focused practice
- **Audio Monitoring**: Hear yourself while practicing (web + future desktop)

### Social Features

- **Audio Sharing**: Upload clips for other learners
- **Language Organization**: Browse clips by language and difficulty
- **Metadata Tagging**: Speaker info, source, transcript, difficulty level
- **Transcription Testing**: Hidden text reveals for comprehension practice

### Technical Features

- **Multi-format Support**: MP3, WAV, M4A, OGG, WebM
- **File Optimization**: Automatic compression for faster loading
- **Mobile Responsive**: Works on phones, tablets, and desktop
- **Real-time Processing**: Low-latency audio for natural practice

## 🚀 Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Audio**: WaveSurfer.js, Web Audio API
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + Storage)
- **Deployment**: Vercel

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd chorus-lab

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

### Development Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

## 📁 Project Structure

```
chorus-lab/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # React components
│   │   ├── audio/          # Audio-specific components
│   │   └── ui/             # General UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and configurations
│   └── types/              # TypeScript type definitions
├── scripts/                # Build and utility scripts
├── docs/                   # Documentation
└── [config files]         # package.json, tsconfig.json, etc.
```

## 🎵 Audio Architecture

### Browser Limitations

- **Audio Monitoring Latency**: 20-50ms minimum in browsers
- **Latency Compensation UI**: Visual feedback for timing
- **Future Desktop Version**: True zero-latency monitoring planned

### Audio Pipeline

1. **Upload**: Multi-format acceptance
2. **Processing**: Server-side optimization and metadata extraction
3. **Storage**: Supabase with CDN delivery
4. **Playback**: WaveSurfer.js with custom controls

## 🔧 Configuration

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Admin Configuration (optional)
# Comma-separated list of user IDs that have admin privileges
# Admins can edit and delete any clips, regardless of ownership
ADMIN_USER_IDS=user-id-1,user-id-2,user-id-3
```

**Note:** File uploads are currently limited to 2MB. Supported formats: MP3, WAV, M4A, OGG, WebM.

## 🎯 Development Phases

### Phase 1: Core Web App ✅

- [x] Project setup and foundation
- [x] Audio player with waveform
- [x] Keyboard controls
- [x] File upload and processing
- [x] Basic UI/UX

### Phase 2: Social Features

- [x] User authentication
- [x] Audio sharing and discovery
- [x] Transcription testing
- [x] Language categorization

### Phase 3: Desktop Version ???

- [ ] Tauri desktop app
- [ ] Zero-latency audio monitoring
- [ ] Shared component library
- [ ] Cross-platform deployment

## 🤝 Contributing

This is currently a personal learning project. Future contributions welcome as the project matures.

## 📄 License

[License TBD]
