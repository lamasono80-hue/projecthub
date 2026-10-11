/**
 * routes/admin.js — ProjectHub Administration API
 *
 * Các endpoint quản trị hệ thống (Chỉ dành cho Admin):
 * - GET  /api/admin/check          : Kiểm tra trạng thái quyền Admin của token
 * - GET  /api/admin/stats          : Bảng điều khiển số liệu thống kê & KPI toàn sàn
 * - GET  /api/admin/users          : Quản lý danh sách người dùng (tìm kiếm, lọc, phân trang)
 * - POST /api/admin/users/:id/role : Cấp / Thu hồi quyền Admin cho người dùng
 * - POST /api/admin/users/:id/ban  : Khóa (Ban) / Mở khóa (Unban) tài khoản
 * - GET  /api/admin/projects       : Quản lý danh sách toàn bộ dự án
 * - PATCH/api/admin/projects/:id   : Đổi trạng thái, ẩn/hiện dự án
 * - DELETE/api/admin/projects/:id  : Xóa dự án vi phạm / spam
 * - GET  /api/admin/announcements  : Danh sách thông báo toàn sàn
 * - POST /api/admin/broadcast      : Soạn & Gửi thông báo toàn sàn (Broadcast Notification)
 * - DELETE/api/admin/announcements/:id : Xóa thông báo
 */
'use strict';

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const { requireAdmin, getSupabaseAdmin, getAdminEmails } = require('../middleware/auth');

// Đảm bảo thư mục lưu trữ data nội bộ tồn tại
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');

function loadAnnouncements() {
  try {
    if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
      const raw = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Admin] Lỗi đọc announcements.json:', err.message);
  }
  return [];
}

function saveAnnouncements(items) {
  try {
    fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('[Admin] Lỗi ghi announcements.json:', err.message);
  }
}

// ==========================================
// 1. Check Admin Status
// ==========================================
router.get('/check', requireAdmin, (req, res) => {
  res.json({
    isAdmin: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.app_metadata?.role || (getAdminEmails().includes(req.user.email.toLowerCase()) ? 'admin' : 'user'),
      isSuperAdmin: getAdminEmails().includes(req.user.email.toLowerCase()),
    },
  });
});

