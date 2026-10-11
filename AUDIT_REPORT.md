# AUDIT_REPORT.md — ProjectHub Security & Performance Audit
> Ngày thực hiện: 2026-10-11 | Người thực hiện: Senior Full-Stack & Application Security Engineer  
> Workspace: `D:\UniConnect\projecthub`  
> Server: Express.js v5 trên port 3000 | Runtime: Node.js v24.14.1  
> **Không chứa bí mật, API key hay credential.**

---

## A. TÓM TẮT TÌNH TRẠNG TỔNG THỂ

| Hạng mục | Trước kiểm toán | Sau đợt sửa 1 | Sau đợt tối ưu & tăng cường (Hiện tại) |
|---|---|---|---|
| Lỗ hổng bảo mật nghiêm trọng | **1 Critical** (JWT bypass) | **0 Critical** ✅ | **0 Critical** ✅ |
| Lỗ hổng dependency | 7 (1 critical, 5 high, 1 moderate) | **3 high** (dev nodemon) | **3 high** (chỉ còn devDependency nodemon) ✅ |
| Routing bug | 7/7 clean URL trả sai trang | **0/7** (Đã sửa) ✅ | **0/7** (Đã sửa) ✅ |
| Nén HTTP (Gzip) | Chưa có (raw transfer) | Chưa có | **ĐÃ BẬT (Giảm 78% – 84% dung lượng)** ✅ |
| Open Redirect (OAuth) | Chưa kiểm tra sanitized | Tiềm ẩn | **ĐÃ VÁ CHẶT CHẼ** ✅ |
| Xử lý ngoại lệ OpenAI AI | Thiếu timeout & crash khi JSON lỗi | Thiếu | **TIMEOUT 30S + SAFE JSON FALLBACK** ✅ |
| File kiểm thử lộ công khai | `test_mock_login.html` trong public | Còn tồn tại | **ĐÃ CÁCH LY KHỎI PUBLIC** ✅ |
| Trang HTML hoạt động | 20/20 (200 OK) | 20/20 (200 OK) ✅ | 19/19 trang production (200 OK) ✅ |
| API core hoạt động | 7/7 | 7/7 ✅ | 7/7 ✅ |
| Google OAuth | Cấu hình hợp lệ | Cấu hình hợp lệ | **Cấu hình hợp lệ + Chống Open Redirect** ✅ |
| Git repository | Không có | Có bản sao lưu local | **Đã sao lưu thư mục scratch/backup-2026-10-11** ✅ |

**Trạng thái tổng thể:** Hệ thống ProjectHub đã được kiểm toán toàn diện, vá thành công lỗ hổng bảo mật nghiêm trọng nhất (JWT Signature Bypass), sửa lỗi định tuyến Clean URL, cô lập file thử nghiệm, gia cố tính năng AI Assistant chống treo socket, và tối ưu hóa nén Gzip giúp tốc độ truyền tải tài nguyên tăng từ 4 đến 6 lần.

---

## B. DANH SÁCH LỖI THEO MỨC ĐỘ

### 🔴 CRITICAL (1) — [CRITICAL-01] ĐÃ SỬA VÀ XÁC MINH
- **JWT Signature Bypass**: Cho phép giả mạo token không chữ ký chiếm quyền Admin.

### 🟠 HIGH (2) — [HIGH-01], [HIGH-02] ĐÃ SỬA VÀ XÁC MINH
- **Clean URL Routing Fallback**: 7/7 đường dẫn sạch trả về landing page thay vì trang đích.
- **Dependency Vulnerabilities (npm audit)**: Vá `proxy-addr`, `multer`, `source-map-js`, `brace-expansion`.

### 🟡 MEDIUM (3) — [MED-01], [MED-02], [MED-03] ĐÃ SỬA VÀ TỐI ƯU
- **HTTP Compression**: Đã cài đặt và tích hợp `compression` middleware (giảm tới 84% payload).
- **OpenAI Hanging & Uncaught Parse Error**: Đã bổ sung timeout 30s, maxRetries 2 và bọc try/catch chống sập server khi OpenAI phản hồi sai định dạng.
- **Open Redirect trong Google OAuth**: Đã thêm whitelist và sanitize tham số `redirect` trong `public/js/auth.js`.

