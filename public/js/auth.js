/**
 * auth.js — Supabase Authentication Module for ProjectHub
 * 
 * QUAN TRỌNG:
 * - Sử dụng Supabase Auth thật qua supabaseClient
 * - Quản lý phiên thật (Real Session) qua Supabase Auth SDK
 * - KHÔNG tự lưu password vào bất kỳ đâu
 * - KHÔNG dùng biến tạm hay 'isLoggedIn = true' làm cơ chế xác thực
 * - Tự động đồng bộ với bảng public.profiles
 */
'use strict';

// Key phụ trợ lưu email để "Ghi nhớ đăng nhập" nếu user chọn
const REMEMBER_EMAIL_KEY = 'ph_remember_email';

/**
 * Lấy Supabase client từ window hoặc gọi getSupabase()
 */
async function getClient() {
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof window.getSupabase === 'function') {
    return await window.getSupabase();
  }
  return null;
}

/**
 * Lấy session hiện tại từ Supabase Auth
 * @returns {Promise<any>} Supabase Session hoặc null
 */
async function getCurrentSession() {
  try {
    const client = await getClient();
    if (!client) return null;

    // Kiểm tra xem URL có chứa OAuth token/code đang chờ xử lý hay không
    const hasOAuthHash = typeof window !== 'undefined' && window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('refresh_token='));
    const hasOAuthCode = typeof window !== 'undefined' && window.location.search && window.location.search.includes('code=');

    let { data: { session }, error } = await client.auth.getSession();

    // Nếu session chưa kịp nạp vào localStorage nhưng URL đang có OAuth tokens -> đợi tối đa 2.5s
    if (!session && (hasOAuthHash || hasOAuthCode)) {
      session = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 2500);
        try {
          const { data: authSub } = client.auth.onAuthStateChange((event, newSession) => {
            if (newSession) {
              clearTimeout(timer);
              if (authSub && authSub.subscription && typeof authSub.subscription.unsubscribe === 'function') {
                authSub.subscription.unsubscribe();
              }
              resolve(newSession);
            }
          });
        } catch (_) {
          // Fallback nếu onAuthStateChange gặp lỗi
        }
      });
    }

    if (error) {
      console.warn('[Auth] Lỗi lấy session:', error.message);
      return null;
    }
    return session;
  } catch (err) {
    console.error('[Auth] getCurrentSession exception:', err);
    return null;
  }
}

/**
 * Lấy thông tin user hiện tại từ session
 * @returns {Promise<any>} Supabase User object hoặc null
 */
async function getCurrentUser() {
  try {
    const session = await getCurrentSession();
    return session ? session.user : null;
  } catch (err) {
    console.error('[Auth] getCurrentUser error:', err);
    return null;
  }
}

/**
 * Lấy profile người dùng hiện tại từ public.profiles
 * @returns {Promise<any>} Profile object hoặc null
 */
