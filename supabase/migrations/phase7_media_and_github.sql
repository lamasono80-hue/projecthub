-- ============================================================
-- ProjectHub — Phase 7 Migration: Cloudinary Media + GitHub Integration
-- ============================================================

-- 1. BỔ SUNG CỘT GITHUB_URL CHO BẢNG PROJECTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'github_url'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN github_url TEXT;
  END IF;
END $$;

-- 2. TẠO INDEX CHO GITHUB_URL
CREATE INDEX IF NOT EXISTS idx_projects_github_url ON public.projects(github_url) WHERE github_url IS NOT NULL;
