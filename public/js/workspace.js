/**
 * workspace.js — Phase 5: Workspace + Task Management + Kanban Board
 * Real Supabase integration, robust RLS enforcement, Drag & Drop with rollback,
 * search/filter/sort, accessible status dropdowns, and progress tracking.
 */

'use strict';

// State nội bộ của Workspace
let _currentProject = null;
let _currentUser = null;
let _currentProfile = null;
let _isOwner = false;
let _isMember = false;
let _isAdmin = false;
let _projectTeamMembers = [];
let _allTasks = [];
let _currentEditTaskId = null;

const STATUS_CONFIG = {
    todo:        { label: 'Cần làm',    color: 'secondary', icon: 'bi-circle' },
    in_progress: { label: 'Đang làm',   color: 'warning',   icon: 'bi-play-circle' },
    review:      { label: 'Review',     color: 'info',      icon: 'bi-eye' },
    done:        { label: 'Hoàn thành', color: 'success',   icon: 'bi-check-circle' }
};

const PRIORITY_CONFIG = {
    urgent: { label: 'Khẩn cấp',  color: 'danger',  badgeClass: 'bg-danger text-white' },
    high:   { label: 'Cao',       color: 'danger',  badgeClass: 'bg-danger bg-opacity-10 text-danger border border-danger' },
    medium: { label: 'Trung bình', color: 'warning', badgeClass: 'bg-warning bg-opacity-15 text-dark border border-warning' },
    low:    { label: 'Thấp',      color: 'secondary', badgeClass: 'bg-secondary bg-opacity-10 text-secondary border' }
};

function getDB() {
    return typeof window.getSupabaseClient === 'function'
        ? window.getSupabaseClient()
        : window.supabaseClient;
}

/**
 * Khởi tạo trang Workspace
 */
async function initWorkspacePage() {
    try {
        // 1. Kiểm tra session đăng nhập
        if (typeof getCurrentUser === 'function') {
            _currentUser = await getCurrentUser();
        }
        if (!_currentUser) {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            return;
        }

        if (typeof getCurrentProfile === 'function') {
            _currentProfile = await getCurrentProfile();
        }

        // Cập nhật thông tin user trên sidebar
        const sbAvatar = document.getElementById('sidebar-user-avatar');
        const sbName   = document.getElementById('sidebar-user-name');
        const userDisplayName = _currentProfile?.display_name || _currentUser?.user_metadata?.full_name || _currentUser.email.split('@')[0];
        if (sbAvatar) {
            sbAvatar.referrerPolicy = 'no-referrer';
            sbAvatar.src = _currentProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=6366f1&color=fff&bold=true`;
            sbAvatar.onerror = function() {
                this.onerror = null;
                this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=6366f1&color=fff&bold=true`;
            };
        }
        if (sbName) sbName.textContent = userDisplayName;

        // 2. Lấy ID dự án từ URL (?id=... hoặc ?project=...)
        const urlParams = new URLSearchParams(window.location.search);
        let projectId = urlParams.get('id') || urlParams.get('project');

        const supabase = getDB();
        if (!supabase) throw new Error('Không thể kết nối Supabase client.');

        // Tải danh sách tất cả các dự án mà user là Chủ dự án hoặc Thành viên chính thức
        const userProjects = await fetchUserProjects(_currentUser.id, supabase);

        // Nếu người dùng truy cập trực tiếp /workspace.html mà không truyền ?id=
        if (!projectId) {
            if (userProjects.length > 0) {
                // Tự động mở dự án mới nhất của người dùng
                projectId = userProjects[0].id;
                const newUrl = `${window.location.pathname}?id=${projectId}`;
                window.history.replaceState({ projectId }, '', newUrl);
            } else {
                // Người dùng chưa tham gia/sở hữu bất kỳ dự án nào: hiển thị màn hình rỗng chào mừng
                showNoProjectsWorkspace();
                return;
            }
        }

        // 3. Tải thông tin dự án trực tiếp từ bảng projects (không ép foreign key join để tránh lỗi quan hệ PostgREST)
        const { data: rawProject, error: projErr } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .maybeSingle();

        if (projErr || !rawProject) {
            // Nếu projectId không tồn tại trong DB, tự động chuyển về dự án mới nhất của user
            if (userProjects.length > 0) {
                console.warn(`[Workspace] Dự án ${projectId} không tồn tại hoặc đã bị xóa. Chuyển hướng về dự án gần nhất: ${userProjects[0].title}`);
                window.location.replace(`workspace.html?id=${userProjects[0].id}`);
                return;
            }
            showAccessDenied('Dự án không tồn tại hoặc đã bị xóa.', userProjects);
            return;
        }

        const project = rawProject;

        // Lấy profile của owner an toàn
        try {
            if (project.owner_id) {
                const { data: ownerProf } = await supabase
                    .from('profiles')
                    .select('id, display_name, avatar_url, username, email')
                    .eq('id', project.owner_id)
                    .maybeSingle();
                if (ownerProf) project.profiles = ownerProf;
            }
        } catch (e) {
            console.warn('[Workspace] Lỗi tải profile owner:', e);
        }

        _currentProject = project;

        // 4. Tải danh sách thành viên active
        let activeMembers = [];
        try {
            const { data: members } = await supabase
                .from('project_members')
                .select('*')
                .eq('project_id', projectId)
                .eq('status', 'active');
            if (members) activeMembers = members;
        } catch (memErr) {
            console.warn('[Workspace] Lỗi tải project_members:', memErr);
        }

        // Tải thông tin profiles của các thành viên nếu có
        const memberUserIds = activeMembers.map(m => m.user_id).filter(Boolean);
        if (memberUserIds.length > 0) {
            try {
                const { data: memberProfiles } = await supabase
                    .from('profiles')
                    .select('id, display_name, avatar_url, username, skills, experience, email')
                    .in('id', memberUserIds);
                if (memberProfiles) {
                    const profMap = new Map();
                    memberProfiles.forEach(p => profMap.set(p.id, p));
                    activeMembers.forEach(m => {
                        m.profiles = profMap.get(m.user_id);
                    });
                }
            } catch (pErr) {
                console.warn('[Workspace] Lỗi tải profiles thành viên:', pErr);
            }
        }

        // 5. Kiểm tra quyền truy cập: CHỦ DỰ ÁN (OWNER) LUÔN CÓ TOÀN QUYỀN
        _isOwner = Boolean(_currentUser && project.owner_id === _currentUser.id);
        _isAdmin = _currentUser && (
            (_currentUser.email && _currentUser.email.toLowerCase().trim() === 'lamasono80@gmail.com') ||
            _currentUser.role === 'admin' ||
            _currentUser.is_admin === true ||
            (_currentUser.app_metadata && _currentUser.app_metadata.role === 'admin') ||
            (_currentUser.user_metadata && _currentUser.user_metadata.role === 'admin') ||
            (_currentProfile && (_currentProfile.role === 'admin' || _currentProfile.is_admin === true))
        );
        _isMember = activeMembers.some(m => m.user_id === _currentUser.id) || _isOwner;

        if (!_isOwner && !_isMember && !_isAdmin) {
            showAccessDenied(`Bạn không phải là thành viên của dự án "${project.title}". Chỉ Chủ dự án, Thành viên chính thức hoặc Quản trị viên (Admin) mới có quyền vào Không gian làm việc này.`, userProjects);
            return;
        }

        // Tự động đồng bộ Chủ dự án vào bảng project_members nếu chưa có
        if (_isOwner && !activeMembers.some(m => m.user_id === _currentUser.id)) {
            try {
                await supabase.from('project_members').insert({
                    project_id: project.id,
                    user_id: _currentUser.id,
                    role_name: 'Chủ dự án',
                    status: 'active'
                });
            } catch (autoInsErr) {
                console.warn('[Workspace] Tự động thêm owner vào project_members cảnh báo:', autoInsErr);
            }
        }

        // 6. Xây dựng danh sách Team Members cho Assignee Dropdown
        _projectTeamMembers = [];
        // Thêm Owner
        _projectTeamMembers.push({
            id: project.owner_id,
            display_name: `${project.profiles?.display_name || 'Chủ dự án'} (Owner)`,
            avatar_url: project.profiles?.avatar_url,
            isOwner: true
        });
        // Thêm các Member
        activeMembers.forEach(m => {
            if (m.user_id !== project.owner_id) {
                _projectTeamMembers.push({
                    id: m.user_id,
                    display_name: `${m.profiles?.display_name || 'Thành viên'}${m.role_name ? ` (${m.role_name})` : ''}`,
                    avatar_url: m.profiles?.avatar_url,
                    role_name: m.role_name,
                    isOwner: false
                });
            }
        });

        // 7. Cập nhật giao diện Topbar & Tabs
        renderWorkspaceHeader(project, activeMembers, userProjects);
        populateAssigneeOptions();
        initWorkspaceTabs();
        setupToolbarEvents();
        setupTaskModalEvents();

        // 8. Tải danh sách Tasks từ Supabase
        await loadWorkspaceTasks(project.id);

        // 9. Khởi tạo Project Chat & Realtime Presence (Phase 6)
        if (typeof initProjectChat === 'function') {
            await initProjectChat(project.id, _currentUser, _currentProfile);
        }

        // 10. Đăng ký Realtime Task Subscription (Phase 6)
        subscribeToProjectTasks(project.id);

    } catch (err) {
        console.error('[Workspace] Lỗi khởi tạo:', err);
        showAccessDenied(`Đã xảy ra lỗi: ${err.message}`);
    }
}

