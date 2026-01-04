-- Migration: Add filter_preferences column to profiles table
-- Run this in your Supabase SQL editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS filter_preferences JSONB DEFAULT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN profiles.filter_preferences IS 'User filter preferences for audio library (language, speakerGender, speakerAgeRange)';
