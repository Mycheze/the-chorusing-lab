-- Migration: Add discovery features tables (difficulty ratings and votes)
-- Run this in your Supabase SQL editor

-- Create clip_difficulty_ratings table
CREATE TABLE IF NOT EXISTS clip_difficulty_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES audio_clips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clip_id, user_id)
);

-- Create clip_votes table
CREATE TABLE IF NOT EXISTS clip_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES audio_clips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clip_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clip_difficulty_ratings_clip_id ON clip_difficulty_ratings(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_difficulty_ratings_user_id ON clip_difficulty_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_clip_votes_clip_id ON clip_votes(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_votes_user_id ON clip_votes(user_id);

-- Enable RLS
ALTER TABLE clip_difficulty_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clip_difficulty_ratings
-- Users can view all ratings
CREATE POLICY "Anyone can view difficulty ratings"
  ON clip_difficulty_ratings
  FOR SELECT
  USING (true);

-- Users can insert their own ratings
CREATE POLICY "Users can insert their own difficulty ratings"
  ON clip_difficulty_ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own difficulty ratings"
  ON clip_difficulty_ratings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their own difficulty ratings"
  ON clip_difficulty_ratings
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for clip_votes
-- Users can view all votes
CREATE POLICY "Anyone can view votes"
  ON clip_votes
  FOR SELECT
  USING (true);

-- Users can insert their own votes
CREATE POLICY "Users can insert their own votes"
  ON clip_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update their own votes"
  ON clip_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON clip_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE clip_difficulty_ratings IS 'User difficulty ratings for audio clips (1-5 scale)';
COMMENT ON TABLE clip_votes IS 'User up/down votes for audio clips';
COMMENT ON COLUMN clip_difficulty_ratings.rating IS 'Difficulty rating: 1=beginner, 3=intermediate, 5=advanced';
COMMENT ON COLUMN clip_votes.vote_type IS 'Vote type: up or down';