/**
 * Tải danh sách dự án mà user là Chủ dự án hoặc Thành viên
 */
async function fetchUserProjects(userId, supabase) {
    const list = [];
    try {
        // 1. Dự án do user làm Owner
        const { data: owned } = await supabase
            .from('projects')
            .select('id, title, category, status, deadline, owner_id')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

        if (owned && owned.length > 0) {
            owned.forEach(p => list.push({ ...p, isOwner: true }));
        }

        // 2. Dự án user tham gia với tư cách Member
        const { data: memberRows } = await supabase
            .from('project_members')
            .select('project_id, role_name, projects:project_id(id, title, category, status, deadline, owner_id)')
            .eq('user_id', userId)
            .eq('status', 'active');

        if (memberRows && memberRows.length > 0) {
            memberRows.forEach(m => {
                if (m.projects && !list.some(p => p.id === m.projects.id)) {
                    list.push({ ...m.projects, role_name: m.role_name, isOwner: false });
                }
            });
        }
    } catch (err) {
        console.warn('[Workspace] fetchUserProjects exception:', err);
    }
    return list;
}

/**
 * Hiển thị màn hình từ chối truy cập (khi user cố tình vào dự án không thuộc về mình)
 */
function showAccessDenied(message, userProjects = []) {
    const wsView = document.getElementById('workspace-view');
    const deniedView = document.getElementById('access-denied-view');
    const noProjectsView = document.getElementById('no-projects-view');
    const deniedMsg = document.getElementById('access-denied-msg');
    const btnReturn = document.getElementById('btn-return-detail');
    const btnReturnMyWs = document.getElementById('btn-return-my-workspace');

    if (wsView) wsView.classList.add('d-none');
    if (noProjectsView) noProjectsView.classList.add('d-none');
    if (deniedView) deniedView.classList.remove('d-none');
    if (deniedMsg && message) deniedMsg.textContent = message;

    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id') || urlParams.get('project');
    if (btnReturn && projectId) {
        btnReturn.href = `project-detail.html?id=${projectId}`;
    }

    if (btnReturnMyWs) {
        if (userProjects && userProjects.length > 0) {
            btnReturnMyWs.href = `workspace.html?id=${userProjects[0].id}`;
            btnReturnMyWs.innerHTML = `<i class="bi bi-kanban me-1"></i>Về Workspace của tôi (${sanitizeText(userProjects[0].title)})`;
            btnReturnMyWs.classList.remove('d-none');
        } else {
            btnReturnMyWs.classList.add('d-none');
        }
    }
}

/**
 * Hiển thị màn hình chào mừng / rỗng thân thiện khi người dùng chưa có dự án nào
 */
function showNoProjectsWorkspace() {
    const wsView = document.getElementById('workspace-view');
    const deniedView = document.getElementById('access-denied-view');
    const noProjectsView = document.getElementById('no-projects-view');

    if (wsView) wsView.classList.add('d-none');
    if (deniedView) deniedView.classList.add('d-none');
    if (noProjectsView) noProjectsView.classList.remove('d-none');
}

/**
 * Render Header của Workspace
 */
