/**
 * login.js — Google OAuth & Authentication Page Controller for ProjectHub
 *
 * Nhiệm vụ:
 * 1. Khởi tạo và xử lý form đăng nhập (login.html)
 * 2. Đăng nhập Google OAuth qua Supabase với dynamic redirectTo = window.location.origin + '/dashboard.html'
 * 3. Tự động kiểm tra và chuyển hướng an toàn
 */
'use strict';

/**
 * Đăng nhập bằng Google OAuth qua Supabase
 * Đảm bảo options.redirectTo tự động nhận diện domain/port hiện tại thông qua window.location.origin
 */
async function loginWithGoogle() {
  try {
    const client = typeof getClient === 'function' ? await getClient() : window.supabaseClient;
    if (!client) {
      if (typeof showToastMsg === 'function') {
        showToastMsg('Chưa kết nối được với hệ thống xác thực Supabase.', 'error');
      } else if (typeof window.showToast === 'function') {
        window.showToast('Chưa kết nối được với hệ thống xác thực Supabase.', 'error');
      }
      return { success: false, error: 'Chưa kết nối được Supabase' };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const rawTarget = urlParams.get('redirect') || 'dashboard.html';

    // Phòng chống Open Redirect: chỉ cho phép đường dẫn nội bộ hợp lệ
    let cleanTarget = 'dashboard.html';
    if (rawTarget && typeof rawTarget === 'string') {
      const sanitized = rawTarget.trim().replace(/^[/\\]+/, '');
      if (!sanitized.includes('://') && !sanitized.startsWith('//') && !sanitized.startsWith('\\\\')) {
        const pageName = sanitized.split('?')[0].split('#')[0];
        const allowedPages = [
          'dashboard', 'dashboard.html',
          'projects', 'projects.html',
          'workspace', 'workspace.html',
          'profile', 'profile.html',
          'portfolio', 'portfolio.html',
          'matching', 'matching.html',
          'create-project', 'create-project.html',
          'index.html', ''
        ];
        if (allowedPages.includes(pageName)) {
          cleanTarget = sanitized || 'dashboard.html';
        }
      }
    }

    // Lưu trang đích dự kiến để chuyển hướng sau khi hoàn tất OAuth
    localStorage.setItem('ph_oauth_redirect', cleanTarget);

    // Dynamic redirectTo: Luôn sử dụng window.location.origin để tự động lấy đúng protocol, domain, port hiện tại
    const currentOrigin = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin.replace(/\/+$/, '')
      : '';
    const redirectTo = `${currentOrigin}/${cleanTarget.replace(/^\/+/, '')}`;

    console.log('[Login] Bắt đầu đăng nhập Google OAuth với redirectTo:', redirectTo);

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      console.error('[Login] Google login error:', error.message);
      if (typeof showToastMsg === 'function') {
        showToastMsg('Lỗi đăng nhập Google: ' + error.message, 'error');
      }
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[Login] Exception loginWithGoogle:', err);
    if (typeof showToastMsg === 'function') {
      showToastMsg('Không thể mở đăng nhập Google.', 'error');
    }
    return { success: false, error: err.message };
  }
}

// Gắn vào window để tất cả sự kiện và các file khác có thể truy cập
window.loginWithGoogle = loginWithGoogle;

// Khởi tạo sự kiện nút Google Login nếu có trên DOM
document.addEventListener('DOMContentLoaded', () => {
  const btnGoogle = document.getElementById('btnGoogleLogin');
  if (btnGoogle && !btnGoogle.hasAttribute('data-oauth-bound')) {
    btnGoogle.setAttribute('data-oauth-bound', 'true');
    btnGoogle.addEventListener('click', async (e) => {
      e.preventDefault();
      await loginWithGoogle();
    });
  }
});
