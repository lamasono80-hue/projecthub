/**
 * admin.js — ProjectHub Admin Portal Client Controller
 *
 * Chức năng:
 * - Bảo vệ xác thực (Auth & Role Guard): chặn 403 Forbidden nếu không phải Admin
 * - Điều hướng Tab giao diện (Overview, Users, Projects, Broadcast, Settings)
 * - Tương tác API /api/admin/* (Thống kê, Quản lý Users, Quản lý Dự án, Gửi thông báo toàn sàn)
 * - Tương thích 100% Dark / Light Mode và thiết bị di động
 */
'use strict';

let currentAdminUser = null;
let currentAdminToken = null;
let categoryChartInstance = null;

// State cho phân trang và bộ lọc
const usersState = {
    page: 1,
    pageSize: 10,
    search: '',
    role: 'all',
    status: 'all',
    total: 0,
};

const projectsState = {
    page: 1,
    pageSize: 10,
    search: '',
    status: 'all',
    category: 'all',
    total: 0,
};

let projectToDeleteId = null;

// Khởi chạy khi tài liệu sẵn sàng
document.addEventListener('DOMContentLoaded', async () => {
    await initAdminAuth();
    setupAdminNavigation();
    setupMobileSidebar();
    setupEventHandlers();
});

// ==========================================
// 1. Authentication & Security Guard
// ==========================================
async function getSupabaseInstance() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof window.getSupabase === 'function') {
        const c = await window.getSupabase();
        if (c) return c;
    }
    if (typeof window.initSupabase === 'function') {
        const c = await window.initSupabase();
        if (c) return c;
    }
    return null;
}

async function initAdminAuth() {
    try {
        const client = await getSupabaseInstance();
        
        let session = null;
        if (client && client.auth) {
            try {
                const res = await client.auth.getSession();
                session = res?.data?.session;
            } catch (sessErr) {
                console.warn('[Admin Guard] client.auth.getSession error:', sessErr);
            }
        }

        if (!session && typeof getCurrentSession === 'function') {
            session = await getCurrentSession();
        }

        if (!session) {
            // Fallback: Tìm access_token từ localStorage của Supabase
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
                    try {
                        const parsed = JSON.parse(localStorage.getItem(key));
                        if (parsed && (parsed.access_token || parsed.currentSession?.access_token)) {
                            session = parsed.currentSession || parsed;
                            break;
                        }
                    } catch {}
                }
            }
        }

        if (!session || !session.access_token) {
            // Chưa đăng nhập -> chuyển hướng đến trang đăng nhập kèm cờ redirect
            window.location.href = 'login.html?redirect=admin.html';
            return;
        }

        currentAdminToken = session.access_token;

        // Gọi Backend API kiểm tra quyền Admin
        const response = await fetch('/api/admin/check', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentAdminToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            showForbidden(errData.error || 'Bạn không có quyền quản trị hệ thống.');
            return;
        }

        const data = await response.json();
        currentAdminUser = data.user;

        // Cập nhật thông tin Admin trên giao diện
        updateAdminInfoUI(currentAdminUser);

        // Bắt đầu tải dữ liệu các tab
        initAdminData();

    } catch (err) {
        console.error('[Admin Guard] Lỗi xác thực:', err);
        showForbidden('Đã xảy ra lỗi trong quá trình xác minh quyền quản trị: ' + (err.message || ''));
    }
}

function showForbidden(msg) {
    document.getElementById('admin-app-view').classList.add('d-none');
    const forbiddenView = document.getElementById('admin-forbidden-view');
    forbiddenView.classList.remove('d-none');
    if (msg) {
        const msgEl = document.getElementById('forbidden-message');
        if (msgEl) msgEl.innerText = msg;
    }
}

