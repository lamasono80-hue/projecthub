-- ============================================================
-- Phase 11: Google OAuth Profile Sync & Student Role Support
-- ============================================================
-- 1. Bổ sung trường role và cho phép 'student' nếu có CHECK constraint
DO $$
BEGIN
  -- Kiểm tra và cập nhật CHECK constraint trên profiles.role
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
      CHECK (role IN ('student', 'user', 'admin', 'moderator'));
  ELSE
    ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student' 
        CHECK (role IN ('student', 'user', 'admin', 'moderator'));
  END IF;
END $$;

-- 2. Đảm bảo RLS cho phép authenticated user INSERT và UPDATE chính profile của mình
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- 3. Cập nhật trigger handle_new_user để gán role = 'student' và lấy avatar_url/full_name từ Google OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  clean_display_name TEXT;
  avatar TEXT;
  user_role TEXT;
BEGIN
  -- 1. Tên hiển thị từ Google OAuth metadata
  clean_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name',
    SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1)
  );

  -- 2. Avatar từ Google metadata
  avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    'https://ui-avatars.com/api/?name=' || clean_display_name || '&background=6366f1&color=fff&bold=true'
  );

  -- 3. Role mặc định là 'student'
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'student'
  );

  -- 4. Tạo username an toàn
  base_username := SUBSTRING(LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1), '[^a-z0-9_]', '', 'g')) FROM 1 FOR 20);
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  -- 5. INSERT hoặc UPDATE
  INSERT INTO public.profiles (id, username, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    base_username || '_' || SUBSTR(REPLACE(NEW.id::TEXT, '-', ''), 1, 6),
    clean_display_name,
    avatar,
    user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    role = COALESCE(public.profiles.role, EXCLUDED.role, 'student'),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user exception: %', SQLERRM;
  RETURN NEW;
END;
$$;