function renderWorkspaceHeader(project, members, userProjects = []) {
    document.title = `${project.title} - Workspace | ProjectHub`;

    const titleEl   = document.getElementById('ws-project-title');
    const fieldEl   = document.getElementById('ws-project-field');
    const ownerEl   = document.getElementById('ws-owner-label');
    const countEl   = document.getElementById('ws-members-count');
    const deadEl    = document.getElementById('ws-deadline');
    const btnBack   = document.getElementById('btn-back-to-project');
    const linkDet   = document.getElementById('link-view-project-detail');
    const avatarsEl = document.getElementById('ws-team-avatars');
    const btnFindMembers = document.getElementById('btn-ws-find-members');

    if (titleEl) titleEl.textContent = project.title;
    if (fieldEl) fieldEl.textContent = project.category || 'Khác';
    if (ownerEl) ownerEl.textContent = `Chủ dự án: ${project.profiles?.display_name || 'Chưa cập nhật'}`;
    if (btnBack) btnBack.href = `project-detail.html?id=${project.id}`;
    if (linkDet) linkDet.href = `project-detail.html?id=${project.id}`;

    // Nút Tìm ứng viên AI Matching cho dự án này
    if (btnFindMembers) {
        btnFindMembers.href = `matching.html?project_id=${project.id}`;
    }

    // Project Switcher Dropdown
    const switcherList = document.getElementById('ws-project-switcher-list');
    if (switcherList && userProjects.length > 0) {
        switcherList.innerHTML = `
            <li class="dropdown-header small text-muted text-uppercase fw-bold px-3 py-1">Dự án của bạn</li>
            ${userProjects.map(p => {
                const isCurrent = p.id === project.id;
                const roleTag = p.isOwner ? 'Chủ dự án' : (p.role_name || 'Thành viên');
                return `
                    <li>
                        <a class="dropdown-item d-flex align-items-center justify-content-between py-2 px-3 ${isCurrent ? 'active fw-bold' : ''}" href="workspace.html?id=${p.id}">
                            <span class="text-truncate me-2"><i class="bi bi-folder2 me-1"></i>${sanitizeText(p.title)}</span>
                            <span class="badge ${isCurrent ? 'bg-light text-primary' : 'bg-secondary bg-opacity-10 text-secondary'} small" style="font-size: 0.7rem;">${roleTag}</span>
                        </a>
                    </li>
                `;
            }).join('')}
            <li><hr class="dropdown-divider my-1"></li>
            <li>
                <a class="dropdown-item py-2 px-3 text-primary d-flex align-items-center gap-1" href="create-project.html">
                    <i class="bi bi-plus-circle me-1"></i>Tạo dự án mới...
                </a>
            </li>
        `;
    }

    const totalCount = members.length + 1;
    if (countEl) countEl.textContent = `${totalCount} thành viên`;

    if (deadEl) {
        if (project.deadline) {
            const days = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            if (days < 0) {
                deadEl.className = 'badge bg-danger text-white px-2 py-1';
                deadEl.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Hết hạn';
            } else if (days === 0) {
                deadEl.className = 'badge bg-warning text-dark px-2 py-1';
                deadEl.innerHTML = '<i class="bi bi-clock me-1"></i>Hôm nay';
            } else {
                deadEl.className = 'badge bg-info text-dark px-2 py-1';
                deadEl.innerHTML = `<i class="bi bi-calendar3 me-1"></i>Còn ${days} ngày`;
            }
        } else {
            deadEl.textContent = 'Không có hạn';
            deadEl.className = 'badge bg-light text-dark border px-2 py-1';
        }
    }

    // Render avatar chồng lên nhau
    if (avatarsEl) {
        avatarsEl.innerHTML = _projectTeamMembers.slice(0, 4).map((m, i) => {
            const avatar = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name)}&background=6366f1&color=fff&bold=true`;
            return `<img src="${avatar}" class="rounded-circle border border-2 border-white" width="28" height="28" style="width:28px;height:28px;object-fit:cover;aspect-ratio:1/1;margin-left:${i > 0 ? '-8px' : '0'}; z-index:${10 - i}" title="${sanitizeText(m.display_name)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name)}&background=6366f1&color=fff&bold=true';">`;
        }).join('');
    }
}

/**
 * Đổ dữ liệu Assignee vào modal và toolbar filter
 */
function populateAssigneeOptions() {
    const modalSelect  = document.getElementById('task-assignee-input');
    const filterSelect = document.getElementById('task-filter-assignee');
    const hintEl       = document.getElementById('task-assignee-hint');

    const optionsHtml = _projectTeamMembers.map(m => 
        `<option value="${m.id}">${sanitizeText(m.display_name)}</option>`
    ).join('');

    if (modalSelect) {
        modalSelect.innerHTML = '<option value="">-- Chưa phân công --</option>' + optionsHtml;
    }

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">Tất cả người phụ trách</option><option value="unassigned">Chưa giao ai</option>' + optionsHtml;
    }

    if (hintEl && _currentProject) {
        if (_projectTeamMembers.length <= 1) {
            hintEl.innerHTML = `<i class="bi bi-info-circle text-primary me-1"></i>Nhóm hiện chỉ có bạn (Chủ dự án). Bạn có thể tự phụ trách hoặc <a href="matching.html?project_id=${_currentProject.id}" target="_blank" class="fw-semibold text-primary text-decoration-underline">Tìm ứng viên phù hợp qua AI</a> để giao việc!`;
        } else {
            hintEl.innerHTML = `<i class="bi bi-people text-success me-1"></i>Chọn thành viên phù hợp từ danh sách nhóm (${_projectTeamMembers.length} thành viên).`;
        }
    }
}

/**
 * Tải danh sách Tasks từ Supabase
 */
async function loadWorkspaceTasks(projectId) {
    const supabase = getDB();
    if (!supabase) return;

    try {
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
                id, project_id, assignee_id, creator_id, title, description,
                status, priority, deadline, position, created_at, updated_at,
                assignee:assignee_id ( id, display_name, username, avatar_url ),
                creator:creator_id ( id, display_name )
            `)
            .eq('project_id', projectId)
            .order('position', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        _allTasks = tasks || [];
        renderKanbanBoard();
        updateWorkspaceProgress();

    } catch (err) {
        console.error('[Workspace] Lỗi tải tasks:', err);
        if (typeof showToast === 'function') {
            showToast('Lỗi tải danh sách công việc: ' + err.message, 'error');
        }
    }
}

