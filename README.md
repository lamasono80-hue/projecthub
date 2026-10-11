# ProjectHub 🚀

> **Nền tảng biến ý tưởng thành dự án thực tế**  
> Kết nối sinh viên, lập trình viên và những người có kỹ năng để cùng nhau xây dựng sản phẩm thực tế.

[![System QA Status](https://img.shields.io/badge/System%20QA-100%25%20Passed-brightgreen)](DEPLOYMENT.md)
[![Phase Status](https://img.shields.io/badge/Phase%201--9-COMPLETE-blue)](DEPLOYMENT.md)
[![Security Audit](https://img.shields.io/badge/Security-RLS%20%2B%20Zero%20Leaks-success)](DEPLOYMENT.md)

---

## 🧭 Luồng hoạt động tổng thể

```
Ý tưởng ──> Tạo Project ──> Tìm thành viên ──> AI Matching ──> Thành lập Team
        ──> Chia Task ──> Workspace (Kanban + Chat) ──> Hoàn thành ──> Portfolio & Analytics
```

---

## 🛠 Tech Stack & Kiến trúc

| Thành phần | Công nghệ / Thư viện | Vai trò |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript ES6+, Bootstrap 5.3, Bootstrap Icons 1.11, Chart.js 4.4 | Giao diện hiện đại, responsive, không phụ thuộc framework nặng |
| **Backend** | Node.js, Express.js | API Gateway, Proxy bảo mật, Xác thực JWT, Upload Controller |
| **Database** | Supabase PostgreSQL 15 | Cơ sở dữ liệu chính, Row Level Security (RLS) trên 100% các bảng |
| **Authentication** | Supabase Auth | Quản lý đăng ký, đăng nhập JWT, phiên làm việc an toàn |
| **Realtime** | Supabase Realtime (WebSockets) | Đồng bộ Kanban tasks, tin nhắn nhóm, trạng thái Online, thông báo tức thì |
| **Media Storage** | Cloudinary API | Tối ưu và lưu trữ ảnh đại diện, ảnh bìa dự án (tối đa 5MB) |
| **AI Matching** | OpenAI API (`gpt-4o-mini`) + Fallback Rule-Based Engine | Phân tích độ tương thích giữa dự án và kỹ năng ứng viên |
| **Code Tracking** | GitHub REST API v3 (với In-memory Cache) | Đồng bộ trạng thái repo, stars, forks, ngôn ngữ lập trình |

---

## 📁 Cấu trúc Codebase

```
projecthub/
├── public/                       ← Express chỉ serve tĩnh thư mục này
│   ├── index.html                ← Trang chủ giới thiệu nền tảng & khám phá nhanh
│   ├── login.html                ← Đăng nhập tài khoản
│   ├── register.html             ← Đăng ký tài khoản mới
│   ├── projects.html             ← Danh sách dự án (Tìm kiếm, Lọc, Phân trang)
│   ├── project-detail.html       ← Chi tiết dự án, ứng tuyển thành viên, AI gợi ý
│   ├── create-project.html       ← Tạo dự án mới kèm ảnh bìa & link GitHub
│   ├── edit-project.html         ← Chỉnh sửa dự án đã tạo
│   ├── workspace.html            ← Không gian làm việc (Kanban Board + Chat Realtime)
│   ├── dashboard.html            ← Bảng điều khiển cá nhân, thống kê & biểu đồ Chart.js
│   ├── profile.html              ← Trang hồ sơ người dùng & cập nhật avatar
│   ├── portfolio.html            ← Portfolio cá nhân công khai / riêng tư
│   ├── matching.html             ← Trung tâm AI Matching & tìm đồng đội
│   ├── notifications.html        ← Quản lý thông báo người dùng
│   ├── css/
│   │   ├── style.css             ← Design token, biến màu CSS, typography
│   │   ├── components.css        ← Component styles: Cards, Badges, Modals, Forms
│   │   └── responsive.css        ← Breakpoints chuẩn cho Mobile (<576px), Tablet (<992px)
│   └── js/
│       ├── api.js                ← REST client giao tiếp với Backend
│       ├── app.js                ← Navbar chung, Footer, Auth Guard, Toast notifications
│       ├── auth.js               ← Supabase Auth helper (login, register, logout, session)
│       ├── chat.js               ← Realtime project chat & Presence tracking
│       ├── dashboard.js          ← Biểu đồ Chart.js & phân tích hiệu suất cá nhân
│       ├── matching.js           ← Giao diện AI Matching & tìm kiếm ứng viên
│       ├── notifications.js      ← Realtime user notifications & dropdown badge
│       ├── notifications-page.js ← Quản lý trang thông báo đầy đủ
│       ├── portfolio.js          ← Trình bày portfolio, kỹ năng và thành tựu
│       ├── profile.js            ← Quản lý thông tin cá nhân & Cloudinary upload
│       ├── projects.js           ← Quản lý CRUD dự án & duyệt đơn gia nhập
│       ├── supabase-client.js    ← Khởi tạo Supabase client dùng chung
│       └── workspace.js          ← Kanban Drag & Drop, quản lý tasks & tiến độ
│
├── server/                       ← Backend API & Services (Bảo vệ 403 Forbidden)
│   ├── server.js                 ← Express server entry point, rate limiting, security
│   ├── middleware/
│   │   └── auth.js               ← Middleware xác thực JWT Supabase
│   ├── routes/
│   │   ├── ai.js                 ← AI matching & chat routes
│   │   ├── github.js             ← Proxy an toàn gọi GitHub API (chống SSRF)
│   │   ├── projects.js           ← API hỗ trợ dự án
│   │   └── upload.js             ← API upload ảnh Cloudinary có auth guard
│   └── services/
│       ├── cloudinaryService.js  ← Dịch vụ tải ảnh lên Cloudinary
│       ├── githubService.js      ← Parse URL, cache và gọi GitHub API
│       └── openaiService.js      ← Dịch vụ gọi OpenAI API
│
├── supabase/
│   ├── schema.sql                ← Master Database Schema + RLS Policies + Triggers
│   └── migrations/               ← Lịch sử các migration từng phase
│
├── .env.example                  ← Mẫu cấu hình môi trường an toàn
├── .gitignore                    ← Chống rò rỉ .env, node_modules
├── DEPLOYMENT.md                 ← Hướng dẫn triển khai Production chi tiết
├── FINAL_REPORT.md               ← Báo cáo tổng kết nghiệm thu Phase 9
└── package.json
```

---

## 🚀 Cài đặt & Chạy cục bộ

### 1. Khởi tạo dự án
```bash
git clone <repo_url>
cd projecthub
npm install
```

### 2. Thiết lập Biến môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```
Điền các giá trị thực tế vào `.env`:
```env
PORT=3000
NODE_ENV=development

# Supabase (bắt buộc)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (tùy chọn - có fallback engine tự động)
OPENAI_API_KEY=sk-...

# Cloudinary (tùy chọn upload ảnh thật)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# GitHub (tùy chọn tăng rate limit)
GITHUB_TOKEN=ghp_...
```

### 3. Cài đặt Cơ sở dữ liệu Supabase
1. Đăng nhập [Supabase Dashboard](https://supabase.com).
2. Tạo project mới, vào mục **SQL Editor**.
3. Dán toàn bộ nội dung file `supabase/schema.sql` và bấm **Run**.
4. Vào **Authentication** -> **Providers** -> **Email**: bật trạng thái `Enabled`.

### 4. Khởi chạy Server
```bash
# Chế độ phát triển (auto-restart)
npm run dev

# Hoặc khởi chạy thông thường
npm start
```
Truy cập: **http://localhost:3000**

---

## 🔒 Kiểm thử Hệ thống & Bảo mật (QA)

ProjectHub được trang bị bộ kiểm thử tự động toàn diện bao quát 100% các tính năng từ Phase 1 đến Phase 9:

```bash
# Chạy bộ kiểm thử Master QA Phase 9 (156 assertions)
node scratch/phase9-full-system-qa.js

# Chạy kiểm thử hồi quy Phase 8 (Portfolio + Dashboard Analytics)
node scratch/phase8-tests.js

# Chạy kiểm thử hồi quy Phase 7 (Media + GitHub)
node scratch/phase7-tests.js

# Chạy kiểm thử hồi quy Phase 6 (Realtime + Chat + Notifications)
node scratch/phase6-tests.js

# Chạy kiểm thử hồi quy Phase 5 (Workspace + Kanban)
node scratch/phase5-tests.js
```
*Tất cả 458 kiểm tra đều đạt 100% PASS.*

---

## 🌐 Triển khai Production

Xem hướng dẫn chi tiết từng bước trên Railway, Render, Fly.io và Vercel tại [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 📜 Giấy phép & Tác giả
Dự án được phát triển cho nền tảng kết nối cộng đồng sáng tạo sinh viên và lập trình viên **ProjectHub**.
Mọi quyền được bảo lưu © 2026.