function updateAdminInfoUI(user) {
    const nameEl = document.getElementById('admin-sidebar-name');
    const emailEl = document.getElementById('admin-sidebar-email');
    const avatarEl = document.getElementById('admin-sidebar-avatar');

    if (nameEl) nameEl.innerText = user.display_name || user.email.split('@')[0];
    if (emailEl) emailEl.innerText = user.email;
    if (avatarEl) {
        const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=6366F1&color=fff`;
        avatarEl.src = avatarUrl;
    }
}

// ==========================================
// 2. Navigation & Tab Switching
// ==========================================
function setupAdminNavigation() {
    const navLinks = document.querySelectorAll('.admin-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = link.getAttribute('data-tab');
            switchAdminTab(tabName);
        });
    });

    // Bắt hash ban đầu nếu có (VD: admin.html#users)
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && ['overview', 'users', 'projects', 'broadcast', 'settings'].includes(initialHash)) {
        switchAdminTab(initialHash);
    }
}

window.switchAdminTab = function(tabName) {
    // 1. Active nav link
    document.querySelectorAll('.admin-nav-link').forEach(link => {
        if (link.getAttribute('data-tab') === tabName) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 2. Show corresponding pane
    document.querySelectorAll('.admin-tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    const activePane = document.getElementById(`tab-${tabName}`);
    if (activePane) {
        activePane.classList.add('active');
    }

    // 3. Update titles
    const titleMap = {
        overview: { title: 'Bảng điều khiển Quản trị', sub: 'Giám sát tổng quan số liệu và vận hành hệ thống' },
        users: { title: 'Quản lý Sinh viên & Phân quyền', sub: 'Danh sách toàn bộ thành viên, phân quyền Admin và kiểm duyệt' },
        projects: { title: 'Quản lý Dự án Toàn sàn', sub: 'Theo dõi tiến độ, kiểm duyệt nội dung và quản lý trạng thái dự án' },
        broadcast: { title: 'Thông báo Toàn hệ thống', sub: 'Phát sóng tin tức quan trọng tới hòm thư của tất cả sinh viên' },
        settings: { title: 'Cài đặt Nền tảng & Bảo mật', sub: 'Quản lý danh sách Super Admin và thông số cấu hình' },
    };

    const info = titleMap[tabName] || titleMap.overview;
    document.getElementById('admin-page-title').innerText = info.title;
    document.getElementById('admin-page-subtitle').innerText = info.sub;

    window.location.hash = `#${tabName}`;

    // Đóng sidebar trên mobile sau khi click
    closeMobileSidebar();

    // Trigger tải dữ liệu theo từng tab nếu cần
    if (tabName === 'users') fetchAdminUsers(usersState.page);
    if (tabName === 'projects') fetchAdminProjects(projectsState.page);
    if (tabName === 'broadcast') fetchAnnouncementsHistory();
};

function setupMobileSidebar() {
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const btnClose = document.getElementById('btn-close-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    const sidebar = document.getElementById('admin-sidebar');

    if (btnToggle && sidebar && backdrop) {
        btnToggle.addEventListener('click', () => {
            sidebar.classList.add('show');
            backdrop.classList.add('show');
        });
    }

    if (btnClose && sidebar && backdrop) {
        btnClose.addEventListener('click', closeMobileSidebar);
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeMobileSidebar);
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
}

// ==========================================
// 3. Event Handlers & Submissions
// ==========================================
function setupEventHandlers() {
    // Logout
    const btnLogout = document.getElementById('btn-admin-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            const client = await getSupabaseInstance();
            if (client && client.auth) await client.auth.signOut();
            window.location.href = 'index.html';
        });
    }

    // Refresh Data Button
    const btnRefresh = document.getElementById('btn-refresh-admin');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            initAdminData();
            showAdminToast('Đã làm mới dữ liệu hệ thống!', 'success');
        });
    }

    // Users Filter & Search
    const btnFilterUsers = document.getElementById('btn-filter-users');
    if (btnFilterUsers) {
        btnFilterUsers.addEventListener('click', () => {
            usersState.search = document.getElementById('users-search-input').value.trim();
            usersState.role = document.getElementById('users-role-filter').value;
            usersState.status = document.getElementById('users-status-filter').value;
            usersState.page = 1;
            fetchAdminUsers(1);
        });
    }

    const usersSearchInput = document.getElementById('users-search-input');
    if (usersSearchInput) {
        let debounceTimer;
        usersSearchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                usersState.search = e.target.value.trim();
                usersState.page = 1;
                fetchAdminUsers(1);
            }, 400);
        });
    }

    // Users Pagination
    const btnUsersPrev = document.getElementById('btn-users-prev');
    const btnUsersNext = document.getElementById('btn-users-next');
    if (btnUsersPrev) {
        btnUsersPrev.addEventListener('click', () => {
            if (usersState.page > 1) fetchAdminUsers(usersState.page - 1);
        });
    }
    if (btnUsersNext) {
        btnUsersNext.addEventListener('click', () => {
            fetchAdminUsers(usersState.page + 1);
        });
    }

    // Projects Filter & Search
    const btnFilterProjects = document.getElementById('btn-filter-projects');
    if (btnFilterProjects) {
        btnFilterProjects.addEventListener('click', () => {
            projectsState.search = document.getElementById('projects-search-input').value.trim();
            projectsState.status = document.getElementById('projects-status-filter').value;
            projectsState.category = document.getElementById('projects-category-filter').value;
            projectsState.page = 1;
            fetchAdminProjects(1);
        });
    }

    const projectsSearchInput = document.getElementById('projects-search-input');
    if (projectsSearchInput) {
        let debounceTimer;
        projectsSearchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                projectsState.search = e.target.value.trim();
                projectsState.page = 1;
                fetchAdminProjects(1);
            }, 400);
        });
    }

    // Projects Pagination
    const btnProjectsPrev = document.getElementById('btn-projects-prev');
    const btnProjectsNext = document.getElementById('btn-projects-next');
    if (btnProjectsPrev) {
        btnProjectsPrev.addEventListener('click', () => {
            if (projectsState.page > 1) fetchAdminProjects(projectsState.page - 1);
        });
    }
    if (btnProjectsNext) {
        btnProjectsNext.addEventListener('click', () => {
            fetchAdminProjects(projectsState.page + 1);
        });
    }

    // Confirm Delete Project Modal Button
    const btnConfirmDel = document.getElementById('btn-confirm-delete-project');
    if (btnConfirmDel) {
        btnConfirmDel.addEventListener('click', async () => {
            if (!projectToDeleteId) return;
            await executeDeleteProject(projectToDeleteId);
            const modalEl = document.getElementById('modal-confirm-delete-project');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            projectToDeleteId = null;
        });
    }

    // Form Broadcast Announcement
    const formBroadcast = document.getElementById('form-broadcast');
    if (formBroadcast) {
        formBroadcast.addEventListener('submit', async (e) => {
            e.preventDefault();
            await sendBroadcastAnnouncement();
        });
    }
}