/**
 * Render bảng Kanban từ `_allTasks` theo bộ lọc hiện tại
 */
function renderKanbanBoard() {
    const filteredTasks = getFilteredAndSortedTasks();

    const columns = ['todo', 'in_progress', 'review', 'done'];

    columns.forEach(status => {
        const colContainer = document.getElementById(`tasks-${status}`);
        const countBadge   = document.getElementById(`count-${status}`);

        const colTasks = filteredTasks.filter(t => t.status === status);

        if (countBadge) countBadge.textContent = colTasks.length;

        if (!colContainer) return;

        if (colTasks.length === 0) {
            colContainer.innerHTML = `
                <div class="empty-col-placeholder text-center py-4 text-muted small">
                    <i class="bi bi-inbox fs-4 d-block mb-1 text-secondary opacity-50"></i>
                    <span>Chưa có task</span>
                </div>
            `;
            return;
        }

        colContainer.innerHTML = colTasks.map(t => renderTaskCard(t)).join('');
    });
}

/**
 * Render 1 thẻ Task Card trên Kanban
 */
function renderTaskCard(task) {
    const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const title = sanitizeText(task.title);
    const desc  = sanitizeText(task.description || '');

    // Xử lý deadline và overdue
    let deadlineHtml = '';
    if (task.deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDue = new Date(task.deadline);
        taskDue.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((taskDue - today) / (1000 * 60 * 60 * 24));

        if (task.status === 'done') {
            deadlineHtml = `<small class="text-muted"><i class="bi bi-calendar-check me-1"></i>${formatDate(task.deadline)}</small>`;
        } else if (diffDays < 0) {
            deadlineHtml = `<span class="badge bg-danger text-white"><i class="bi bi-exclamation-triangle me-1"></i>Quá hạn</span>`;
        } else if (diffDays === 0) {
            deadlineHtml = `<span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>Hôm nay</span>`;
        } else {
            deadlineHtml = `<small class="text-muted"><i class="bi bi-calendar2 me-1"></i>${formatDate(task.deadline)}</small>`;
        }
    }

    // Thông tin Assignee
    const assignee = task.assignee;
    let assigneeHtml = '';
    if (assignee) {
        const aName = sanitizeText(assignee.display_name || 'Thành viên');
        const aAvatar = assignee.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(aName)}&background=4F46E5&color=fff&size=32`;
        assigneeHtml = `
            <div class="d-flex align-items-center gap-1" title="Giao cho: ${aName}">
                <img src="${aAvatar}" class="rounded-circle" width="22" height="22" style="object-fit:cover;" alt="${aName}">
                <small class="text-muted text-truncate" style="max-width: 90px;">${aName}</small>
            </div>
        `;
    } else {
        assigneeHtml = `<small class="text-muted fst-italic"><i class="bi bi-person-dash me-1"></i>Chưa giao</small>`;
    }

    return `
        <div class="kanban-task-card card border-0 shadow-sm p-3 mb-2" 
             data-task-id="${task.id}" 
             draggable="true" 
             ondragstart="dragTaskStart(event, '${task.id}')">
            
            <div class="d-flex justify-content-between align-items-start mb-2">
                <span class="badge ${priorityInfo.badgeClass}" style="font-size: 0.7rem;">${priorityInfo.label}</span>
                
                <!-- Quick Status Dropdown (Mobile accessible) -->
                <div class="dropdown" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-link text-muted p-0" type="button" data-bs-toggle="dropdown" title="Đổi trạng thái">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm small">
                        <li><h6 class="dropdown-header">Chuyển sang:</h6></li>
                        <li><a class="dropdown-item ${task.status === 'todo' ? 'active' : ''}" href="#" onclick="quickChangeStatus('${task.id}', 'todo')">Cần làm</a></li>
                        <li><a class="dropdown-item ${task.status === 'in_progress' ? 'active' : ''}" href="#" onclick="quickChangeStatus('${task.id}', 'in_progress')">Đang làm</a></li>
                        <li><a class="dropdown-item ${task.status === 'review' ? 'active' : ''}" href="#" onclick="quickChangeStatus('${task.id}', 'review')">Review</a></li>
                        <li><a class="dropdown-item ${task.status === 'done' ? 'active' : ''}" href="#" onclick="quickChangeStatus('${task.id}', 'done')">Hoàn thành</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" onclick="openEditTaskModal('${task.id}')"><i class="bi bi-pencil me-1"></i>Chỉnh sửa</a></li>
                    </ul>
                </div>
            </div>

            <!-- Title (Click to Edit) -->
            <div class="task-card-title fw-semibold text-dark mb-1" onclick="openEditTaskModal('${task.id}')" style="cursor: pointer;">
                ${title}
            </div>

            ${desc ? `<p class="small text-muted mb-2 text-truncate" style="max-width: 100%;">${desc}</p>` : ''}

            <!-- Footer: Assignee & Deadline -->
            <div class="d-flex justify-content-between align-items-center pt-2 mt-auto border-top">
                ${assigneeHtml}
                <div>${deadlineHtml}</div>
            </div>
        </div>
    `;
}

/**
 * Lọc và sắp xếp tasks theo toolbar
 */
function getFilteredAndSortedTasks() {
    let result = [..._allTasks];

    const searchVal   = document.getElementById('task-search-input')?.value?.toLowerCase().trim() || '';
    const priorityVal = document.getElementById('task-filter-priority')?.value || 'all';
    const assigneeVal = document.getElementById('task-filter-assignee')?.value || 'all';
    const sortByVal   = document.getElementById('task-sort-by')?.value || 'position';

    // 1. Search keyword
    if (searchVal) {
        result = result.filter(t => 
            t.title.toLowerCase().includes(searchVal) ||
            (t.description && t.description.toLowerCase().includes(searchVal))
        );
    }

    // 2. Filter Priority
    if (priorityVal !== 'all') {
        result = result.filter(t => t.priority === priorityVal);
    }

    // 3. Filter Assignee
    if (assigneeVal !== 'all') {
        if (assigneeVal === 'unassigned') {
            result = result.filter(t => !t.assignee_id);
        } else {
            result = result.filter(t => t.assignee_id === assigneeVal);
        }
    }

    // 4. Sort
    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

    result.sort((a, b) => {
        if (sortByVal === 'deadline') {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        }
        if (sortByVal === 'priority') {
            return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        }
        if (sortByVal === 'newest') {
            return new Date(b.created_at) - new Date(a.created_at);
        }
        // Default: sort by position
        return (a.position || 0) - (b.position || 0);
    });

    return result;
}

// ── DRAG & DROP LOGIC WITH DATABASE PERSISTENCE & ROLLBACK ──────────────────

function dragTaskStart(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
}

function allowDrop(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('kanban-drag-over');
}

document.querySelectorAll('.kanban-tasks').forEach(col => {
    col.addEventListener('dragleave', () => col.classList.remove('kanban-drag-over'));
});

async function dropTask(e, targetStatus) {
    e.preventDefault();
    e.currentTarget.classList.remove('kanban-drag-over');

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    await updateTaskStatusAndPosition(taskId, targetStatus);
}

async function quickChangeStatus(taskId, targetStatus) {
    await updateTaskStatusAndPosition(taskId, targetStatus);
}

/**
 * Cập nhật status của task vào Supabase có cơ chế Rollback nếu lỗi
 */
async function updateTaskStatusAndPosition(taskId, targetStatus) {
    const taskIndex = _allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const previousStatus = _allTasks[taskIndex].status;
    if (previousStatus === targetStatus) return;

    // 1. Cập nhật lạc quan (Optimistic UI update)
    _allTasks[taskIndex].status = targetStatus;
    renderKanbanBoard();
    updateWorkspaceProgress();

    try {
        const supabase = getDB();
        const { error } = await supabase
            .from('tasks')
            .update({ 
                status: targetStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', taskId);

        if (error) throw error;

        // Phase 6: Gửi thông báo khi hoàn thành task
        if (targetStatus === 'done' && typeof createNotification === 'function' && _currentProject) {
            const task = _allTasks[taskIndex];
            const recipientId = _currentProject.owner_id !== _currentUser.id 
                ? _currentProject.owner_id 
                : (task && task.creator_id && task.creator_id !== _currentUser.id ? task.creator_id : null);

            if (recipientId) {
                const memberName = _currentProfile?.display_name || _currentUser.email?.split('@')[0] || 'Thành viên';
                createNotification({
                    userId: recipientId,
                    projectId: _currentProject.id,
                    type: 'task_status_changed',
                    title: 'Nhiệm vụ đã hoàn thành',
                    message: `Nhiệm vụ "${task.title}" trong dự án "${_currentProject.title}" đã được ${memberName} đánh dấu Hoàn thành.`,
                    actionUrl: `workspace.html?id=${_currentProject.id}`
                });
            }
        }

    } catch (err) {
        console.error('[Workspace] Lỗi cập nhật status task:', err);
        // 2. Rollback UI nếu lưu thất bại
        _allTasks[taskIndex].status = previousStatus;
        renderKanbanBoard();
        updateWorkspaceProgress();

        if (typeof showToast === 'function') {
            showToast('Không thể cập nhật trạng thái: ' + err.message, 'error');
        }
    }
}

// ── TASK MODAL CRUD ──────────────────────────────────────────────────────────

function openAddTaskModal(defaultStatus = 'todo') {
    _currentEditTaskId = null;

    const titleEl = document.getElementById('taskModalTitle');
    const formEl  = document.getElementById('task-form');
    const btnDel  = document.getElementById('btn-delete-task');
    const statEl  = document.getElementById('task-status-input');

    if (titleEl) titleEl.textContent = 'Thêm công việc mới';
    if (formEl) formEl.reset();
    if (btnDel) btnDel.style.display = 'none';
    if (statEl) statEl.value = defaultStatus;

    const modalEl = document.getElementById('taskModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function openEditTaskModal(taskId) {
    const task = _allTasks.find(t => t.id === taskId);
    if (!task) return;

    _currentEditTaskId = taskId;

    const titleModal = document.getElementById('taskModalTitle');
    const titleInput = document.getElementById('task-title-input');
    const descInput  = document.getElementById('task-desc-input');
    const assInput   = document.getElementById('task-assignee-input');
    const priInput   = document.getElementById('task-priority-input');
    const statInput  = document.getElementById('task-status-input');
    const deadInput  = document.getElementById('task-deadline-input');
    const btnDel     = document.getElementById('btn-delete-task');

    if (titleModal) titleModal.textContent = 'Chỉnh sửa công việc';
    if (titleInput) titleInput.value = task.title || '';
    if (descInput)  descInput.value = task.description || '';
    if (assInput)   assInput.value = task.assignee_id || '';
    if (priInput)   priInput.value = task.priority || 'medium';
    if (statInput)  statInput.value = task.status || 'todo';
    if (deadInput)  deadInput.value = task.deadline || '';

    // Cho phép xóa nếu là Owner, Admin hoặc người tạo task
    if (btnDel) {
        const canDelete = _isOwner || _isAdmin || (_currentUser && task.creator_id === _currentUser.id);
        btnDel.style.display = canDelete ? 'inline-flex' : 'none';
    }

    const modalEl = document.getElementById('taskModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function setupTaskModalEvents() {
    const saveBtn = document.getElementById('btn-save-task');
    const delBtn  = document.getElementById('btn-delete-task');

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const titleInput = document.getElementById('task-title-input');
            const descInput  = document.getElementById('task-desc-input');
            const assInput   = document.getElementById('task-assignee-input');
            const priInput   = document.getElementById('task-priority-input');
            const statInput  = document.getElementById('task-status-input');
            const deadInput  = document.getElementById('task-deadline-input');

            const title = titleInput?.value?.trim();
            if (!title) {
                if (titleInput) {
                    titleInput.classList.add('is-invalid');
                    titleInput.focus();
                }
                return;
            }
            if (titleInput) titleInput.classList.remove('is-invalid');

            const taskData = {
                title: title,
                description: descInput?.value?.trim() || null,
                assignee_id: assInput?.value || null,
                priority: priInput?.value || 'medium',
                status: statInput?.value || 'todo',
                deadline: deadInput?.value || null
            };

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang lưu...';

            try {
                const supabase = getDB();
                if (!supabase) throw new Error('Không có Supabase client.');

                if (_currentEditTaskId) {
                    // Update
                    const { error } = await supabase
                        .from('tasks')
                        .update(taskData)
                        .eq('id', _currentEditTaskId);
                    if (error) throw error;

                    if (typeof showToast === 'function') showToast('Cập nhật công việc thành công!', 'success');
                } else {
                    // Create
                    const insertPayload = {
                        ...taskData,
                        project_id: _currentProject.id,
                        creator_id: _currentUser.id,
                        position: _allTasks.filter(t => t.status === taskData.status).length
                    };

                    const { error } = await supabase
                        .from('tasks')
                        .insert(insertPayload);
                    if (error) throw error;

                    if (typeof showToast === 'function') showToast('Tạo công việc mới thành công!', 'success');
                }

                // Phase 6: Gửi thông báo nếu có người được giao việc
                if (taskData.assignee_id && taskData.assignee_id !== _currentUser.id && typeof createNotification === 'function') {
                    const senderName = _currentProfile?.display_name || _currentUser.email?.split('@')[0] || 'Đồng đội';
                    createNotification({
                        userId: taskData.assignee_id,
                        projectId: _currentProject.id,
                        type: 'task_assigned',
                        title: 'Nhiệm vụ mới được giao',
                        message: `${senderName} đã giao cho bạn nhiệm vụ "${taskData.title}" trong dự án "${_currentProject.title}".`,
                        actionUrl: `workspace.html?id=${_currentProject.id}`
                    });
                }

                // Ẩn modal và reload tasks
                const modalEl = document.getElementById('taskModal');
                if (modalEl && typeof bootstrap !== 'undefined') {
                    const bsModal = bootstrap.Modal.getInstance(modalEl);
                    if (bsModal) bsModal.hide();
                }

                await loadWorkspaceTasks(_currentProject.id);

            } catch (err) {
                console.error('[Workspace] Lỗi lưu task:', err);
                if (typeof showToast === 'function') showToast(err.message || 'Lỗi lưu task', 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Lưu công việc';
            }
        });
    }

    if (delBtn) {
        delBtn.addEventListener('click', async () => {
            if (!_currentEditTaskId) return;
            if (!confirm('Bạn có chắc muốn xóa công việc này? Hành động này không thể hoàn tác.')) return;

            delBtn.disabled = true;
            delBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang xóa...';

            try {
                const supabase = getDB();
                const { error } = await supabase
                    .from('tasks')
                    .delete()
                    .eq('id', _currentEditTaskId);

                if (error) throw error;

                const modalEl = document.getElementById('taskModal');
                if (modalEl && typeof bootstrap !== 'undefined') {
                    const bsModal = bootstrap.Modal.getInstance(modalEl);
                    if (bsModal) bsModal.hide();
                }

                if (typeof showToast === 'function') showToast('Đã xóa công việc thành công!', 'success');
                await loadWorkspaceTasks(_currentProject.id);

            } catch (err) {
                console.error('[Workspace] Lỗi xóa task:', err);
                if (typeof showToast === 'function') showToast(err.message || 'Lỗi xóa task', 'error');
            } finally {
                delBtn.disabled = false;
                delBtn.innerHTML = '<i class="bi bi-trash me-1"></i>Xóa task';
            }
        });
    }
}

function setupToolbarEvents() {
    const searchInput   = document.getElementById('task-search-input');
    const filterPriority = document.getElementById('task-filter-priority');
    const filterAssignee = document.getElementById('task-filter-assignee');
    const sortBy         = document.getElementById('task-sort-by');

    if (searchInput)   searchInput.addEventListener('input', renderKanbanBoard);
    if (filterPriority) filterPriority.addEventListener('change', renderKanbanBoard);
    if (filterAssignee) filterAssignee.addEventListener('change', renderKanbanBoard);
    if (sortBy)         sortBy.addEventListener('change', renderKanbanBoard);
}

/**
 * Cập nhật tiến độ tổng thể của task trên topbar
 */
function updateWorkspaceProgress() {
    const bar  = document.getElementById('ws-progress-bar');
    const text = document.getElementById('ws-progress-text');

    if (!_allTasks || _allTasks.length === 0) {
        if (bar) bar.style.width = '0%';
        if (text) text.textContent = '0%';
        return;
    }

    const doneCount = _allTasks.filter(t => t.status === 'done').length;
    const percent = Math.round((doneCount / _allTasks.length) * 100);

    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}%`;
}

