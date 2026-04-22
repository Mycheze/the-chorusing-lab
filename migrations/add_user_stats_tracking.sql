-- Migration: Add user stats and tracking tables
-- Run this in your Supabase SQL editor

-- Create clip_sessions table - Tracks individual practice sessions on clips (only when audio is actually played)
CREATE TABLE IF NOT EXISTS clip_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clip_id UUID NOT NULL REFERENCES audio_clips(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  total_time_seconds NUMERIC NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),
  loop_count INTEGER NOT NULL DEFAULT 0 CHECK (loop_count >= 0),
  restart_count INTEGER NOT NULL DEFAULT 0 CHECK (restart_count >= 0),
  language TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transcription_attempts table - Tracks transcription practice attempts
CREATE TABLE IF NOT EXISTS transcription_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clip_id UUID NOT NULL REFERENCES audio_clips(id) ON DELETE CASCADE,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accuracy NUMERIC CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)),
  is_submission BOOLEAN NOT NULL DEFAULT false,
  characters_correct INTEGER CHECK (characters_correct IS NULL OR characters_correct >= 0),
  characters_total INTEGER CHECK (characters_total IS NULL OR characters_total >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_stats_cache table - Aggregated stats for quick access
CREATE TABLE IF NOT EXISTS user_stats_cache (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_chorusing_time_seconds NUMERIC NOT NULL DEFAULT 0 CHECK (total_chorusing_time_seconds >= 0),
  total_clips_practiced INTEGER NOT NULL DEFAULT 0 CHECK (total_clips_practiced >= 0),
  total_transcription_attempts INTEGER NOT NULL DEFAULT 0 CHECK (total_transcription_attempts >= 0),
  total_clips_submitted INTEGER NOT NULL DEFAULT 0 CHECK (total_clips_submitted >= 0),
  language_stats JSONB DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clip_sessions_user_id ON clip_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_clip_sessions_clip_id ON clip_sessions(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_sessions_started_at ON clip_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_clip_sessions_user_language ON clip_sessions(user_id, language);
CREATE INDEX IF NOT EXISTS idx_clip_sessions_user_clip ON clip_sessions(user_id, clip_id);

CREATE INDEX IF NOT EXISTS idx_transcription_attempts_user_id ON transcription_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_attempts_clip_id ON transcription_attempts(clip_id);
CREATE INDEX IF NOT EXISTS idx_transcription_attempts_attempted_at ON transcription_attempts(attempted_at DESC);

-- Enable RLS
ALTER TABLE clip_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clip_sessions
-- Users can view their own sessions
CREATE POLICY "Users can view their own clip sessions"
  ON clip_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert their own clip sessions"
  ON clip_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update their own clip sessions"
  ON clip_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete their own clip sessions"
  ON clip_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public read access for aggregated stats (for clip creators to see time spent on their clips)
CREATE POLICY "Anyone can view clip session stats for clip creators"
  ON clip_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM audio_clips
      WHERE audio_clips.id = clip_sessions.clip_id
      AND audio_clips.uploaded_by = auth.uid()
    )
  );

-- RLS Policies for transcription_attempts
-- Users can view their own attempts
CREATE POLICY "Users can view their own transcription attempts"
  ON transcription_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own attempts
CREATE POLICY "Users can insert their own transcription attempts"
  ON transcription_attempts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own attempts
CREATE POLICY "Users can update their own transcription attempts"
  ON transcription_attempts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own attempts
CREATE POLICY "Users can delete their own transcription attempts"
  ON transcription_attempts
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_stats_cache
-- Users can view their own stats
CREATE POLICY "Users can view their own stats cache"
  ON user_stats_cache
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own stats
CREATE POLICY "Users can update their own stats cache"
  ON user_stats_cache
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE clip_sessions IS 'Tracks individual practice sessions on clips. Only created when user actually starts playing audio.';
COMMENT ON COLUMN clip_sessions.total_time_seconds IS 'Actual accumulated playback time (only seconds when audio was playing, excluding pauses)';
COMMENT ON COLUMN clip_sessions.loop_count IS 'Number of loops (auto-loop or manual R key presses)';
COMMENT ON COLUMN clip_sessions.restart_count IS 'Number of times R key was pressed';
COMMENT ON TABLE transcription_attempts IS 'Tracks transcription practice attempts and submissions';
COMMENT ON COLUMN transcription_attempts.accuracy IS 'Percentage accuracy if original transcript exists (0-100)';
COMMENT ON COLUMN transcription_attempts.is_submission IS 'Whether this was a new transcript submission (true) or just a practice attempt (false)';
COMMENT ON TABLE user_stats_cache IS 'Aggregated stats for quick access. Updated via application logic or triggers.';
COMMENT ON COLUMN user_stats_cache.language_stats IS 'JSONB object with per-language stats: {"en": {"time_seconds": 3600, "clips_practiced": 10}}';