async function getCurrentProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const client = await getClient();
    if (!client) return null;

    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[Auth] Lỗi tải profile:', error.message);
      return null;
    }

    if (data) {
      // Đảm bảo tương thích cả full_name và display_name
      data.full_name = data.display_name || data.full_name || user.user_metadata?.full_name || '';
      data.email = user.email;
      return data;
    }

    // Nếu profile chưa được tạo kịp bởi trigger, trả về thông tin tối thiểu từ metadata
    return {
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.full_name || user.email.split('@')[0],
      full_name: user.user_metadata?.full_name || user.email.split('@')[0],
      username: user.user_metadata?.username || user.email.split('@')[0],
      avatar_url: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || 'User')}&background=4F46E5&color=fff`,
      skills: [],
      interests: [],
      experience: 'beginner',
    };
  } catch (err) {
    console.error('[Auth] getCurrentProfile error:', err);
    return null;
  }
}

/**
 * Đăng nhập bằng Email và Password
 * @param {string} email
 * @param {string} password
 * @param {boolean} remember
 * @returns {Promise<{success: boolean, session?: any, user?: any, error?: string}>}
 */
async function login(email, password, remember = false) {
  try {
    const client = await getClient();
    if (!client) {
      return { success: false, error: 'Chưa kết nối được với hệ thống xác thực Supabase.' };
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.warn('[Auth] Đăng nhập thất bại:', error.message);
      let friendlyError = 'Email hoặc mật khẩu không chính xác.';
      if (error.message.includes('Email not confirmed')) {
        friendlyError = 'Email chưa được xác thực. Vui lòng kiểm tra hộp thư của bạn.';
      } else if (error.message.includes('Invalid login credentials')) {
        friendlyError = 'Email hoặc mật khẩu không đúng.';
      } else if (error.message.includes('rate limit')) {
        friendlyError = 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi trong giây lát.';
      }
      return { success: false, error: friendlyError };
    }

    // Xử lý ghi nhớ email
    if (remember) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    console.error('[Auth] login error:', err);
    return { success: false, error: 'Đã có lỗi xảy ra khi kết nối máy chủ.' };
  }
}

/**
 * Đăng nhập bằng Google OAuth qua Supabase
 */
async function loginWithGoogle() {
  try {
    const client = await getClient();
    if (!client) {
      showToastMsg('Chưa kết nối được với hệ thống xác thực Supabase.', 'error');
      return { success: false, error: 'Chưa kết nối được Supabase' };
    }

    const urlParams = new URLSearchParams(window.location.search);
    const rawTarget = urlParams.get('redirect') || 'dashboard.html';
    // Phòng chống Open Redirect: chỉ cho phép đường dẫn nội bộ hợp lệ
    let cleanTarget = 'dashboard.html';
    if (rawTarget && typeof rawTarget === 'string') {
      const sanitized = rawTarget.trim().replace(/^[/\\]+/, '');
      // Không cho phép protocol, scheme, hay ký tự đặc biệt
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

    const redirectTo = `${window.location.origin}/${cleanTarget}`;

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
      console.error('[Auth] Google login error:', error.message);
      showToastMsg('Lỗi đăng nhập Google: ' + error.message, 'error');
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[Auth] Exception loginWithGoogle:', err);
    showToastMsg('Không thể mở đăng nhập Google.', 'error');
    return { success: false, error: err.message };
  }
}

/**
 * Xử lý kết quả OAuth callback (lỗi hoặc thành công) từ Google/Supabase
 */
async function handleOAuthCallback() {
  if (typeof window === 'undefined') return;

  const hash = window.location.hash || '';
  const search = window.location.search || '';

  // 1. Bắt lỗi trả về từ OAuth (VD: xung đột email đã tồn tại, hủy cấp quyền, redirect mismatch)
  let errorParam = '';
  let errorDesc = '';

  if (hash.includes('error=')) {
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    errorParam = hashParams.get('error') || '';
    errorDesc = hashParams.get('error_description') || hashParams.get('error_code') || '';
  } else if (search.includes('error=')) {
    const searchParams = new URLSearchParams(search);
    errorParam = searchParams.get('error') || '';
    errorDesc = searchParams.get('error_description') || searchParams.get('error_code') || '';
  }

  if (errorParam || errorDesc) {
    console.warn('[Auth] OAuth error callback:', errorParam, errorDesc);
    let friendlyMsg = 'Đăng nhập Google không thành công.';

    const lower = (errorDesc || errorParam).toLowerCase();
    if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('email_exists')) {
      friendlyMsg = 'Email Google này đã được đăng ký bằng Mật khẩu trước đó. Vui lòng nhập mật khẩu bên dưới để đăng nhập hoặc liên kết tài khoản.';
    } else if (lower.includes('access_denied') || lower.includes('consent_required')) {
      friendlyMsg = 'Bạn đã hủy yêu cầu đăng nhập bằng tài khoản Google.';
    } else if (lower.includes('redirect_uri_mismatch') || lower.includes('redirect_uri')) {
      friendlyMsg = 'Lỗi cấu hình Redirect URI: Vui lòng thêm URL trang web vào mục Redirect URLs trong Supabase Dashboard.';
    } else if (lower.includes('database error')) {
      friendlyMsg = 'Hệ thống đang đồng bộ hồ sơ. Vui lòng bấm Đăng nhập bằng Google lại một lần nữa.';
    }

    const form = document.getElementById('loginForm') || document.getElementById('registerForm');
    if (form) {
      const existingAlert = form.querySelector('.auth-alert');
      if (existingAlert) existingAlert.remove();
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-danger alert-dismissible fade show mb-4 auth-alert';
      alertDiv.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill me-2"></i><strong>Lỗi đăng nhập Google:</strong> ${friendlyMsg}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      form.insertBefore(alertDiv, form.firstChild);
    } else {
      showToastMsg(friendlyMsg, 'error');
    }

    // Làm sạch hash trên thanh địa chỉ
    if (window.history && window.history.replaceState) {
      const cleanPath = window.location.pathname + (window.location.search.replace(/[?&]error[^&]*/g, '') || '');
      window.history.replaceState(null, '', cleanPath);
    }
    return;
  }

  // 2. Xử lý trường hợp OAuth thành công khi đang ở login.html hoặc register.html
  const isAuthPage = window.location.pathname.includes('login') || window.location.pathname.includes('register');
  const hasTokens = hash.includes('access_token=') || search.includes('code=');

  if (isAuthPage && hasTokens) {
    try {
      const session = await getCurrentSession();
      if (session) {
        const target = localStorage.getItem('ph_oauth_redirect') || 'dashboard.html';
        localStorage.removeItem('ph_oauth_redirect');
        showToastMsg('Đăng nhập Google thành công! Đang chuyển hướng...', 'success');
        setTimeout(() => {
          window.location.href = target;
        }, 500);
      }
    } catch (e) {
      console.warn('[Auth] OAuth token check exception:', e);
    }
  }
}

/**
 * Đăng ký tài khoản mới qua Supabase Auth
 * @param {Object} userData - { email, password, full_name, username, skills, interests }
 * @returns {Promise<{success: boolean, user?: any, session?: any, confirmationRequired?: boolean, error?: string}>}
 */
async function register(userData) {
  try {
    const client = await getClient();
    if (!client) {
      return { success: false, error: 'Chưa kết nối được với hệ thống xác thực Supabase.' };
    }

    const { email, password, full_name, username, skills, interests } = userData;

    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: full_name ? full_name.trim() : '',
          display_name: full_name ? full_name.trim() : '',
          username: username ? username.trim() : '',
        },
      },
    });

    if (error) {
      console.warn('[Auth] Đăng ký thất bại:', error.message);
      let friendlyError = error.message;
      if (error.message.includes('User already registered') || error.message.includes('already exists')) {
        friendlyError = 'Email này đã được sử dụng. Vui lòng dùng email khác hoặc đăng nhập.';
      } else if (error.message.includes('Password should be at least')) {
        friendlyError = 'Mật khẩu phải có ít nhất 6 ký tự.';
      }
      return { success: false, error: friendlyError };
    }

    const user = data.user;
    const session = data.session;
    const confirmationRequired = !session; // Nếu không có session tức là email confirmation đang BẬT

    // Nếu email confirmation tắt (có session ngay), cập nhật bổ sung skills/interests vào public.profiles
    if (session && user) {
      try {
        await client
          .from('profiles')
          .update({
            skills: Array.isArray(skills) ? skills : [],
            interests: Array.isArray(interests) ? interests : [],
            display_name: full_name ? full_name.trim() : user.email.split('@')[0],
            username: username ? username.trim() : user.email.split('@')[0],
          })
          .eq('id', user.id);
      } catch (profErr) {
        console.warn('[Auth] Không thể cập nhật thông tin bổ sung profile:', profErr.message);
      }
    }

    return {
      success: true,
      user,
      session,
      confirmationRequired,
    };
  } catch (err) {
    console.error('[Auth] register error:', err);
    return { success: false, error: 'Đã xảy ra lỗi khi tạo tài khoản.' };
  }
}

/**
 * Đăng xuất tài khoản
 */
async function logout() {
  try {
    const client = await getClient();
    if (client) {
      await client.auth.signOut();
    }
  } catch (err) {
    console.error('[Auth] signOut error:', err);
  } finally {
    // Xóa session cache nội bộ
    localStorage.removeItem('ph_current_user');
    showToastMsg('Bạn đã đăng xuất thành công', 'info');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 500);
  }
}

/**
 * Guard bảo vệ các trang yêu cầu đăng nhập (dashboard, profile, ...)
 * Nếu chưa đăng nhập -> chuyển hướng về login.html?redirect=...
 */
async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) {
    const currentPath = (window.location.pathname.split('/').pop() || 'index.html') + window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent(currentPath)}`;
    return false;
  }
  return true;
}