// ── TABS NAVIGATION ──────────────────────────────────────────────────────────

function initWorkspaceTabs() {
    document.querySelectorAll('.ws-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ws-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ws-tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const tabName = btn.dataset.tab;
            const targetContent = document.getElementById(`tab-${tabName}`);
            if (targetContent) targetContent.classList.add('active');

            if (tabName === 'overview') renderOverviewTab();
            if (tabName === 'members') renderMembersTab();
            if (typeof setChatTabActive === 'function') {
                setChatTabActive(tabName === 'chat');
            }
        });
    });
}

function renderOverviewTab() {
    const container = document.getElementById('overview-content');
    if (!container || !_currentProject) return;

    const totalTasks = _allTasks.length;
    const doneTasks = _allTasks.filter(t => t.status === 'done').length;
    const inProgTasks = _allTasks.filter(t => t.status === 'in_progress').length;
    const reviewTasks = _allTasks.filter(t => t.status === 'review').length;
    const todoTasks = _allTasks.filter(t => t.status === 'todo').length;
    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    container.innerHTML = `
        <div class="row g-4">
            <div class="col-lg-8">
                <div class="card border-0 shadow-sm p-4 mb-4">
                    <h5 class="fw-bold mb-3">Mô tả dự án</h5>
                    <p class="text-secondary">${sanitizeText(_currentProject.description || 'Chưa có mô tả chi tiết.')}</p>
                    ${_currentProject.goal ? `<h6 class="fw-bold mt-4 mb-2">Mục tiêu</h6><p class="text-secondary">${sanitizeText(_currentProject.goal)}</p>` : ''}
                    ${_currentProject.problem ? `<h6 class="fw-bold mt-4 mb-2">Vấn đề giải quyết</h6><p class="text-secondary">${sanitizeText(_currentProject.problem)}</p>` : ''}
                </div>

                <div class="card border-0 shadow-sm p-4 mb-4">
                    <h5 class="fw-bold mb-3">Công nghệ sử dụng</h5>
                    <div class="d-flex flex-wrap gap-2">
                        ${(_currentProject.technologies || []).map(t => `<span class="badge bg-light text-dark border px-3 py-2 fs-6">${sanitizeText(t)}</span>`).join('') || '<span class="text-muted">Chưa cập nhật công nghệ</span>'}
                    </div>
                </div>

                <!-- GitHub Repository Widget (Phase 7) -->
                <div class="card border-0 shadow-sm p-4" id="ws-github-card">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-github fs-5 text-dark"></i>
                            <h5 class="fw-bold mb-0">Kho mã nguồn GitHub</h5>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" id="btn-ws-refresh-github" title="Làm mới dữ liệu từ GitHub">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                    <div id="ws-github-body">
                        <!-- Populated by loadWorkspaceGitHub -->
                    </div>
                </div>
            </div>

            <div class="col-lg-4">
                <div class="card border-0 shadow-sm p-4 mb-4 text-center">
                    <h6 class="fw-bold mb-3">Tiến độ công việc</h6>
                    <div class="display-4 fw-bold text-success mb-2">${progress}%</div>
                    <div class="progress mb-3" style="height: 8px;">
                        <div class="progress-bar bg-success" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-muted small">${doneTasks} / ${totalTasks} công việc đã hoàn thành</span>
                </div>

                <div class="card border-0 shadow-sm p-4">
                    <h6 class="fw-bold mb-3">Thống kê công việc</h6>
                    <div class="d-flex justify-content-between py-2 border-bottom">
                        <span class="text-muted"><i class="bi bi-circle me-2 text-secondary"></i>Cần làm</span>
                        <span class="fw-bold">${todoTasks}</span>
                    </div>
                    <div class="d-flex justify-content-between py-2 border-bottom">
                        <span class="text-muted"><i class="bi bi-play-circle me-2 text-warning"></i>Đang làm</span>
                        <span class="fw-bold text-warning">${inProgTasks}</span>
                    </div>
                    <div class="d-flex justify-content-between py-2 border-bottom">
                        <span class="text-muted"><i class="bi bi-eye me-2 text-info"></i>Review</span>
                        <span class="fw-bold text-info">${reviewTasks}</span>
                    </div>
                    <div class="d-flex justify-content-between py-2">
                        <span class="text-muted"><i class="bi bi-check-circle me-2 text-success"></i>Hoàn thành</span>
                        <span class="fw-bold text-success">${doneTasks}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    loadWorkspaceGitHub(_currentProject.github_url);
}

/**
 * Tải và hiển thị tóm tắt GitHub Repository trong Tab Tổng quan
 */
async function loadWorkspaceGitHub(githubUrl, refresh = false) {
    const bodyEl = document.getElementById('ws-github-body');
    const refreshBtn = document.getElementById('btn-ws-refresh-github');
    if (!bodyEl) return;

    if (!githubUrl || !githubUrl.trim()) {
        bodyEl.innerHTML = `
            <div class="text-center py-3">
                <i class="bi bi-github fs-1 text-muted d-block mb-2"></i>
                <p class="text-muted small mb-2">Dự án này chưa liên kết với kho mã nguồn GitHub nào.</p>
                ${_isOwner ? `<a href="edit-project.html?id=${encodeURIComponent(_currentProject.id)}" class="btn btn-sm btn-outline-primary"><i class="bi bi-link-45deg me-1"></i>Liên kết GitHub ngay</a>` : ''}
            </div>
        `;
        if (refreshBtn) refreshBtn.style.display = 'none';
        return;
    }

    if (refreshBtn) {
        refreshBtn.style.display = 'inline-block';
        refreshBtn.onclick = (e) => {
            e.preventDefault();
            loadWorkspaceGitHub(githubUrl, true);
        };
    }

    bodyEl.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
            <div class="text-muted small">Đang tải dữ liệu từ GitHub...</div>
        </div>
    `;

    try {
        const res = await fetch(`/api/github/repository?url=${encodeURIComponent(githubUrl)}${refresh ? '&refresh=true' : ''}`);
        const data = await res.json();

        if (!res.ok) {
            bodyEl.innerHTML = `
                <div class="alert alert-warning py-2 px-3 small mb-2">
                    <i class="bi bi-exclamation-triangle me-1"></i>${sanitizeText(data.error || 'Không thể tải thông tin repository.')}
                </div>
                <a href="${sanitizeText(githubUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-dark">
                    <i class="bi bi-box-arrow-up-right me-1"></i>Truy cập GitHub
                </a>
            `;
            return;
        }

        const langColors = {
            'JavaScript': '#f1e05a',
            'TypeScript': '#3178c6',
            'Python': '#3572A5',
            'HTML': '#e34c26',
            'CSS': '#563d7c',
            'Java': '#b07219',
            'Go': '#00ADD8',
            'Rust': '#dea584',
            'C++': '#f34b7d',
            'C#': '#178600',
            'PHP': '#4F5D95',
        };
        const langColor = langColors[data.language] || '#6c757d';

        const updatedDate = data.updated_at
            ? new Date(data.updated_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' })
            : '-';

        bodyEl.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-2">
                <div class="d-flex align-items-center gap-2 text-truncate">
                    ${data.owner_avatar ? `<img src="${sanitizeText(data.owner_avatar)}" class="rounded" width="28" height="28" alt="Owner">` : '<i class="bi bi-folder2 text-secondary fs-5"></i>'}
                    <a href="${sanitizeText(data.html_url)}" target="_blank" rel="noopener noreferrer" class="fw-bold text-dark text-decoration-none hover-primary text-truncate">
                        ${sanitizeText(data.full_name || data.name)}
                    </a>
                </div>
                <a href="${sanitizeText(data.html_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-dark flex-shrink-0">
                    <i class="bi bi-github me-1"></i>Mở GitHub
                </a>
            </div>

            ${data.description ? `<p class="text-muted small mb-3">${sanitizeText(data.description)}</p>` : ''}

            <div class="d-flex flex-wrap gap-2 mb-2">
                <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                    <i class="bi bi-star-fill text-warning"></i> ${Number(data.stars || 0).toLocaleString()} sao
                </span>
                <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                    <i class="bi bi-diagram-2 text-secondary"></i> ${Number(data.forks || 0).toLocaleString()} forks
                </span>
                <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                    <i class="bi bi-exclamation-circle text-info"></i> ${Number(data.open_issues || 0).toLocaleString()} issues
                </span>
                ${data.language ? `
                    <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                        <span class="d-inline-block rounded-circle" style="width: 8px; height: 8px; background-color: ${langColor};"></span>
                        ${sanitizeText(data.language)}
                    </span>
                ` : ''}
                <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                    <i class="bi bi-git"></i> ${sanitizeText(data.default_branch || 'main')}
                </span>
            </div>

            <div class="text-muted small">
                <i class="bi bi-clock-history me-1"></i>Cập nhật lần cuối: ${updatedDate}
            </div>
        `;
    } catch (err) {
        console.error('[Workspace] GitHub load error:', err);
        bodyEl.innerHTML = `
            <div class="alert alert-danger py-2 px-3 small mb-0">
                <i class="bi bi-exclamation-circle me-1"></i>Không thể tải dữ liệu repository từ GitHub.
            </div>
        `;
    }
}

function renderMembersTab() {
    const container = document.getElementById('members-content');
    if (!container) return;

    const recruitBanner = _isOwner ? `
        <div class="card bg-primary bg-opacity-10 border border-primary-subtle p-3 mb-4 rounded-3">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                    <h6 class="fw-bold text-primary mb-1"><i class="bi bi-stars me-1"></i>Tìm kiếm &amp; Phân công thành viên phù hợp</h6>
                    <p class="text-muted small mb-0">Hệ thống AI Matching sẽ tự động quét hồ sơ và kỹ năng của các sinh viên trên nền tảng để gợi ý ứng viên sáng giá nhất cho dự án của bạn.</p>
                </div>
                <div class="d-flex flex-wrap gap-2">
                    <a href="matching.html?project_id=${_currentProject?.id || ''}" class="btn btn-primary btn-sm px-3 py-2 fw-semibold rounded-pill d-inline-flex align-items-center gap-1 shadow-sm">
                        <i class="bi bi-magic"></i><span>Tìm ứng viên AI</span>
                    </a>
                    <a href="project-detail.html?id=${_currentProject?.id || ''}" class="btn btn-outline-primary btn-sm px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1">
                        <i class="bi bi-person-check"></i><span>Duyệt đơn tham gia</span>
                    </a>
                </div>
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        ${recruitBanner}
        <div class="row g-3">
            ${_projectTeamMembers.map(m => {
                const avatar = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name)}&background=6366f1&color=fff&bold=true`;
                return `
                    <div class="col-md-6 col-lg-4">
                        <div class="card border-0 shadow-sm p-3 h-100 text-center">
                            <img src="${avatar}" class="rounded-circle mx-auto mb-2" width="64" height="64" style="width:64px;height:64px;object-fit:cover;aspect-ratio:1/1;" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name)}&background=6366f1&color=fff&bold=true';">
                            <h6 class="fw-bold mb-1">${sanitizeText(m.display_name)}</h6>
                            <span class="badge ${m.isOwner ? 'bg-primary' : 'bg-success bg-opacity-10 text-success'} mx-auto mb-3">
                                ${m.isOwner ? 'Chủ dự án (Owner)' : (m.role_name || 'Thành viên')}
                            </span>
                            <a href="profile.html?user=${m.id}" class="btn btn-outline-primary btn-sm mt-auto w-100">
                                <i class="bi bi-person me-1"></i>Xem hồ sơ
                            </a>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ── UTILITIES ────────────────────────────────────────────────────────────────

function sanitizeText(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    try {
        return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch(e) { return dateStr; }
}

// ── REALTIME TASKS SUBSCRIPTION (Phase 6) ────────────────────────────────────

let _tasksChannel = null;

/**
 * Lắng nghe thay đổi của bảng tasks theo thời gian thực (Zero reload)
 */
function subscribeToProjectTasks(projectId) {
    const supabase = getDB();
    if (!supabase || !projectId) return;

    if (_tasksChannel) {
        supabase.removeChannel(_tasksChannel);
        _tasksChannel = null;
    }

    _tasksChannel = supabase.channel(`project-tasks-${projectId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'tasks',
                filter: `project_id=eq.${projectId}`
            },
            async (payload) => {
                const newTask = payload.new;
                if (_allTasks.some(t => t.id === newTask.id)) return;

                const assignee = _projectTeamMembers.find(m => m.id === newTask.assignee_id);
                newTask.assignee = assignee ? {
                    id: assignee.id,
                    display_name: assignee.display_name,
                    avatar_url: assignee.avatar_url
                } : null;

                _allTasks.unshift(newTask);
                renderKanbanBoard();
                updateWorkspaceProgress();
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'tasks',
                filter: `project_id=eq.${projectId}`
            },
            async (payload) => {
                const updatedTask = payload.new;
                const idx = _allTasks.findIndex(t => t.id === updatedTask.id);
                if (idx !== -1) {
                    const assignee = _projectTeamMembers.find(m => m.id === updatedTask.assignee_id);
                    _allTasks[idx] = {
                        ..._allTasks[idx],
                        ...updatedTask,
                        assignee: assignee ? {
                            id: assignee.id,
                            display_name: assignee.display_name,
                            avatar_url: assignee.avatar_url
                        } : _allTasks[idx].assignee
                    };
                    renderKanbanBoard();
                    updateWorkspaceProgress();
                } else {
                    await loadWorkspaceTasks(projectId);
                }
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'tasks',
                filter: `project_id=eq.${projectId}`
            },
            (payload) => {
                const deletedId = payload.old?.id;
                if (deletedId) {
                    _allTasks = _allTasks.filter(t => t.id !== deletedId);
                    renderKanbanBoard();
                    updateWorkspaceProgress();
                }
            }
        )
        .subscribe();
}

window.addEventListener('beforeunload', () => {
    const supabase = getDB();
    if (supabase && _tasksChannel) {
        supabase.removeChannel(_tasksChannel);
        _tasksChannel = null;
    }
});

// Global exports cho inline HTML event handlers
window.allowDrop = allowDrop;
window.dropTask = dropTask;
window.dragTaskStart = dragTaskStart;
window.quickChangeStatus = quickChangeStatus;
window.openAddTaskModal = openAddTaskModal;
window.openEditTaskModal = openEditTaskModal;
window.loadWorkspaceTasks = loadWorkspaceTasks;
window.initWorkspacePage = initWorkspacePage;

document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (page === 'workspace.html') {
        initWorkspacePage();
    }
});