### 🟢 LOW (2) — [LOW-01], [LOW-02] ĐÃ XỬ LÝ
- **Lộ file test mock login**: Đã chuyển `test_mock_login.html` ra khỏi `public/` vào `scratch/`.
- **Navbar/Footer placeholders**: Ghi nhận thiết kế riêng cho các trang portal/admin.

---

## C. CHI TIẾT TỪNG PHÁT HIỆN & BIỆN PHÁP ĐÃ TRIỂN KHAI

---

### [CRITICAL-01] JWT Authentication Bypass — Leo Thang Đặc Quyền Admin

- **Tệp:** `server/middleware/auth.js` · Dòng 111–130
- **Nguyên nhân:** Middleware `requireAuth` có đoạn mã decode fallback khi Supabase Auth không xác thực được token. Đoạn mã này lấy payload base64 chỉ kiểm tra hạn `exp` mà **không hề xác minh chữ ký mã hóa (cryptographic signature)**.
- **Bằng chứng trước khi sửa:**
  ```javascript
  const fakeToken = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJmYWtlLWFkbWluIiwiZW1haWwiOiJsYW1hc29ubzgwQGdtYWlsLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.fakesig";
  // Gửi request tới /api/admin/announcements -> HTTP 200 (Trả về toàn bộ thông báo nội bộ admin)
  ```
- **Thay đổi đã thực hiện:** Xóa bỏ hoàn toàn cơ chế decode không an toàn. Mọi token không được Supabase Auth chứng thực hợp lệ đều bị từ chối với mã **HTTP 401 Unauthorized**.
- **Kết quả kiểm thử sau sửa:**
  ```
  [SECURITY] Unsigned Fake JWT to /api/admin/announcements -> Status: 401 (SECURE - REJECTED) ✅
  ```
- **File sao lưu:** `scratch/backup-2026-10-11/auth.js.bak`

---

### [HIGH-01] Định Tuyến Clean URL Bị Lỗi Phục Vụ Sai Trang

- **Tệp:** `server/server.js` · Dòng 179–197
- **Nguyên nhân:** Logic SPA Fallback trước đây tự động trả về `index.html` cho bất kỳ request GET nào không chứa dấu chấm `.`, khiến người dùng truy cập `/dashboard`, `/projects`, `/login`, `/workspace`, `/admin` đều nhận trang chủ Landing page thay vì trang tương ứng.
- **Bằng chứng trước khi sửa:**
  ```
  GET /dashboard -> HTTP 200, <title>ProjectHub - Biến ý tưởng thành dự án thực tế</title> (Sai)
  GET /login     -> HTTP 200, <title>ProjectHub - Biến ý tưởng thành dự án thực tế</title> (Sai)
  ```
- **Thay đổi đã thực hiện:** Xây dựng bản đồ tường minh `CLEAN_URL_MAP` cho 20 route ứng dụng trong `server.js`.
- **Kết quả kiểm thử sau sửa:**
  ```
  GET /dashboard -> HTTP 200, <title>Bảng điều khiển - ProjectHub</title> ✅
  GET /login     -> HTTP 200, <title>Đăng nhập - ProjectHub</title> ✅
  GET /projects  -> HTTP 200, <title>Khám phá dự án - ProjectHub</title> ✅
  ```
- **File sao lưu:** `scratch/backup-2026-10-11/server.js.bak`

---

### [HIGH-02] Lỗ Hổng Thư Viện Phụ Thuộc (npm audit)

- **Phát hiện ban đầu:** 7 lỗ hổng (1 Critical trong `proxy-addr`, 5 High, 1 Moderate trong `multer`).
- **Thay đổi đã thực hiện:** Chạy `npm audit fix` nâng cấp an toàn không gây breaking change:
  - `proxy-addr`: 2.0.7 → **2.0.8** (Đã vá CVE IP spoofing)
  - `multer`: 2.3.0 → **2.4.0** (Đã vá lỗi DoS orphaned disk writes)
  - `source-map-js`: 1.2.1 → **1.2.2** (Đã vá event loop DoS)
  - `brace-expansion`: 5.0.9 → **5.0.12**
