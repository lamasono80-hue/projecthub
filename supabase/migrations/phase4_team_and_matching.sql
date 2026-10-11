-- ============================================================
-- ProjectHub — Phase 4 Migration: Team Formation + Join Request + AI Matching
-- ============================================================

-- 1. BẢNG PROJECT_JOIN_REQUESTS (Yêu cầu tham gia dự án)
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

-- Trigger tự động cập nhật updated_at cho project_join_requests
CREATE TRIGGER set_project_join_requests_updated_at
  BEFORE UPDATE ON public.project_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes cho tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_join_req_project ON public.project_join_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_join_req_user    ON public.project_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_req_status  ON public.project_join_requests(status);

-- 2. BẢO VỆ CHỐNG DUPLICATE REQUEST:
-- Mỗi user chỉ có tối đa 1 request 'pending' cho cùng 1 project
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_request_per_user_project
  ON public.project_join_requests (project_id, user_id)
  WHERE status = 'pending';

-- 3. BẬT ROW LEVEL SECURITY (RLS) CHO PROJECT_JOIN_REQUESTS
ALTER TABLE public.project_join_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Applicant và Owner dự án được xem request
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

-- Policy: User đăng nhập có thể gửi request cho chính mình
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

-- Policy: Applicant có thể hủy request của mình nếu đang pending
CREATE POLICY "Applicants can cancel their own pending requests"
  ON public.project_join_requests
  FOR UPDATE
  USING (
    auth.uid() = user_id AND status = 'pending'
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- Policy: Project Owner có thể accept/reject request của project mình
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
    status IN ('accepted', 'rejected')
  );

-- 4. BỔ SUNG POLICY CHO PROJECT_MEMBERS (Cho phép member tự rời dự án)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_members' AND policyname = 'Members can leave project'
  ) THEN
    CREATE POLICY "Members can leave project" ON public.project_members
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. FUNCTION NGUYÊN TỬ: ACCEPT_JOIN_REQUEST (ATOMIC TRANSACTION)
-- Hàm này xử lý an toàn: kiểm tra quyền owner, kiểm tra số slot, thêm member, update request
CREATE OR REPLACE FUNCTION public.accept_join_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
