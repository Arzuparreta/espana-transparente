-- User profile foundation.
-- Public identity is opt-in through is_public, while account settings and
-- avatar objects stay private to the owner.

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text UNIQUE,
  display_name text,
  bio text,
  website_url text,
  location text,
  avatar_path text,
  is_public boolean NOT NULL DEFAULT false,
  public_options jsonb NOT NULL DEFAULT '{"show_recent_annotations": true, "show_avatar": true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_handle_format
    CHECK (handle IS NULL OR handle ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  CONSTRAINT user_profiles_display_name_length
    CHECK (display_name IS NULL OR char_length(display_name) <= 80),
  CONSTRAINT user_profiles_bio_length
    CHECK (bio IS NULL OR char_length(bio) <= 280),
  CONSTRAINT user_profiles_location_length
    CHECK (location IS NULL OR char_length(location) <= 80),
  CONSTRAINT user_profiles_website_url_format
    CHECK (website_url IS NULL OR website_url ~ '^https?://')
);

CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_public_handle_idx
  ON user_profiles (handle)
  WHERE is_public = true AND handle IS NOT NULL;

CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_profile_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_user_profile_settings_updated_at
    BEFORE UPDATE ON user_profile_settings
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profile_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_profile'
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
  END IF;
END $$;

INSERT INTO user_profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profile_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read public profiles" ON user_profiles;
CREATE POLICY "Public read public profiles"
  ON user_profiles
  FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
CREATE POLICY "Users read own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;
CREATE POLICY "Users insert own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users read own profile settings" ON user_profile_settings;
CREATE POLICY "Users read own profile settings"
  ON user_profile_settings
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own profile settings" ON user_profile_settings;
CREATE POLICY "Users update own profile settings"
  ON user_profile_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own profile settings" ON user_profile_settings;
CREATE POLICY "Users insert own profile settings"
  ON user_profile_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "Users read own avatars" ON storage.objects;
CREATE POLICY "Users read own avatars"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users upload own avatars" ON storage.objects;
CREATE POLICY "Users upload own avatars"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users update own avatars" ON storage.objects;
CREATE POLICY "Users update own avatars"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users delete own avatars" ON storage.objects;
CREATE POLICY "Users delete own avatars"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
