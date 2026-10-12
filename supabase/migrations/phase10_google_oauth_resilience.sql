-- ============================================================
-- Phase 10: Google OAuth & Database Profile Resilience
-- Khắc phục triệt để lỗi đăng nhập Google lần 2 hoặc trùng lặp email/username
-- ============================================================

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
BEGIN
  -- 1. Lấy tên hiển thị từ Google OAuth metadata (full_name, name, display_name) hoặc email
  clean_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name',
    SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1)
  );

  -- 2. Lấy avatar từ Google metadata (avatar_url, picture)
  avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  -- 3. Tạo username an toàn (tối đa 20 ký tự chữ cái/số để tránh vượt quá giới hạn 30 ký tự)
  base_username := SUBSTRING(LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1), '[^a-z0-9_]', '', 'g')) FROM 1 FOR 20);
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  -- 4. INSERT hoặc UPDATE nếu profile đã tồn tại (chống lỗi trùng lặp khi login lần 2)
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    base_username || '_' || SUBSTR(REPLACE(NEW.id::TEXT, '-', ''), 1, 6),
    clean_display_name,
    avatar
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Không bao giờ throw exception làm hủy giao dịch xác thực Supabase Auth
  RAISE WARNING 'handle_new_user exception: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Đảm bảo quyền thực thi cho trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

-- Gắn lại trigger trên auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