// Khởi tạo toàn bộ dữ liệu Admin
function initAdminData() {
    fetchAdminOverview();
    fetchAdminUsers(usersState.page);
    fetchAdminProjects(projectsState.page);
    fetchAnnouncementsHistory();
}

// ==========================================
// 4. Tab 1: Overview & KPI Dashboard
// ==========================================
async function fetchAdminOverview() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${currentAdminToken}` },
        });
        if (!response.ok) throw new Error('Không thể tải dữ liệu thống kê');

        const { overview, categoryDistribution, recentProjects, announcements } = await response.json();

        // Update KPIs
        animateValue('stat-total-users', overview.totalUsers);
        animateValue('stat-total-projects', overview.totalProjects);
        animateValue('stat-done-tasks', overview.doneTasks);
        document.getElementById('stat-matching-rate').innerText = `${overview.matchingSuccessRate}%`;

        document.getElementById('stat-recruiting-projects').innerText = `${overview.recruitingProjects} đang tuyển`;
        document.getElementById('stat-total-tasks').innerText = `/ ${overview.totalTasks} tổng task`;

        // Render Doughnut Chart
        renderCategoryChart(categoryDistribution);

        // Render Recent Projects in Overview
        renderOverviewRecentProjects(recentProjects);

        // Render Active Announcements Preview
        renderOverviewAnnouncements(announcements);

    } catch (err) {
        console.error('[Admin Overview Error]', err);
    }
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    const start = parseInt(obj.innerText.replace(/,/g, ''), 10) || 0;
    if (start === end) {
        obj.innerText = end.toLocaleString('vi-VN');
        return;
    }
    const range = end - start;
    let current = start;
    const stepTime = Math.abs(Math.floor(800 / (range || 1)));
    const timer = setInterval(() => {
        current += range > 0 ? 1 : -1;
        obj.innerText = current.toLocaleString('vi-VN');
        if (current === end) clearInterval(timer);
    }, Math.max(stepTime, 20));
}

function renderCategoryChart(distribution) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const labels = Object.keys(distribution || {});
    const data = Object.values(distribution || {});

    const labelMap = {
        web: 'Web App',
        mobile: 'Mobile App',
        ai: 'AI & Data',
        iot: 'IoT',
        game: 'Game',
        other: 'Khác',
    };

    const formattedLabels = labels.map(l => labelMap[l] || l);

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: formattedLabels.length ? formattedLabels : ['Chưa có dữ liệu'],
            datasets: [{
                data: data.length ? data : [1],
                backgroundColor: [
                    '#6366F1', // Indigo
                    '#10B981', // Emerald
                    '#F59E0B', // Amber
                    '#EC4899', // Pink
                    '#06B6D4', // Cyan
                    '#8B5CF6', // Purple
                ],
                borderWidth: 0,
                hoverOffset: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 14,
                        font: { family: 'Inter', size: 12 },
                    },
                },
            },
            cutout: '70%',
        },
    });
}

function renderOverviewRecentProjects(projects) {
    const tbody = document.getElementById('overview-recent-projects-body');
    if (!tbody) return;

    if (!projects || projects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Chưa có dự án nào.</td></tr>`;
        return;
    }

    const statusBadge = {
        recruiting: '<span class="badge bg-success-soft text-success">Đang tuyển</span>',
        in_progress: '<span class="badge bg-primary-soft text-primary">Đang làm</span>',
        completed: '<span class="badge bg-info-soft text-info">Hoàn thành</span>',
        archived: '<span class="badge bg-secondary-soft text-secondary">Lưu trữ</span>',
    };

    tbody.innerHTML = projects.map(p => `
        <tr>
            <td class="fw-semibold text-truncate" style="max-width: 220px;" title="${escapeHtml(p.title)}">
                <a href="project-detail.html?id=${p.id}" target="_blank" class="text-dark text-decoration-none hover-primary">
                    ${escapeHtml(p.title)}
                </a>
            </td>
            <td><span class="badge bg-light text-secondary text-uppercase">${escapeHtml(p.category || 'other')}</span></td>
            <td>${statusBadge[p.status] || p.status}</td>
            <td style="min-width: 100px;">
                <div class="d-flex align-items-center gap-2">
                    <div class="progress flex-grow-1" style="height: 6px;">
                        <div class="progress-bar bg-primary" role="progressbar" style="width: ${p.progress || 0}%;"></div>
                    </div>
                    <small class="text-secondary fw-semibold">${p.progress || 0}%</small>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderOverviewAnnouncements(announcements) {
    const container = document.getElementById('overview-announcements-list');
    if (!container) return;

    if (!announcements || announcements.length === 0) {
        container.innerHTML = `<div class="text-muted small py-2">Hiện tại không có thông báo toàn sàn nào đang hoạt động.</div>`;
        return;
    }

    const typeIcons = {
        info: '<i class="bi bi-info-circle-fill text-primary"></i>',
        success: '<i class="bi bi-check-circle-fill text-success"></i>',
        warning: '<i class="bi bi-exclamation-triangle-fill text-warning"></i>',
        urgent: '<i class="bi bi-exclamation-octagon-fill text-danger"></i>',
    };

    container.innerHTML = announcements.map(a => `
        <div class="p-3 rounded-3 border bg-light d-flex align-items-start justify-content-between gap-3">
            <div class="d-flex align-items-start gap-2">
                <div class="fs-5 mt-1">${typeIcons[a.type] || typeIcons.info}</div>
                <div>
                    <div class="fw-bold text-dark font-manrope">${escapeHtml(a.title)}</div>
                    <div class="text-secondary small mt-1">${escapeHtml(a.message)}</div>
                    <div class="text-muted small mt-2" style="font-size: 0.75rem;">
                        <i class="bi bi-clock me-1"></i>${formatDateTime(a.createdAt)} • Bởi ${escapeHtml(a.createdBy)}
                    </div>
                </div>
            </div>
            ${a.action_url ? `<a href="${escapeHtml(a.action_url)}" target="_blank" class="btn btn-sm btn-outline-secondary rounded-pill flex-shrink-0">Xem link</a>` : ''}
        </div>
    `).join('');
}

// ==========================================
// 5. Tab 2: Quản lý Sinh viên (Users)
// ==========================================
async function fetchAdminUsers(page = 1) {
    try {
        usersState.page = page;
        const tbody = document.getElementById('users-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Đang tải danh sách người dùng...</td></tr>`;
        }

        const params = new URLSearchParams({
            page: usersState.page,
            pageSize: usersState.pageSize,
            search: usersState.search,
            role: usersState.role,
            status: usersState.status,
        });

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${currentAdminToken}` },
        });

        if (!response.ok) throw new Error('Lỗi truy vấn người dùng');
        const { data: users, pagination } = await response.json();

        usersState.total = pagination.total;
        renderUsersTable(users);
        updateUsersPagination(pagination);

    } catch (err) {
        console.error('[Admin Users Error]', err);
        const tbody = document.getElementById('users-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Lỗi tải danh sách người dùng: ${err.message}</td></tr>`;
        }
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-5">Không tìm thấy người dùng nào phù hợp.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name)}&background=6366F1&color=fff`;
        const roleBadge = u.role === 'admin'
            ? `<span class="badge bg-primary-soft text-primary"><i class="bi bi-shield-check me-1"></i>Admin</span>`
            : `<span class="badge bg-light text-secondary">Sinh viên</span>`;
        
        const statusBadge = u.isBanned
            ? `<span class="badge bg-danger-soft text-danger"><i class="bi bi-slash-circle me-1"></i>Bị khóa</span>`
            : `<span class="badge bg-success-soft text-success"><i class="bi bi-check-circle me-1"></i>Hoạt động</span>`;

        const skillsPills = (u.skills || []).slice(0, 3).map(s => 
            `<span class="badge bg-light text-secondary border me-1">${escapeHtml(s)}</span>`
        ).join('');

        const isSuper = u.isSuperAdmin;

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        <img src="${avatar}" class="rounded-circle border" style="width: 38px; height: 38px; object-fit: cover;" alt="Avatar">
                        <div>
                            <div class="fw-semibold text-dark">${escapeHtml(u.display_name)}</div>
                            <div class="text-muted small">@${escapeHtml(u.username)}</div>
                        </div>
                    </div>
                </td>
                <td class="text-secondary small font-monospace">${escapeHtml(u.email)}</td>
                <td>${skillsPills || '<span class="text-muted small">—</span>'}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td class="text-secondary small">${formatDate(u.createdAt)}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <!-- Nút đổi vai trò (Nếu là Super Admin chính thì disable) -->
                        <button class="btn btn-outline-secondary" title="${u.role === 'admin' ? 'Hạ quyền thành viên' : 'Cấp quyền Admin'}" 
                                onclick="toggleUserRole('${u.id}', '${u.role === 'admin' ? 'user' : 'admin'}')"
                                ${isSuper ? 'disabled title="Super Admin chính"' : ''}>
                            <i class="bi ${u.role === 'admin' ? 'bi-person-dash text-warning' : 'bi-shield-plus text-primary'}"></i>
                        </button>
                        
                        <!-- Nút Khóa / Mở khóa -->
                        <button class="btn btn-outline-secondary" title="${u.isBanned ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}"
                                onclick="toggleUserBan('${u.id}', ${u.isBanned})"
                                ${isSuper ? 'disabled title="Không thể khóa Super Admin"' : ''}>
                            <i class="bi ${u.isBanned ? 'bi-unlock text-success' : 'bi-lock text-danger'}"></i>
                        </button>

                        <!-- Nút Xem chi tiết -->
                        <button class="btn btn-outline-secondary" title="Xem hồ sơ chi tiết" onclick='viewUserDetail(${JSON.stringify(u)})'>
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateUsersPagination(pagination) {
    const info = document.getElementById('users-pagination-info');
    const btnPrev = document.getElementById('btn-users-prev');
    const btnNext = document.getElementById('btn-users-next');

    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

    if (info) {
        info.innerText = pagination.total > 0 ? `Hiển thị ${start} - ${end} trên tổng ${pagination.total} sinh viên` : 'Không có dữ liệu';
    }

    if (btnPrev) btnPrev.disabled = pagination.page <= 1;
    if (btnNext) btnNext.disabled = pagination.page >= pagination.totalPages || pagination.total === 0;
}

