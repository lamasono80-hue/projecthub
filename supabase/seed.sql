-- ============================================================
-- ProjectHub — Seed Data
-- ============================================================
-- QUAN TRỌNG:
-- File này CHỈ chứa data mẫu cho development
-- KHÔNG chứa password thật
-- Users phải được tạo qua Supabase Auth API/Dashboard trước
-- Sau đó seed data này mới chạy được (vì profiles.id = auth.users.id)
--
-- Cách tạo users:
-- 1. Vào Supabase Dashboard > Authentication > Users > Invite User
-- 2. Hoặc dùng Supabase CLI: supabase auth users create
-- 3. Copy UUID của từng user vào bên dưới
-- ============================================================

-- HƯỚNG DẪN:
-- Thay các UUID placeholder bên dưới bằng UUID thật từ auth.users
-- Ví dụ: SELECT id FROM auth.users WHERE email = 'minhkhoa@demo.com';

-- NOTE: Đây là seed dữ liệu để DEMO — chỉ dùng cho development
-- Trong production, KHÔNG chạy file này

-- ── Tạm thời dùng UUID giả để minh họa cấu trúc ──
-- Uncomment và thay UUID thật trước khi chạy

/*
-- Giả sử đã tạo các users sau trong Supabase Auth:
-- minhkhoa@demo.com → uuid: <UUID_1>
-- thilan@demo.com   → uuid: <UUID_2>
-- letu@demo.com     → uuid: <UUID_3>

-- UPDATE profiles (trigger đã tạo profiles tự động)
UPDATE public.profiles SET
  username = 'minhkhoa',
  display_name = 'Nguyễn Minh Khoa',
  bio = 'Full-stack developer đam mê xây dựng sản phẩm có ý nghĩa. Năm 3 CNTT.',
  skills = ARRAY['JavaScript', 'React', 'Node.js', 'MongoDB'],
  interests = ARRAY['Web Development', 'AI/ML', 'Open Source'],
  experience = 'intermediate',
  github_username = 'minhkhoa'
WHERE id = '<UUID_1>';

UPDATE public.profiles SET
  username = 'thilan',
  display_name = 'Trần Thị Lan',
  bio = 'UI/UX Designer với 2 năm kinh nghiệm.',
  skills = ARRAY['Figma', 'UI/UX', 'CSS', 'User Research'],
  interests = ARRAY['Design', 'Mobile Apps'],
  experience = 'intermediate',
  github_username = 'thilan_design'
WHERE id = '<UUID_2>';

-- INSERT projects
INSERT INTO public.projects (id, owner_id, title, description, category, technologies, difficulty, status, progress)
VALUES
  (uuid_generate_v4(), '<UUID_1>', 'Hệ thống học tập thích ứng AI', 'Platform học AI cá nhân hóa', 'Education', ARRAY['React', 'Node.js', 'OpenAI', 'PostgreSQL'], 'hard', 'in_progress', 45),
  (uuid_generate_v4(), '<UUID_2>', 'App quản lý chi tiêu sinh viên', 'Ứng dụng mobile theo dõi chi tiêu', 'Finance', ARRAY['React Native', 'Firebase'], 'medium', 'recruiting', 20);
*/

-- Seed notifications mẫu (cần chạy sau khi có real user IDs)
-- INSERT INTO public.notifications (user_id, type, title, message, action_url) VALUES ...

SELECT 'Seed file structure ready. Replace placeholder UUIDs with real auth.users IDs before running.' AS info;
