# HƯỚNG DẪN TRIỂN KHAI PRODUCTION — PROJECTHUB 🚀
# PRODUCTION DEPLOYMENT GUIDE

Tài liệu hướng dẫn chi tiết quy trình đưa ứng dụng **ProjectHub** lên môi trường Production với độ ổn định cao, bảo mật nghiêm ngặt và tối ưu hiệu năng.

---

## 📋 1. Danh mục Kiểm tra Trước Triển khai (Pre-deployment Checklist)

Trước khi kích hoạt deploy lên bất kỳ nhà cung cấp dịch vụ đám mây nào:

- [x] **Cơ sở dữ liệu:** Master schema `supabase/schema.sql` đã kích hoạt RLS (`ROW LEVEL SECURITY`) trên toàn bộ 11 bảng.
- [x] **Mã nguồn:** Không có bất kỳ API Key, Secret Token hoặc mật khẩu nào hardcode trong mã nguồn frontend hoặc backend.
- [x] **Static Assets:** 13 trang HTML đã kiểm tra đầy đủ liên kết tài nguyên CSS/JS cục bộ, không có liên kết 404.
- [x] **Bảo vệ tệp nhạy cảm:** Middleware bảo vệ của Express chặn mã 403 Forbidden đối với `.env`, `package.json`, `schema.sql`, `server/`.
- [x] **Media & Uploads:** Giới hạn file tải lên 5MB và lọc chặt chẽ MIME type/Extension hình ảnh.
- [x] **Kiểm thử tự động:** Đã vượt qua 100% 458 kiểm thử hệ thống (Master QA + Hồi quy Phase 5-8).

---

## 🗄 2. Cấu hình Supabase Production

