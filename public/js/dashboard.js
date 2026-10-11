/**
 * dashboard.js — Dashboard controller for ProjectHub
 * 
 * QUAN TRỌNG:
 * - Bảo vệ bằng requireAuth() — yêu cầu đăng nhập
 * - Hiển thị thông tin người dùng thật từ Supabase (KHÔNG dùng demo hardcode)
 * - Tính toán Profile Completion dựa trên dữ liệu thật
 * - Xử lý đăng xuất an toàn qua logout()
 */
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // Mobile sidebar toggle handler
  initSidebarToggle();

  // 1. Kiểm tra xác thực
  if (typeof requireAuth === 'function') {
    const isAuth = await requireAuth();
    if (!isAuth) return;
  }

  // 2. Tải thông tin người dùng và phân tích dữ liệu thật
  await initDashboardUser();
});

/**
 * Điều khiển đóng/mở Sidebar trên thiết bị di động
 */
function initSidebarToggle() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('show');
    });
  }
  if (backdrop && sidebar) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });
  }
}

/**
 * Tải và hiển thị thông tin người dùng thật từ Supabase
 */
async function initDashboardUser() {
  try {
    let profile = null;
    if (typeof getCurrentProfile === 'function') {
      profile = await getCurrentProfile();
    }
    const authUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;

    if (!profile && !authUser) {
      console.warn('[Dashboard] Chưa có session đăng nhập hợp lệ. Chuyển hướng login.');
      window.location.href = 'login.html?redirect=dashboard.html';
      return;
    }

    const displayName = profile?.display_name || profile?.full_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Thành viên';
    const email = profile?.email || authUser?.email || '';
    const username = profile?.username || authUser?.user_metadata?.username || email.split('@')[0];
    const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4F46E5&color=fff&size=128`;
    const skills = Array.isArray(profile?.skills) ? profile.skills : [];
    const experience = profile?.experience || 'beginner';

    // 1. Welcome Header
    const welcomeEl = document.getElementById('dashboard-welcome');
    if (welcomeEl) {
      welcomeEl.textContent = `Xin chào, ${displayName}! 👋`;
    }

    // Ngày tháng hiện tại tiếng Việt
    const dateEl = document.getElementById('dashboard-date');
    if (dateEl) {
      const now = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('vi-VN', options);
    }

    // 2. Sidebar User info
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    if (sidebarAvatar) sidebarAvatar.src = avatarUrl;

    const sidebarName = document.getElementById('sidebar-user-name');
    if (sidebarName) sidebarName.textContent = displayName;

    const sidebarRole = document.getElementById('sidebar-user-role');
    if (sidebarRole) {
      const expMap = { beginner: 'Người mới', intermediate: 'Trung cấp', advanced: 'Nâng cao' };
      sidebarRole.textContent = expMap[experience] || 'Thành viên';
    }

    // Hiển thị nút Admin Portal nếu là Admin
    const isAdmin = (email && email.toLowerCase().trim() === 'lamasono80@gmail.com') ||
                    profile?.role === 'admin' ||
                    authUser?.app_metadata?.role === 'admin';
    const adminLinkEl = document.getElementById('sidebar-admin-link');
    if (adminLinkEl && isAdmin) {
      adminLinkEl.classList.remove('d-none');
    }

    // Nút đăng xuất sidebar
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.onclick = (e) => {
        e.preventDefault();
        if (typeof logout === 'function') {
          logout();
        } else {
          window.location.href = 'login.html';
        }
      };
    }

    // 3. User Profile Card & Completion Widget
    const userCardName = document.getElementById('dash-user-name');
    if (userCardName) userCardName.textContent = displayName;

    const userCardEmail = document.getElementById('dash-user-email');
    if (userCardEmail) userCardEmail.textContent = email;

    const userCardUsername = document.getElementById('dash-user-username');
    if (userCardUsername) userCardUsername.textContent = `@${username}`;

    const userCardAvatar = document.getElementById('dash-user-avatar');
    if (userCardAvatar) userCardAvatar.src = avatarUrl;

    // Skills
    const userCardSkills = document.getElementById('dash-user-skills');
    if (userCardSkills) {
      if (skills.length > 0) {
        userCardSkills.innerHTML = skills
          .map(s => `<span class="badge bg-light text-dark border px-2 py-1 small">${escapeHtml(s)}</span>`)
          .join(' ');
      } else {
        userCardSkills.innerHTML = '<span class="text-muted small">Chưa có kỹ năng. <a href="profile.html">Thêm ngay</a></span>';
      }
    }

    // Profile Completion (Tính dựa trên dữ liệu thật)
    const completionPercent = typeof calculateProfileCompletion === 'function'
      ? calculateProfileCompletion(profile || {})
      : 50;

    const compText = document.getElementById('profile-completion-text');
    if (compText) compText.textContent = `${completionPercent}%`;

    const compBar = document.getElementById('profile-completion-bar');
    if (compBar) {
      compBar.style.width = `${completionPercent}%`;
      compBar.setAttribute('aria-valuenow', completionPercent);
      if (completionPercent >= 80) {
        compBar.className = 'progress-bar bg-success';
      } else if (completionPercent >= 50) {
        compBar.className = 'progress-bar bg-primary';
      } else {
        compBar.className = 'progress-bar bg-warning';
      }
    }

    // 4. Load real projects from Supabase
    const userId = authUser?.id || profile?.id;
    if (userId && typeof window.loadDashboardMyProjects === 'function') {
      await window.loadDashboardMyProjects(userId);
    }

    // 5. Load user's join requests
    if (userId && typeof window.loadDashboardJoinRequests === 'function') {
      await window.loadDashboardJoinRequests(userId);
    }

    // 6. Load recommended projects based on profile (AI Matching)
    if (typeof window.loadDashboardRecommendedProjects === 'function') {
      const userProfile = profile || {
        id: userId,
        skills: authUser?.user_metadata?.skills || [],
        interests: authUser?.user_metadata?.interests || [],
        experience: 'intermediate'
      };
      await window.loadDashboardRecommendedProjects(userProfile);
    }

    // 7. Load assigned tasks for current user (Phase 5 Workspace integration)
    if (userId) {
      await loadDashboardAssignedTasks(userId);
    }

    // 8. Load recent activities/notifications (Phase 6 Realtime Collaboration)
    if (userId) {
      await loadDashboardActivityFeed(userId);
    }

    // 9. Load real analytics metrics, charts and performance drilldown (Phase 8 Analytics)
    if (userId) {
      await loadDashboardAnalytics(userId);
    }

  } catch (err) {
    console.error('[Dashboard] Lỗi hiển thị dashboard user:', err);
  }
}

/**
 * Tải và hiển thị danh sách nhiệm vụ được giao cho user thật từ Supabase (Phase 5)
 */
async function loadDashboardAssignedTasks(userId) {
  const container = document.getElementById('dashboard-tasks-list');
  const countBadge = document.getElementById('dashboard-tasks-count');
  const statActive = document.getElementById('stat-active-tasks');
  const statDone = document.getElementById('stat-done-tasks');
  const statDeadline = document.getElementById('stat-deadline');
  const statDeadlineLabel = document.getElementById('stat-deadline-label');

  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-3">
      <div class="spinner-border spinner-border-sm text-primary me-2"></div>
      <span class="text-muted small">Đang tải nhiệm vụ...</span>
    </div>
  `;

  try {
    const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : window.supabaseClient;
    if (!supabase) {
      container.innerHTML = '<div class="alert alert-warning small">Không thể kết nối Supabase</div>';
      return;
    }

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select(`
        id,
        project_id,
        title,
        description,
        status,
        priority,
        deadline,
        created_at,
        projects:project_id (
          id,
          title
        )
      `)
      .eq('assignee_id', userId)
      .order('deadline', { ascending: true, nullsLast: true });

    if (error) throw error;

    const allTasks = tasks || [];
    const activeTasks = allTasks.filter(t => t.status !== 'done');
    const doneTasks = allTasks.filter(t => t.status === 'done');

    // Cập nhật số liệu thống kê
    if (statActive) statActive.textContent = activeTasks.length;
    if (statDone) statDone.textContent = doneTasks.length;
    if (countBadge) countBadge.textContent = `${activeTasks.length} đang xử lý`;

    // Tính hạn chót gần nhất
    const activeWithDeadline = activeTasks
      .filter(t => t.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    if (activeWithDeadline.length > 0) {
      const nextDate = new Date(activeWithDeadline[0].deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(nextDate);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

      if (statDeadline) {
        if (diffDays < 0) {
          statDeadline.textContent = `${Math.abs(diffDays)}`;
          if (statDeadlineLabel) statDeadlineLabel.textContent = 'ngày quá hạn!';
        } else if (diffDays === 0) {
          statDeadline.textContent = 'Hôm';
          if (statDeadlineLabel) statDeadlineLabel.textContent = 'nay';
        } else {
          statDeadline.textContent = `${diffDays}`;
          if (statDeadlineLabel) statDeadlineLabel.textContent = 'ngày nữa';
        }
      }
    } else {
      if (statDeadline) statDeadline.textContent = '0';
      if (statDeadlineLabel) statDeadlineLabel.textContent = 'nhiệm vụ';
    }

    // Cập nhật Chart nếu đã render
    if (window.taskStatusChartInstance) {
      const todoCount = allTasks.filter(t => t.status === 'todo').length;
      const inProgCount = allTasks.filter(t => t.status === 'in_progress').length;
      const reviewCount = allTasks.filter(t => t.status === 'review').length;
      const doneCount = doneTasks.length;

      // Nếu có task thật thì cập nhật số thật
      if (allTasks.length > 0) {
        window.taskStatusChartInstance.data.datasets[0].data = [todoCount, inProgCount, reviewCount, doneCount];
        window.taskStatusChartInstance.update();
      }
    }

    // Render danh sách nhiệm vụ
    if (activeTasks.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-clipboard-check fs-1 text-muted mb-2 d-block"></i>
          <p class="text-muted mb-0">Bạn hiện không có nhiệm vụ nào cần làm.</p>
          ${doneTasks.length > 0 ? `<small class="text-success fw-medium">Đã hoàn thành ${doneTasks.length} nhiệm vụ gần đây</small>` : ''}
        </div>
      `;
      return;
    }

    const priorityMap = {
      urgent: { label: 'Khẩn cấp', color: 'danger' },
      high:   { label: 'Cao', color: 'warning text-dark' },
      medium: { label: 'Trung bình', color: 'primary' },
      low:    { label: 'Thấp', color: 'secondary' }
    };

    const statusMap = {
      todo:        { label: 'Cần làm', color: 'secondary' },
      in_progress: { label: 'Đang làm', color: 'primary' },
      review:      { label: 'Chờ duyệt', color: 'warning text-dark' },
      done:        { label: 'Hoàn thành', color: 'success' }
    };

    container.innerHTML = activeTasks.slice(0, 6).map(t => {
      const pri = priorityMap[t.priority] || priorityMap.medium;
      const st = statusMap[t.status] || statusMap.todo;
      const projectTitle = t.projects?.title || 'Dự án';
      
      let deadlineHtml = '';
      if (t.deadline) {
        const dDate = new Date(t.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = dDate < today;
        const dStr = dDate.toLocaleDateString('vi-VN');
        deadlineHtml = isOverdue
          ? `<span class="badge bg-danger ms-1"><i class="bi bi-exclamation-circle me-1"></i>${dStr} (Quá hạn)</span>`
          : `<span class="text-muted"><i class="bi bi-calendar3 me-1"></i>${dStr}</span>`;
      }

      return `
        <div class="d-flex align-items-center justify-content-between p-3 mb-2 rounded border bg-light">
          <div class="d-flex align-items-center gap-3 overflow-hidden me-2">
            <span class="badge bg-${st.color} flex-shrink-0">${st.label}</span>
            <div class="overflow-hidden">
              <div class="fw-semibold text-dark text-truncate">${escapeHtml(t.title)}</div>
              <div class="d-flex flex-wrap align-items-center gap-2 small text-muted mt-1">
                <span class="text-truncate" style="max-width: 200px;"><i class="bi bi-folder me-1"></i>${escapeHtml(projectTitle)}</span>
                <span>•</span>
                <span class="badge bg-${pri.color} bg-opacity-10 text-${pri.color}">${pri.label}</span>
                ${deadlineHtml ? `<span>•</span> ${deadlineHtml}` : ''}
              </div>
            </div>
          </div>
          <a href="workspace.html?id=${t.project_id}" class="btn btn-sm btn-outline-primary flex-shrink-0">
            <i class="bi bi-kanban me-1"></i>Workspace
          </a>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('[Dashboard] Lỗi tải nhiệm vụ dashboard:', err);
    container.innerHTML = `<div class="alert alert-warning small">Lỗi tải nhiệm vụ: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Tải và hiển thị dữ liệu phân tích Dashboard thực tế từ Supabase (Phase 8 Analytics)
 * @param {string} userId
 */
async function loadDashboardAnalytics(userId) {
  try {
    const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : window.supabaseClient;
    if (!supabase) return;

    // 1. Tải song song: Dự án sở hữu, Dự án tham gia, và toàn bộ nhiệm vụ của user
    const [ownedRes, memRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('id, owner_id, title, status, progress, deadline, created_at').eq('owner_id', userId),
      supabase.from('project_members').select(`
        project_id, role_name, status,
        projects:project_id (id, owner_id, title, status, progress, deadline, created_at)
      `).eq('user_id', userId).eq('status', 'active'),
      supabase.from('tasks').select(`
        id, project_id, title, status, priority, deadline, created_at,
        projects:project_id (id, title)
      `).eq('assignee_id', userId)
    ]);

    const ownedProjects = ownedRes.data || [];
    const memberships = memRes.data || [];
    const userTasks = tasksRes.data || [];

    // Tổng hợp tất cả dự án liên quan đến user (sở hữu + tham gia)
    const projectMap = new Map();
    ownedProjects.forEach(p => {
      projectMap.set(p.id, { ...p, isOwner: true, userRole: 'Chủ dự án' });
    });

    memberships.forEach(m => {
      if (m.projects && !projectMap.has(m.projects.id)) {
        projectMap.set(m.projects.id, {
          ...m.projects,
          isOwner: false,
          userRole: m.role_name || 'Thành viên'
        });
      }
    });

    const allProjects = Array.from(projectMap.values());

    // 2. Tính toán 6 chỉ số Analytics Cards
    const projectsOwnedCount = ownedProjects.length;
    const projectsJoinedCount = memberships.filter(m => m.projects && m.projects.owner_id !== userId).length;
    const projectsCompletedCount = allProjects.filter(p => p.status === 'completed').length;
    const tasksCompletedCount = userTasks.filter(t => t.status === 'done').length;
    const activeTasksCount = userTasks.filter(t => t.status !== 'done').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasksCount = userTasks.filter(t => {
      if (t.status === 'done' || !t.deadline) return false;
      const d = new Date(t.deadline);
      return d < today;
    }).length;

    // Cập nhật DOM các thẻ Analytics
    const setElemText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElemText('stat-projects-owned', projectsOwnedCount);
    setElemText('stat-projects-joined', projectsJoinedCount);
    setElemText('stat-projects-completed', projectsCompletedCount);
    setElemText('stat-tasks-completed', tasksCompletedCount);
    setElemText('stat-active-tasks', activeTasksCount);
    setElemText('stat-overdue-tasks', overdueTasksCount);

    // Cập nhật các ID cũ để tương thích
    setElemText('stat-projects', projectsOwnedCount);
    setElemText('stat-done-tasks', tasksCompletedCount);

    // 3. Widget Hiệu suất cá nhân (Personal Productivity)
    const totalAssigned = tasksCompletedCount + activeTasksCount;
    const completionPercent = totalAssigned > 0 ? Math.round((tasksCompletedCount / totalAssigned) * 100) : 0;

    setElemText('personal-productivity-val', `${completionPercent}%`);
    const prodBar = document.getElementById('personal-productivity-bar');
    if (prodBar) {
      prodBar.style.width = `${completionPercent}%`;
      prodBar.setAttribute('aria-valuenow', completionPercent);
      if (completionPercent >= 80) prodBar.className = 'progress-bar bg-success';
      else if (completionPercent >= 50) prodBar.className = 'progress-bar bg-primary';
      else prodBar.className = 'progress-bar bg-warning';
    }

    setElemText('personal-stat-total', `${totalAssigned} nhiệm vụ`);
    setElemText('personal-stat-done', `${tasksCompletedCount} xong`);
    setElemText('personal-stat-active', `${activeTasksCount} đang làm`);
    setElemText('personal-stat-overdue', `${overdueTasksCount} quá hạn`);

    // 4. Biểu đồ Dự án theo trạng thái (Project Status Chart)
    renderProjectStatusChart(allProjects);

    // 5. Biểu đồ Công việc theo trạng thái (Task Status Chart)
    renderTaskStatusChart(userTasks);

    // 6. Drill-down Hiệu suất dự án (Project Performance)
    renderProjectPerformanceDrilldown(allProjects, supabase);

  } catch (err) {
    console.error('[Dashboard] Lỗi loadDashboardAnalytics:', err);
  }
}

/**
 * Render biểu đồ Dự án theo trạng thái bằng Chart.js
 */
function renderProjectStatusChart(allProjects) {
  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('projectStatusChart');
  const emptyEl = document.getElementById('projectStatusEmpty');
  const totalBadge = document.getElementById('project-status-total');

  if (!canvas) return;

  if (totalBadge) totalBadge.textContent = `${allProjects.length} dự án`;

  if (allProjects.length === 0) {
    canvas.style.display = 'none';
    if (emptyEl) emptyEl.classList.remove('d-none');
    if (window.projectStatusChartInstance) {
      window.projectStatusChartInstance.destroy();
      window.projectStatusChartInstance = null;
    }
    return;
  }

  canvas.style.display = 'block';
  if (emptyEl) emptyEl.classList.add('d-none');

  const recruiting = allProjects.filter(p => p.status === 'recruiting').length;
  const inProgress = allProjects.filter(p => p.status === 'in_progress').length;
  const completed = allProjects.filter(p => p.status === 'completed').length;
  const archived = allProjects.filter(p => p.status === 'archived').length;

  if (window.projectStatusChartInstance) {
    window.projectStatusChartInstance.destroy();
  }

  window.projectStatusChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Đang tuyển', 'Đang thực hiện', 'Hoàn thành', 'Lưu trữ'],
      datasets: [{
        data: [recruiting, inProgress, completed, archived],
        backgroundColor: ['#4F46E5', '#F59E0B', '#10B981', '#94A3B8'],
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } },
      },
    },
  });
}

/**
 * Render biểu đồ Công việc theo trạng thái bằng Chart.js
 */
function renderTaskStatusChart(userTasks) {
  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('taskStatusChart');
  const emptyEl = document.getElementById('taskStatusEmpty');
  const totalBadge = document.getElementById('task-status-total');

  if (!canvas) return;

  if (totalBadge) totalBadge.textContent = `${userTasks.length} task`;

  if (userTasks.length === 0) {
    canvas.style.display = 'none';
    if (emptyEl) emptyEl.classList.remove('d-none');
    if (window.taskStatusChartInstance) {
      window.taskStatusChartInstance.destroy();
      window.taskStatusChartInstance = null;
    }
    return;
  }

  canvas.style.display = 'block';
  if (emptyEl) emptyEl.classList.add('d-none');

  const todo = userTasks.filter(t => t.status === 'todo').length;
  const inProgress = userTasks.filter(t => t.status === 'in_progress').length;
  const review = userTasks.filter(t => t.status === 'review').length;
  const done = userTasks.filter(t => t.status === 'done').length;

  if (window.taskStatusChartInstance) {
    window.taskStatusChartInstance.destroy();
  }

  window.taskStatusChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Cần làm', 'Đang làm', 'Chờ duyệt', 'Hoàn thành'],
      datasets: [{
        data: [todo, inProgress, review, done],
        backgroundColor: ['#94A3B8', '#3B82F6', '#F59E0B', '#10B981'],
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } },
      },
    },
  });
}

/**
 * Phân tích hiệu suất chi tiết theo dự án cụ thể (Project Performance Drilldown)
 */
function renderProjectPerformanceDrilldown(allProjects, supabase) {
  const select = document.getElementById('project-perf-selector');
  const content = document.getElementById('project-perf-content');
  if (!select || !content) return;

  if (allProjects.length === 0) {
    select.innerHTML = '<option value="">Chưa có dự án nào</option>';
    select.disabled = true;
    content.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-folder-plus fs-2 d-block mb-2 text-secondary"></i>
        <p class="mb-0">Bạn chưa tham gia dự án nào để phân tích hiệu suất.</p>
      </div>
    `;
    return;
  }

  select.disabled = false;
  select.innerHTML = allProjects.map(p => `
    <option value="${p.id}">${escapeHtml(p.title)} (${p.isOwner ? 'Chủ dự án' : 'Thành viên'})</option>
  `).join('');

  const loadPerf = async (projectId) => {
    content.innerHTML = `
      <div class="text-center py-3 text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2"></div>
        <small>Đang phân tích dữ liệu dự án...</small>
      </div>
    `;

    try {
      const [tasksRes, memRes] = await Promise.all([
        supabase.from('tasks').select('id, status, deadline').eq('project_id', projectId),
        supabase.from('project_members').select('id, user_id').eq('project_id', projectId).eq('status', 'active')
      ]);

      const pTasks = tasksRes.data || [];
      const pMembers = memRes.data || [];
      const totalPTasks = pTasks.length;
      const donePTasks = pTasks.filter(t => t.status === 'done').length;
      const prog = totalPTasks > 0 ? Math.round((donePTasks / totalPTasks) * 100) : 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overduePTasks = pTasks.filter(t => {
        if (t.status === 'done' || !t.deadline) return false;
        return new Date(t.deadline) < today;
      }).length;

      const proj = allProjects.find(p => p.id === projectId);

      content.innerHTML = `
        <div class="row g-3 align-items-center">
          <div class="col-md-7">
            <div class="d-flex align-items-center gap-2 mb-2">
              <h6 class="fw-bold mb-0 text-dark">${escapeHtml(proj?.title || 'Dự án')}</h6>
              <span class="badge ${proj?.isOwner ? 'bg-primary' : 'bg-info text-white'}">${escapeHtml(proj?.userRole || 'Member')}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-1 small">
              <span class="text-muted">Tiến độ công việc hoàn thành</span>
              <span class="fw-bold text-success">${prog}% (${donePTasks}/${totalPTasks} tasks)</span>
            </div>
            <div class="progress mb-2" style="height: 8px;">
              <div class="progress-bar bg-success" style="width: ${prog}%"></div>
            </div>
          </div>
          <div class="col-md-5">
            <div class="row g-2 text-center">
              <div class="col-4">
                <div class="p-2 border rounded bg-light">
                  <div class="text-muted" style="font-size: 0.72rem;">Thành viên</div>
                  <div class="fw-bold text-dark fs-6">${pMembers.length + 1}</div>
                </div>
              </div>
              <div class="col-4">
                <div class="p-2 border rounded bg-light">
                  <div class="text-muted" style="font-size: 0.72rem;">Nhiệm vụ</div>
                  <div class="fw-bold text-primary fs-6">${totalPTasks}</div>
                </div>
              </div>
              <div class="col-4">
                <div class="p-2 border rounded bg-light">
                  <div class="text-muted" style="font-size: 0.72rem;">Quá hạn</div>
                  <div class="fw-bold text-${overduePTasks > 0 ? 'danger' : 'muted'} fs-6">${overduePTasks}</div>
                </div>
              </div>
            </div>
            <div class="mt-2 text-end">
              <a href="workspace.html?id=${projectId}" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-kanban me-1"></i>Truy cập Workspace
              </a>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      content.innerHTML = '<div class="alert alert-warning small mb-0">Không thể tải thông tin hiệu suất dự án.</div>';
    }
  };

  select.onchange = () => {
    if (select.value) loadPerf(select.value);
  };

  // Nạp mặc định dự án đầu tiên
  if (allProjects.length > 0) {
    loadPerf(allProjects[0].id);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Tải dòng hoạt động gần đây từ Notifications thật (Phase 6)
 */
async function loadDashboardActivityFeed(userId) {
  const container = document.getElementById('dashboard-activity');
  if (!container) return;

  try {
    let notifications = [];
    if (window.ProjectHubNotifications && typeof window.ProjectHubNotifications.fetchNotifications === 'function') {
      const res = await window.ProjectHubNotifications.fetchNotifications({ limit: 6 });
      notifications = res.data || [];
    } else {
      const supabase = typeof getSupabaseClient === 'function' ? getSupabaseClient() : window.supabaseClient;
      if (supabase) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(6);
        notifications = data || [];
      }
    }

    if (!notifications || notifications.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-bell-slash fs-2 mb-2 d-block text-secondary"></i>
          <small>Chưa có hoạt động gần đây.</small>
        </div>
      `;
      return;
    }

    const timeAgoFn = window.ProjectHubNotifications?.formatTimeAgo || ((d) => new Date(d).toLocaleDateString('vi-VN'));
    const notifIcons = window.ProjectHubNotifications?.NOTIF_ICONS || {};

    const itemsHtml = notifications.map(n => {
      const conf = notifIcons[n.type] || { icon: 'bi-bell', color: 'text-primary' };
      const actionUrl = n.action_url || '#';

      return `
        <div class="d-flex align-items-start gap-3 py-3 border-bottom position-relative">
          <span class="d-inline-flex align-items-center justify-content-center rounded-circle ${conf.color} bg-opacity-10 flex-shrink-0" style="width: 36px; height: 36px; background-color: currentColor;">
            <i class="bi ${conf.icon} ${conf.color}"></i>
          </span>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between align-items-center gap-2">
              <h6 class="mb-0 fw-semibold text-dark small text-truncate">${escapeHtml(n.title)}</h6>
              <small class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-clock me-1"></i>${timeAgoFn(n.created_at)}</small>
            </div>
            ${n.message ? `<p class="mb-1 text-muted small text-truncate" style="max-width: 480px;">${escapeHtml(n.message)}</p>` : ''}
            ${actionUrl && actionUrl !== '#' ? `
              <a href="${escapeHtml(actionUrl)}" class="small text-primary text-decoration-none fw-medium">
                Xem chi tiết <i class="bi bi-arrow-right"></i>
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="activity-feed">
        ${itemsHtml}
        <div class="text-center pt-3">
          <a href="notifications.html" class="btn btn-sm btn-outline-primary">
            <i class="bi bi-bell me-1"></i>Xem tất cả thông báo
          </a>
        </div>
      </div>
    `;

  } catch (err) {
    console.error('[Dashboard] Lỗi tải activity feed:', err);
    container.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-activity fs-2 mb-2 d-block"></i>
        <small>Chưa có hoạt động gần đây.</small>
      </div>
    `;
  }
}

window.loadDashboardAssignedTasks = loadDashboardAssignedTasks;
window.loadDashboardActivityFeed = loadDashboardActivityFeed;
window.loadDashboardAnalytics = loadDashboardAnalytics;