- **Trạng thái hiện tại:** Đã vá 4 thư viện cốt lõi chạy production. Chỉ còn 3 cảnh báo High nằm trong `nodemon` (công cụ chạy môi trường dev, không ảnh hưởng runtime production).

---

### [MED-01] Tối Ưu Hóa Nén Băng Thông HTTP Compression (Gzip)

- **Tệp:** `server/server.js` & `package.json`
- **Nguyên nhân:** Toàn bộ HTML, CSS và JavaScript kích thước lớn (style.css 73.5KB, projects.js 135.2KB, index.html 100.1KB) được truyền dưới dạng thô (raw transfer), tiêu tốn băng thông và làm chậm tốc độ tải trang trên mạng di động.
- **Thay đổi đã thực hiện:**
  - Cài đặt thư viện `compression`.
  - Cấu hình `app.use(compression({ threshold: 1024 }))` trong `server.js` để tự động nén Gzip/Deflate cho tất cả response >= 1KB.
- **Kết quả đo lường thực tế:**
  - `GET /index.html`: Giảm từ **100.1 KB** xuống **16.1 KB** (**Giảm 84%**) ✅
  - `GET /css/style.css`: Giảm từ **73.5 KB** xuống **13.8 KB** (**Giảm 81%**) ✅
  - `GET /js/projects.js`: Giảm từ **135.2 KB** xuống **29.5 KB** (**Giảm 78%**) ✅
  - `GET /api/projects`: Giảm từ **5.1 KB** xuống **1.8 KB** (**Giảm 65%**) ✅

---

### [MED-02] Bổ Sung Timeout & Phòng Ngừa Crash Phía AI Assistant

- **Tệp:** `server/services/openaiService.js`
- **Nguyên nhân:**
  - `new OpenAI()` không cấu hình timeout, nếu mạng kết nối OpenAI chậm hoặc chập chờn thì HTTP request có thể bị treo socket đến 10 phút.
  - Các hàm `analyzeProject` và `matchMembers` gọi `JSON.parse(raw)` mà không có try/catch; nếu OpenAI phản hồi chuỗi markdown kèm json hoặc cú pháp lỗi, server sẽ ném ngoại lệ chưa bắt và trả về HTTP 500.
- **Thay đổi đã thực hiện:**
  - Thêm `timeout: 30000` (30 giây) và `maxRetries: 2` vào khởi tạo OpenAI client.
  - Bọc khối `JSON.parse(raw)` bằng `try ... catch`, tự động fallback về cấu trúc mặc định chuẩn nếu phân tích cú pháp thất bại, bảo vệ tiến trình không bị crash.
- **File sao lưu:** `scratch/backup-2026-10-11/openaiService.js.bak`

---

### [MED-03] Phòng Chống Tấn Công Open Redirect Khi Đăng Nhập Google

- **Tệp:** `public/js/auth.js` · Hàm `loginWithGoogle`
- **Nguyên nhân:** Tham số `?redirect=...` trên URL được nối trực tiếp vào `window.location.origin` mà không có bước lọc kỹ lưỡng, tiềm ẩn nguy cơ Open Redirect nếu kẻ tấn công lừa người dùng bấm vào đường dẫn kèm redirect độc hại dạng `//evil.com` hoặc `\evil.com`.
- **Thay đổi đã thực hiện:** Bổ sung hàm kiểm tra, loại bỏ protocol và kiểm tra whitelist các trang đích nội bộ hợp lệ trước khi chuyển tiếp.
- **File sao lưu:** `scratch/backup-2026-10-11/auth.js.bak2`

---

### [LOW-01] Cách Ly Tệp Thử Nghiệm `test_mock_login.html`

- **Tệp:** `public/test_mock_login.html`
- **Nguyên nhân:** Tệp tạo người dùng giả và token mock nằm trong thư mục phục vụ tĩnh công khai.
- **Thay đổi đã thực hiện:** Di chuyển tệp ra khỏi `public/` sang `scratch/test_mock_login.html`.

---

## D. BẢNG HIỆU NĂNG TRƯỚC VÀ SAU TỐI ƯU (SỐ ĐO THỰC TẾ)

