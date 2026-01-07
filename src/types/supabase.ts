export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          email: string
          created_at: string
          updated_at: string
          filter_preferences: Json | null
        }
        Insert: {
          id: string
          username: string
          email: string
          created_at?: string
          updated_at?: string
          filter_preferences?: Json | null
        }
        Update: {
          id?: string
          username?: string
          email?: string
          created_at?: string
          updated_at?: string
          filter_preferences?: Json | null
        }
      }
      audio_clips: {
        Row: {
          id: string
          title: string
          duration: number
          filename: string
          original_filename: string
          file_size: number
          storage_path: string
          language: string
          speaker_gender: string | null
          speaker_age_range: string | null
          speaker_dialect: string | null
          transcript: string | null
          source_url: string | null
          tags: string[]
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          duration: number
          filename: string
          original_filename: string
          file_size: number
          storage_path: string
          language: string
          speaker_gender?: string | null
          speaker_age_range?: string | null
          speaker_dialect?: string | null
          transcript?: string | null
          source_url?: string | null
          tags?: string[]
          uploaded_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          duration?: number
          filename?: string
          original_filename?: string
          file_size?: number
          storage_path?: string
          language?: string
          speaker_gender?: string | null
          speaker_age_range?: string | null
          speaker_dialect?: string | null
          transcript?: string | null
          source_url?: string | null
          tags?: string[]
          uploaded_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      clip_stars: {
        Row: {
          id: string
          clip_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          user_id?: string
          created_at?: string
        }
      }
      clip_difficulty_ratings: {
        Row: {
          id: string
          clip_id: string
          user_id: string
          rating: number
          created_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          user_id: string
          rating: number
          created_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          user_id?: string
          rating?: number
          created_at?: string
        }
      }
      clip_votes: {
        Row: {
          id: string
          clip_id: string
          user_id: string
          vote_type: 'up' | 'down'
          created_at: string
        }
        Insert: {
          id?: string
          clip_id: string
          user_id: string
          vote_type: 'up' | 'down'
          created_at?: string
        }
        Update: {
          id?: string
          clip_id?: string
          user_id?: string
          vote_type?: 'up' | 'down'
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier use
export type Profile = Database['public']['Tables']['profiles']['Row']
export type AudioClipRow = Database['public']['Tables']['audio_clips']['Row']
export type ClipStar = Database['public']['Tables']['clip_stars']['Row']
export type ClipDifficultyRating = Database['public']['Tables']['clip_difficulty_ratings']['Row']
export type ClipVote = Database['public']['Tables']['clip_votes']['Row']

// Converted types that match our existing AudioClip interface
export interface SupabaseAudioClip {
  id: string
  title: string
  duration: number
  filename: string
  originalFilename: string
  fileSize: number
  storagePath: string
  metadata: {
    language: string
    speakerGender?: 'male' | 'female' | 'other'
    speakerAgeRange?: 'teen' | 'younger-adult' | 'adult' | 'senior'
    speakerDialect?: string
    transcript?: string
    sourceUrl?: string
    tags: string[]
  }
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

// Helper function to convert database row to our interface
export const convertAudioClipFromDb = (row: AudioClipRow): SupabaseAudioClip => ({
  id: row.id,
  title: row.title,
  duration: row.duration,
  filename: row.filename,
  originalFilename: row.original_filename,
  fileSize: row.file_size,
  storagePath: row.storage_path,
  metadata: {
    language: row.language,
    speakerGender: row.speaker_gender as any,
    speakerAgeRange: row.speaker_age_range as any,
    speakerDialect: row.speaker_dialect || undefined,
    transcript: row.transcript || undefined,
    sourceUrl: row.source_url || undefined,
    tags: row.tags || [],
  },
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// Helper function to convert our interface to database insert
export const convertAudioClipToDb = (
  clip: Omit<SupabaseAudioClip, 'id' | 'createdAt' | 'updatedAt'>
): Database['public']['Tables']['audio_clips']['Insert'] => {
  
  // Validate duration before conversion
  if (!clip.duration || isNaN(clip.duration) || clip.duration <= 0 || !isFinite(clip.duration)) {
    console.error('❌ Invalid duration in convertAudioClipToDb:', clip.duration, typeof clip.duration)
    throw new Error(`Invalid duration: ${clip.duration}. Duration must be a finite positive number.`)
  }
  
  return {
    title: clip.title,
    duration: clip.duration,
    filename: clip.filename,
    original_filename: clip.originalFilename,
    file_size: clip.fileSize,
    storage_path: clip.storagePath,
    language: clip.metadata.language,
    speaker_gender: clip.metadata.speakerGender || null,
    speaker_age_range: clip.metadata.speakerAgeRange || null,
    speaker_dialect: clip.metadata.speakerDialect || null,
    transcript: clip.metadata.transcript || null,
    source_url: clip.metadata.sourceUrl || null,
    tags: clip.metadata.tags,
    uploaded_by: clip.uploadedBy,
  }
}