-- ============================================================
-- ProjectHub — Phase 6 Migration: Realtime Collaboration,
-- Project Chat & Multi-channel Notifications
-- ============================================================

-- 1. BỔ SUNG CỘT PROJECT_ID VÀ INDEX CHO BẢNG NOTIFICATIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notif_project_id ON public.notifications(project_id);

-- 2. MỞ RỘNG RÀNG BUỘC NOTIFICATION TYPE
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'invite', 'join_request', 'task_assigned', 'task_deadline', 'project_update', 'ai_result', 'member_joined', 'system',
    'task_status_changed', 'join_request_accepted', 'join_request_rejected', 'member_removed', 'new_message',
    'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'JOIN_REQUEST', 'JOIN_REQUEST_ACCEPTED', 'JOIN_REQUEST_REJECTED',
    'PROJECT_MEMBER_ADDED', 'PROJECT_MEMBER_REMOVED', 'NEW_MESSAGE'
  ));

-- 3. RLS POLICIES CHO BẢNG NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Policy SELECT: User chỉ xem thông báo của chính mình
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users see own notifications'
  ) THEN
    CREATE POLICY "Users see own notifications" ON public.notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- Policy UPDATE: User chỉ cập nhật thông báo của mình (ví dụ mark as read)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users update own notifications'
  ) THEN
    CREATE POLICY "Users update own notifications" ON public.notifications
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  -- Policy INSERT: Người dùng đăng nhập được tạo thông báo cho người khác trong luồng cộng tác
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can create notifications'
  ) THEN
    CREATE POLICY "Users can create notifications" ON public.notifications
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;

  -- Policy DELETE: Người dùng có quyền xóa thông báo của chính mình
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can delete own notifications'
  ) THEN
    CREATE POLICY "Users can delete own notifications" ON public.notifications
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. HIỆU NĂNG CHO PROJECT CHAT MESSAGES
CREATE INDEX IF NOT EXISTS idx_messages_project_created ON public.messages(project_id, created_at ASC);

-- 5. KÍCH HOẠT SUPABASE REALTIME PUBLICATION CHO CÁC BẢNG CỘNG TÁC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Table messages
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    -- Table tasks
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;

    -- Table notifications
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;
