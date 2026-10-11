/**
 * middleware/auth.js — Supabase JWT Authentication Middleware
 * Xác thực Supabase access token từ Authorization header
 * KHÔNG tự quản lý password hay session — ủy quyền hoàn toàn cho Supabase Auth
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');

// Khởi tạo Supabase client với service role (chỉ dùng server-side)
let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình trong .env');
    }

    supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

function getAdminEmails() {
  const envVal = process.env.ADMIN_EMAILS || 'lamasono80@gmail.com';
  const list = envVal
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (!list.includes('lamasono80@gmail.com')) {
    list.push('lamasono80@gmail.com');
  }
  return list;
}

/**
 * Kiểm tra xem user có quyền Admin hay không
 */
async function isUserAdmin(user) {
  if (!user || !user.email) return false;

  const email = user.email.toLowerCase().trim();
  const adminEmails = getAdminEmails();

  // 1. Kiểm tra danh sách ADMIN_EMAILS cấu hình trong .env hoặc email lamasono80@gmail.com
  if (email === 'lamasono80@gmail.com' || adminEmails.includes(email)) {
    return true;
  }

  // 2. Kiểm tra app_metadata trong Supabase Auth
  if (user.app_metadata && (user.app_metadata.role === 'admin' || user.app_metadata.is_admin === true)) {
    return true;
  }

  // 3. Kiểm tra cột role trong profiles nếu có
  try {
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && (profile.role === 'admin' || profile.is_admin === true)) {
      return true;
    }
  } catch {
    // Ignore schema cache or missing column error
  }

  return false;
}

/**
 * requireAuth middleware
 * Xác thực Bearer token trong Authorization header
 * Attach req.user nếu hợp lệ
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized. Vui lòng đăng nhập.',
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer "

  try {
    const supabase = getSupabaseAdmin();
    let user = null;

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    } catch (authErr) {
      console.warn('[Auth Middleware] supabase.auth.getUser error:', authErr.message);
    }

    // SECURITY: Không có fallback decode JWT không xác minh chữ ký.
    // Nếu Supabase Auth không xác minh được token (network error, token hết hạn, giả mạo),
    // yêu cầu phải bị từ chối. Việc decode JWT payload mà không verify signature
    // cho phép tấn công giả mạo danh tính với bất kỳ email nào bao gồm admin.
    if (!user) {
      console.warn('[Auth Middleware] Token không thể xác minh qua Supabase Auth.');
    }

    if (!user) {
      return res.status(401).json({
        error: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }

    // Attach user info vào request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    };

    req.user.isAdmin = await isUserAdmin(user);

    next();
  } catch (err) {
    console.error('[Auth Middleware]', err.message);
    return res.status(500).json({ error: 'Lỗi xác thực.' });
  }
}

/**
 * requireAdmin middleware
 * Bắt buộc người dùng phải đăng nhập VÀ có quyền Admin
 */
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        error: 'Forbidden. Bạn không có quyền quản trị hệ thống.',
        requiresAdmin: true,
      });
    }
    next();
  });
}

/**
 * optionalAuth middleware
 * Không block request nếu không có token, chỉ attach user nếu có
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const supabase = getSupabaseAdmin();
    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
        isAdmin: await isUserAdmin(user),
      };
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
  isUserAdmin,
  getAdminEmails,
  getSupabaseAdmin,
};
