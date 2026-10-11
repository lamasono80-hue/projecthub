/**
 * portfolio.js — Real Supabase Portfolio Controller for ProjectHub (Phase 8)
 * 
 * NGUYÊN TẮC:
 * - 100% dữ liệu thực từ Supabase (projects, project_members, tasks, profiles)
 * - Tuyệt đối KHÔNG dùng demo mock data hay localStorage làm nguồn dữ liệu chính
 * - Hỗ trợ xem Portfolio công khai (?user=USER_ID hoặc ?id=USER_ID)
 * - Tự động ẩn các dự án riêng tư (private) và công việc nội bộ đối với khách
 * - Không cho phép chỉnh sửa nếu không phải là chủ sở hữu
 */
'use strict';

// Trạng thái cục bộ của trang Portfolio
let loadedProjects = [];
let userCompletedTasks = [];
let portfolioProfile = null;
let isOwnProfile = false;
let currentFilter = 'all';
let currentSort = 'newest';
let searchQuery = '';

/**
 * Khởi tạo dữ liệu Portfolio khi trang load
 */
async function initPortfolio() {
  const loadingEl = document.getElementById('portfolio-loading');
  const errorEl = document.getElementById('portfolio-error');
  const contentEl = document.getElementById('portfolio-content');

  try {
    const client = await (typeof getClient === 'function' ? getClient() : window.getSupabase?.());
    if (!client) {
      throw new Error('Chưa thể kết nối tới cơ sở dữ liệu Supabase.');
    }

    // 1. Xác định target user ID
    const urlParams = new URLSearchParams(window.location.search);
    let targetUserId = urlParams.get('user') || urlParams.get('id');

    let currentUser = null;
    if (typeof getCurrentUser === 'function') {
      currentUser = await getCurrentUser();
    } else {
      const sess = await client.auth.getSession();
      currentUser = sess?.data?.session?.user || null;
    }

    if (!targetUserId) {
      if (!currentUser) {
        // Chưa đăng nhập và không truyền param -> chuyển hướng sang login
        window.location.href = 'login.html?redirect=portfolio.html';
        return;
      }
      targetUserId = currentUser.id;
      isOwnProfile = true;
    } else {
      isOwnProfile = Boolean(currentUser && currentUser.id === targetUserId);
    }

    // 2. Truy vấn dữ liệu song song từ Supabase
    const [profileRes, ownedRes, memberRes, tasksRes] = await Promise.all([
      // Hồ sơ cá nhân
      client.from('profiles').select('*').eq('id', targetUserId).maybeSingle(),
      // Dự án người dùng làm chủ
      client.from('projects').select('*').eq('owner_id', targetUserId),
      // Dự án người dùng tham gia
      client.from('project_members').select(`
        role_name,
        status,
        projects:project_id (
          id, owner_id, title, description, goal, problem, category, technologies,
          difficulty, status, progress, deadline, image_url, github_url, is_public, created_at
        )
      `).eq('user_id', targetUserId).eq('status', 'active'),
      // Nhiệm vụ hoàn thành của người dùng
      client.from('tasks').select('id, project_id, title, status, priority, deadline').eq('assignee_id', targetUserId).eq('status', 'done')
    ]);

    if (profileRes.error) {
      console.warn('[Portfolio] Lỗi lấy profiles:', profileRes.error.message);
    }

    let profile = profileRes.data;

    // Fallback nếu là chính mình nhưng chưa có profile row (tạo từ user metadata)
    if (!profile && isOwnProfile && currentUser) {
      profile = {
        id: currentUser.id,
        display_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Thành viên',
        username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'user',
        bio: '',
        skills: currentUser.user_metadata?.skills || [],
        interests: currentUser.user_metadata?.interests || [],
        experience: 'beginner',
        avatar_url: currentUser.user_metadata?.avatar_url || null,
        github_username: null,
        github_url: null,
        website_url: null
      };
    }

    if (!profile) {
      if (loadingEl) loadingEl.classList.add('d-none');
      if (errorEl) {
        errorEl.classList.remove('d-none');
        const titleEl = document.getElementById('portfolio-error-title');
        const msgEl = document.getElementById('portfolio-error-msg');
        if (titleEl) titleEl.textContent = 'Hồ sơ người dùng không tồn tại';
        if (msgEl) msgEl.textContent = 'Không thể tìm thấy thông tin tài khoản được yêu cầu.';
      }
      return;
    }

    portfolioProfile = profile;
    userCompletedTasks = tasksRes.data || [];

    // 3. Tổng hợp và chuẩn hóa danh sách dự án
    const projectMap = new Map();

    // Thêm các dự án sở hữu
    (ownedRes.data || []).forEach(p => {
      // Nếu khách xem: chỉ hiện dự án is_public = true
      if (isOwnProfile || p.is_public !== false) {
        projectMap.set(p.id, {
          ...p,
          userRole: 'Chủ dự án',
          isOwner: true
        });
      }
    });

    // Thêm các dự án tham gia
    (memberRes.data || []).forEach(m => {
      const p = m.projects;
      if (p && !projectMap.has(p.id)) {
        if (isOwnProfile || p.is_public !== false) {
          projectMap.set(p.id, {
            ...p,
            userRole: m.role_name || 'Thành viên',
            isOwner: false
          });
        }
      }
    });

    loadedProjects = Array.from(projectMap.values());

    // 4. Render toàn bộ UI
    renderPortfolioHeader(profile, isOwnProfile);
    renderPortfolioStats(loadedProjects, userCompletedTasks);
    renderSkillsAndTechnologies(profile, loadedProjects);
    renderAchievements(profile, loadedProjects, userCompletedTasks);
    setupEventListeners();
    filterAndRenderProjects();

    // Hiển thị nội dung chính
    if (loadingEl) loadingEl.classList.add('d-none');
    if (contentEl) contentEl.classList.remove('d-none');

  } catch (err) {
    console.error('[Portfolio] Lỗi khởi tạo portfolio:', err);
    if (loadingEl) loadingEl.classList.add('d-none');
    if (errorEl) {
      errorEl.classList.remove('d-none');
      const msgEl = document.getElementById('portfolio-error-msg');
      if (msgEl) msgEl.textContent = err.message || 'Không thể tải dữ liệu portfolio.';
    }
  }
}