// ==========================================
// 2. Statistics & KPI Dashboard
// ==========================================
router.get('/stats', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Lấy danh sách users từ Auth
    let totalUsers = 0;
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      totalUsers = users ? users.length : 0;
    } catch (err) {
      console.warn('[Admin Stats] listUsers fallback:', err.message);
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      totalUsers = count || 0;
    }

    // 2. Thống kê dự án
    const { data: projects, count: totalProjects } = await supabase
      .from('projects')
      .select('id, title, category, status, progress, created_at', { count: 'exact' });

    const activeProjects = (projects || []).filter(p => p.status === 'in_progress').length;
    const recruitingProjects = (projects || []).filter(p => p.status === 'recruiting').length;
    const completedProjects = (projects || []).filter(p => p.status === 'completed').length;
    const archivedProjects = (projects || []).filter(p => p.status === 'archived').length;

    // Phân bổ danh mục
    const categoryCount = {};
    (projects || []).forEach(p => {
      const cat = p.category || 'other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    // 3. Thống kê tasks
    let totalTasks = 0;
    let doneTasks = 0;
    try {
      const { data: tasks, count: taskCount } = await supabase
        .from('tasks')
        .select('id, status', { count: 'exact' });
      totalTasks = taskCount || 0;
      doneTasks = (tasks || []).filter(t => t.status === 'done').length;
    } catch (err) {
      console.warn('[Admin Stats] tasks query:', err.message);
    }

    // 4. Thống kê thành viên tham gia
    let totalMembers = 0;
    try {
      const { count } = await supabase
        .from('project_members')
        .select('*', { count: 'exact', head: true });
      totalMembers = count || 0;
    } catch {
      totalMembers = 0;
    }

    // 5. Hoạt động gần đây (Recent activities)
    const recentProjects = (projects || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    const announcements = loadAnnouncements();

    res.json({
      overview: {
        totalUsers,
        totalProjects: totalProjects || (projects ? projects.length : 0),
        activeProjects,
        recruitingProjects,
        completedProjects,
        archivedProjects,
        totalTasks,
        doneTasks,
        totalMembers,
        announcementsCount: announcements.length,
        matchingSuccessRate: totalProjects > 0 ? Math.round(((activeProjects + completedProjects) / totalProjects) * 100) : 98,
      },
      categoryDistribution: categoryCount,
      recentProjects,
      announcements: announcements.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. Quản lý Người dùng (Users Management)
// ==========================================
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const adminEmails = getAdminEmails();

    const search = (req.query.search || '').trim().toLowerCase();
    const roleFilter = req.query.role || 'all'; // all, admin, user
    const statusFilter = req.query.status || 'all'; // all, active, banned
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));

    // Lấy users từ auth.admin
    const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) throw authErr;

    // Lấy profiles
    const { data: profiles } = await supabase.from('profiles').select('*');
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Đếm số dự án mỗi user làm chủ
    const { data: projects } = await supabase.from('projects').select('owner_id');
    const projectCountMap = new Map();
    (projects || []).forEach(p => {
      projectCountMap.set(p.owner_id, (projectCountMap.get(p.owner_id) || 0) + 1);
    });

    // Kết hợp thông tin
    let combinedUsers = (users || []).map(u => {
      const prof = profileMap.get(u.id) || {};
      const isSuper = adminEmails.includes(u.email.toLowerCase());
      const role = isSuper || u.app_metadata?.role === 'admin' || prof.role === 'admin' ? 'admin' : 'user';
      const isBanned = !!(u.banned_until && u.banned_until !== 'none') || !!u.app_metadata?.is_banned || !!prof.is_banned;

      return {
        id: u.id,
        email: u.email,
        display_name: prof.display_name || u.user_metadata?.display_name || u.email.split('@')[0],
        username: prof.username || u.email.split('@')[0],
        avatar_url: prof.avatar_url || u.user_metadata?.avatar_url || '',
        skills: prof.skills || [],
        experience: prof.experience || 'beginner',
        role,
        isSuperAdmin: isSuper,
        isBanned,
        projectsCount: projectCountMap.get(u.id) || 0,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
      };
    });

    // Lọc theo search
    if (search) {
      combinedUsers = combinedUsers.filter(u =>
        u.email.toLowerCase().includes(search) ||
        u.display_name.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search) ||
        u.skills.some(s => s.toLowerCase().includes(search))
      );
    }

    // Lọc theo role
    if (roleFilter === 'admin') {
      combinedUsers = combinedUsers.filter(u => u.role === 'admin');
    } else if (roleFilter === 'user') {
      combinedUsers = combinedUsers.filter(u => u.role === 'user');
    }

    // Lọc theo status
    if (statusFilter === 'banned') {
      combinedUsers = combinedUsers.filter(u => u.isBanned);
    } else if (statusFilter === 'active') {
      combinedUsers = combinedUsers.filter(u => !u.isBanned);
    }

    const total = combinedUsers.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = combinedUsers.slice(startIndex, startIndex + pageSize);

    res.json({
      data: paginated,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Cập nhật vai trò (Cấp / Thu hồi quyền Admin)
router.post('/users/:id/role', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // 'admin' | 'user'
    const supabase = getSupabaseAdmin();
    const adminEmails = getAdminEmails();

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ. Chỉ chấp nhận "admin" hoặc "user".' });
    }

    // Kiểm tra user có tồn tại
    const { data: { user }, error: getErr } = await supabase.auth.admin.getUserById(id);
    if (getErr || !user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    // Không được phép hạ quyền Super Admin chính
    if (adminEmails.includes(user.email.toLowerCase()) && role !== 'admin') {
      return res.status(403).json({ error: 'Không thể thu hồi quyền của Super Admin chính của hệ thống.' });
    }

    // Cập nhật app_metadata
    const updatedMetadata = {
      ...(user.app_metadata || {}),
      role,
      is_admin: role === 'admin',
    };

    const { error: updateErr } = await supabase.auth.admin.updateUserById(id, {
      app_metadata: updatedMetadata,
    });
    if (updateErr) throw updateErr;

    // Thử cập nhật cột role trong profiles nếu bảng có cột này
    try {
      await supabase.from('profiles').update({ role }).eq('id', id);
    } catch {
      // Bỏ qua nếu cột chưa tồn tại
    }

    res.json({
      success: true,
      message: `Đã ${role === 'admin' ? 'cấp quyền Admin' : 'chuyển về thành viên thường'} thành công cho ${user.email}.`,
      role,
    });
  } catch (err) {
    next(err);
  }
});

// Khóa (Ban) / Mở khóa (Unban) tài khoản
router.post('/users/:id/ban', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ban } = req.body; // boolean: true = ban, false = unban
    const supabase = getSupabaseAdmin();
    const adminEmails = getAdminEmails();

    const { data: { user }, error: getErr } = await supabase.auth.admin.getUserById(id);
    if (getErr || !user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    if (adminEmails.includes(user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Không thể khóa tài khoản Super Admin!' });
    }

    const isBanning = Boolean(ban);

    const { error: updateErr } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: isBanning ? '876000h' : 'none',
      app_metadata: {
        ...(user.app_metadata || {}),
        is_banned: isBanning,
      },
    });
    if (updateErr) throw updateErr;

    // Thử cập nhật profiles nếu có
    try {
      await supabase.from('profiles').update({ is_banned: isBanning }).eq('id', id);
    } catch {
      // ignore
    }

    res.json({
      success: true,
      message: isBanning
        ? `Đã khóa tài khoản ${user.email}. Người dùng này sẽ không thể đăng nhập hoặc thực hiện thao tác.`
        : `Đã mở khóa tài khoản cho ${user.email}.`,
      isBanned: isBanning,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. Quản lý Dự án (Projects Management)
// ==========================================
router.get('/projects', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const search = (req.query.search || '').trim().toLowerCase();
    const status = req.query.status || 'all';
    const category = req.query.category || 'all';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));

    let query = supabase
      .from('projects')
      .select(`
        id, title, description, category, technologies, difficulty,
        status, progress, max_members, deadline, is_public, image_url,
        created_at, updated_at, owner_id,
        owner:owner_id ( display_name, avatar_url, username )
      `, { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (category !== 'all') {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    query = query.order('created_at', { ascending: false });

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: projects, count, error } = await query;
    if (error) throw error;

    // Đếm số thành viên và số tasks cho từng dự án
    const projectIds = (projects || []).map(p => p.id);
    let memberCountMap = new Map();
    let taskCountMap = new Map();

    if (projectIds.length > 0) {
      try {
        const { data: members } = await supabase
          .from('project_members')
          .select('project_id')
          .in('project_id', projectIds);
        (members || []).forEach(m => {
          memberCountMap.set(m.project_id, (memberCountMap.get(m.project_id) || 0) + 1);
        });

        const { data: tasks } = await supabase
          .from('tasks')
          .select('project_id')
          .in('project_id', projectIds);
        (tasks || []).forEach(t => {
          taskCountMap.set(t.project_id, (taskCountMap.get(t.project_id) || 0) + 1);
        });
      } catch (err) {
        console.warn('[Admin Projects] member/task counts:', err.message);
      }
    }

    const enhanced = (projects || []).map(p => ({
      ...p,
      membersCount: memberCountMap.get(p.id) || 1, // Chủ dự án luôn là ít nhất 1
      tasksCount: taskCountMap.get(p.id) || 0,
    }));

    res.json({
      data: enhanced,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Cập nhật trạng thái / ẩn hiện dự án
router.patch('/projects/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, is_public } = req.body;
    const supabase = getSupabaseAdmin();

    const updates = {};
    if (status !== undefined) {
      const validStatuses = ['recruiting', 'in_progress', 'completed', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Trạng thái dự án không hợp lệ.' });
      }
      updates.status = status;
    }
    if (is_public !== undefined) {
      updates.is_public = Boolean(is_public);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Không có thông tin nào cần cập nhật.' });
    }

    const { data: updated, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Cập nhật dự án thành công.',
      project: updated,
    });
  } catch (err) {
    next(err);
  }
});

// Xóa dự án vi phạm / spam
router.delete('/projects/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseAdmin();

    // Lấy thông tin dự án để xác nhận
    const { data: project, error: getErr } = await supabase
      .from('projects')
      .select('id, title, owner_id')
      .eq('id', id)
      .single();

    if (getErr || !project) {
      return res.status(404).json({ error: 'Không tìm thấy dự án để xóa.' });
    }

    // Xóa dự án (foreign keys onDelete: CASCADE sẽ tự động xóa tasks, members, messages)
    const { error: delErr } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    // Gửi thông báo đến chủ dự án nếu có
    try {
      await supabase.from('notifications').insert({
        user_id: project.owner_id,
        type: 'system',
        title: 'Dự án đã bị gỡ bỏ bởi Ban Quản Trị',
        message: `Dự án "${project.title}" của bạn đã bị quản trị viên gỡ bỏ do vi phạm tiêu chuẩn cộng đồng hoặc chứa nội dung không phù hợp.`,
      });
    } catch {
      // ignore notif error
    }

    res.json({
      success: true,
      message: `Đã xóa thành công dự án "${project.title}".`,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. Thông báo Toàn sàn (Broadcast Announcements)
// ==========================================
router.get('/announcements', requireAdmin, (req, res) => {
  const items = loadAnnouncements();
  res.json({ data: items });
});

router.post('/broadcast', requireAdmin, async (req, res, next) => {
  try {
    const { title, message, type = 'info', action_url = '' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tiêu đề thông báo.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung thông báo.' });
    }

    const validTypes = ['info', 'warning', 'urgent', 'success'];
    const chosenType = validTypes.includes(type) ? type : 'info';

    const newAnnouncement = {
      id: 'anno_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: title.trim(),
      message: message.trim(),
      type: chosenType,
      action_url: action_url ? action_url.trim() : '',
      createdAt: new Date().toISOString(),
      createdBy: req.user.email,
    };

    // 1. Lưu vào file json
    const current = loadAnnouncements();
    current.unshift(newAnnouncement);
    saveAnnouncements(current);

    // 2. Broadcast notification đến tất cả users trong bảng notifications
    const supabase = getSupabaseAdmin();
    let notifCount = 0;
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (users && users.length > 0) {
        const notifPayloads = users.map(u => ({
          user_id: u.id,
          type: 'system',
          title: `[Thông báo hệ thống] ${newAnnouncement.title}`,
          message: newAnnouncement.message,
          action_url: newAnnouncement.action_url || '/index.html',
          is_read: false,
          created_at: new Date().toISOString(),
        }));

        // Insert theo batch nhỏ 100 phần tử để tránh quá tải
        const batchSize = 100;
        for (let i = 0; i < notifPayloads.length; i += batchSize) {
          const batch = notifPayloads.slice(i, i + batchSize);
          await supabase.from('notifications').insert(batch);
        }
        notifCount = users.length;
      }
    } catch (notifErr) {
      console.warn('[Admin Broadcast] Lỗi gửi notifications tới users:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Đã phát sóng thông báo toàn sàn thành công! Đã gửi thông báo đến ${notifCount} người dùng.`,
      announcement: newAnnouncement,
      sentCount: notifCount,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/announcements/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let items = loadAnnouncements();
  const initialLength = items.length;
  items = items.filter(item => item.id !== id);

  if (items.length === initialLength) {
    return res.status(404).json({ error: 'Không tìm thấy thông báo để xóa.' });
  }

  saveAnnouncements(items);
  res.json({ success: true, message: 'Đã xóa thông báo thành công.' });
});

module.exports = router;
