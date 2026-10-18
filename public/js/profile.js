/**
 * profile.js — User Profile Management using Supabase
 * 
 * QUAN TRỌNG:
 * - Tải dữ liệu thật từ bảng public.profiles
 * - Chỉnh sửa và cập nhật profile bằng Supabase Client có RLS bảo vệ (auth.uid() = id)
 * - Không cho phép frontend tự ý sửa ID của user khác
 * - Quản lý skills và interests dạng PostgreSQL TEXT[] (mảng chuỗi)
 * - Tính toán tỉ lệ hoàn thiện hồ sơ (Profile Completion) từ dữ liệu thật
 */
'use strict';

const AVAILABLE_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js',
  'Python', 'Java', 'PHP', 'C++', 'SQL', 'PostgreSQL', 'MongoDB',
  'Firebase', 'Docker', 'Git', 'Figma', 'UI/UX', 'Mobile Dev', 'AI/ML'
];

const AVAILABLE_INTERESTS = [
  'Web Development', 'Mobile App', 'AI/ML', 'Game Dev', 'Cybersecurity',
  'Data Science', 'UI/UX Design', 'DevOps', 'Open Source', 'Cloud Computing'
];

let currentProfileData = null;

/**
 * Tính toán tỷ lệ hoàn thiện hồ sơ dựa trên dữ liệu thật
 */
function calculateProfileCompletion(profile) {
  if (!profile) return 0;
  const fields = [
    Boolean(profile.display_name || profile.full_name),
    Boolean(profile.username),
    Boolean(profile.bio && profile.bio.length >= 10),
    Boolean(profile.skills && profile.skills.length > 0),
    Boolean(profile.experience && profile.experience !== 'beginner'),
    Boolean(profile.github_username || profile.github_url),
    Boolean(profile.avatar_url),
  ];
  const filledCount = fields.filter(Boolean).length;
  return Math.round((filledCount / fields.length) * 100);
}

/**
 * Tải và hiển thị hồ sơ người dùng
 * @param {string|null} targetUserId
 */