/**
 * Hiển thị thông tin người dùng ở Header Card
 */
function renderPortfolioHeader(profile, isOwn) {
  const displayName = profile.display_name || profile.full_name || 'Người dùng';
  const username = profile.username ? `@${profile.username}` : '';
  const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4F46E5&color=fff&size=128`;
  const expMap = { beginner: 'Người mới bắt đầu', intermediate: 'Lập trình viên Trung cấp', advanced: 'Chuyên gia Nâng cao' };
  const roleTitle = expMap[profile.experience] || 'Thành viên';

  const avatarEl = document.getElementById('portfolio-avatar');
  if (avatarEl) avatarEl.src = avatarUrl;

  const nameEl = document.getElementById('portfolio-name');
  if (nameEl) nameEl.textContent = displayName;

  const usernameEl = document.getElementById('portfolio-username');
  if (usernameEl) usernameEl.textContent = username;

  const roleEl = document.getElementById('portfolio-role');
  if (roleEl) roleEl.textContent = roleTitle;

  const bioEl = document.getElementById('portfolio-bio');
  if (bioEl) bioEl.textContent = profile.bio || 'Chưa cập nhật phần giới thiệu bản thân.';

  // Links
  const ghEl = document.getElementById('portfolio-github');
  const ghText = document.getElementById('portfolio-github-text');
  if (ghEl) {
    const ghUser = profile.github_username || '';
    const ghUrl = profile.github_url || (ghUser ? `https://github.com/${ghUser}` : '');
    if (ghUrl) {
      ghEl.href = ghUrl;
      ghEl.classList.remove('d-none');
      if (ghText) ghText.textContent = ghUser ? `GitHub (@${ghUser})` : 'GitHub';
    } else {
      ghEl.classList.add('d-none');
    }
  }

  const webEl = document.getElementById('portfolio-website');
  const webText = document.getElementById('portfolio-website-text');
  if (webEl) {
    if (profile.website_url) {
      webEl.href = profile.website_url;
      webEl.classList.remove('d-none');
      if (webText) webText.textContent = profile.website_url.replace(/^https?:\/\//, '');
    } else {
      webEl.classList.add('d-none');
    }
  }

  // Nút hành động
  const editBtn = document.getElementById('btn-edit-profile');
  if (editBtn) {
    if (isOwn) {
      editBtn.classList.remove('d-none');
    } else {
      editBtn.classList.add('d-none');
    }
  }

  const viewProfileBtn = document.getElementById('btn-view-profile');
  if (viewProfileBtn) {
    viewProfileBtn.href = isOwn ? 'profile.html' : `profile.html?user=${encodeURIComponent(profile.id)}`;
  }
}