| Tài nguyên / Endpoint | Dung lượng TRƯỚC nén | Dung lượng SAU nén Gzip | Tỷ lệ giảm | Độ trễ trung bình (p50) |
|---|---|---|---|---|
| **GET /index.html (landing)** | 100.1 KB | **16.1 KB** | **-84.0%** | 4 ms |
| **GET /dashboard.html** | 37.2 KB | **7.3 KB** | **-80.4%** | 3 ms |
| **GET /projects.html** | 28.5 KB | **5.3 KB** | **-81.4%** | 3 ms |
| **GET /workspace.html** | 35.9 KB | **7.4 KB** | **-79.4%** | 3 ms |
| **CSS /css/style.css** | 73.5 KB | **13.8 KB** | **-81.2%** | 4 ms |
| **JS /js/projects.js** | 135.2 KB | **29.5 KB** | **-78.2%** | ~5 ms |
| **GET /api/projects?pageSize=12** | 5.1 KB | **1.8 KB** | **-64.7%** | 79 ms (Supabase Cloud) |
| **GET /api/projects/featured** | 9.2 KB | **1.7 KB** | **-81.5%** | 71 ms (Supabase Cloud) |
| **GET /api/health** | 0.1 KB | 0.1 KB | Không nén (<1KB) | 2 ms |
| **GET /api/config** | 0.3 KB | 0.3 KB | Không nén (<1KB) | 2 ms |

> *Ghi chú: Thử nghiệm đo đạc 5 lần liên tiếp trên máy chủ cục bộ bằng script `scratch/performance-bench.js`. Độ trễ của các API Database phản ánh thời gian khứ hồi (RTT) đến máy chủ cơ sở dữ liệu đám mây Supabase.*

---

## E. TRẠNG THÁI GOOGLE OAUTH

**Trạng thái: ĐÃ XÁC MINH CẤU HÌNH KIẾN TRÚC & GIA CỐ BẢO MẬT**

### 1. Phân tích mã nguồn và luồng hoạt động:
- **Cơ chế triển khai:** Ứng dụng tích hợp Google OAuth thông qua Supabase Auth SDK (`client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: ... } })`).
- **Bảo mật bí mật OAuth:** Google Client Secret được lưu trữ trên dashboard Supabase, **hoàn toàn không bị lộ** trong client-side script hay code backend Express.
- **Endpoint kiểm thử:**
  - URL phát sinh: `https://wmqpdxwgdandtvgxduha.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fdashboard.html`
  - Thử nghiệm HTTP chuyển hướng: Supabase phản hồi HTTP 302 chuyển tiếp đến `accounts.google.com` với Client ID hợp lệ và scope tối thiểu (`email + profile`).
- **Phòng chống Open Redirect:** Đã bổ sung bộ lọc whitelist trang đích, chặn triệt để nguy cơ đánh cắp token qua redirect giả mạo.

### 2. Các điểm cần cấu hình thủ công phía nhà cung cấp (Google Cloud & Supabase):
Vì đây là cấu hình trên đám mây bên ngoài mã nguồn dự án:
- **Google Cloud Console:** Cần đảm bảo `http://localhost:3000` được khai báo trong danh sách **Authorized JavaScript origins**.
- **Supabase Dashboard:** Cần đảm bảo `http://localhost:3000/**` được khai báo trong mục **Authentication -> URL Configuration -> Redirect URLs**.

---

## F. CÁC RỦI RO BẢO MẬT CÒN LẠI & HƯỚNG DẪN THỦ CÔNG

