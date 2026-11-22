-- ==============================================================================
-- My Music: Cloud Synchronization Schema (Supabase / PostgreSQL)
-- ==============================================================================
-- Run this script in your Supabase project SQL Editor to enable cross-platform
-- cloud library synchronization for My Music (Windows, Linux, Android).

-- 1. Create the user_libraries table
CREATE TABLE IF NOT EXISTS public.user_libraries (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  favorites JSONB DEFAULT '[]'::jsonb,
  playlists JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  play_stats JSONB DEFAULT '{"totalPlays":0,"totalSeconds":0,"tracks":{},"artists":{}}'::jsonb,
  lyrics_offsets JSONB DEFAULT '{}'::jsonb,
  client_version TEXT DEFAULT '1.1.8',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_libraries ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Users can only read their own synchronized library
DROP POLICY IF EXISTS "Users can read own library" ON public.user_libraries;
CREATE POLICY "Users can read own library"
  ON public.user_libraries
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Policy: Users can only insert their own synchronized library
DROP POLICY IF EXISTS "Users can insert own library" ON public.user_libraries;
CREATE POLICY "Users can insert own library"
  ON public.user_libraries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Policy: Users can only update their own synchronized library
DROP POLICY IF EXISTS "Users can update own library" ON public.user_libraries;
CREATE POLICY "Users can update own library"
  ON public.user_libraries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Policy: Users can delete their own synchronized library
DROP POLICY IF EXISTS "Users can delete own library" ON public.user_libraries;
CREATE POLICY "Users can delete own library"
  ON public.user_libraries
  FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Add index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_user_libraries_user_id ON public.user_libraries(user_id);