async function loadProfile(targetUserId) {
  try {
    const client = await (typeof getClient === 'function' ? getClient() : window.getSupabase?.());
    const currentUser = await (typeof getCurrentUser === 'function' ? getCurrentUser() : null);

    // Xác định ID cần xem: nếu không truyền targetUserId thì là ID của user đang đăng nhập
    const profileId = targetUserId || currentUser?.id;

    if (!profileId) {
      // Chưa đăng nhập và không có user param -> chuyển về trang login
      window.location.href = 'login.html?redirect=profile.html';
      return;
    }

    const isOwn = currentUser && currentUser.id === profileId;

    let profile = null;

    if (client) {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (error) {
        console.warn('[Profile] Lỗi tải profile từ Supabase:', error.message);
      } else if (data) {
        profile = data;
      }
    }

    // Fallback: nếu chưa có bản ghi trong DB nhưng là user hiện tại, dựng profile tạm từ user_metadata
    if (!profile && isOwn && currentUser) {
      profile = {
        id: currentUser.id,
        email: currentUser.email,
        display_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        full_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
        username: currentUser.user_metadata?.username || currentUser.email.split('@')[0],
        bio: '',
        skills: [],
        interests: [],
        experience: 'beginner',
        avatar_url: currentUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.email)}&background=4F46E5&color=fff&size=128`,
      };
    }

    if (!profile) {
      const mainCard = document.querySelector('.profile-header-card');
      if (mainCard) {
        mainCard.innerHTML = `
          <div class="p-4 text-center">
            <i class="bi bi-person-x display-4 text-muted mb-3 d-block"></i>
            <h4>Không tìm thấy hồ sơ người dùng</h4>
            <p class="text-muted">Người dùng này không tồn tại hoặc đã bị xóa.</p>
            <a href="index.html" class="btn btn-outline-primary mt-2">Về trang chủ</a>
          </div>
        `;
      }
      return;
    }

    currentProfileData = profile;
    renderProfileView(profile, isOwn);
    await loadProfileProjectsAndStats(profile.id, isOwn);
  } catch (err) {
    console.error('[Profile] loadProfile exception:', err);
    if (typeof showToastMsg === 'function') {
      showToastMsg('Không thể tải thông tin hồ sơ.', 'error');
    }
  }
}

/**
 * Hiển thị dữ liệu hồ sơ lên giao diện
 */
function renderProfileView(profile, isOwn) {
  const displayName = profile.display_name || profile.full_name || 'Người dùng';
  const username = profile.username ? `@${profile.username}` : '';
  const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&bold=true`;

  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    avatarEl.referrerPolicy = 'no-referrer';
    avatarEl.src = avatarUrl;
    avatarEl.onerror = function() {
      this.onerror = null;
      this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&bold=true`;
    };
  }

  // Header texts
  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = displayName;

  const usernameEl = document.getElementById('profile-username');
  if (usernameEl) usernameEl.textContent = username;

  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.textContent = profile.bio || 'Chưa có thông tin giới thiệu bản thân.';

  // Links
  const githubEl = document.getElementById('profile-github');
  if (githubEl) {
    const ghUser = profile.github_username || '';
    const ghUrl = profile.github_url || (ghUser ? `https://github.com/${ghUser}` : '');
    if (ghUrl) {
      githubEl.href = ghUrl;
      githubEl.style.display = 'inline-flex';
      githubEl.innerHTML = `<i class="bi bi-github me-1"></i> GitHub (${ghUser || 'Xem profile'})`;
    } else {
      githubEl.style.display = 'none';
    }
  }

  const websiteEl = document.getElementById('profile-website');
  if (websiteEl) {
    if (profile.website_url) {
      websiteEl.href = profile.website_url;
      websiteEl.style.display = 'inline-flex';
    } else {
      websiteEl.style.display = 'none';
    }
  }

  // Skills
  const skillsEl = document.getElementById('profile-skills');
  if (skillsEl) {
    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    if (skills.length > 0) {
      skillsEl.innerHTML = skills
        .map(s => `<span class="badge bg-light text-dark border px-3 py-2 fs-6 fw-normal">${escapeHtml(s)}</span>`)
        .join('');
    } else {
      skillsEl.innerHTML = '<p class="text-muted small mb-0">Chưa cập nhật kỹ năng.</p>';
    }
  }

  // Interests
  const interestsEl = document.getElementById('profile-interests');
  if (interestsEl) {
    const interests = Array.isArray(profile.interests) ? profile.interests : [];
    if (interests.length > 0) {
      interestsEl.innerHTML = interests
        .map(i => `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-3 py-2 small">${escapeHtml(i)}</span>`)
        .join('');
    } else {
      interestsEl.innerHTML = '<p class="text-muted small mb-0">Chưa cập nhật lĩnh vực quan tâm.</p>';
    }
  }

  // Stats: Kỹ năng
  const statSkills = document.getElementById('stat-skills-count');
  if (statSkills) {
    statSkills.textContent = (profile.skills || []).length;
  }

  // Nút xem Portfolio
  const portfolioBtn = document.getElementById('profile-portfolio-btn');
  if (portfolioBtn) {
    portfolioBtn.href = isOwn ? 'portfolio.html' : `portfolio.html?user=${encodeURIComponent(profile.id)}`;
  }

  // Edit controls (chỉ hiện khi là hồ sơ của chính mình)
  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) {
    editBtn.style.display = isOwn ? 'inline-block' : 'none';
    if (isOwn) {
      editBtn.onclick = () => openEditModal(profile);
    }
  }

  // Avatar upload button
  const avatarEditBtn = document.getElementById('avatar-edit-btn');
  if (avatarEditBtn) {
    avatarEditBtn.style.display = isOwn ? 'inline-block' : 'none';
  }

  // Profile Completion Badge
  const completionBadge = document.getElementById('profile-completion-badge');
  if (completionBadge) {
    const percent = calculateProfileCompletion(profile);
    completionBadge.textContent = `${percent}% hoàn thiện`;
    completionBadge.style.display = 'inline-block';
  }

  // Load GitHub repos nếu có
  const ghUsername = profile.github_username;
  loadProfileGitHubRepos(ghUsername, isOwn);
}

/**
 * Hiển thị thành tựu người dùng
 */
