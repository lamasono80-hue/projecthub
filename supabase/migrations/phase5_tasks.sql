-- ============================================================
-- ProjectHub — Phase 5 Migration: Tasks & Workspace Management
-- ============================================================

-- 1. BỔ SUNG CỘT CREATOR_ID VÀO BẢNG TASKS (Nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'creator_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_creator ON public.tasks(creator_id);

-- 2. CỦNG CỐ RLS POLICIES CHO BẢNG TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Chỉ Owner và Active Members của project được xem task
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Tasks viewable by project members'
  ) THEN
    CREATE POLICY "Tasks viewable by project members" ON public.tasks
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.project_members m 
          WHERE m.project_id = tasks.project_id AND m.user_id = auth.uid() AND m.status = 'active'
        ) OR EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = tasks.project_id AND p.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Policy INSERT: Chỉ Owner và Active Members được tạo task cho project
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Members can create tasks'
  ) THEN
    CREATE POLICY "Members can create tasks" ON public.tasks
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.project_members m 
          WHERE m.project_id = tasks.project_id AND m.user_id = auth.uid() AND m.status = 'active'
        ) OR EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = tasks.project_id AND p.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Policy UPDATE: Owner và Active Members được cập nhật task trong project
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Members can update tasks'
  ) THEN
    CREATE POLICY "Members can update tasks" ON public.tasks
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.project_members m 
          WHERE m.project_id = tasks.project_id AND m.user_id = auth.uid() AND m.status = 'active'
        ) OR EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = tasks.project_id AND p.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Policy DELETE: Chỉ Owner hoặc người tạo task mới được xóa task
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Owner or creator can delete tasks'
  ) THEN
    CREATE POLICY "Owner or creator can delete tasks" ON public.tasks
      FOR DELETE USING (
        creator_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = tasks.project_id AND p.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3. TỰ ĐỘNG TÍNH TOÁN TIẾN ĐỘ DỰ ÁN KHI TASKS THAY ĐỔI
CREATE OR REPLACE FUNCTION public.update_project_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_tasks   INT;
  done_tasks    INT;
  new_progress  INT;
  proj_id       UUID;
BEGIN
  proj_id := COALESCE(NEW.project_id, OLD.project_id);
  SELECT COUNT(*) INTO total_tasks FROM public.tasks WHERE project_id = proj_id;
  SELECT COUNT(*) INTO done_tasks  FROM public.tasks WHERE project_id = proj_id AND status = 'done';

  IF total_tasks > 0 THEN
    new_progress := ROUND((done_tasks::NUMERIC / total_tasks) * 100);
  ELSE
    new_progress := 0;
  END IF;

  UPDATE public.projects SET progress = new_progress WHERE id = proj_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_progress_on_task_change ON public.tasks;
CREATE TRIGGER update_progress_on_task_change
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_project_progress();