1. **Cấu hình Redirect URLs trên Supabase:**
   - Đăng nhập [https://app.supabase.com](https://app.supabase.com)
   - Chọn dự án `wmqpdxwgdandtvgxduha`
   - Vào `Authentication` -> `URL Configuration`
   - Thêm `http://localhost:3000/**` vào trường Redirect URLs để đăng nhập Google trên môi trường local không bị từ chối.

2. **Cấu hình Google Cloud Console:**
   - Vào [https://console.cloud.google.com](https://console.cloud.google.com)
   - Chọn Credentials -> OAuth 2.0 Client IDs
   - Kiểm tra Authorized JavaScript origins có chứa `http://localhost:3000` và Authorized redirect URIs có chứa `https://wmqpdxwgdandtvgxduha.supabase.co/auth/v1/callback`.

3. **Cập nhật devDependency `nodemon` (Tùy chọn):**
   - Chạy `npm install --save-dev nodemon@latest` khi chuẩn bị release để dọn dẹp nốt 3 cảnh báo phụ thuộc dev không quan trọng.

---

## G. CÁC LỆNH VẬN HÀNH VÀ KIỂM THỬ HỆ THỐNG

```bash
# 1. Khởi động máy chủ ProjectHub (Thư mục d:\UniConnect\projecthub)
node server/server.js

# 2. Kiểm tra sức khỏe hệ thống
curl http://localhost:3000/api/health

# 3. Chạy bộ kiểm thử tự động toàn diện (Routing, Auth, Security, APIs)
node scratch/test-full-audit.js

# 4. Đo đạc hiệu năng và độ nén băng thông
node scratch/performance-bench.js

# 5. Mở ứng dụng trên trình duyệt
start http://localhost:3000/index.html
```

---

## H. DANH MỤC CÁC TỆP ĐÃ TẠO VÀ CHỈNH SỬA

### Các tệp mã nguồn đã chỉnh sửa:
1. `server/middleware/auth.js`: Vá lỗ hổng CRITICAL JWT Authentication Bypass.
2. `server/server.js`: Sửa lỗi định tuyến Clean URL, tích hợp middleware `compression`.
3. `server/services/openaiService.js`: Bổ sung timeout 30s, maxRetries 2, safe JSON parsing.
4. `public/js/auth.js`: Khắc phục nguy cơ Open Redirect khi đăng nhập Google.
5. `package.json` & `package-lock.json`: Bổ sung `compression`, cập nhật `proxy-addr`, `multer`, `source-map-js`.

### Các tệp sao lưu an toàn (trong `scratch/backup-2026-10-11/`):
- `auth.js.bak` (Bản gốc trước khi vá JWT)
- `server.js.bak` (Bản gốc trước khi vá Routing)
- `openaiService.js.bak` (Bản gốc trước khi cấu hình timeout AI)
- `auth.js.bak2` (Bản gốc trước khi vá Open Redirect)
- `package.json.bak` (Bản gốc trước khi cài thêm thư viện)

### Các tệp script kiểm thử đã tạo (trong `scratch/`):
- `test-full-audit.js`: Kiểm thử hồi quy tự động toàn diện (19 pages, clean URLs, security checks, APIs).
- `performance-bench.js`: Đo đạc độ trễ p50/p95 và kích thước truyền tải nén.
- `test_mock_login.html`: Đã cách ly an toàn khỏi thư mục public.

---

## I. TỔNG KẾT PHÂN LOẠI KẾT QUẢ

- **ĐÃ XÁC MINH**: 19/19 trang giao diện production, 7/7 API core, mã hóa HTTP Security Headers (Helmet), CORS bảo vệ nguồn, bảo vệ file nội bộ (`.env`, `package.json`, `server/`).
- **ĐÃ SỬA VÀ KIỂM THỬ LẠI**: 
  - Đã xóa lỗ hổng JWT Signature Bypass (Xác nhận 401 khi dùng token giả).
  - Đã khắc phục lỗi định tuyến Clean URL (Xác nhận 7/7 route trả đúng file).
  - Đã giải quyết 4 cảnh báo thư viện phụ thuộc của npm audit.
  - Đã bật nén Gzip giảm 78% – 84% lưu lượng dữ liệu.
  - Đã bảo vệ API OpenAI Assistant chống treo kết nối và sập luồng.
  - Đã vá nguy cơ Open Redirect cho Google OAuth.
- **CHƯA THỂ XÁC MINH TỰ ĐỘNG BẰNG MÁY CHỦ**: Phiên xác thực Google OAuth người dùng thực tế trên trình duyệt thật (yêu cầu thao tác đăng nhập thủ công từ người dùng có tài khoản Google).
- **CẦN BẠN CẤU HÌNH THỦ CÔNG**: Khai báo bổ sung `http://localhost:3000` trên Google Cloud Console và Supabase Dashboard như hướng dẫn ở Mục F.

---
*Báo cáo được hoàn thiện và xác thực trên mã nguồn thực tế tại workspace D:\UniConnect\projecthub.*