/**
 * Chuyển hướng về dashboard nếu user ĐÃ đăng nhập (dùng ở login.html, register.html)
 */
async function redirectIfAuthenticated() {
  const session = await getCurrentSession();
  if (session) {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get('redirect') || 'dashboard.html';
    window.location.href = redirectUrl;
    return true;
  }
  return false;
}

/**
 * Lắng nghe thay đổi trạng thái xác thực (login, logout, token refresh)
 */
function onAuthStateChange(callback) {
  getClient().then(client => {
    if (client) {
      client.auth.onAuthStateChange((event, session) => {
        if (typeof callback === 'function') callback(event, session);
      });
    }
  });
}

// ──────────────────────────────────────────────
// Helpers UI Forms
// ──────────────────────────────────────────────

function showToastMsg(message, type = 'success') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  // Fallback toast đơn giản nếu chưa có container
  const toastContainer = document.querySelector('.toast-container') || document.body;
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed bottom-0 end-0 m-3 shadow`;
  alertDiv.style.zIndex = '1099';
  alertDiv.innerHTML = `
    <span>${message}</span>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  toastContainer.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 4000);
}

function validateEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Khởi tạo form đăng nhập
 */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  // 1. Kiểm tra và xử lý callback OAuth từ Google/Supabase
  if (typeof handleOAuthCallback === 'function') {
    handleOAuthCallback();
  }

  // 2. Kiểm tra nếu đã login thì chuyển về dashboard
  redirectIfAuthenticated();

  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePassword.innerHTML = type === 'password' ? '<i class="bi bi-eye"></i>' : '<i class="bi bi-eye-slash"></i>';
    });
  }

  const emailInput = document.getElementById('email');
  const rememberMe = document.getElementById('rememberMe');
  const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
  if (savedEmail && emailInput) {
    emailInput.value = savedEmail;
    if (rememberMe) rememberMe.checked = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const existingAlert = form.querySelector('.auth-alert');
    if (existingAlert) existingAlert.remove();

    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const remember = rememberMe ? rememberMe.checked : false;

    if (!validateEmail(email)) {
      emailInput.setCustomValidity('Invalid email');
      form.classList.add('was-validated');
      return;
    } else {
      emailInput.setCustomValidity('');
    }

    const loginBtn = document.getElementById('loginBtn');
    const originalText = loginBtn.innerHTML;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Đang đăng nhập...';
    loginBtn.disabled = true;

    try {
      const result = await login(email, password, remember);

      if (result.success) {
        showToastMsg('Đăng nhập thành công! Đang chuyển hướng...', 'success');
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get('redirect') || 'dashboard.html';
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 600);
      } else {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;

        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show mb-4 auth-alert';
        alertDiv.innerHTML = `
          <i class="bi bi-exclamation-triangle-fill me-2"></i>${result.error}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        form.insertBefore(alertDiv, form.firstChild);
      }
    } catch (err) {
      console.error(err);
      loginBtn.innerHTML = originalText;
      loginBtn.disabled = false;
      showToastMsg('Có lỗi xảy ra, vui lòng thử lại sau.', 'error');
    }
  });

  const btnGoogle = document.getElementById('btnGoogleLogin') || form.querySelector('.btn-outline-dark');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async (e) => {
      e.preventDefault();
      await loginWithGoogle();
    });
  }
}

/**
 * Đánh giá độ mạnh mật khẩu (ít nhất 8 ký tự, 1 chữ hoa, 1 ký tự đặc biệt)
 */
function evaluatePasswordStrength(password) {
  const pwd = password || '';
  const hasLength = pwd.length >= 8;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_~`\-+=\[\]\\;'/]/.test(pwd);

  let score = 0;
  if (hasLength) score++;
  if (hasUpper) score++;
  if (hasSpecial) score++;

  return {
    hasLength,
    hasUpper,
    hasSpecial,
    score,
    isValid: hasLength && hasUpper && hasSpecial,
  };
}

/**
 * Khởi tạo form đăng ký
 */
function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  // 1. Kiểm tra và xử lý callback OAuth từ Google/Supabase
  if (typeof handleOAuthCallback === 'function') {
    handleOAuthCallback();
  }

  // 2. Nút Đăng ký nhanh với Google
  const btnGoogleRegister = document.getElementById('btnGoogleRegister');
  if (btnGoogleRegister) {
    btnGoogleRegister.addEventListener('click', async (e) => {
      e.preventDefault();
      await loginWithGoogle();
    });
  }

  // 3. Kiểm tra nếu đã login thì chuyển về dashboard
  redirectIfAuthenticated();

  const steps = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
  ];
  let currentStep = 0;

  const skillsList = [
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular',
    'Node.js', 'Python', 'Java', 'PHP', 'C++', 'SQL', 'MongoDB', 'PostgreSQL',
    'Docker', 'Git', 'Figma', 'UI/UX', 'Mobile Dev', 'AI/ML'
  ];

  const interestsList = [
    'Web Development', 'Mobile App', 'AI/ML', 'Game Dev', 'Cybersecurity',
    'Data Science', 'UI/UX Design', 'DevOps', 'Open Source', 'Cloud Computing'
  ];

  const skillsContainer = document.getElementById('skillsContainer');
  if (skillsContainer && skillsContainer.children.length === 0) {
    skillsList.forEach((skill, idx) => {
      skillsContainer.innerHTML += `
        <div class="pill-checkbox">
          <input type="checkbox" id="skill_${idx}" name="skills" value="${skill}">
          <label for="skill_${idx}">${skill}</label>
        </div>
      `;
    });
  }

  const interestsContainer = document.getElementById('interestsContainer');
  if (interestsContainer && interestsContainer.children.length === 0) {
    interestsList.forEach((interest, idx) => {
      interestsContainer.innerHTML += `
        <div class="pill-checkbox">
          <input type="checkbox" id="interest_${idx}" name="interests" value="${interest}">
          <label for="interest_${idx}">${interest}</label>
        </div>
      `;
    });
  }

  // Live count helper for skills and interests
  function updateSkillsCount() {
    const selected = document.querySelectorAll('input[name="skills"]:checked').length;
    const numEl = document.getElementById('skillsCountNum');
    if (numEl) numEl.textContent = selected;
  }

  function updateInterestsCount() {
    const selected = document.querySelectorAll('input[name="interests"]:checked').length;
    const numEl = document.getElementById('interestsCountNum');
    if (numEl) numEl.textContent = selected;
  }

  document.addEventListener('change', (e) => {
    if (e.target && e.target.matches('input[name="skills"]')) {
      updateSkillsCount();
      const err = document.getElementById('skillsError');
      if (err) err.classList.add('d-none');
    }
    if (e.target && e.target.matches('input[name="interests"]')) {
      updateInterestsCount();
      const err = document.getElementById('interestsError');
      if (err) err.classList.add('d-none');
    }
  });

  // Real-time Search Filter for Skills
  const skillSearchInput = document.getElementById('skillSearchInput');
  if (skillSearchInput) {
    skillSearchInput.addEventListener('input', () => {
      const q = skillSearchInput.value.toLowerCase().trim();
      document.querySelectorAll('#skillsContainer .pill-checkbox').forEach(item => {
        const text = item.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          item.style.display = 'inline-flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Tự nhập kỹ năng bổ sung nếu danh sách ví dụ chưa có
  const customSkillRegisterInput = document.getElementById('customSkillRegisterInput');
  const btnAddCustomSkillRegister = document.getElementById('btnAddCustomSkillRegister');
  const customSkillsRegisterList = document.getElementById('customSkillsRegisterList');
  let customSkillCounter = 0;

  function safeEscapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addCustomSkillToRegister() {
    if (!customSkillRegisterInput) return;
    const skillName = customSkillRegisterInput.value.trim();
    if (!skillName) return;

    // Kiểm tra xem kỹ năng này đã có trong danh sách checkbox (ví dụ) chưa
    const existingCheckbox = Array.from(document.querySelectorAll('input[name="skills"]'))
      .find(cb => (cb.value || '').toLowerCase() === skillName.toLowerCase());

    if (existingCheckbox) {
      existingCheckbox.checked = true;
      existingCheckbox.closest('.pill-checkbox')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      updateSkillsCount();
      const err = document.getElementById('skillsError');
      if (err) err.classList.add('d-none');
      customSkillRegisterInput.value = '';
      return;
    }

    customSkillCounter++;
    const customId = `custom_skill_${customSkillCounter}`;

    const pillDiv = document.createElement('div');
    pillDiv.className = 'pill-checkbox is-custom-skill';
    pillDiv.innerHTML = `
      <input type="checkbox" id="${customId}" name="skills" value="${safeEscapeHtml(skillName)}" checked>
      <label for="${customId}" class="d-inline-flex align-items-center gap-1">
        <i class="bi bi-patch-check-fill text-warning" style="font-size: 0.75rem;"></i>
        <span>${safeEscapeHtml(skillName)}</span>
        <span class="remove-custom-skill-btn" title="Xóa kỹ năng này" aria-label="Xóa">&times;</span>
      </label>
    `;

    // Nút xóa kỹ năng tùy chỉnh
    const removeBtn = pillDiv.querySelector('.remove-custom-skill-btn');
    removeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pillDiv.remove();
      if (customSkillsRegisterList && customSkillsRegisterList.children.length === 0) {
        customSkillsRegisterList.classList.add('d-none');
      }
      updateSkillsCount();
    });

    if (customSkillsRegisterList) {
      customSkillsRegisterList.classList.remove('d-none');
      customSkillsRegisterList.appendChild(pillDiv);
    } else if (skillsContainer) {
      skillsContainer.appendChild(pillDiv);
    }

    updateSkillsCount();
    const err = document.getElementById('skillsError');
    if (err) err.classList.add('d-none');

    customSkillRegisterInput.value = '';
    customSkillRegisterInput.focus();
  }

  btnAddCustomSkillRegister?.addEventListener('click', addCustomSkillToRegister);
  customSkillRegisterInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomSkillToRegister();
    }
  });

  function updateIndicators() {
    for (let i = 1; i <= 3; i++) {
      const ind = document.getElementById(`ind-${i}`);
      const line = document.getElementById(`line-${i-1}`);
      const text = document.getElementById(`text-${i}`);
      if (!ind) continue;

      if (i - 1 < currentStep) {
        ind.className = 'step-indicator step-completed';
        ind.innerHTML = '<i class="bi bi-check-lg"></i>';
        if (text) text.className = 'step-label step-label-completed';
        if (line) line.className = 'step-line step-line-active';
      } else if (i - 1 === currentStep) {
        ind.className = 'step-indicator step-active';
        ind.innerHTML = i;
        if (text) text.className = 'step-label step-label-active';
        if (line) line.className = 'step-line';
      } else {
        ind.className = 'step-indicator step-pending';
        ind.innerHTML = i;
        if (text) text.className = 'step-label step-label-pending';
        if (line) line.className = 'step-line';
      }
    }
  }

  // ── Password Strength & Validation ──────────────────────────
  const regPasswordInput = document.getElementById('regPassword');
  const regConfirmPasswordInput = document.getElementById('regConfirmPassword');

  function updatePasswordStrengthUI() {
    if (!regPasswordInput) return;
    const val = regPasswordInput.value;
    const { hasLength, hasUpper, hasSpecial, score } = evaluatePasswordStrength(val);

    const ruleLength = document.getElementById('rule-length');
    const ruleUpper = document.getElementById('rule-uppercase');
    const ruleSpecial = document.getElementById('rule-special');
    const bar = document.getElementById('strengthProgressBar');
    const label = document.getElementById('strengthLabel');
    const seg1 = document.getElementById('seg-1');
    const seg2 = document.getElementById('seg-2');
    const seg3 = document.getElementById('seg-3');

    function updateRule(el, valid, text) {
      if (!el) return;
      if (valid) {
        el.className = 'rule-item rule-valid';
        el.innerHTML = `<span class="rule-icon">✓</span> <span>${text}</span>`;
      } else {
        el.className = 'rule-item rule-invalid';
        el.innerHTML = `<span class="rule-icon">✓</span> <span>${text}</span>`;
      }
    }

    updateRule(ruleLength, hasLength, 'Ít nhất 8 ký tự');
    updateRule(ruleUpper, hasUpper, 'Có 1 chữ hoa');
    updateRule(ruleSpecial, hasSpecial, '1 ký tự đặc biệt');

    // Update Status Label
    if (label) {
      if (!val) {
        label.textContent = 'Chưa nhập';
        label.style.color = '#6B7280';
      } else if (score <= 1) {
        label.textContent = 'Yếu';
        label.style.color = '#EF4444';
      } else if (score === 2) {
        label.textContent = 'Trung bình';
        label.style.color = '#F59E0B';
      } else {
        label.textContent = 'Mạnh';
        label.style.color = '#10B981';
      }
    }

    // Update Compatibility Progress Bar
    if (bar) {
      if (!val) {
        bar.style.width = '0%';
        bar.style.backgroundColor = '#374151';
      } else if (score <= 1) {
        bar.style.width = '33%';
        bar.style.backgroundColor = '#EF4444';
      } else if (score === 2) {
        bar.style.width = '66%';
        bar.style.backgroundColor = '#F59E0B';
      } else {
        bar.style.width = '100%';
        bar.style.backgroundColor = '#10B981';
      }
    }
  }

  const confirmFeedback = document.getElementById('confirmPasswordFeedback');
  function updateConfirmPasswordValidation() {
    if (!regConfirmPasswordInput || !confirmFeedback) return;
    const pwd = regPasswordInput ? regPasswordInput.value : '';
    const confirmVal = regConfirmPasswordInput.value;

    if (!confirmVal) {
      confirmFeedback.style.display = 'none';
      confirmFeedback.textContent = '';
      regConfirmPasswordInput.classList.remove('is-valid-dark', 'is-invalid-dark');
      regConfirmPasswordInput.setCustomValidity('');
      return;
    }

    if (pwd === confirmVal) {
      confirmFeedback.style.display = 'block';
      confirmFeedback.className = 'confirm-pwd-status text-success mt-1';
      confirmFeedback.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Mật khẩu khớp';
      regConfirmPasswordInput.classList.remove('is-invalid-dark');
      regConfirmPasswordInput.classList.add('is-valid-dark');
      regConfirmPasswordInput.setCustomValidity('');
    } else {
      confirmFeedback.style.display = 'block';
      confirmFeedback.className = 'confirm-pwd-status text-danger mt-1';
      confirmFeedback.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> Mật khẩu chưa khớp';
      regConfirmPasswordInput.classList.remove('is-valid-dark');
      regConfirmPasswordInput.classList.add('is-invalid-dark');
      regConfirmPasswordInput.setCustomValidity('Mật khẩu không khớp');
    }
  }

  if (regPasswordInput) {
    regPasswordInput.addEventListener('input', updatePasswordStrengthUI);
    regPasswordInput.addEventListener('input', () => {
      if (regConfirmPasswordInput && regConfirmPasswordInput.value) {
        updateConfirmPasswordValidation();
      }
    });
    updatePasswordStrengthUI();
  }

  if (regConfirmPasswordInput) {
    regConfirmPasswordInput.addEventListener('input', updateConfirmPasswordValidation);
  }

  const btnNext1 = document.getElementById('btnNext1');
  if (btnNext1) {
    btnNext1.addEventListener('click', () => {
      const inputs = steps[0].querySelectorAll('input[required]');
      let valid = true;

      inputs.forEach(input => {
        if (!input.checkValidity()) valid = false;
      });

      const pwd = regPasswordInput ? regPasswordInput.value : '';
      const confirmPwd = regConfirmPasswordInput ? regConfirmPasswordInput.value : '';

      const strength = evaluatePasswordStrength(pwd);
      if (!strength.isValid) {
        if (regPasswordInput) regPasswordInput.setCustomValidity('Mật khẩu chưa đạt đủ các điều kiện bảo mật.');
        valid = false;
      } else {
        if (regPasswordInput) regPasswordInput.setCustomValidity('');
      }

      if (pwd !== confirmPwd) {
        if (regConfirmPasswordInput) regConfirmPasswordInput.setCustomValidity('Mật khẩu không khớp');
        updateConfirmPasswordValidation();
        valid = false;
      } else {
        if (regConfirmPasswordInput) regConfirmPasswordInput.setCustomValidity('');
      }

      if (!valid) {
        steps[0].classList.add('was-validated');
        return;
      }

      steps[0].classList.remove('was-validated');
      steps[0].classList.add('d-none');
      currentStep = 1;
      steps[currentStep].classList.remove('d-none');
      updateIndicators();
    });
  }

  const btnBack1 = document.getElementById('btnBack1');
  if (btnBack1) {
    btnBack1.addEventListener('click', () => {
      steps[1].classList.add('d-none');
      currentStep = 0;
      steps[currentStep].classList.remove('d-none');
      updateIndicators();
    });
  }

  const btnNext2 = document.getElementById('btnNext2');
  if (btnNext2) {
    btnNext2.addEventListener('click', () => {
      const selectedSkills = document.querySelectorAll('input[name="skills"]:checked');
      const err = document.getElementById('skillsError');
      if (selectedSkills.length === 0) {
        if (err) err.classList.remove('d-none');
        return;
      }
      if (err) err.classList.add('d-none');

      steps[1].classList.add('d-none');
      currentStep = 2;
      steps[currentStep].classList.remove('d-none');
      updateIndicators();
    });
  }

  const btnBack2 = document.getElementById('btnBack2');
  if (btnBack2) {
    btnBack2.addEventListener('click', () => {
      steps[2].classList.add('d-none');
      currentStep = 1;
      steps[currentStep].classList.remove('d-none');
      updateIndicators();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedInterests = document.querySelectorAll('input[name="interests"]:checked');
    const err = document.getElementById('interestsError');
    if (selectedInterests.length === 0) {
      if (err) err.classList.remove('d-none');
      return;
    }
    if (err) err.classList.add('d-none');

    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    const skills = Array.from(document.querySelectorAll('input[name="skills"]:checked')).map(cb => cb.value);
    const interests = Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value);

    const btnSubmit = document.getElementById('btnSubmit');
    const spinner = document.getElementById('registerSpinner');
    const originalSubmitText = btnSubmit.innerHTML;

    btnSubmit.disabled = true;
    if (spinner) spinner.classList.remove('d-none');
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Đang xử lý...';

    try {
      const result = await register({
        email,
        password,
        full_name: name,
        username,
        skills,
        interests,
      });

      if (result.success) {
        if (result.confirmationRequired) {
          form.innerHTML = `
            <div class="text-center py-5">
              <div class="mb-3 text-success">
                <i class="bi bi-envelope-check-fill display-2"></i>
              </div>
              <h3 class="fw-bold mb-3">Đăng ký thành công!</h3>
              <p class="text-muted mb-4 lead">
                Chúng tôi đã gửi một email xác nhận đến <strong>${email}</strong>.<br>
                Vui lòng kiểm tra hộp thư (bao gồm cả thư rác/spam) và nhấn xác thực để hoàn tất kích hoạt tài khoản.
              </p>
              <div class="d-flex flex-wrap justify-content-center gap-3">
                <a href="guide.html?onboarding=true" class="btn btn-primary btn-lg px-4 shadow-sm">
                  <i class="bi bi-book-half me-2"></i>Xem hướng dẫn sử dụng ngay
                </a>
                <a href="login.html" class="btn btn-outline-secondary btn-lg px-4">Đến trang Đăng nhập</a>
              </div>
            </div>
          `;
        } else {
          localStorage.setItem('just_registered', 'true');
          showToastMsg('Tạo tài khoản thành công! Đang chuyển hướng đến Hướng dẫn sử dụng...', 'success');
          setTimeout(() => {
            window.location.href = 'guide.html?onboarding=true';
          }, 800);
        }
      } else {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalSubmitText;
        if (spinner) spinner.classList.add('d-none');

        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-danger alert-dismissible fade show mb-4 auth-alert';
        alertDiv.innerHTML = `
          <i class="bi bi-exclamation-triangle-fill me-2"></i>${result.error}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        steps[2].insertBefore(alertDiv, steps[2].firstChild);
      }
    } catch (submitErr) {
      console.error(submitErr);
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalSubmitText;
      if (spinner) spinner.classList.add('d-none');
      showToastMsg('Có lỗi xảy ra, vui lòng thử lại.', 'error');
    }
  });
}

// Gắn các hàm vào window để các file khác dễ dàng gọi
window.getCurrentSession = getCurrentSession;
window.getCurrentUser = getCurrentUser;
window.getCurrentProfile = getCurrentProfile;
window.login = login;
window.register = register;
window.logout = logout;
window.requireAuth = requireAuth;
window.redirectIfAuthenticated = redirectIfAuthenticated;
window.onAuthStateChange = onAuthStateChange;
window.initLoginForm = initLoginForm;
window.initRegisterForm = initRegisterForm;
window.loginWithGoogle = loginWithGoogle;
window.evaluatePasswordStrength = evaluatePasswordStrength;
window.handleOAuthCallback = handleOAuthCallback;

// Tự động xử lý OAuth tokens hoặc lỗi trả về nếu có trong URL
if (typeof window !== 'undefined') {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (hash.includes('error=') || search.includes('error=') || hash.includes('access_token=') || search.includes('code=')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        handleOAuthCallback();
      });
    } else {
      handleOAuthCallback();
    }
  }
}
