-- ============================================================
-- ProjectHub — Supabase PostgreSQL Schema
-- ============================================================
-- QUAN TRỌNG:
-- 1. Không lưu password vào database — Supabase Auth quản lý
-- 2. profiles liên kết với auth.users qua id (UUID)
-- 3. Tất cả bảng có RLS (Row Level Security) enabled
-- 4. Không tự tạo password trong SQL — dùng Supabase Auth API
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES
-- Liên kết 1-1 với auth.users
-- Trigger tự tạo profile khi user đăng ký qua Supabase Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      VARCHAR(30)  UNIQUE NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  skills        TEXT[]       DEFAULT '{}',
  interests     TEXT[]       DEFAULT '{}',
  experience    VARCHAR(20)  DEFAULT 'beginner'
                CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  github_username VARCHAR(40),
  github_url    TEXT,
  website_url   TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Trigger: tạo profile khi user đăng ký (gọi từ Supabase Auth hook)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    -- Username mặc định từ email (phần trước @), có thể update sau
    LOWER(SPLIT_PART(NEW.email, '@', 1)) || '_' || SUBSTR(NEW.id::TEXT, 1, 4),
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

-- Gắn trigger vào auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: tự cập nhật updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         VARCHAR(200) NOT NULL,
  description   TEXT         NOT NULL,
  goal          TEXT,
  problem       TEXT,
  category      VARCHAR(50)  NOT NULL DEFAULT 'other',
  technologies  TEXT[]       DEFAULT '{}',
  difficulty    VARCHAR(20)  DEFAULT 'medium'
                CHECK (difficulty IN ('easy', 'medium', 'hard')),
  status        VARCHAR(20)  DEFAULT 'recruiting'
                CHECK (status IN ('recruiting', 'in_progress', 'completed', 'archived')),
  progress      SMALLINT     DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  max_members   SMALLINT     DEFAULT 5 CHECK (max_members >= 1 AND max_members <= 20),
  deadline      DATE,
  image_url     TEXT,
  github_url    TEXT,
  is_public     BOOLEAN      DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_projects_owner_id  ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_github_url ON public.projects(github_url) WHERE github_url IS NOT NULL;

