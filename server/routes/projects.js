/**
 * routes/projects.js — Project API routes
 *
 * Backend endpoints:
 * - GET  /api/projects          : Query public projects with filtering/pagination
 * - GET  /api/projects/featured : Query featured public projects
 * - POST /api/projects/:id/invite : Invite a user to join a project (notifications-based)
 */
'use strict';

const express = require('express');
const router  = express.Router();
const { requireAuth, getSupabaseAdmin } = require('../middleware/auth');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(uuid) {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid.trim());
}

/**
 * GET /api/projects
 * Public — query public projects via Supabase service role (fallback if client RLS fails or recursion detected)
 */
router.get('/', async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 12;
    const offset = (page - 1) * pageSize;

    let q = supabase
      .from('projects')
      .select(`
        id, title, description, category, technologies,
        difficulty, status, progress, max_members, deadline,
        image_url, is_public, created_at, owner_id,
        profiles:owner_id ( display_name, avatar_url, username )
      `, { count: 'exact' })
      .eq('is_public', true);

    if (req.query.search) {
      q = q.or(`title.ilike.%${req.query.search}%,description.ilike.%${req.query.search}%`);
    }
    if (req.query.category) {
      q = q.eq('category', req.query.category);
    }
    if (req.query.status) {
      q = q.eq('status', req.query.status);
    } else if (req.query.recruiting === 'true') {
      q = q.eq('status', 'recruiting');
    }
    if (req.query.difficulty) {
      q = q.eq('difficulty', req.query.difficulty);
    }
    if (req.query.teamSize === '1-3') {
      q = q.lte('max_members', 3);
    } else if (req.query.teamSize === '4-6') {
      q = q.gte('max_members', 4).lte('max_members', 6);
    } else if (req.query.teamSize === '7+') {
      q = q.gte('max_members', 7);
    }

    if (req.query.sort === 'oldest') {
      q = q.order('created_at', { ascending: true });
    } else if (req.query.sort === 'progress') {
      q = q.order('progress', { ascending: false });
    } else {
      q = q.order('created_at', { ascending: false });
    }

    q = q.range(offset, offset + pageSize - 1);

    const { data, error, count } = await q;
    if (error) throw error;

    res.json({ data: data || [], count: count || 0, page, pageSize });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/projects/featured
 * Public — không cần auth
 * Trả về danh sách project nổi bật từ cơ sở dữ liệu:
 * - is_public = true (không để lộ dự án riêng tư)
 * - status != 'archived' (loại trừ dự án đã lưu trữ/đóng)
 * - Sắp xếp tất định: progress DESC (ưu tiên dự án có tiến độ hoạt động cao), sau đó created_at DESC
 * - Hỗ trợ query param ?limit=N (mặc định 6, tối đa 20) và ?category=...
 */
router.get('/featured', async (req, res, next) => {
  try {
    let limit = 6;
    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
        return res.status(400).json({ error: 'Tham số limit không hợp lệ. Phải là số nguyên từ 1 đến 20.' });
      }
      limit = parsedLimit;
    }

    const supabase = getSupabaseAdmin();

    let q = supabase
      .from('projects')
      .select(`
        id, title, description, category, technologies,
        difficulty, status, progress, max_members, deadline,
        image_url, is_public, created_at, updated_at, owner_id,
        profiles:owner_id ( display_name, avatar_url, username )
      `)
      .eq('is_public', true)
      .neq('status', 'archived');

    if (req.query.category && typeof req.query.category === 'string') {
      const cat = req.query.category.trim();
      if (cat.length > 50) {
        return res.status(400).json({ error: 'Tham số category không hợp lệ.' });
      }
      q = q.eq('category', cat);
    }

    q = q
      .order('progress', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await q;
    if (error) {
      console.error('[Featured Projects Error]:', error.message);
      return res.status(500).json({ error: 'Lỗi khi tải danh sách dự án nổi bật.' });
    }

    const projects = data || [];
    res.json({
      success: true,
      data: projects,
      projects: projects,
      count: projects.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/projects/:id/invite
 * Mời thành viên tham gia dự án
 * - Yêu cầu xác thực JWT (requireAuth)
 * - Chỉ chủ dự án mới có quyền mời
 * - Kiểm tra dự án tồn tại và đang mở
 * - Kiểm tra người được mời tồn tại
 * - Kiểm tra không mời chính mình
 * - Kiểm tra người được mời chưa là thành viên active
 * - Kiểm tra số lượng thành viên không vượt quá max_members
 * - Kiểm tra không trùng lặp lời mời chưa đọc
 * - Tạo thông báo type='invite' trong public.notifications
 */
router.post('/:id/invite', requireAuth, async (req, res, next) => {
  try {
    const projectId = req.params.id;
    if (!isValidUUID(projectId)) {
      return res.status(400).json({ error: 'Mã dự án (project ID) không hợp lệ.' });
    }

    const { userId, role, message } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã người dùng (userId) cần mời.' });
    }
    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Mã người dùng (userId) không hợp lệ.' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Chủ dự án không thể tự mời chính mình làm thành viên.' });
    }

    if (!role || typeof role !== 'string' || !role.trim()) {
      return res.status(400).json({ error: 'Vui lòng chỉ định vai trò (role) cho thành viên được mời.' });
    }

    const sanitizedRole = role.trim();
    if (sanitizedRole.length > 100) {
      return res.status(400).json({ error: 'Tên vai trò không được vượt quá 100 ký tự.' });
    }

    const supabase = getSupabaseAdmin();

    // 1. Kiểm tra dự án
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, title, owner_id, status, max_members')
      .eq('id', projectId)
      .maybeSingle();

    if (projErr) {
      console.error('[Invite API] Error fetching project:', projErr.message);
      return res.status(500).json({ error: 'Lỗi hệ thống khi tìm kiếm dự án.' });
    }
    if (!project) {
      return res.status(404).json({ error: 'Không tìm thấy dự án tương ứng.' });
    }

    // 2. Quyền sở hữu
    if (project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Chỉ có chủ dự án mới có quyền mời thành viên.' });
    }

    // 3. Trạng thái dự án
    if (project.status === 'archived' || project.status === 'completed') {
      return res.status(400).json({ error: 'Dự án đã hoàn thành hoặc đã đóng, không thể nhận thêm thành viên.' });
    }

    // 4. Kiểm tra người được mời có tồn tại trong profiles
    const { data: inviteeProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr) {
      console.error('[Invite API] Error fetching profile:', profileErr.message);
      return res.status(500).json({ error: 'Lỗi hệ thống khi kiểm tra người dùng.' });
    }
    if (!inviteeProfile) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng được mời.' });
    }

    // 5. Kiểm tra người dùng đã là thành viên active chưa
    const { data: existingMember, error: memberErr } = await supabase
      .from('project_members')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (memberErr) {
      console.error('[Invite API] Error checking member:', memberErr.message);
      return res.status(500).json({ error: 'Lỗi hệ thống khi kiểm tra thành viên dự án.' });
    }
    if (existingMember) {
      return res.status(400).json({ error: 'Người dùng này đã là thành viên chính thức của dự án.' });
    }

    // 6. Kiểm tra giới hạn thành viên tối đa (max_members)
    const { count: currentMemberCount, error: countErr } = await supabase
      .from('project_members')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'active');

    if (countErr) {
      console.error('[Invite API] Error counting members:', countErr.message);
      return res.status(500).json({ error: 'Lỗi hệ thống khi kiểm tra số lượng thành viên.' });
    }

    const maxAllowed = project.max_members || 5;
    if ((currentMemberCount + 1) >= maxAllowed) {
      return res.status(400).json({ error: `Dự án đã đủ số lượng thành viên tối đa (${maxAllowed}).` });
    }

    // 7. Kiểm tra trùng lặp lời mời chưa đọc (pending invite)
    const { data: pendingInvite, error: pendingErr } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .eq('type', 'invite')
      .eq('is_read', false)
      .maybeSingle();

    if (pendingErr) {
      console.error('[Invite API] Error checking pending invite:', pendingErr.message);
      return res.status(500).json({ error: 'Lỗi hệ thống khi kiểm tra lời mời trước đó.' });
    }
    if (pendingInvite) {
      return res.status(409).json({ error: 'Đã có lời mời đang chờ người dùng này phản hồi cho dự án.' });
    }

    // 8. Lấy tên chủ dự án để hiển thị lời mời
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', req.user.id)
      .maybeSingle();

    const inviterName = inviterProfile?.display_name || inviterProfile?.username || 'Chủ dự án';
    const inviteTitle = `Lời mời tham gia dự án: ${project.title}`;
    const inviteMsg = message && typeof message === 'string' && message.trim()
      ? message.trim().substring(0, 500)
      : `${inviterName} đã mời bạn tham gia dự án "${project.title}" với vai trò ${sanitizedRole}.`;

    // 9. Tạo thông báo mời vào bảng notifications
    const { data: newNotif, error: insertErr } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        project_id: projectId,
        type: 'invite',
        title: inviteTitle,
        message: inviteMsg,
        data: {
          project_id: projectId,
          project_title: project.title,
          inviter_id: req.user.id,
          inviter_name: inviterName,
          role: sanitizedRole
        },
        action_url: `project-detail.html?id=${projectId}`,
        is_read: false
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[Invite API] Error inserting invitation:', insertErr.message);
      return res.status(500).json({ error: 'Lỗi khi tạo lời mời tham gia dự án.' });
    }

    res.status(201).json({
      success: true,
      message: `Đã gửi lời mời tham gia dự án tới ${inviteeProfile.display_name || inviteeProfile.username}.`,
      data: {
        id: newNotif.id,
        projectId,
        userId,
        role: sanitizedRole,
        createdAt: newNotif.created_at
      }
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