/**
 * Hiển thị 6 chỉ số thống kê thực tế
 */
function renderPortfolioStats(projects, completedTasks) {
  const total = projects.length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const active = projects.filter(p => p.status === 'in_progress' || p.status === 'recruiting').length;
  const owned = projects.filter(p => p.isOwner).length;
  const team = projects.filter(p => !p.isOwner).length;
  const tasks = completedTasks.length;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('portfolio-stat-total', total);
  setVal('portfolio-stat-completed', completed);
  setVal('portfolio-stat-active', active);
  setVal('portfolio-stat-owned', owned);
  setVal('portfolio-stat-team', team);
  setVal('portfolio-stat-tasks', tasks);

  // Cập nhật số lượng trên các tab lọc
  setVal('count-all', total);
  setVal('count-owned', owned);
  setVal('count-participated', team);
  setVal('count-completed', completed);
  setVal('count-in-progress', active);
}

/**
 * Lọc và render danh sách dự án
 */
function filterAndRenderProjects() {
  const container = document.getElementById('portfolio-projects-grid');
  const emptyEl = document.getElementById('portfolio-empty-projects');
  if (!container) return;

  let filtered = [...loadedProjects];

  // 1. Áp dụng tab lọc
  if (currentFilter === 'owned') {
    filtered = filtered.filter(p => p.isOwner);
  } else if (currentFilter === 'participated') {
    filtered = filtered.filter(p => !p.isOwner);
  } else if (currentFilter === 'completed') {
    filtered = filtered.filter(p => p.status === 'completed');
  } else if (currentFilter === 'in_progress') {
    filtered = filtered.filter(p => p.status === 'in_progress' || p.status === 'recruiting');
  }

  // 2. Áp dụng tìm kiếm
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => {
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchTech = (p.technologies || []).some(t => t.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchTech;
    });
  }

  // 3. Áp dụng sắp xếp
  if (currentSort === 'newest') {
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else if (currentSort === 'oldest') {
    filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  } else if (currentSort === 'progress_desc') {
    filtered.sort((a, b) => (b.progress || 0) - (a.progress || 0));
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');

  const statusMap = {
    recruiting:  { label: 'Đang tuyển', color: 'primary' },
    in_progress: { label: 'Đang làm',   color: 'warning text-dark' },
    completed:   { label: 'Hoàn thành', color: 'success' },
    archived:    { label: 'Lưu trữ',    color: 'secondary' }
  };

  const categoryMap = {
    web: 'Web Dev', mobile: 'Mobile', ai: 'AI / ML', game: 'Game Dev', data: 'Data Science', iot: 'IoT', other: 'Khác'
  };

  container.innerHTML = filtered.map(p => {
    const st = statusMap[p.status] || { label: p.status, color: 'secondary' };
    const cat = categoryMap[p.category] || p.category || 'Dự án';
    const cover = p.image_url || 'https://images.unsplash.com/photo-1555066931-4365d14431b9?w=500&q=80';
    const techs = Array.isArray(p.technologies) ? p.technologies.slice(0, 4) : [];
    const isOwner = Boolean(p.isOwner);

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card project-card h-100 shadow-sm border-0">
          <div class="position-relative">
            <img src="${cover}" class="project-card-img" alt="${escapeHtml(p.title)}" onerror="this.src='https://images.unsplash.com/photo-1555066931-4365d14431b9?w=500&q=80'">
            <div class="position-absolute top-0 start-0 m-2 d-flex gap-1 flex-wrap">
              <span class="badge bg-dark bg-opacity-75">${escapeHtml(cat)}</span>
            </div>
            <div class="position-absolute top-0 end-0 m-2">
              <span class="badge bg-${st.color}">${st.label}</span>
            </div>
            <div class="position-absolute bottom-0 start-0 m-2">
              <span class="badge ${isOwner ? 'bg-primary' : 'bg-info text-white'}">
                <i class="bi ${isOwner ? 'bi-shield-check' : 'bi-person-check'} me-1"></i>${escapeHtml(p.userRole)}
              </span>
            </div>
          </div>

          <div class="card-body p-4 d-flex flex-column">
            <h5 class="fw-bold mb-2 text-dark text-truncate" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</h5>
            <p class="small text-muted mb-3 text-truncate-2" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.4rem;">
              ${escapeHtml(p.description || 'Chưa có phần tóm tắt cho dự án.')}
            </p>

            <div class="d-flex flex-wrap gap-1 mb-3">
              ${techs.map(t => `<span class="tech-pill">${escapeHtml(t)}</span>`).join('')}
              ${(p.technologies || []).length > 4 ? `<span class="tech-pill text-muted">+${p.technologies.length - 4}</span>` : ''}
            </div>

            <!-- Progress bar -->
            <div class="mt-auto pt-2 border-top">
              <div class="d-flex justify-content-between align-items-center mb-1 small">
                <span class="text-muted" style="font-size: 0.75rem;">Tiến độ</span>
                <span class="fw-bold ${p.status === 'completed' ? 'text-success' : 'text-primary'}">${p.progress || 0}%</span>
              </div>
              <div class="progress mb-3" style="height: 6px;">
                <div class="progress-bar ${p.status === 'completed' ? 'bg-success' : 'bg-primary'}" style="width: ${p.progress || 0}%;"></div>
              </div>

              <!-- Buttons -->
              <div class="d-flex align-items-center justify-content-between gap-2">
                ${p.github_url ? `
                  <a href="${escapeHtml(p.github_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-dark px-2" title="Xem GitHub Repo">
                    <i class="bi bi-github"></i>
                  </a>
                ` : ''}
                <button type="button" class="btn btn-sm btn-light border flex-grow-1 btn-view-project-modal" data-id="${p.id}">
                  <i class="bi bi-eye me-1"></i>Chi tiết
                </button>
                <a href="project-detail.html?id=${p.id}" class="btn btn-sm btn-outline-primary px-2" title="Xem trang dự án">
                  <i class="bi bi-arrow-up-right"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Gắn sự kiện click mở modal chi tiết
  container.querySelectorAll('.btn-view-project-modal').forEach(btn => {
    btn.onclick = () => {
      const projId = btn.dataset.id;
      openProjectDetailModal(projId);
    };
  });
}

/**
 * Hiển thị Kỹ năng cá nhân & Thống kê Tần suất Công nghệ qua các dự án
 */
function renderSkillsAndTechnologies(profile, projects) {
  // 1. Kỹ năng từ Profile
  const skillsContainer = document.getElementById('portfolio-skills-container');
  if (skillsContainer) {
    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    if (skills.length > 0) {
      skillsContainer.innerHTML = skills.map(s =>
        `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 fs-6 fw-normal">${escapeHtml(s)}</span>`
      ).join('');
    } else {
      skillsContainer.innerHTML = '<p class="text-muted small mb-0">Chưa thiết lập kỹ năng trong hồ sơ.</p>';
    }
  }

  // 2. Sở thích
  const interestsContainer = document.getElementById('portfolio-interests-container');
  if (interestsContainer) {
    const interests = Array.isArray(profile.interests) ? profile.interests : [];
    if (interests.length > 0) {
      interestsContainer.innerHTML = interests.map(i =>
        `<span class="badge bg-light text-dark border px-3 py-2 small">${escapeHtml(i)}</span>`
      ).join('');
    } else {
      interestsContainer.innerHTML = '<p class="text-muted small mb-0">Chưa thiết lập lĩnh vực quan tâm.</p>';
    }
  }

  // 3. Tần suất công nghệ áp dụng từ các dự án thật
  const techUsageContainer = document.getElementById('portfolio-tech-usage');
  const totalTechBadge = document.getElementById('total-tech-count');
  if (!techUsageContainer) return;

  const techCountMap = {};
  projects.forEach(p => {
    (p.technologies || []).forEach(t => {
      const normalized = t.trim();
      if (normalized) {
        techCountMap[normalized] = (techCountMap[normalized] || 0) + 1;
      }
    });
  });

  const sortedTechs = Object.entries(techCountMap).sort((a, b) => b[1] - a[1]);
  if (totalTechBadge) totalTechBadge.textContent = `${sortedTechs.length} công nghệ`;

  if (sortedTechs.length === 0) {
    techUsageContainer.innerHTML = `
      <div class="text-center py-4 text-muted">
        <i class="bi bi-stack fs-3 d-block mb-2 text-secondary"></i>
        <small>Chưa có dữ liệu công nghệ từ các dự án đã tham gia.</small>
      </div>
    `;
    return;
  }

  const maxProjects = Math.max(...sortedTechs.map(t => t[1]), 1);

  techUsageContainer.innerHTML = sortedTechs.slice(0, 7).map(([tech, count]) => {
    const percent = Math.round((count / maxProjects) * 100);
    return `
      <div>
        <div class="d-flex justify-content-between align-items-center mb-1 small">
          <span class="fw-semibold text-dark">${escapeHtml(tech)}</span>
          <span class="text-muted fw-medium">${count} dự án</span>
        </div>
        <div class="progress" style="height: 7px;">
          <div class="progress-bar bg-primary" role="progressbar" style="width: ${percent}%;" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Hiển thị các thành tựu và cột mốc dựa trên dữ liệu thực tế
 */
function renderAchievements(profile, projects, completedTasks) {
  const container = document.getElementById('portfolio-achievements-list');
  if (!container) return;

  const ownedCount = projects.filter(p => p.isOwner).length;
  const teamCount = projects.filter(p => !p.isOwner).length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const tasksCount = completedTasks.length;
  const skillsCount = (profile.skills || []).length;

  const milestones = [
    {
      id: 'creator',
      title: 'Người khởi xướng',
      desc: 'Sáng lập và quản lý dự án',
      icon: 'bi-rocket-takeoff-fill',
      color: 'primary',
      unlocked: ownedCount >= 1,
      progressText: `${ownedCount}/1 dự án`
    },
    {
      id: 'teamwork',
      title: 'Đồng đội tin cậy',
      desc: 'Tham gia dự án nhóm',
      icon: 'bi-people-fill',
      color: 'info',
      unlocked: teamCount >= 1,
      progressText: `${teamCount}/1 dự án`
    },
    {
      id: 'finisher',
      title: 'Chiến binh về đích',
      desc: 'Hoàn thành 100% mục tiêu dự án',
      icon: 'bi-trophy-fill',
      color: 'success',
      unlocked: completedCount >= 1,
      progressText: `${completedCount}/1 dự án`
    },
    {
      id: 'productivity',
      title: 'Năng suất vượt bậc',
      desc: 'Hoàn thành từ 5 nhiệm vụ trở lên',
      icon: 'bi-check-circle-fill',
      color: 'warning',
      unlocked: tasksCount >= 5,
      progressText: `${tasksCount}/5 tasks`
    },
    {
      id: 'multitalent',
      title: 'Chuyên gia đa năng',
      desc: 'Thành thạo từ 4 kỹ năng công nghệ',
      icon: 'bi-stars',
      color: 'danger',
      unlocked: skillsCount >= 4,
      progressText: `${skillsCount}/4 kỹ năng`
    }
  ];

  container.innerHTML = milestones.map(m => {
    return `
      <div class="col-sm-6 col-lg">
        <div class="achievement-card text-center h-100 ${m.unlocked ? '' : 'locked'}">
          <div class="d-flex justify-content-center mb-2">
            <div class="rounded-circle bg-${m.color} bg-opacity-10 text-${m.color} d-flex align-items-center justify-content-center" style="width: 52px; height: 52px;">
              <i class="bi ${m.icon} fs-4"></i>
            </div>
          </div>
          <h6 class="fw-bold mb-1 small text-dark">${escapeHtml(m.title)}</h6>
          <p class="text-muted mb-2" style="font-size: 0.72rem;">${escapeHtml(m.desc)}</p>
          <span class="badge ${m.unlocked ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'} border" style="font-size: 0.7rem;">
            ${m.unlocked ? '<i class="bi bi-check2 me-1"></i>Đã đạt được' : m.progressText}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Mở modal chi tiết dự án trong Portfolio (Read-only)
 */
async function openProjectDetailModal(projectId) {
  const modalEl = document.getElementById('portfolioProjectModal');
  if (!modalEl) return;

  const project = loadedProjects.find(p => p.id === projectId);
  if (!project) return;

  // Điền dữ liệu cơ bản
  const coverImg = document.getElementById('modal-project-cover');
  if (coverImg) coverImg.src = project.image_url || 'https://images.unsplash.com/photo-1555066931-4365d14431b9?w=800&q=80';

  const titleEl = document.getElementById('modal-project-title');
  if (titleEl) titleEl.textContent = project.title || 'Dự án';

  const descEl = document.getElementById('modal-project-desc');
  if (descEl) descEl.textContent = project.description || 'Chưa có mô tả.';

  const userRoleEl = document.getElementById('modal-user-role');
  if (userRoleEl) userRoleEl.textContent = `Vai trò: ${project.userRole || 'Thành viên'}`;

  const catEl = document.getElementById('modal-project-category');
  if (catEl) catEl.textContent = project.category || 'Khác';

  const stMap = {
    recruiting: 'Đang tuyển', in_progress: 'Đang làm', completed: 'Hoàn thành', archived: 'Lưu trữ'
  };
  const statusEl = document.getElementById('modal-project-status');
  if (statusEl) statusEl.textContent = stMap[project.status] || project.status;

  const progVal = document.getElementById('modal-project-progress-val');
  if (progVal) progVal.textContent = `${project.progress || 0}%`;

  const progBar = document.getElementById('modal-project-progress-bar');
  if (progBar) progBar.style.width = `${project.progress || 0}%`;

  // Problem & Goal
  const problemEl = document.getElementById('modal-project-problem');
  if (problemEl) problemEl.textContent = project.problem || 'Chưa cập nhật vấn đề.';

  const goalEl = document.getElementById('modal-project-goal');
  if (goalEl) goalEl.textContent = project.goal || 'Chưa cập nhật mục tiêu.';

  // Technologies
  const techsContainer = document.getElementById('modal-project-techs');
  if (techsContainer) {
    const techs = Array.isArray(project.technologies) ? project.technologies : [];
    if (techs.length > 0) {
      techsContainer.innerHTML = techs.map(t => `<span class="badge bg-light text-dark border">${escapeHtml(t)}</span>`).join(' ');
    } else {
      techsContainer.innerHTML = '<span class="text-muted small">Chưa khai báo công nghệ.</span>';
    }
  }

  // GitHub info
  const ghContainer = document.getElementById('modal-project-github-container');
  const ghLink = document.getElementById('modal-github-link');
  const ghName = document.getElementById('modal-github-name');
  if (ghContainer) {
    if (project.github_url) {
      ghContainer.classList.remove('d-none');
      if (ghLink) ghLink.href = project.github_url;
      if (ghName) ghName.textContent = project.github_url.replace('https://github.com/', '');
    } else {
      ghContainer.classList.add('d-none');
    }
  }

  // Link đến trang chi tiết
  const pageBtn = document.getElementById('modal-project-page-btn');
  if (pageBtn) pageBtn.href = `project-detail.html?id=${project.id}`;

  // Tải danh sách thành viên dự án
  const membersContainer = document.getElementById('modal-project-members');
  if (membersContainer) {
    membersContainer.innerHTML = '<span class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span> Đang nạp danh sách thành viên...</span>';
    try {
      const client = await (typeof getClient === 'function' ? getClient() : window.getSupabase?.());
      if (client) {
        const { data: members } = await client
          .from('project_members')
          .select(`
            role_name,
            profiles:user_id (id, display_name, username, avatar_url)
          `)
          .eq('project_id', project.id)
          .eq('status', 'active');

        if (!members || members.length === 0) {
          membersContainer.innerHTML = '<span class="text-muted small">Dự án hiện có chủ sở hữu quản lý.</span>';
        } else {
          membersContainer.innerHTML = members.map(m => {
            const prof = m.profiles || {};
            const name = prof.display_name || prof.username || 'Thành viên';
            const avt = prof.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=32`;
            return `
              <div class="d-inline-flex align-items-center gap-2 p-1 pe-2 rounded-pill bg-light border small">
                <img src="${avt}" class="rounded-circle" style="width: 24px; height: 24px; object-fit: cover;" alt="${escapeHtml(name)}">
                <span class="fw-medium">${escapeHtml(name)}</span>
                <span class="text-muted" style="font-size: 0.72rem;">(${escapeHtml(m.role_name || 'Member')})</span>
              </div>
            `;
          }).join(' ');
        }
      }
    } catch {
      membersContainer.innerHTML = '<span class="text-muted small">Không thể nạp danh sách thành viên.</span>';
    }
  }

  const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  bsModal.show();
}

/**
 * Cấu hình các bộ lắng nghe sự kiện trên giao diện
 */
function setupEventListeners() {
  // 1. Chia sẻ link portfolio
  const shareBtn = document.getElementById('btn-share-portfolio');
  if (shareBtn) {
    shareBtn.onclick = () => {
      const shareUrl = window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          if (typeof showToastMsg === 'function') {
            showToastMsg('Đã sao chép liên kết Portfolio vào clipboard!', 'success');
          } else if (typeof showToast === 'function') {
            showToast('Đã sao chép liên kết Portfolio vào clipboard!', 'success');
          } else {
            alert('Đã sao chép liên kết Portfolio vào clipboard!');
          }
        }).catch(() => {
          prompt('Sao chép liên kết Portfolio:', shareUrl);
        });
      } else {
        prompt('Sao chép liên kết Portfolio:', shareUrl);
      }
    };
  }

  // 2. Tìm kiếm dự án
  const searchInput = document.getElementById('portfolio-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      filterAndRenderProjects();
    });
  }

  // 3. Tab bộ lọc
  const filterPills = document.querySelectorAll('#portfolio-filter-pills [data-filter]');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      filterAndRenderProjects();
    });
  });

  // 4. Sắp xếp
  const sortSelect = document.getElementById('portfolio-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      filterAndRenderProjects();
    });
  }

  // 5. Custom Sort Dropdown
  const customSortDropdown = document.querySelector('.custom-portfolio-sort-dropdown');
  if (customSortDropdown && sortSelect) {
    const labelSpan = customSortDropdown.querySelector('.custom-select-label');
    customSortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const val = item.getAttribute('data-value') || 'newest';
        sortSelect.value = val;
        if (labelSpan) labelSpan.textContent = item.textContent.trim();

        customSortDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        sortSelect.dispatchEvent(new Event('change'));
      });
    });
  }

  // 6. Xóa bộ lọc & tìm kiếm khi danh sách trống
  const resetBtn = document.getElementById('btn-reset-portfolio-search');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchQuery = '';
      currentFilter = 'all';

      // Reset tabs
      filterPills.forEach(p => p.classList.remove('active'));
      const allTab = document.querySelector('#portfolio-filter-pills [data-filter="all"]');
      if (allTab) allTab.classList.add('active');

      // Reset sort
      if (sortSelect) sortSelect.value = 'newest';
      if (customSortDropdown) {
        const firstItem = customSortDropdown.querySelector('.dropdown-item');
        const labelSpan = customSortDropdown.querySelector('.custom-select-label');
        if (firstItem && labelSpan) {
          labelSpan.textContent = firstItem.textContent.trim();
          customSortDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
          firstItem.classList.add('active');
        }
      }

      currentSort = 'newest';
      filterAndRenderProjects();
    });
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

document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page === 'portfolio.html') {
    initPortfolio();
  }
});

window.initPortfolio = initPortfolio;
window.openProjectDetailModal = openProjectDetailModal;