### Bước 1: Khởi tạo Project Supabase Production
1. Truy cập [https://supabase.com](https://supabase.com) và tạo một Organization/Project mới dành riêng cho Production (ví dụ: `projecthub-prod`).
2. Chọn khu vực (Region) gần người dùng nhất (ví dụ: `Southeast Asia (Singapore)`).

### Bước 2: Chạy Database Schema
1. Mở **SQL Editor** trong Supabase Dashboard.
2. Dán toàn bộ nội dung của tệp [`supabase/schema.sql`](file:///d:/UniConnect/projecthub/supabase/schema.sql).
3. Bấm **Run** để khởi tạo các bảng, quan hệ Foreign Key, Indexes, RLS Policies và Realtime Publications.

### Bước 3: Kiểm tra Realtime Publication
1. Vào mục **Database** -> **Replication**.
2. Đảm bảo bảng `messages`, `tasks`, và `notifications` đã được gán vào `supabase_realtime` publication.

### Bước 4: Cấu hình Email Authentication
1. Vào **Authentication** -> **URL Configuration**.
2. Đặt **Site URL** thành URL chính thức của ứng dụng (ví dụ: `https://projecthub.up.railway.app`).
3. Đặt **Redirect URLs** bao gồm:
   - `https://your-domain.com/**`
   - `https://your-domain.com/login.html`

---

## 🌐 3. Hướng dẫn Triển khai theo Nền tảng

### Lựa chọn A: Triển khai trên Railway (Khuyến nghị số 1)
Railway hỗ trợ triển khai ứng dụng Node.js Full-Stack nguyên khối cực kỳ đơn giản và mạnh mẽ.

1. Đăng ký/Đăng nhập tại [https://railway.app](https://railway.app).
2. Chọn **New Project** -> **Deploy from GitHub repo**.
3. Chọn repository `projecthub`.
4. Vào tab **Variables** và thêm các biến môi trường:
   ```env
   NODE_ENV=production
   PORT=3000
   SUPABASE_URL=https://<your-project-id>.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   OPENAI_API_KEY=sk-... (nếu sử dụng AI trả lời thông minh)
   CLOUDINARY_CLOUD_NAME=<your-cloud-name>
   CLOUDINARY_API_KEY=<your-api-key>
   CLOUDINARY_API_SECRET=<your-api-secret>
   GITHUB_TOKEN=ghp_... (nếu cần tăng rate limit GitHub)
   ```
5. Vào tab **Settings** -> **Networking** -> Bấm **Generate Domain** (hoặc cấu hình Custom Domain cá nhân).
6. Quá trình build và start sẽ tự động chạy lệnh `npm start`.

---

### Lựa chọn B: Triển khai trên Render.com
1. Đăng nhập [https://render.com](https://render.com).
2. Tạo mới **Web Service** -> Kết nối GitHub repository.
3. Thiết lập thông số:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free hoặc Starter
4. Điền danh sách **Environment Variables** tương tự như danh sách Railway ở trên.
5. Bấm **Create Web Service**. Render sẽ cấp một URL dạng `https://projecthub.onrender.com`.

---

### Lựa chọn C: Triển khai trên Docker / Fly.io / VPS (Ubuntu Server)
Nếu chạy VPS độc lập bằng Nginx + PM2:
```bash
# 1. Cài đặt Node.js LTS & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git
sudo npm install -g pm2

# 2. Clone mã nguồn
cd /var/www
git clone <repo_url> projecthub
cd projecthub
npm install --production

# 3. Tạo file .env
nano .env  # điền các biến môi trường production

# 4. Quản lý tiến trình bằng PM2
pm2 start server/server.js --name "projecthub"
pm2 save
pm2 startup

# 5. Cấu hình Nginx làm Reverse Proxy + SSL Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

---

## 🔐 4. Danh sách Biến Môi trường Chi tiết

| Tên biến | Bắt buộc | Môi trường | Mô tả |
|---|---|---|---|
| `PORT` | Không | 3000 (mặc định) | Cổng mạng cho Express Server |
| `NODE_ENV` | Có | `production` | Bật chế độ tối ưu hóa Production |
| `SUPABASE_URL` | **Có** | Server & Client | URL endpoint của Supabase Project |
| `SUPABASE_ANON_KEY` | **Có** | Server & Client | Public key client dùng xác thực và truy vấn an toàn qua RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Có** | Server | Key đặc quyền dành cho backend xác thực token |
| `OPENAI_API_KEY` | Không | Server | API Key OpenAI (nếu thiếu, hệ thống tự kích hoạt Rule-Based Matching fallback) |
| `CLOUDINARY_CLOUD_NAME` | Không | Server | Tên Cloudinary Cloud để upload ảnh đại diện/dự án |
| `CLOUDINARY_API_KEY` | Không | Server | API Key Cloudinary |
| `CLOUDINARY_API_SECRET` | Không | Server | Secret Key Cloudinary |
| `GITHUB_TOKEN` | Không | Server | Personal Access Token nâng giới hạn gọi GitHub API từ 60 lên 5000 req/h |

---

## 🔍 5. Kiểm tra Sau Triển khai (Smoke Tests)

Ngay sau khi deploy thành công lên URL production:

1. **Kiểm tra trạng thái máy chủ:**
   ```bash
   curl -I https://your-production-url.com/api/health
   # Phải trả về: HTTP/2 200 OK kèm { status: "ok" }
   ```
2. **Kiểm tra bảo mật file nhạy cảm:**
   ```bash
   curl -I https://your-production-url.com/.env
   # Phải trả về: HTTP/2 403 Forbidden
   curl -I https://your-production-url.com/server/server.js
   # Phải trả về: HTTP/2 403 Forbidden
   ```
3. **Kiểm tra luồng người dùng chính trên trình duyệt:**
   - [ ] Đăng ký tài khoản mới và đăng nhập.
   - [ ] Xem danh sách dự án và tạo mới một dự án thử nghiệm.
   - [ ] Thử nghiệm kết nối GitHub repo trên dự án vừa tạo.
   - [ ] Vào Workspace, thêm một công việc trên Kanban, kéo thả sang cột khác.
   - [ ] Kiểm tra kết nối chat nhóm và nhận thông báo realtime.
   - [ ] Xem Portfolio cá nhân tại `portfolio.html`.

---

## 🛠 6. Khắc phục Sự cố Thường gặp (Troubleshooting)

| Triệu chứng | Nguyên nhân khả dĩ | Hướng xử lý |
|---|---|---|
| Màn hình đăng nhập báo `Failed to fetch` hoặc `Invalid API key` | `SUPABASE_URL` hoặc `SUPABASE_ANON_KEY` trong biến môi trường bị sai hoặc thiếu. | Kiểm tra lại mục cấu hình Environment Variables trên dashboard hosting và khởi động lại. |
| Người dùng không nhận được Realtime chat/task | Chưa kích hoạt Supabase Realtime cho bảng. | Vào Supabase Dashboard -> Database -> Replication và kiểm tra bảng `messages`, `tasks`, `notifications`. |
| Lỗi 401 khi tải ảnh lên | Request chưa đính kèm Bearer token hợp lệ trong header. | Đảm bảo người dùng đã đăng nhập và session Supabase đang hoạt động. |
| GitHub repo hiển thị lỗi 403 Rate Limit | Đạt giới hạn 60 request/giờ của GitHub unauthenticated. | Cung cấp `GITHUB_TOKEN` vào biến môi trường server. |
| AI Matching báo `Rule-based fallback` | Không có `OPENAI_API_KEY` hoặc hết hạn ngạch tài khoản. | Kiểm tra OpenAI API key hoặc tiếp tục sử dụng Rule-based engine tích hợp sẵn. |

---

## 🔄 7. Quy trình Rollback (Khôi phục Sự cố)

Nếu phiên bản mới gặp sự cố nghiêm trọng trên production:

1. **Trên Railway/Render:**
   - Vào mục **Deployments**.
   - Tìm phiên bản commit ổn định gần nhất trước đó.
   - Nhấn **Rollback to this deployment**. Hệ thống sẽ khôi phục trong vòng dưới 60 giây.
2. **Trên Cơ sở dữ liệu (Supabase):**
   - Nếu có lỗi dữ liệu, vào mục **Database** -> **Backups** trên Supabase Dashboard và khôi phục snapshot point-in-time gần nhất.