-- ============================================================
-- 3. PROJECT ROLES (Vị trí cần tuyển)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_roles (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_name    VARCHAR(100) NOT NULL,
  description  TEXT,
  skills_needed TEXT[]     DEFAULT '{}',
  is_filled    BOOLEAN     DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_roles_project ON public.project_roles(project_id);

-- ============================================================
-- 4. PROJECT MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id     UUID        REFERENCES public.project_roles(id) ON DELETE SET NULL,
  role_name   VARCHAR(100),
  status      VARCHAR(20) DEFAULT 'active'
              CHECK (status IN ('pending', 'active', 'left', 'removed')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_members_user    ON public.project_members(user_id);

-- ============================================================
-- 5. TASKS (Kanban)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  creator_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  title        VARCHAR(300) NOT NULL,
  description  TEXT,
  status       VARCHAR(20) DEFAULT 'todo'
               CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority     VARCHAR(10) DEFAULT 'medium'
               CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  deadline     DATE,
  position     INTEGER     DEFAULT 0,  -- Thứ tự trong column Kanban
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tasks_project  ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator  ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON public.tasks(status);

-- Trigger: tự động cập nhật project.progress khi tasks thay đổi
CREATE OR REPLACE FUNCTION public.update_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.update_project_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_project_progress() TO authenticated, service_role;

CREATE TRIGGER update_progress_on_task_change
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_project_progress();

-- ============================================================
-- 6. MESSAGES (Team Discussion)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 5000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_project    ON public.messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_project_created ON public.messages(project_id, created_at ASC);

-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id  UUID        REFERENCES public.projects(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL
              CHECK (type IN (
                'invite', 'join_request', 'task_assigned', 'task_deadline',
                'project_update', 'ai_result', 'member_joined', 'system',
                'task_status_changed', 'join_request_accepted', 'join_request_rejected', 'member_removed', 'new_message',
                'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'JOIN_REQUEST', 'JOIN_REQUEST_ACCEPTED', 'JOIN_REQUEST_REJECTED',
                'PROJECT_MEMBER_ADDED', 'PROJECT_MEMBER_REMOVED', 'NEW_MESSAGE'
              )),
  title       VARCHAR(200) NOT NULL,
  message     TEXT,
  action_url  TEXT,
  is_read     BOOLEAN     DEFAULT FALSE,
  data        JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_project_id ON public.notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notif_is_read    ON public.notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notif_created_at ON public.notifications(created_at DESC);

-- ============================================================
-- 8. PORTFOLIO PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.portfolio_projects (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id     UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  role           VARCHAR(100),
  technologies   TEXT[]      DEFAULT '{}',
  image_url      TEXT,
  demo_url       TEXT,
  github_url     TEXT,
  is_featured    BOOLEAN     DEFAULT FALSE,
  display_order  INTEGER     DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_portfolio_updated_at
  BEFORE UPDATE ON public.portfolio_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON public.portfolio_projects(user_id);

-- ============================================================
-- 9. AI CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id  UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  title       VARCHAR(200) DEFAULT 'Cuộc trò chuyện mới',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_user    ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_project ON public.ai_conversations(project_id);

-- ============================================================
-- 10. AI MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID        NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_msgs_conv ON public.ai_messages(conversation_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages       ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── HELPER FUNCTIONS TO PREVENT RLS RECURSION ──
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO anon, authenticated, service_role;

-- ── PROJECTS ──
CREATE POLICY "Public projects viewable by all" ON public.projects
  FOR SELECT USING (is_public = TRUE OR owner_id = auth.uid() OR public.is_project_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Only owner can update project" ON public.projects
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Only owner can delete project" ON public.projects
  FOR DELETE USING (auth.uid() = owner_id);

-- ── PROJECT ROLES ──
CREATE POLICY "Project roles viewable by project viewers" ON public.project_roles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.is_public = TRUE OR p.owner_id = auth.uid()))
  );

CREATE POLICY "Owner manages roles" ON public.project_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- ── PROJECT MEMBERS ──
CREATE POLICY "Members viewable by project participants" ON public.project_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.is_public OR p.owner_id = auth.uid()))
  );

CREATE POLICY "Owner manages members" ON public.project_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

-- ── TASKS ──
CREATE POLICY "Tasks viewable by project members" ON public.tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = tasks.project_id AND m.user_id = auth.uid() AND m.status = 'active')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Members can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = tasks.project_id AND m.user_id = auth.uid() AND m.status = 'active')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Members can update tasks" ON public.tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = tasks.project_id AND m.user_id = auth.uid() AND m.status = 'active')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Owner or creator can delete tasks" ON public.tasks
  FOR DELETE USING (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.owner_id = auth.uid())
  );

-- ── MESSAGES ──
CREATE POLICY "Messages viewable by project members" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = messages.project_id AND m.user_id = auth.uid() AND m.status = 'active')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = messages.project_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Members can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = messages.project_id AND m.user_id = auth.uid() AND m.status = 'active')
      OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = messages.project_id AND p.owner_id = auth.uid())
    )
  );

-- ── NOTIFICATIONS ──
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- ── PORTFOLIO ──
CREATE POLICY "Portfolios viewable by all" ON public.portfolio_projects
  FOR SELECT USING (TRUE);

CREATE POLICY "Users manage own portfolio" ON public.portfolio_projects
  FOR ALL USING (auth.uid() = user_id);

-- ── AI CONVERSATIONS ──
CREATE POLICY "Users see own conversations" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- ── AI MESSAGES ──
CREATE POLICY "Users see own AI messages" ON public.ai_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users create own AI messages" ON public.ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