window.toggleUserRole = async function(userId, newRole) {
    const confirmMsg = newRole === 'admin'
        ? 'Bạn có chắc chắn muốn NÂNG CẤP người dùng này thành Quản trị viên (Admin)?'
        : 'Bạn có chắc chắn muốn THU HỒI quyền Admin của người dùng này?';

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAdminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: newRole }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lỗi cập nhật vai trò');

        showAdminToast(data.message, 'success');
        fetchAdminUsers(usersState.page);

    } catch (err) {
        showAdminToast(err.message, 'danger');
    }
};

window.toggleUserBan = async function(userId, currentBanned) {
    const willBan = !currentBanned;
    const confirmMsg = willBan
        ? 'Bạn có chắc chắn muốn KHÓA tài khoản này? Người dùng sẽ không thể truy cập hoặc đăng nhập.'
        : 'Bạn có chắc chắn muốn MỞ KHÓA cho tài khoản này?';

    if (!confirm(confirmMsg)) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAdminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ban: willBan }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lỗi cập nhật trạng thái khóa');

        showAdminToast(data.message, willBan ? 'warning' : 'success');
        fetchAdminUsers(usersState.page);

    } catch (err) {
        showAdminToast(err.message, 'danger');
    }
};

window.viewUserDetail = function(u) {
    const modalEl = document.getElementById('modal-user-detail');
    if (!modalEl) return;

    document.getElementById('detail-user-name').innerText = u.display_name;
    document.getElementById('detail-user-email').innerText = u.email;
    document.getElementById('detail-user-username').innerText = `@${u.username}`;
    document.getElementById('detail-user-exp').innerText = u.experience;
    document.getElementById('detail-user-projects').innerText = `${u.projectsCount} dự án làm chủ`;

    const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name)}&background=6366F1&color=fff`;
    document.getElementById('detail-user-avatar').src = avatar;

    const badgesContainer = document.getElementById('detail-user-badges');
    badgesContainer.innerHTML = `
        <span class="badge ${u.role === 'admin' ? 'bg-primary-soft text-primary' : 'bg-light text-secondary'} me-1">${u.role.toUpperCase()}</span>
        <span class="badge ${u.isBanned ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}">${u.isBanned ? 'Đã bị khóa' : 'Hoạt động'}</span>
    `;

    const skillsContainer = document.getElementById('detail-user-skills');
    if (u.skills && u.skills.length > 0) {
        skillsContainer.innerHTML = u.skills.map(s => `<span class="badge bg-primary bg-opacity-10 text-primary">${escapeHtml(s)}</span>`).join('');
    } else {
        skillsContainer.innerHTML = '<span class="text-muted small">Chưa cập nhật kỹ năng</span>';
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

// ==========================================
// 6. Tab 3: Quản lý Dự án (Projects)
// ==========================================
async function fetchAdminProjects(page = 1) {
    try {
        projectsState.page = page;
        const tbody = document.getElementById('projects-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Đang tải danh sách dự án...</td></tr>`;
        }

        const params = new URLSearchParams({
            page: projectsState.page,
            pageSize: projectsState.pageSize,
            search: projectsState.search,
            status: projectsState.status,
            category: projectsState.category,
        });

        const response = await fetch(`/api/admin/projects?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${currentAdminToken}` },
        });

        if (!response.ok) throw new Error('Lỗi tải danh sách dự án');
        const { data: projects, pagination } = await response.json();

        projectsState.total = pagination.total;
        renderProjectsTable(projects);
        updateProjectsPagination(pagination);

    } catch (err) {
        console.error('[Admin Projects Error]', err);
        const tbody = document.getElementById('projects-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Lỗi: ${err.message}</td></tr>`;
        }
    }
}