function renderProfileAchievements(profile, allProjects, completedTasks = []) {
  const container = document.getElementById('profile-achievements');
  if (!container) return;

  const ownedCount = allProjects.filter(p => p.isOwner).length;
  const teamCount = allProjects.filter(p => !p.isOwner).length;
  const completedCount = allProjects.filter(p => p.status === 'completed').length;
  const tasksCount = completedTasks.length;
  const skillsCount = (profile?.skills || []).length;
  const completionPercent = calculateProfileCompletion(profile);

  const achievements = [
    {
      id: 'creator',
      title: 'Người khởi xướng',
      desc: 'Sáng lập và quản trị dự án',
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
      desc: 'Hoàn thành nhiệm vụ được giao',
      icon: 'bi-check-circle-fill',
      color: 'warning',
      unlocked: tasksCount >= 3,
      progressText: `${tasksCount}/3 tasks`
    },
    {
      id: 'multitalent',
      title: 'Kỹ năng đa dạng',
      desc: 'Thiết lập từ 3 kỹ năng chuyên môn',
      icon: 'bi-stars',
      color: 'danger',
      unlocked: skillsCount >= 3,
      progressText: `${skillsCount}/3 kỹ năng`
    },
    {
      id: 'profile_master',
      title: 'Hồ sơ chuyên nghiệp',
      desc: 'Hoàn thiện từ 80% thông tin cá nhân',
      icon: 'bi-patch-check-fill',
      color: 'primary',
      unlocked: completionPercent >= 80,
      progressText: `${completionPercent}% / 80%`
    }
  ];

  container.innerHTML = achievements.map(a => {
    return `
      <div class="achievement-item d-flex align-items-center gap-2 p-2 rounded-3 border w-100 mb-1 ${a.unlocked ? 'bg-white shadow-xs' : 'bg-light bg-opacity-75 opacity-75'}">
        <div class="rounded-circle bg-${a.color} bg-opacity-10 text-${a.color} d-flex align-items-center justify-content-center flex-shrink-0" style="width: 36px; height: 36px;">
          <i class="bi ${a.icon} fs-5"></i>
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex align-items-center justify-content-between">
            <span class="fw-semibold text-dark small text-truncate" title="${escapeHtml(a.title)}">${escapeHtml(a.title)}</span>
            <span class="badge ${a.unlocked ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'} border" style="font-size: 0.65rem;">
              ${a.unlocked ? '<i class="bi bi-check2 me-1"></i>Đã đạt' : a.progressText}
            </span>
          </div>
          <div class="text-muted text-truncate" style="font-size: 0.72rem;">${escapeHtml(a.desc)}</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Tải và hiển thị danh sách GitHub repositories trong sidebar
 */
async function loadProfileGitHubRepos(username, isOwn) {
  const wrapperCard = document.getElementById('github-repos');
  const container = document.getElementById('github-repos-container');
  if (!container) return;

  if (!username) {
    if (isOwn) {
      if (wrapperCard) wrapperCard.style.display = 'block';
      container.innerHTML = `
        <div class="text-center py-3 px-2 border border-dashed rounded bg-light bg-opacity-50">
          <i class="bi bi-github fs-3 text-muted d-block mb-1"></i>
          <p class="small text-muted mb-2">Chưa liên kết tài khoản GitHub</p>
          <button type="button" class="btn btn-sm btn-outline-primary" id="btn-add-github">
            <i class="bi bi-plus-circle me-1"></i>Thêm GitHub Username
          </button>
        </div>
      `;
      const addBtn = document.getElementById('btn-add-github');
      if (addBtn) {
        addBtn.onclick = () => {
          if (currentProfileData) openEditModal(currentProfileData);
        };
      }
    } else {
      if (wrapperCard) wrapperCard.style.display = 'none';
    }
    return;
  }

  if (wrapperCard) wrapperCard.style.display = 'block';
  container.innerHTML = `
    <div class="text-center py-3 text-muted">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
      <small>Đang tải repositories...</small>
    </div>
  `;

  try {
    const repos = typeof fetchGitHubRepos === 'function'
      ? await fetchGitHubRepos(username, 5)
      : await (await fetch(`/api/github/${encodeURIComponent(username)}/repos?per_page=5`)).json();

    if (!Array.isArray(repos) || repos.length === 0) {
      container.innerHTML = `
        <div class="text-center py-3 text-muted small">
          <i class="bi bi-folder-x fs-4 d-block mb-1"></i>
          Chưa có kho lưu trữ công khai nào.
        </div>
      `;
      return;
    }

    const languageColors = {
      JavaScript: '#F7DF1E', TypeScript: '#3178C6', Python: '#3776AB',
      Java: '#ED8B00', CSS: '#1572B6', HTML: '#E34F26', Vue: '#4FC08D',
      React: '#61DAFB', Go: '#00ADD8', Rust: '#DEA584', C: '#555555',
      'C++': '#f34b7d', 'C#': '#178600', PHP: '#4F5D95', Ruby: '#701516',
      Kotlin: '#A97BFF', Swift: '#F05138', Dart: '#00B4AB'
    };

    container.innerHTML = `
      <div class="d-flex flex-column gap-2">
        ${repos.slice(0, 5).map(repo => {
          const langColor = languageColors[repo.language] || '#6e7681';
          return `
            <div class="p-2 border rounded bg-light bg-opacity-50 hover-shadow transition-all">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener noreferrer" class="fw-semibold text-primary text-decoration-none small text-truncate me-2" title="${escapeHtml(repo.name)}">
                  <i class="bi bi-journal-code me-1 text-muted"></i>${escapeHtml(repo.name)}
                </a>
                <span class="badge bg-white text-secondary border px-1 py-0 small" style="font-size: 0.68rem;" title="${repo.stargazers_count || 0} stars">
                  <i class="bi bi-star-fill text-warning me-1"></i>${repo.stargazers_count || 0}
                </span>
              </div>
              ${repo.description ? `<p class="text-muted mb-1 text-truncate" style="font-size: 0.75rem;">${escapeHtml(repo.description)}</p>` : ''}
              <div class="d-flex align-items-center gap-3 text-muted" style="font-size: 0.7rem;">
                ${repo.language ? `<span><span class="d-inline-block rounded-circle me-1" style="width: 8px; height: 8px; background-color: ${langColor};"></span>${escapeHtml(repo.language)}</span>` : ''}
                ${repo.forks_count ? `<span><i class="bi bi-diagram-2 me-1"></i>${repo.forks_count}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <a href="https://github.com/${encodeURIComponent(username)}?tab=repositories" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-dark w-100 mt-3">
        <i class="bi bi-github me-1"></i>Xem tất cả trên GitHub
      </a>
    `;
  } catch (err) {
    console.warn('[Profile] Lỗi tải GitHub repos:', err);
    container.innerHTML = `
      <div class="p-3 text-center text-muted small bg-light rounded">
        <i class="bi bi-exclamation-circle text-warning d-block fs-5 mb-1"></i>
        <span>Không thể tải dữ liệu từ GitHub (@${escapeHtml(username)}).</span>
        <div class="mt-2">
          <a href="https://github.com/${encodeURIComponent(username)}" target="_blank" class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size: 0.75rem;">
            <i class="bi bi-box-arrow-up-right me-1"></i>Mở trực tiếp
          </a>
        </div>
      </div>
    `;
  }
}

/**
 * Tải danh sách dự án và thống kê số liệu cho trang Profile từ Supabase
 */
async function loadProfileProjectsAndStats(userId, isOwn) {
  const container = document.getElementById('profile-projects');
  const statCompleted = document.getElementById('stat-projects-completed');
  const statActive = document.getElementById('stat-projects-active');

  try {
    const client = await (typeof getClient === 'function' ? getClient() : window.getSupabase?.());
    if (!client) return;

    // 1. Lấy danh sách dự án sở hữu
    let ownedQuery = client
      .from('projects')
      .select('id, title, description, status, progress, category, technologies, image_url, is_public, created_at')
      .eq('owner_id', userId);
    if (!isOwn) {
      ownedQuery = ownedQuery.eq('is_public', true);
    }
    const { data: ownedProjects, error: errOwned } = await ownedQuery;
    if (errOwned) console.warn('[Profile] Lỗi lấy dự án sở hữu:', errOwned.message);

    // 2. Lấy danh sách dự án tham gia
    const { data: memberships, error: errMem } = await client
      .from('project_members')
      .select('role_name, status, projects:project_id (id, title, description, status, progress, category, technologies, image_url, is_public, created_at)')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (errMem) console.warn('[Profile] Lỗi lấy dự án thành viên:', errMem.message);

    // 3. Lấy danh sách nhiệm vụ đã hoàn thành
    let userCompletedTasks = [];
    try {
      const { data: tasksData } = await client
        .from('tasks')
        .select('id, project_id, title, status')
        .eq('assignee_id', userId)
        .eq('status', 'done');
      if (tasksData) userCompletedTasks = tasksData;
    } catch (e) {
      console.warn('[Profile] Lỗi lấy tasks hoàn thành:', e);
    }

    const projectMap = new Map();
    (ownedProjects || []).forEach(p => {
      projectMap.set(p.id, { ...p, userRole: 'Chủ dự án', isOwner: true });
    });

    (memberships || []).forEach(m => {
      if (m.projects && !projectMap.has(m.projects.id)) {
        if (isOwn || m.projects.is_public) {
          projectMap.set(m.projects.id, {
            ...m.projects,
            userRole: m.role_name || 'Thành viên',
            isOwner: false,
          });
        }
      }
    });

    const allProjects = Array.from(projectMap.values());

    // Thống kê
    const completedCount = allProjects.filter(p => p.status === 'completed').length;
    const activeCount = allProjects.filter(p => p.status === 'in_progress' || p.status === 'recruiting').length;

    if (statCompleted) statCompleted.textContent = completedCount;
    if (statActive) statActive.textContent = activeCount;

    // Render Thành tựu
    renderProfileAchievements(currentProfileData || { id: userId }, allProjects, userCompletedTasks);

    // Render danh sách dự án
    if (container) {
      if (allProjects.length === 0) {
        container.innerHTML = `
          <div class="col-12 text-center py-4 text-muted">
            <i class="bi bi-folder2-open display-6 d-block mb-2 text-secondary"></i>
            <p class="mb-2">Chưa có dự án nào được hiển thị.</p>
            ${isOwn ? '<a href="create-project.html" class="btn btn-sm btn-primary"><i class="bi bi-plus-circle me-1"></i>Tạo dự án mới</a>' : ''}
          </div>
        `;
        return;
      }

      container.innerHTML = allProjects.map(p => {
        const isDone = p.status === 'completed';
        const stBadge = isDone
          ? '<span class="badge bg-success">Hoàn thành</span>'
          : '<span class="badge bg-primary">Đang làm</span>';
        const cover = p.image_url || 'https://images.unsplash.com/photo-1555066931-4365d14431b9?w=400&q=80';
        const techs = Array.isArray(p.technologies) ? p.technologies.slice(0, 3) : [];

        return `
          <div class="col-md-6">
            <div class="card h-100 border-0 shadow-sm overflow-hidden">
              <img src="${cover}" class="card-img-top" alt="${escapeHtml(p.title)}" style="height: 140px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1555066931-4365d14431b9?w=400&q=80'">
              <div class="card-body p-3 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  ${stBadge}
                  <span class="badge bg-light text-dark border small">${escapeHtml(p.userRole)}</span>
                </div>
                <h6 class="fw-bold mb-1 text-truncate">${escapeHtml(p.title)}</h6>
                <p class="small text-muted mb-2 text-truncate-2" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(p.description || '')}</p>
                <div class="d-flex flex-wrap gap-1 mb-3 mt-auto">
                  ${techs.map(t => `<span class="badge bg-light text-dark border small" style="font-size: 0.72rem;">${escapeHtml(t)}</span>`).join('')}
                </div>
                <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                  <div class="progress flex-grow-1 me-2" style="height: 6px;">
                    <div class="progress-bar ${isDone ? 'bg-success' : 'bg-primary'}" style="width: ${p.progress || 0}%"></div>
                  </div>
                  <a href="project-detail.html?id=${p.id}" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 0.8rem;">Xem</a>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('[Profile] Lỗi loadProfileProjectsAndStats:', err);
    if (container) {
      container.innerHTML = '<div class="col-12 text-muted small text-center">Không thể tải dự án.</div>';
    }
  }
}

/**
 * Mở modal chỉnh sửa hồ sơ và điền sẵn dữ liệu hiện tại
 */
function openEditModal(profile) {
  const modalEl = document.getElementById('editProfileModal');
  if (!modalEl) return;

  document.getElementById('edit-name-input').value = profile.display_name || profile.full_name || '';
  document.getElementById('edit-username-input').value = profile.username || '';
  document.getElementById('edit-bio-input').value = profile.bio || '';
  document.getElementById('edit-experience-input').value = profile.experience || 'beginner';
  document.getElementById('edit-avatar-input').value = profile.avatar_url || '';
  document.getElementById('edit-github-input').value = profile.github_username || '';
  document.getElementById('edit-website-input').value = profile.website_url || '';

  // Render pills skills
  const skillsContainer = document.getElementById('edit-skills-container');
  if (skillsContainer) {
    const currentSkills = new Set(profile.skills || []);
    const mergedSkills = Array.from(new Set([...AVAILABLE_SKILLS, ...(profile.skills || [])]));
    skillsContainer.innerHTML = mergedSkills.map(skill => {
      const active = currentSkills.has(skill);
      return `
        <button type="button" class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline-primary'} edit-skill-pill" data-skill="${escapeHtml(skill)}">
          ${escapeHtml(skill)}
        </button>
      `;
    }).join('');

    skillsContainer.querySelectorAll('.edit-skill-pill').forEach(btn => {
      btn.onclick = () => {
        btn.classList.toggle('btn-primary');
        btn.classList.toggle('btn-outline-primary');
      };
    });

    // Custom skill addition in Edit Profile Modal
    const editCustomSkillInput = document.getElementById('edit-custom-skill-input');
    const btnAddProfileCustomSkill = document.getElementById('btn-add-profile-custom-skill');

    function addCustomSkillToProfile() {
      if (!editCustomSkillInput || !skillsContainer) return;
      const skillName = editCustomSkillInput.value.trim();
      if (!skillName) return;

      const existing = Array.from(skillsContainer.querySelectorAll('.edit-skill-pill'))
        .find(b => (b.dataset.skill || '').toLowerCase() === skillName.toLowerCase());

      if (existing) {
        existing.classList.remove('btn-outline-primary');
        existing.classList.add('btn-primary');
        editCustomSkillInput.value = '';
        return;
      }

      const newBtn = document.createElement('button');
      newBtn.type = 'button';
      newBtn.className = 'btn btn-sm btn-primary edit-skill-pill d-inline-flex align-items-center gap-1';
      newBtn.dataset.skill = skillName;
      newBtn.innerHTML = `
        <span>${escapeHtml(skillName)}</span>
        <span class="btn-remove-profile-skill ms-1 opacity-75" title="Xóa" style="cursor: pointer;">&times;</span>
      `;

      newBtn.onclick = (e) => {
        if (e.target.closest('.btn-remove-profile-skill')) {
          e.stopPropagation();
          newBtn.remove();
          return;
        }
        newBtn.classList.toggle('btn-primary');
        newBtn.classList.toggle('btn-outline-primary');
      };

      skillsContainer.appendChild(newBtn);
      editCustomSkillInput.value = '';
    }

    if (btnAddProfileCustomSkill) {
      btnAddProfileCustomSkill.onclick = addCustomSkillToProfile;
    }
    if (editCustomSkillInput) {
      editCustomSkillInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addCustomSkillToProfile();
        }
      };
    }
  }

  // Render pills interests
  const interestsContainer = document.getElementById('edit-interests-container');
  if (interestsContainer) {
    const currentInterests = new Set(profile.interests || []);
    const mergedInterests = Array.from(new Set([...AVAILABLE_INTERESTS, ...(profile.interests || [])]));
    interestsContainer.innerHTML = mergedInterests.map(interest => {
      const active = currentInterests.has(interest);
      return `
        <button type="button" class="btn btn-sm ${active ? 'btn-info text-white' : 'btn-outline-info'} edit-interest-pill" data-interest="${escapeHtml(interest)}">
          ${escapeHtml(interest)}
        </button>
      `;
    }).join('');

    interestsContainer.querySelectorAll('.edit-interest-pill').forEach(btn => {
      btn.onclick = () => {
        btn.classList.toggle('btn-info');
        btn.classList.toggle('text-white');
        btn.classList.toggle('btn-outline-info');
      };
    });
  }

  const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  bsModal.show();
}

/**
 * Lưu thay đổi hồ sơ vào Supabase
 */
async function saveProfileEdits() {
  const currentUser = await (typeof getCurrentUser === 'function' ? getCurrentUser() : null);
  if (!currentUser) {
    alert('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
    window.location.href = 'login.html';
    return;
  }

  const client = await (typeof getClient === 'function' ? getClient() : window.getSupabase?.());
  if (!client) {
    alert('Chưa kết nối được với cơ sở dữ liệu Supabase.');
    return;
  }

  const name = document.getElementById('edit-name-input')?.value?.trim();
  const username = document.getElementById('edit-username-input')?.value?.trim();
  const bio = document.getElementById('edit-bio-input')?.value?.trim() || '';
  const experience = document.getElementById('edit-experience-input')?.value || 'beginner';
  const avatarUrl = document.getElementById('edit-avatar-input')?.value?.trim() || null;
  const githubUser = document.getElementById('edit-github-input')?.value?.trim() || '';
  const website = document.getElementById('edit-website-input')?.value?.trim() || '';

  if (!name || !username) {
    alert('Vui lòng điền Họ tên và Tên người dùng.');
    return;
  }

  // Thu thập mảng kỹ năng và sở thích đã chọn
  const selectedSkills = Array.from(document.querySelectorAll('.edit-skill-pill.btn-primary')).map(b => b.dataset.skill);
  const selectedInterests = Array.from(document.querySelectorAll('.edit-interest-pill.btn-info')).map(b => b.dataset.interest);

  const saveBtn = document.getElementById('save-profile-btn');
  const spinner = document.getElementById('save-spinner');
  const originalText = saveBtn.innerHTML;

  saveBtn.disabled = true;
  if (spinner) spinner.classList.remove('d-none');
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Đang lưu...';

  const updates = {
    display_name: name,
    username: username,
    bio: bio,
    experience: experience,
    avatar_url: avatarUrl,
    skills: selectedSkills,
    interests: selectedInterests,
    github_username: githubUser,
    github_url: githubUser ? `https://github.com/${githubUser}` : null,
    website_url: website || null,
    updated_at: new Date().toISOString(),
  };

  try {
    // RLS đảm bảo: auth.uid() = id
    const { error } = await client
      .from('profiles')
      .upsert({
        id: currentUser.id,
        ...updates,
      });

    if (error) {
      console.error('[Profile] Lỗi lưu profile:', error);
      alert('Không thể lưu hồ sơ: ' + error.message);
    } else {
      if (client.auth && typeof client.auth.updateUser === 'function') {
        try {
          await client.auth.updateUser({
            data: {
              full_name: name,
              display_name: name,
              avatar_url: avatarUrl || undefined,
            }
          });
        } catch (e) {
          console.warn('[Profile] updateUser metadata:', e);
        }
      }

      if (typeof showToastMsg === 'function') {
        showToastMsg('Cập nhật hồ sơ thành công!', 'success');
      }

      // Đóng modal
      const modalEl = document.getElementById('editProfileModal');
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();

      // Cập nhật lại giao diện ngay lập tức
      await loadProfile(currentUser.id);

      // Cập nhật navbar nếu có
      if (typeof renderNavbar === 'function') {
        renderNavbar();
      }
    }
  } catch (err) {
    console.error('[Profile] saveProfileEdits exception:', err);
    alert('Có lỗi xảy ra khi lưu thay đổi.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalText;
    if (spinner) spinner.classList.add('d-none');
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
 * Xử lý tải ảnh đại diện lên Cloudinary và cập nhật profile
 * @param {File} file
 * @param {object} options
 */
async function handleAvatarUpload(file, options = {}) {
  if (!file) return;

  // 1. Client-side validation: định dạng & kích thước
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    const msg = 'Định dạng file không hỗ trợ. Vui lòng chọn ảnh JPEG, PNG, WebP hoặc GIF.';
    if (typeof showToastMsg === 'function') showToastMsg(msg, 'warning');
    else alert(msg);
    return;
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    const msg = 'Kích thước file vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.';
    if (typeof showToastMsg === 'function') showToastMsg(msg, 'warning');
    else alert(msg);
    return;
  }

  // 2. UI Spinner & Preview tức thì
  const spinnerEl = document.getElementById('avatar-upload-spinner');
  const avatarEl = document.getElementById('profile-avatar');
  const prevSrc = avatarEl ? avatarEl.src : '';

  if (spinnerEl) {
    spinnerEl.classList.remove('d-none');
    spinnerEl.style.setProperty('display', 'flex', 'important');
  }

  // Preview tạm thời
  if (avatarEl) {
    try {
      avatarEl.src = URL.createObjectURL(file);
    } catch {
      // Fallback
    }
  }

  try {
    // 3. Lấy token xác thực
    let session = null;
    if (typeof getCurrentSession === 'function') {
      session = await getCurrentSession();
    } else {
      const client = await (typeof getClient === 'function' ? getClient() : window.getSupabase?.());
      const res = await client?.auth.getSession();
      session = res?.data?.session;
    }

    if (!session || !session.access_token) {
      throw new Error('Bạn cần đăng nhập để thực hiện thao tác này.');
    }

    // 4. Gửi request POST /api/upload/avatar (có fallback Supabase Storage & Base64 nếu backend bị CORS/offline)
    let uploadedUrl = null;
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.url) {
          uploadedUrl = data.url;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('[Profile] /api/upload/avatar trả về lỗi:', errData.error);
      }
    } catch (apiErr) {
      console.warn('[Profile] /api/upload/avatar gặp lỗi kết nối/CORS, tự động chuyển sang fallback:', apiErr);
    }

    const client = await (typeof getClient === 'function' ? getClient() : window.getSupabase?.());
    const currentUser = await (typeof getCurrentUser === 'function' ? getCurrentUser() : null);

    // Fallback 1: Tải trực tiếp lên Supabase Storage (bucket avatars)
    if (!uploadedUrl && client && currentUser) {
      try {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `avatar-${currentUser.id}-${Date.now()}.${ext}`;
        const { data: storageData, error: storageErr } = await client.storage
          .from('avatars')
          .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (!storageErr && storageData) {
          const { data: pubData } = client.storage.from('avatars').getPublicUrl(fileName);
          if (pubData && pubData.publicUrl) {
            uploadedUrl = pubData.publicUrl;
          }
        }
      } catch (stEx) {
        console.warn('[Profile] Fallback Supabase Storage cảnh báo:', stEx);
      }
    }

    // Fallback 2: Chuyển đổi sang chuỗi Base64 tối ưu hóa và lưu trực tiếp vào Supabase profiles
    if (!uploadedUrl) {
      try {
        uploadedUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const maxDim = 256;
              let w = img.width;
              let h = img.height;
              if (w > h) {
                if (w > maxDim) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                }
              } else {
                if (h > maxDim) {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => resolve(e.target.result);
            img.src = e.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch (b64Err) {
        console.warn('[Profile] Fallback Base64 cảnh báo:', b64Err);
      }
    }

    if (!uploadedUrl) {
      throw new Error('Không thể tải hoặc xử lý ảnh đại diện.');
    }

    // 5. Cập nhật vào Supabase public.profiles & Auth metadata
    if (client && currentUser) {
      try {
        const { error: updateErr } = await client
          .from('profiles')
          .update({
            avatar_url: uploadedUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id);

        if (updateErr) {
          console.warn('[Profile] Lưu avatar vào Supabase profiles:', updateErr.message);
        }
      } catch (dbErr) {
        console.warn('[Profile] DB update exception:', dbErr);
      }

      if (client.auth && typeof client.auth.updateUser === 'function') {
        try {
          await client.auth.updateUser({ data: { avatar_url: uploadedUrl } });
        } catch (authMetaErr) {
          console.warn('[Profile] Cập nhật auth metadata:', authMetaErr);
        }
      }
    }

    // 6. Cập nhật các phần tử UI khác
    if (avatarEl) avatarEl.src = uploadedUrl;
    if (typeof currentProfileData === 'object' && currentProfileData) {
      currentProfileData.avatar_url = uploadedUrl;
    }
    const editAvatarInput = document.getElementById('edit-avatar-input');
    if (editAvatarInput) editAvatarInput.value = uploadedUrl;

    // Cập nhật navbar avatar nếu có
    document.querySelectorAll('.navbar-avatar, #nav-user-avatar, #navbar-avatar, .user-avatar-img, #userDropdown img').forEach(img => {
      if (img.tagName === 'IMG') img.src = uploadedUrl;
    });

    if (typeof showToastMsg === 'function') {
      showToastMsg('Cập nhật ảnh đại diện thành công!', 'success');
    }

    if (options.onSuccess) options.onSuccess(uploadedUrl);
  } catch (err) {
    console.error('[Profile] Upload avatar thất bại:', err);
    if (avatarEl) avatarEl.src = prevSrc;

    const errMsg = err.message || 'Không thể tải ảnh lên.';
    if (typeof showToastMsg === 'function') showToastMsg(errMsg, 'error');
    else alert(errMsg);
  } finally {
    if (spinnerEl) {
      spinnerEl.classList.add('d-none');
      spinnerEl.style.setProperty('display', 'none', 'important');
    }
    // Reset file inputs
    const fileInput = document.getElementById('avatar-file-input');
    if (fileInput) fileInput.value = '';
    const modalFileInput = document.getElementById('modal-avatar-file-input');
    if (modalFileInput) modalFileInput.value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const pathname = window.location.pathname;
  if (!pathname.includes('profile.html') && !pathname.endsWith('/profile')) return;

  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('user') || urlParams.get('id');
  loadProfile(targetId);

  const editForm = document.getElementById('edit-profile-form');
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveProfileEdits();
    });
  }

  // Bắt sự kiện tải avatar từ nút camera trên trang hồ sơ
  const avatarFileInput = document.getElementById('avatar-file-input');
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleAvatarUpload(file);
    });
  }

  // Bắt sự kiện tải avatar từ modal chỉnh sửa
  const modalAvatarInput = document.getElementById('modal-avatar-file-input');
  if (modalAvatarInput) {
    modalAvatarInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const statusEl = document.getElementById('modal-avatar-status');
        if (statusEl) statusEl.textContent = 'Đang tải ảnh lên...';
        handleAvatarUpload(file, {
          onSuccess: (url) => {
            if (statusEl) statusEl.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Đã tải ảnh lên thành công.</span>';
          }
        });
      }
    });
  }
});

window.loadProfile = loadProfile;
window.saveProfileEdits = saveProfileEdits;
window.handleAvatarUpload = handleAvatarUpload;
window.calculateProfileCompletion = calculateProfileCompletion;