-- ============================================================
-- 11. PROJECT JOIN REQUESTS (Phase 4: Team Formation)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_join_requests (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id     UUID        REFERENCES public.project_roles(id) ON DELETE SET NULL,
  role_name   VARCHAR(100),
  message     TEXT        NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_project_join_requests_updated_at
  BEFORE UPDATE ON public.project_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_join_req_project ON public.project_join_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_join_req_user    ON public.project_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_req_status  ON public.project_join_requests(status);

-- Unique partial index: 1 pending request per user per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_request_per_user_project
  ON public.project_join_requests (project_id, user_id)
  WHERE status = 'pending';

-- ── JOIN REQUESTS RLS ──
ALTER TABLE public.project_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants and project owners can view requests"
  ON public.project_join_requests
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create join requests for themselves"
  ON public.project_join_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.status = 'recruiting'
        AND p.owner_id != auth.uid()
    )
  );

CREATE POLICY "Applicants can cancel their own pending requests"
  ON public.project_join_requests
  FOR UPDATE
  USING (
    auth.uid() = user_id AND status = 'pending'
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- Area A Hardening: Only 'rejected' is permitted directly via UPDATE.
-- Setting 'accepted' must go through the atomic accept_join_request RPC to guarantee member insertion and limits.
CREATE POLICY "Project owners can update request status"
  ON public.project_join_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'rejected'
  );

-- Member leave policy
CREATE POLICY "Members can leave project" ON public.project_members
  FOR DELETE USING (auth.uid() = user_id);

-- ── ATOMIC ACCEPT FUNCTION ──
CREATE OR REPLACE FUNCTION public.accept_join_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_project RECORD;
  v_current_member_count INT;
BEGIN
  -- 1. Tìm request
  SELECT * INTO v_req FROM public.project_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy yêu cầu tham gia.');
  END IF;

  -- 2. Kiểm tra trạng thái pending
  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yêu cầu này đã được xử lý trước đó.');
  END IF;

  -- 3. Tìm project
  SELECT * INTO v_project FROM public.projects WHERE id = v_req.project_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy dự án tương ứng.');
  END IF;

  -- 4. Kiểm tra quyền của người gọi (phải là Owner)
  IF v_project.owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chỉ có chủ dự án mới có quyền duyệt yêu cầu.');
  END IF;

  -- 5. Kiểm tra user không phải là owner
  IF v_req.user_id = v_project.owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chủ dự án không thể làm thành viên thông thường.');
  END IF;

  -- 6. Kiểm tra user đã là thành viên chưa
  IF EXISTS (SELECT 1 FROM public.project_members WHERE project_id = v_req.project_id AND user_id = v_req.user_id) THEN
    -- Đã là thành viên, chỉ cần cập nhật request status
    UPDATE public.project_join_requests SET status = 'accepted' WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'message', 'Người dùng đã là thành viên của dự án.');
  END IF;

  -- 7. Kiểm tra số lượng thành viên (max_members)
  -- Số thành viên = các thành viên trong project_members + 1 (Owner)
  SELECT COUNT(*) INTO v_current_member_count
  FROM public.project_members
  WHERE project_id = v_req.project_id AND status = 'active';

  IF (v_current_member_count + 1) >= v_project.max_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dự án đã đủ số lượng thành viên tối đa (' || v_project.max_members || ').');
  END IF;

  -- 8. Thêm vào project_members
  INSERT INTO public.project_members (project_id, user_id, role_id, role_name, status)
  VALUES (v_req.project_id, v_req.user_id, v_req.role_id, v_req.role_name, 'active');

  -- 9. Cập nhật role is_filled nếu có role_id
  IF v_req.role_id IS NOT NULL THEN
    UPDATE public.project_roles SET is_filled = TRUE WHERE id = v_req.role_id;
  END IF;

  -- 10. Cập nhật request thành 'accepted'
  UPDATE public.project_join_requests SET status = 'accepted' WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Đã thêm thành viên vào dự án thành công.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_join_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_join_request(UUID) TO authenticated, service_role;

-- ============================================================
-- REALTIME PUBLICATION SETUP (Messages, Tasks, Notifications)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