function renderProjectsTable(projects) {
    const tbody = document.getElementById('projects-table-body');
    if (!tbody) return;

    if (!projects || projects.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-5">Không tìm thấy dự án nào phù hợp.</td></tr>`;
        return;
    }

    tbody.innerHTML = projects.map(p => {
        const cover = p.image_url || `https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=100&q=80`;
        const ownerName = p.owner?.display_name || 'Không rõ';
        const ownerAvatar = p.owner?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=4F46E5&color=fff`;

        const publicBadge = p.is_public
            ? `<span class="badge bg-success-soft text-success"><i class="bi bi-eye me-1"></i>Công khai</span>`
            : `<span class="badge bg-secondary-soft text-secondary"><i class="bi bi-eye-slash me-1"></i>Ẩn</span>`;

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-3">
                        <img src="${cover}" class="rounded-3 border object-fit-cover flex-shrink-0" style="width: 50px; height: 38px;" alt="Cover">
                        <div class="min-w-0" style="max-width: 220px;">
                            <a href="project-detail.html?id=${p.id}" target="_blank" class="fw-bold text-dark text-truncate d-block text-decoration-none hover-primary" title="${escapeHtml(p.title)}">
                                ${escapeHtml(p.title)}
                            </a>
                            <small class="text-muted d-block text-truncate">${escapeHtml(p.description || '')}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <img src="${ownerAvatar}" class="rounded-circle" style="width: 24px; height: 24px; object-fit: cover;">
                        <span class="small fw-medium text-dark">${escapeHtml(ownerName)}</span>
                    </div>
                </td>
                <td><span class="badge bg-light text-secondary text-uppercase">${escapeHtml(p.category || 'Khác')}</span></td>
                <td><span class="small fw-semibold text-secondary"><i class="bi bi-people me-1"></i>${p.membersCount}/${p.max_members || 5}</span></td>
                <td style="min-width: 100px;">
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar bg-success" style="width: ${p.progress || 0}%;"></div>
                    </div>
                    <small class="text-secondary fw-semibold">${p.progress || 0}%</small>
                </td>
                <td>${publicBadge}</td>
                <td>
                    <!-- Dropdown Thay Đổi Trạng Thái Nhanh -->
                    <select class="form-select form-select-sm" style="font-size: 0.8rem; width: auto;" onchange="changeProjectStatus('${p.id}', this.value)">
                        <option value="recruiting" ${p.status === 'recruiting' ? 'selected' : ''}>Đang tuyển</option>
                        <option value="in_progress" ${p.status === 'in_progress' ? 'selected' : ''}>Đang làm</option>
                        <option value="completed" ${p.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                        <option value="archived" ${p.status === 'archived' ? 'selected' : ''}>Lưu trữ</option>
                    </select>
                </td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <!-- Toggle Public -->
                        <button class="btn btn-outline-secondary" title="${p.is_public ? 'Ẩn dự án khỏi trang khám phá' : 'Công khai dự án'}" onclick="toggleProjectPublic('${p.id}', ${p.is_public})">
                            <i class="bi ${p.is_public ? 'bi-eye-slash text-warning' : 'bi-eye text-success'}"></i>
                        </button>

                        <!-- Link Xem Chi Tiết -->
                        <a href="project-detail.html?id=${p.id}" target="_blank" class="btn btn-outline-secondary" title="Xem trang dự án">
                            <i class="bi bi-box-arrow-up-right"></i>
                        </a>

                        <!-- Xóa Dự Án Vi Phạm -->
                        <button class="btn btn-outline-danger" title="Xóa dự án vi phạm / spam" onclick="promptDeleteProject('${p.id}', '${escapeHtml(p.title)}')">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateProjectsPagination(pagination) {
    const info = document.getElementById('projects-pagination-info');
    const btnPrev = document.getElementById('btn-projects-prev');
    const btnNext = document.getElementById('btn-projects-next');

    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

    if (info) {
        info.innerText = pagination.total > 0 ? `Hiển thị ${start} - ${end} trên tổng ${pagination.total} dự án` : 'Không có dữ liệu';
    }

    if (btnPrev) btnPrev.disabled = pagination.page <= 1;
    if (btnNext) btnNext.disabled = pagination.page >= pagination.totalPages || pagination.total === 0;
}

window.changeProjectStatus = async function(projectId, newStatus) {
    try {
        const response = await fetch(`/api/admin/projects/${projectId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${currentAdminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lỗi cập nhật trạng thái');

        showAdminToast('Đã cập nhật trạng thái dự án!', 'success');
        fetchAdminOverview();
    } catch (err) {
        showAdminToast(err.message, 'danger');
    }
};

window.toggleProjectPublic = async function(projectId, currentPublic) {
    try {
        const nextPublic = !currentPublic;
        const response = await fetch(`/api/admin/projects/${projectId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${currentAdminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_public: nextPublic }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lỗi cập nhật hiển thị');

        showAdminToast(nextPublic ? 'Dự án đã được hiển thị công khai!' : 'Dự án đã được ẩn khỏi danh sách công khai.', 'success');
        fetchAdminProjects(projectsState.page);
    } catch (err) {
        showAdminToast(err.message, 'danger');
    }
};

window.promptDeleteProject = function(projectId, projectTitle) {
    projectToDeleteId = projectId;
    document.getElementById('delete-project-title').innerText = `"${projectTitle}"`;
    const modalEl = document.getElementById('modal-confirm-delete-project');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
};

async function executeDeleteProject(projectId) {
    try {
        const response = await fetch(`/api/admin/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentAdminToken}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lỗi xóa dự án');

        showAdminToast(data.message, 'success');
        fetchAdminProjects(projectsState.page);
        fetchAdminOverview();
    } catch (err) {
        showAdminToast(err.message, 'danger');
    }
}

// ==========================================
// 7. Tab 4: Thông báo Toàn sàn (Broadcast)
// ==========================================
async function sendBroadcastAnnouncement() {
    const titleInput = document.getElementById('broadcast-title');
    const messageInput = document.getElementById('broadcast-message');
    const typeSelect = document.getElementById('broadcast-type');
    const urlInput = document.getElementById('broadcast-url');
    const btnSubmit = document.getElementById('btn-send-broadcast');

    const title = titleInput.value.trim();
    const message = messageInput.value.trim();
    const type = typeSelect.value;
    const action_url = urlInput.value.trim();

    if (!title || !message) {
        showAdminToast('Vui lòng điền tiêu đề và nội dung thông báo.', 'warning');
        return;
    }

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Đang phát sóng...`;

        const response = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAdminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, message, type, action_url }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lỗi phát sóng thông báo');

        showAdminToast(data.message, 'success');

        // Reset form
        titleInput.value = '';
        messageInput.value = '';
        urlInput.value = '';

        fetchAnnouncementsHistory();
        fetchAdminOverview();

    } catch (err) {
        showAdminToast(err.message, 'danger');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="bi bi-broadcast"></i> Phát Sóng Thông Báo Ngay`;
    }
}

async function fetchAnnouncementsHistory() {
    try {
        const container = document.getElementById('broadcast-history-list');
        if (!container) return;

        const response = await fetch('/api/admin/announcements', {
            headers: { 'Authorization': `Bearer ${currentAdminToken}` },
        });

        if (!response.ok) throw new Error('Lỗi tải thông báo');
        const { data: items } = await response.json();

        if (!items || items.length === 0) {
            container.innerHTML = `<div class="text-muted text-center py-4">Chưa có thông báo nào được phát sóng.</div>`;
            return;
        }

        const typeBadge = {
            info: '<span class="badge bg-primary text-white">Thông tin</span>',
            success: '<span class="badge bg-success text-white">Tin vui</span>',
            warning: '<span class="badge bg-warning text-dark">Cảnh báo</span>',
            urgent: '<span class="badge bg-danger text-white">Khẩn cấp</span>',
        };

        container.innerHTML = items.map(item => `
            <div class="card p-3 border rounded-3 bg-surface">
                <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div>
                        ${typeBadge[item.type] || typeBadge.info}
                        <h6 class="fw-bold text-dark font-manrope d-inline-block ms-2 mb-0">${escapeHtml(item.title)}</h6>
                    </div>
                    <button class="btn btn-sm btn-outline-danger border-0 p-1" title="Xóa thông báo" onclick="deleteAnnouncement('${item.id}')">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
                <p class="text-secondary small mb-2">${escapeHtml(item.message)}</p>
                <div class="d-flex justify-content-between align-items-center small text-muted">
                    <span><i class="bi bi-clock me-1"></i>${formatDateTime(item.createdAt)} • Bởi ${escapeHtml(item.createdBy)}</span>
                    ${item.action_url ? `<a href="${escapeHtml(item.action_url)}" target="_blank" class="text-primary text-decoration-none small">Xem link liên kết <i class="bi bi-box-arrow-up-right ms-1"></i></a>` : ''}
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('[Admin Broadcast Error]', err);
    }
}

window.deleteAnnouncement = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;
    try {
        const response = await fetch(`/api/admin/announcements/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentAdminToken}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Lỗi xóa thông báo');

        showAdminToast(data.message, 'success');
        fetchAnnouncementsHistory();
        fetchAdminOverview();
    } catch (err) {
        showAdminToast(err.message, 'danger');
    }
};

// ==========================================
// 8. Toast Helper
// ==========================================
function showAdminToast(message, type = 'success') {
    const toastEl = document.getElementById('admin-toast');
    const toastBody = document.getElementById('admin-toast-body');
    if (!toastEl || !toastBody) return;

    const iconMap = {
        success: '<i class="bi bi-check-circle-fill text-success fs-5"></i>',
        warning: '<i class="bi bi-exclamation-triangle-fill text-warning fs-5"></i>',
        danger: '<i class="bi bi-x-circle-fill text-danger fs-5"></i>',
    };

    toastBody.innerHTML = `
        ${iconMap[type] || iconMap.success}
        <span class="text-dark">${escapeHtml(message)}</span>
    `;

    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
}

// Utilities
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch {
        return dateStr;
    }
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}
