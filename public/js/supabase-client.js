/**
 * supabase-client.js — Client-side Supabase Initialization
 * 
 * QUAN TRỌNG:
 * - CHỈ sử dụng SUPABASE_ANON_KEY (public key được thiết kế cho client với RLS)
 * - TUYỆT ĐỐI KHÔNG chứa SUPABASE_SERVICE_ROLE_KEY
 * - Lấy config động từ /api/config
 * - Tích hợp Supabase Auth với session persistence
 */
'use strict';

(function(window) {
  const DEFAULT_URL = 'https://wmqpdxwgdandtvgxduha.supabase.co';
  const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcXBkeHdnZGFuZHR2Z3hkdWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NjI1MDksImV4cCI6MjEwNDIzODUwOX0.u4a9jGhFQgKDydBkNuL5PWBF_9oTl1YWJlaOQjodWNs';

  let clientPromise = null;
  let clientInstance = null;

  function createClient(url, anonKey) {
    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
      return null;
    }
    return window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
  }

  // Khởi tạo tức thì nếu CDN Supabase đã sẵn sàng
  try {
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      clientInstance = createClient(DEFAULT_URL, DEFAULT_ANON_KEY);
      window.supabaseClient = clientInstance;
    }
  } catch (e) {
    console.warn('[SupabaseClient] Immediate init note:', e);
  }

  /**
   * Lấy cấu hình công khai từ server (/api/config)
   */
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[SupabaseClient] Không thể tải cấu hình từ /api/config, dùng cấu hình mặc định:', err.message);
      return { supabaseUrl: DEFAULT_URL, supabaseAnonKey: DEFAULT_ANON_KEY };
    }
  }

  /**
   * Khởi tạo hoặc trả về Supabase client singleton
   * @returns {Promise<any>} Supabase client instance
   */
  async function initSupabase() {
    if (clientInstance) return clientInstance;
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
      // Đảm bảo thư viện Supabase JS CDN đã tải
      if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
        console.error('[SupabaseClient] Thư viện @supabase/supabase-js CDN chưa được nạp trên trang này.');
        return null;
      }

      const config = await fetchConfig();
      const url = config.supabaseUrl || DEFAULT_URL;
      const anonKey = config.supabaseAnonKey || DEFAULT_ANON_KEY;

      if (!url || !anonKey || url.includes('your-project-ref')) {
        console.warn('[SupabaseClient] Cảnh báo: SUPABASE_URL hoặc SUPABASE_ANON_KEY chưa được cấu hình.');
        return null;
      }

      try {
        clientInstance = createClient(url, anonKey);
        window.supabaseClient = clientInstance;
        return clientInstance;
      } catch (err) {
        console.error('[SupabaseClient] Lỗi khởi tạo Supabase client:', err);
        return null;
      }
    })();

    return clientPromise;
  }

  // Khởi tạo ngay khi script được nạp
  initSupabase();

  window.initSupabase = initSupabase;
  window.getSupabase = initSupabase;
  window.getSupabaseClient = () => clientInstance || window.supabaseClient;
})(window);
