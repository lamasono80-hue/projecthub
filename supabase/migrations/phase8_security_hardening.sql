-- ============================================================
-- ProjectHub — Phase 8 Migration: Security Hardening
-- Hardening of SECURITY DEFINER functions, execution privileges,
-- and RLS policy interactions.
-- ============================================================

-- 1. HARDEN SEARCH_PATH & EXECUTION PRIVILEGES: handle_new_user
-- Executed via trigger on auth.users when a user signs up.
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

ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Revoke default public/anon execute on trigger function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;


-- 2. HARDEN SEARCH_PATH & EXECUTION PRIVILEGES: update_project_progress
-- Executed via trigger on public.tasks when tasks are inserted, updated, or deleted.
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

ALTER FUNCTION public.update_project_progress() SET search_path = public;

-- Revoke default public/anon execute on trigger function
REVOKE EXECUTE ON FUNCTION public.update_project_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_project_progress() TO authenticated, service_role;


-- 3. HARDEN SEARCH_PATH & EXECUTION PRIVILEGES: accept_join_request
-- Atomic RPC executed by project owners to accept join requests.
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

ALTER FUNCTION public.accept_join_request(UUID) SET search_path = public;

-- Revoke execute from PUBLIC and anon; grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.accept_join_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_join_request(UUID) TO authenticated, service_role;


-- 4. HARDEN HELPER FUNCTION & RESOLVE RLS RECURSION: is_project_member
-- Helper function to break circular RLS recursion between projects and project_members
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

ALTER FUNCTION public.is_project_member(UUID, UUID) SET search_path = public;

-- Must be executable by anon, authenticated, service_role because it is invoked in RLS on projects for public queries
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO anon, authenticated, service_role;

-- Update projects SELECT policy to use the helper function (resolves 42P17 infinite recursion)
DROP POLICY IF EXISTS "Public projects viewable by all" ON public.projects;
CREATE POLICY "Public projects viewable by all" ON public.projects
  FOR SELECT USING (is_public = TRUE OR owner_id = auth.uid() OR public.is_project_member(id, auth.uid()));


-- 5. RLS HARDENING (AREA A): PREVENT DIRECT MANIPULATION OF JOIN REQUEST STATUS
-- Direct update of status to 'accepted' bypasses the atomic accept_join_request RPC
-- (which validates max_members, inserts into project_members, and fills roles).
-- Restrict direct UPDATE by project owner to only allow status = 'rejected'.
DROP POLICY IF EXISTS "Project owners can update request status" ON public.project_join_requests;
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
