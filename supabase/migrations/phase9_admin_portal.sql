-- ============================================================
-- Phase 9: Admin Portal, Role-Based Access & System Announcements
-- ============================================================

-- 1. Bổ sung trường role và is_banned vào bảng profiles nếu chưa có
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' 
    CHECK (role IN ('user', 'admin', 'moderator')),
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 2. Bảng Announcements (Thông báo toàn hệ thống từ Ban Quản Trị)
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(250) NOT NULL,
  message     TEXT        NOT NULL,
  type        VARCHAR(20) DEFAULT 'info' 
              CHECK (type IN ('info', 'warning', 'urgent', 'success')),
  action_url  TEXT,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

-- 3. RLS cho Announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Mọi người (kể cả khách) đều xem được các thông báo đang active
DROP POLICY IF EXISTS "Active announcements viewable by all" ON public.announcements;
CREATE POLICY "Active announcements viewable by all" ON public.announcements
  FOR SELECT USING (is_active = TRUE);

-- Chỉ Admin mới được thêm/sửa/xóa announcement qua service role / authenticated admin
-- 4. Helper function kiểm tra admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin' AND is_banned = FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon, authenticated, service_role;
