/**
 * Main Application Script for ProjectHub
 * Handles initialization, routing/auth guards, UI components, and generic utilities.
 */

const STORAGE_KEYS = {
    USERS: 'ph_users',
    CURRENT_USER: 'ph_current_user',
    PROJECTS: 'ph_projects',
    TASKS: 'ph_tasks',
    MESSAGES: 'ph_messages',
    NOTIFICATIONS: 'ph_notifications',
    SETTINGS: 'ph_settings'
};

const PROTECTED_PAGES = ['dashboard.html', 'workspace.html', 'create-project.html', 'edit-project.html', 'profile.html', 'portfolio.html'];

// ============================================================
// ============================================================
// THEME MANAGEMENT (DARK / LIGHT MODE & DAY-NIGHT SWITCH 2)
// ============================================================
function getSavedTheme() {
    const saved = localStorage.getItem('ph_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Tạo markup chuẩn cho thanh trượt Day-Night Switch 2 (hoạt ảnh mặt trời/mặt trăng, mây & sao)
 */
function getThemeSwitchHTML(isDark) {
    return `
        <label class="theme-switch" title="${isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}" aria-label="Chuyển chế độ Sáng / Tối">
            <input type="checkbox" class="theme-switch__checkbox" ${isDark ? 'checked' : ''}>
            <div class="theme-switch__container">
                <div class="theme-switch__clouds"></div>
                <div class="theme-switch__stars-container">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 55" fill="none">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z" fill="currentColor"></path>
                    </svg>
                </div>
                <div class="theme-switch__circle-container">
                    <div class="theme-switch__sun-moon-container">
                        <div class="theme-switch__moon">
                            <div class="theme-switch__spot"></div>
                            <div class="theme-switch__spot"></div>
                            <div class="theme-switch__spot"></div>
                        </div>
                    </div>
                </div>
            </div>
        </label>
    `;
}

function initTheme() {
    const theme = getSavedTheme();
    document.documentElement.setAttribute('data-theme', theme);
    syncThemeToggleButtons(theme);
}

function syncThemeToggleButtons(theme) {
    const isDark = theme === 'dark';
    document.querySelectorAll('.theme-switch__checkbox').forEach(cb => {
        cb.checked = isDark;
    });
    document.querySelectorAll('.theme-switch').forEach(el => {
        el.setAttribute('title', isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối');
        el.setAttribute('aria-label', isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối');
    });
    document.querySelectorAll('.btn-theme-toggle').forEach(btn => {
        btn.setAttribute('title', isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối');
        btn.setAttribute('aria-label', isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối');
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ph_theme', theme);
    syncThemeToggleButtons(theme);

    if (typeof showToast === 'function') {
        showToast(theme === 'dark' ? 'Đã bật Giao diện Tối 🌙' : 'Đã bật Giao diện Sáng ☀️', 'info', 1500);
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
}

// Bắt sự kiện thay đổi trực tiếp từ Day-Night Switch
document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('theme-switch__checkbox')) {
        const next = e.target.checked ? 'dark' : 'light';
        setTheme(next);
    }
});

window.initTheme = initTheme;
window.setTheme = setTheme;
window.toggleTheme = toggleTheme;
window.getThemeSwitchHTML = getThemeSwitchHTML;

// Chạy khởi tạo theme ngay lập tức để chống FOUC (nhấp nháy trắng khi chuyển trang)
initTheme();

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // 1. Inject Footer and Modals IMMEDIATELY so all modals & footer buttons work instantly without waiting for network/auth
    try {
        renderFooter();
    } catch (e) {
        console.warn('Footer render error:', e);
    }

    // 2. Auth Guard
    const isAuthorized = await checkAuthGuard();
    if (!isAuthorized) return;

    // 3. Inject Navbar
    try {
        await renderNavbar();
    } catch (e) {
        console.warn('Navbar render error:', e);
    }

    // 4. Setup UI interactivity
    try {
        await initNotifications();
    } catch (e) {
        console.warn('Notifications init error:', e);
    }
    setupMobileNav();
    setActiveNavLink();
    initGlobalSidebarToggle();
    initGlassDeckInteractivity();
    initAccordionTimeline();

    // Listen to real auth state changes
    if (typeof onAuthStateChange === 'function') {
        onAuthStateChange(async (event) => {
            if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                await renderNavbar();
                await initNotifications();
            }
        });
    }
}

/**
 * Validates if the current page requires authentication and if the user is logged in.
 * Redirects to login page if unauthorized.
 * @returns {Promise<boolean>} True if authorized or public page, false otherwise.
 */
async function checkAuthGuard() {
    const pathname = window.location.pathname;
    const currentPage = pathname === '/' || pathname === '' ? 'index.html' : pathname.split('/').pop() || 'index.html';
    
    const isProtected = PROTECTED_PAGES.some(p => currentPage.includes(p));
    if (!isProtected) return true;

    // Public view: cho phép khách truy cập xem Portfolio hoặc Profile công khai của người khác
    const urlParams = new URLSearchParams(window.location.search);
    const hasTargetUser = Boolean(urlParams.get('user') || urlParams.get('id'));
    if ((currentPage.includes('portfolio.html') || currentPage.includes('profile.html')) && hasTargetUser) {
        return true;
    }

    // Kiểm tra Supabase session thật
    if (typeof getCurrentSession === 'function') {
        const session = await getCurrentSession();
        if (!session) {
            window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
            return false;
        }
        return true;
    }

    return true;
}

// --- LocalStorage Helpers (cho UI state/cache phụ) ---

function getFromStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error(`Error reading ${key} from storage:`, e);
        return null;
    }
}

function setToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Error writing ${key} to storage:`, e);
    }
}

// --- UI Components ---

async function renderNavbar() {
    const navbarPlaceholder = document.getElementById('navbar-placeholder');
    if (!navbarPlaceholder) return;

    let user = null;
    if (typeof getCurrentProfile === 'function') {
        user = await getCurrentProfile();
    }
    if (!user && typeof getCurrentUser === 'function') {
        const authUser = await getCurrentUser();
        if (authUser) {
            user = {
                id: authUser.id,
                email: authUser.email,
                full_name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
                avatar_url: authUser.user_metadata?.avatar_url,
            };
        }
    }

    let userMenuHTML = '';
    
    if (user) {
        const unreadCount = await getUnreadCount();
        const badgeHTML = unreadCount > 0 ? `<span class="badge bg-danger rounded-circle position-absolute top-0 start-100 translate-middle p-1"><span class="visually-hidden">unread messages</span></span>` : '';
        const rawName = user.full_name || user.display_name || user.name || 'Người dùng';
        const displayName = sanitizeHTML(rawName);
        const avatarSrc = user.avatar_url || user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=4F46E5&color=fff&size=128`;

        const isDark = (document.documentElement.getAttribute('data-theme') || getSavedTheme()) === 'dark';
        const switchHTML = getThemeSwitchHTML(isDark);

        const isAdminUser = (user.email && user.email.toLowerCase().trim() === 'lamasono80@gmail.com') ||
                            user.role === 'admin' ||
                            user.is_admin === true ||
                            (user.app_metadata && user.app_metadata.role === 'admin');

        userMenuHTML = `
            <div class="navbar-user-profile d-flex align-items-center gap-3">
                ${switchHTML}

                <div class="dropdown">
                    <button class="btn btn-link text-dark position-relative p-0" id="notificationDropdown" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Thông báo">
                        <i class="bi bi-bell fs-5"></i>
                        ${badgeHTML}
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm p-0 notification-dropdown" aria-labelledby="notificationDropdown" id="notification-menu">
                        <!-- Notifications injected here via initNotifications() -->
                    </ul>
                </div>
                
                <div class="dropdown">
                    <a href="#" class="d-flex align-items-center text-decoration-none dropdown-toggle" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                        <img src="${avatarSrc}" alt="${displayName}" width="32" height="32" class="rounded-circle me-2" style="object-fit: cover;" onerror="this.src='https://ui-avatars.com/api/?name=User&background=4F46E5&color=fff&size=128'">
                        <span class="text-dark fw-medium user-name-label">${displayName}</span>
                    </a>
                    <ul class="dropdown-menu dropdown-menu-end shadow-sm text-small" aria-labelledby="userDropdown">
                        ${isAdminUser ? `
                        <li><a class="dropdown-item fw-semibold text-primary" href="admin.html"><i class="bi bi-shield-lock-fill me-2"></i> Trang Quản trị (Admin)</a></li>
                        <li><hr class="dropdown-divider"></li>
                        ` : ''}
                        <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person me-2"></i> Hồ sơ của tôi</a></li>
                        <li><a class="dropdown-item" href="dashboard.html"><i class="bi bi-speedometer2 me-2"></i> Dashboard</a></li>
                        <li><a class="dropdown-item" href="portfolio.html"><i class="bi bi-briefcase me-2"></i> Portfolio</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" id="logout-btn"><i class="bi bi-box-arrow-right me-2"></i> Đăng xuất</a></li>
                    </ul>
                </div>
            </div>
        `;
    } else {
        const isDark = (document.documentElement.getAttribute('data-theme') || getSavedTheme()) === 'dark';
        const switchHTML = getThemeSwitchHTML(isDark);

        userMenuHTML = `
            <div class="navbar-auth-buttons d-flex align-items-center gap-2">
                ${switchHTML}
                <a href="login.html" class="btn btn-outline-primary">Đăng nhập</a>
                <a href="register.html" class="btn btn-primary">Đăng ký</a>
            </div>
        `;
    }

    navbarPlaceholder.innerHTML = `
        <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top py-3 navbar-projecthub">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center fw-bold text-primary" href="index.html">
                    <i class="bi bi-hexagon-fill fs-3 me-2"></i>
                    ProjectHub
                </a>
                <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar" aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="mainNavbar">
                    <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-4 gap-lg-3">
                        <li class="nav-item">
                            <a class="nav-link" href="index.html">Trang chủ</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="projects.html">Khám phá dự án</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="matching.html">Tìm thành viên</a>
                        </li>
                        ${user ? `
                        <li class="nav-item">
                            <a class="nav-link" href="workspace.html">Workspace</a>
                        </li>
                        ` : ''}
                    </ul>
                    ${userMenuHTML}
                </div>
            </div>
        </nav>
    `;

    // Đồng bộ trạng thái nút gạt sáng tối
    if (typeof syncThemeToggleButtons === 'function') {
        syncThemeToggleButtons(document.documentElement.getAttribute('data-theme') || 'light');
    }

    // Logout event gắn trực tiếp vào logout() của auth.js
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof logout === 'function') {
                logout();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    // Khởi tạo hệ thống thông báo Realtime
    if (user) {
        if (window.ProjectHubNotifications && typeof window.ProjectHubNotifications.initNotificationSystem === 'function') {
            window.ProjectHubNotifications.initNotificationSystem();
        } else {
            initNotifications();
        }
    }
}

function openProjectHubModal(targetId) {
    if (!targetId) return;
    const modalEl = typeof targetId === 'string' ? document.querySelector(targetId) : targetId;
    if (!modalEl) {
        console.warn('[Modal] Không tìm thấy modal:', targetId);
        return;
    }

    // Đảm bảo modal nằm ở root level của body để không bị kẹt stacking context của container cha
    let container = document.getElementById('projecthub-global-modals');
    if (!container) {
        container = document.createElement('div');
        container.id = 'projecthub-global-modals';
        document.body.appendChild(container);
    }
    if (modalEl.parentElement !== container) {
        container.appendChild(modalEl);
    }

    // Luôn áp dụng hiển thị trực tiếp để modal chắc chắn mở ra ngay lập tức
    modalEl.style.display = 'block';
    modalEl.style.zIndex = '1060';
    modalEl.removeAttribute('aria-hidden');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('role', 'dialog');
    document.body.classList.add('modal-open');
    modalEl.classList.add('show');

    // Bắt sự kiện click ra ngoài dialog để đóng modal
    modalEl.onclick = (e) => {
        if (e.target === modalEl) {
            closeProjectHubModal(modalEl);
        }
    };

    // Tạo hoặc hiển thị backdrop lớp mờ
    let backdrop = document.querySelector('.modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        backdrop.style.zIndex = '1050';
        backdrop.style.display = 'block';
        document.body.appendChild(backdrop);
        backdrop.onclick = () => closeProjectHubModal(modalEl);
    } else {
        backdrop.classList.add('show');
        backdrop.style.display = 'block';
        backdrop.onclick = () => closeProjectHubModal(modalEl);
    }

    // Đồng bộ với Bootstrap Modal API nếu có
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl, { backdrop: false });
        } catch (err) {
            console.warn('[Modal] Bootstrap sync info:', err);
        }
    }
}

function closeProjectHubModal(modalEl) {
    if (!modalEl) {
        modalEl = document.querySelector('#projecthub-global-modals .modal.show, .modal.show');
    }
    if (!modalEl) return;

    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.removeAttribute('aria-modal');

    // Nếu không còn modal nào mở thì xóa backdrop và class modal-open trên body
    const remainingModals = document.querySelectorAll('#projecthub-global-modals .modal.show, .modal.show');
    if (remainingModals.length === 0) {
        document.body.classList.remove('modal-open');
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
    }

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        try {
            const inst = bootstrap.Modal.getInstance(modalEl);
            if (inst && typeof inst.hide === 'function') {
                inst.hide();
            }
        } catch (e) {}
    }
}

// Bắt phím Escape để đóng modal đang mở
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('#projecthub-global-modals .modal.show, .modal.show');
        if (activeModal) {
            closeProjectHubModal(activeModal);
        }
    }
});

// Export ra window để mọi script đều có thể gọi
window.openProjectHubModal = openProjectHubModal;
window.closeProjectHubModal = closeProjectHubModal;

// Trình bắt sự kiện Delegated Listener toàn cục cho TẤT CẢ các modal popup
document.addEventListener('click', (e) => {
    // 1. Mở modal khi bấm vào link/nút có data-bs-target, data-bs-toggle="modal", hoặc href trỏ tới modal
    const trigger = e.target.closest('[data-bs-toggle="modal"], [data-bs-target], a[href^="#"]');
    if (trigger) {
        const targetSelector = trigger.getAttribute('data-bs-target') || trigger.getAttribute('href');
        if (targetSelector && targetSelector.startsWith('#') && targetSelector.length > 1) {
            try {
                const targetModal = document.querySelector(targetSelector);
                if (targetModal && (targetModal.classList.contains('modal') || targetModal.id.includes('modal') || targetModal.id.includes('Modal'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    openProjectHubModal(targetModal);
                    return;
                }
            } catch (err) {}
        }
    }

    // 2. Đóng modal khi bấm nút dismiss hoặc nút x
    const closeBtn = e.target.closest('[data-bs-dismiss="modal"]');
    if (closeBtn) {
        const modal = closeBtn.closest('.modal') || document.querySelector('#projecthub-global-modals .modal.show, .modal.show');
        if (modal) {
            e.preventDefault();
            closeProjectHubModal(modal);
        }
        return;
    }

    // 3. Đảm bảo click logo ProjectHub luôn luôn điều hướng về trang chủ index.html
    const brandTrigger = e.target.closest('.navbar-brand, .sidebar-brand a');
    if (brandTrigger) {
        const href = brandTrigger.getAttribute('href');
        if (href && (href === 'index.html' || href === '/' || href.includes('index.html'))) {
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            if (currentPage === 'index.html' || currentPage === '') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                // Chuyển trang về index.html
                window.location.href = 'index.html';
            }
            return;
        }
    }

    // 4. Bắt sự kiện nút gạt giao diện Sáng / Tối (Theme Toggle)
    const themeBtn = e.target.closest('#theme-toggle-btn, .btn-theme-toggle');
    if (themeBtn) {
        e.preventDefault();
        toggleTheme();
        return;
    }
});

// Hỗ trợ phím Escape đóng modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('#projecthub-global-modals .modal.show, .modal.show');
        if (openModal) {
            closeProjectHubModal(openModal);
        }
    }
});

function renderFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;
    
    // 1. Render khung footer chính vào #footer-placeholder
    footerPlaceholder.innerHTML = `
        <footer class="bg-light pt-5 pb-4 border-top mt-auto">
            <div class="container">
                <div class="row gy-4">
                    <div class="col-lg-4 col-md-6">
                        <h5 class="fw-bold text-primary d-flex align-items-center mb-3">
                            <i class="bi bi-hexagon-fill me-2"></i> ProjectHub
                        </h5>
                        <p class="text-muted">Nền tảng kết nối sinh viên IT, tìm kiếm đồng đội và quản lý dự án học tập chuyên nghiệp.</p>
                        <div class="d-flex gap-2 mt-3 align-items-center">
                            <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" class="footer-social-link social-fb" data-social="facebook" title="Facebook - Kết nối cộng đồng" aria-label="Facebook">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z"/>
                                </svg>
                            </a>
                            <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="footer-social-link social-gh" data-social="github" title="GitHub - Kho mã nguồn mở" aria-label="GitHub">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                                </svg>
                            </a>
                            <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" class="footer-social-link social-in" data-social="linkedin" title="LinkedIn - Mạng lưới nghề nghiệp" aria-label="LinkedIn">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                    <div class="col-lg-2 col-md-3 col-6">
                        <h6 class="fw-bold mb-3">Khám phá</h6>
                        <ul class="list-unstyled mb-0 d-flex flex-column gap-2">
                            <li><a href="projects.html" class="footer-hover-link">Dự án mới</a></li>
                            <li><a href="matching.html" class="footer-hover-link">Tìm đồng đội</a></li>
                            <li><a href="portfolio.html" class="footer-hover-link">Thành tựu</a></li>
                        </ul>
                    </div>
                    <div class="col-lg-2 col-md-3 col-6">
                        <h6 class="fw-bold mb-3">Hỗ trợ</h6>
                        <ul class="list-unstyled mb-0 d-flex flex-column gap-2">
                            <li><a href="guide.html" class="footer-hover-link">Hướng dẫn</a></li>
                            <li><a href="faq.html" class="footer-hover-link">FAQ</a></li>
                            <li><a href="contact.html" class="footer-hover-link">Liên hệ</a></li>
                        </ul>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <h6 class="fw-bold mb-3">Đăng ký nhận tin</h6>
                        <p class="text-muted small">Nhận thông báo về các dự án mới hấp dẫn hàng tuần.</p>
                        <form id="footer-newsletter-form" class="input-group mb-3">
                            <input type="email" id="footer-newsletter-email" class="form-control" placeholder="Email sinh viên của bạn..." required>
                            <button class="btn btn-primary px-3" type="submit" id="footer-subscribe-btn">Gửi</button>
                        </form>
                    </div>
                </div>
                <hr class="my-4 text-muted">
                <div class="row align-items-center">
                    <div class="col-md-6 text-center text-md-start">
                        <p class="text-muted small mb-0">&copy; ${new Date().getFullYear()} ProjectHub. All rights reserved.</p>
                    </div>
                    <div class="col-md-6 text-center text-md-end mt-2 mt-md-0">
                        <ul class="list-inline mb-0">
                            <li class="list-inline-item"><a href="terms.html" class="footer-hover-link small">Điều khoản</a></li>
                            <li class="list-inline-item"><span class="text-muted mx-1">·</span></li>
                            <li class="list-inline-item"><a href="privacy.html" class="footer-hover-link small">Bảo mật</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </footer>
    `;

    // 2. Render tất cả Modal trực tiếp vào root document.body để tuyệt đối không bị kẹt backdrop hay layout
    let modalsContainer = document.getElementById('projecthub-global-modals');
    if (!modalsContainer) {
        modalsContainer = document.createElement('div');
        modalsContainer.id = 'projecthub-global-modals';
        document.body.appendChild(modalsContainer);
    }

    modalsContainer.innerHTML = `
        <!-- MODAL 1: HƯỚNG DẪN SỬ DỤNG -->
        <div class="modal fade" id="modal-guide" tabindex="-1" aria-labelledby="modalGuideLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-header border-bottom py-3">
                        <h5 class="modal-title fw-bold text-primary d-flex align-items-center" id="modalGuideLabel">
                            <i class="bi bi-book-half me-2"></i> Hướng dẫn sử dụng ProjectHub
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <p class="text-muted mb-4">Chào mừng bạn đến với <strong>ProjectHub</strong> — Nền tảng kết nối sinh viên liên ngành, tìm kiếm đồng đội và quản lý dự án học tập chuyên nghiệp.</p>
                        
                        <div class="row g-3">
                            <div class="col-md-6">
                                <div class="p-3 border rounded-3 h-100 bg-light-subtle">
                                    <div class="d-flex align-items-center gap-2 mb-2">
                                        <span class="badge bg-primary text-white rounded-circle p-2" style="width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;">1</span>
                                        <h6 class="fw-bold mb-0">Tạo tài khoản & Kỹ năng</h6>
                                    </div>
                                    <p class="small text-muted mb-0">Đăng ký tài khoản, cập nhật chuyên ngành (CNTT, Thiết kế, Kinh tế...) và các kỹ năng công nghệ (Skills) để hệ thống tự động gợi ý bạn với các dự án phù hợp.</p>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 border rounded-3 h-100 bg-light-subtle">
                                    <div class="d-flex align-items-center gap-2 mb-2">
                                        <span class="badge bg-primary text-white rounded-circle p-2" style="width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;">2</span>
                                        <h6 class="fw-bold mb-0">Khám phá & Gia nhập</h6>
                                    </div>
                                    <p class="small text-muted mb-0">Truy cập trang "Dự án", lọc theo công nghệ hoặc độ khó. Chọn dự án bạn yêu thích và bấm <strong>Gửi yêu cầu tham gia</strong> kèm vai trò mong muốn.</p>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 border rounded-3 h-100 bg-light-subtle">
                                    <div class="d-flex align-items-center gap-2 mb-2">
                                        <span class="badge bg-primary text-white rounded-circle p-2" style="width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;">3</span>
                                        <h6 class="fw-bold mb-0">Tạo dự án & Tuyển quân</h6>
                                    </div>
                                    <p class="small text-muted mb-0">Bạn có ý tưởng mới? Vào trang <strong>Tạo dự án mới</strong>, phân chia các vị trí cần tuyển theo chuyên ngành và liên kết mã nguồn GitHub để thu hút thành viên.</p>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 border rounded-3 h-100 bg-light-subtle">
                                    <div class="d-flex align-items-center gap-2 mb-2">
                                        <span class="badge bg-primary text-white rounded-circle p-2" style="width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;">4</span>
                                        <h6 class="fw-bold mb-0">Làm việc trên Workspace</h6>
                                    </div>
                                    <p class="small text-muted mb-0">Khi nhóm được duyệt, cùng nhau quản trị công việc trên bảng <strong>Kanban Workspace</strong>, chat thời gian thực và xây dựng Portfolio hoàn chỉnh.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top py-2 d-flex justify-content-between">
                        <a href="projects.html" class="btn btn-outline-primary px-3 btn-sm rounded-3">
                            <i class="bi bi-compass me-1"></i> Khám phá dự án ngay
                        </a>
                        <button type="button" class="btn btn-primary px-4 btn-sm rounded-3" data-bs-dismiss="modal">Đã hiểu</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 2: FAQ (CÂU HỎI THƯỜNG GẶP) -->
        <div class="modal fade" id="modal-faq" tabindex="-1" aria-labelledby="modalFaqLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-header border-bottom py-3">
                        <h5 class="modal-title fw-bold text-primary d-flex align-items-center" id="modalFaqLabel">
                            <i class="bi bi-question-circle-fill text-warning me-2"></i> Câu hỏi thường gặp (FAQ)
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="accordion accordion-flush" id="faqAccordion">
                            <div class="accordion-item border rounded-3 mb-2 overflow-hidden">
                                <h2 class="accordion-header">
                                    <button class="accordion-button fw-bold collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                                        1. ProjectHub là gì và ai có thể tham gia?
                                    </button>
                                </h2>
                                <div id="faq1" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                    <div class="accordion-body text-muted small">
                                        ProjectHub là nền tảng kết nối sinh viên liên ngành (CNTT, Thiết kế đồ họa, Kinh tế, AI, Marketing...) để cùng làm việc nhóm trên các dự án học tập, đồ án tốt nghiệp, NCKH và startup. Nền tảng mở cửa hoàn toàn miễn phí cho tất cả sinh viên.
                                    </div>
                                </div>
                            </div>

                            <div class="accordion-item border rounded-3 mb-2 overflow-hidden">
                                <h2 class="accordion-header">
                                    <button class="accordion-button fw-bold collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                                        2. Làm sao để gửi yêu cầu gia nhập một dự án?
                                    </button>
                                </h2>
                                <div id="faq2" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                    <div class="accordion-body text-muted small">
                                        Bạn đăng nhập vào hệ thống, vào trang <strong>Dự án</strong> và nhấn xem chi tiết dự án bạn muốn tham gia. Nếu dự án đang ở trạng thái <em>Đang tuyển</em>, hãy bấm nút <strong>Tham gia dự án</strong>, chọn vị trí (Frontend, Backend, UI/UX...) và gửi lời nhắn. Chủ dự án sẽ nhận được thông báo ngay lập tức.
                                    </div>
                                </div>
                            </div>

                            <div class="accordion-item border rounded-3 mb-2 overflow-hidden">
                                <h2 class="accordion-header">
                                    <button class="accordion-button fw-bold collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                                        3. Tôi có thể tạo tối đa bao nhiêu dự án?
                                    </button>
                                </h2>
                                <div id="faq3" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                    <div class="accordion-body text-muted small">
                                        ProjectHub không giới hạn số lượng dự án bạn tạo. Tuy nhiên, để đảm bảo chất lượng và khả năng hoàn thiện của các sản phẩm, chúng tôi khuyến khích bạn tập trung vào 1 đến 2 dự án cùng một lúc.
                                    </div>
                                </div>
                            </div>

                            <div class="accordion-item border rounded-3 mb-2 overflow-hidden">
                                <h2 class="accordion-header">
                                    <button class="accordion-button fw-bold collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq4">
                                        4. Tính năng AI Ghép đội (Matching) hoạt động thế nào?
                                    </button>
                                </h2>
                                <div id="faq4" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                    <div class="accordion-body text-muted small">
                                        Thuật toán của ProjectHub tự động tính toán độ tương đồng giữa các kỹ năng công nghệ (skills) và sở thích của bạn với các vị trí còn trống trong các dự án. Điểm phù hợp (Match Score) giúp bạn tìm thấy người bạn đồng hành ăn ý nhất.
                                    </div>
                                </div>
                            </div>

                            <div class="accordion-item border rounded-3 mb-2 overflow-hidden">
                                <h2 class="accordion-header">
                                    <button class="accordion-button fw-bold collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq5">
                                        5. Kết nối GitHub Repository có an toàn không?
                                    </button>
                                </h2>
                                <div id="faq5" class="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                    <div class="accordion-body text-muted small">
                                        Tuyệt đối an toàn. ProjectHub chỉ truy xuất các thông tin công khai (Public Repo Info) như số sao ⭐, ngôn ngữ lập trình chính và trạng thái commit để hiển thị minh bạch cho các thành viên xem trước. Chúng tôi không bao giờ can thiệp vào mã nguồn riêng tư của bạn.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top py-2">
                        <button type="button" class="btn btn-primary px-4 btn-sm rounded-3" data-bs-dismiss="modal">Đóng</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 3: LIÊN HỆ & HỖ TRỢ -->
        <div class="modal fade" id="modal-contact" tabindex="-1" aria-labelledby="modalContactLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-header border-bottom py-3">
                        <h5 class="modal-title fw-bold text-primary d-flex align-items-center" id="modalContactLabel">
                            <i class="bi bi-headset text-info me-2"></i> Trung tâm Hỗ trợ & Liên hệ
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="row g-4">
                            <div class="col-md-5 border-end">
                                <h6 class="fw-bold mb-3">Thông tin kết nối</h6>
                                <p class="text-muted small">Đội ngũ hỗ trợ ProjectHub luôn sẵn sàng lắng nghe các phản hồi, báo lỗi hoặc đề xuất hợp tác.</p>
                                
                                <div class="d-flex flex-column gap-3 mt-3">
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="avatar bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center" style="width:36px;height:36px;"><i class="bi bi-envelope-fill"></i></div>
                                        <div>
                                            <small class="text-muted d-block">Email hỗ trợ</small>
                                            <a href="mailto:support@projecthub.edu.vn" class="fw-medium text-dark text-decoration-none small">support@projecthub.edu.vn</a>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="avatar bg-success-subtle text-success rounded-circle d-flex align-items-center justify-content-center" style="width:36px;height:36px;"><i class="bi bi-geo-alt-fill"></i></div>
                                        <div>
                                            <small class="text-muted d-block">Địa điểm hỗ trợ</small>
                                            <span class="fw-medium text-dark small">Không gian Sáng tạo & Khởi nghiệp Sinh viên</span>
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="avatar bg-warning-subtle text-warning rounded-circle d-flex align-items-center justify-content-center" style="width:36px;height:36px;"><i class="bi bi-clock-fill"></i></div>
                                        <div>
                                            <small class="text-muted d-block">Thời gian phản hồi</small>
                                            <span class="fw-medium text-dark small">8:00 - 18:00 (Thứ 2 - Thứ 7)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-7">
                                <h6 class="fw-bold mb-3">Gửi tin nhắn trực tiếp</h6>
                                <form id="footer-contact-form">
                                    <div class="mb-2">
                                        <label class="form-label small fw-medium">Họ và tên <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control form-control-sm" id="cf-name" required placeholder="Nguyễn Văn A">
                                    </div>
                                    <div class="mb-2">
                                        <label class="form-label small fw-medium">Email của bạn <span class="text-danger">*</span></label>
                                        <input type="email" class="form-control form-control-sm" id="cf-email" required placeholder="student@university.edu.vn">
                                    </div>
                                    <div class="mb-2">
                                        <label class="form-label small fw-medium">Chủ đề</label>
                                        <select class="form-select form-select-sm" id="cf-topic">
                                            <option value="bug">Báo lỗi giao diện / chức năng</option>
                                            <option value="feature">Góp ý / Đề xuất tính năng mới</option>
                                            <option value="club">Hợp tác câu lạc bộ / Đoàn khoa</option>
                                            <option value="other">Hỏi đáp khác</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label small fw-medium">Nội dung tin nhắn <span class="text-danger">*</span></label>
                                        <textarea class="form-control form-control-sm" id="cf-message" rows="3" required placeholder="Mô tả chi tiết nội dung bạn cần hỗ trợ..."></textarea>
                                    </div>
                                    <button type="submit" class="btn btn-primary btn-sm w-100 fw-bold rounded-3">
                                        <i class="bi bi-send me-1"></i> Gửi yêu cầu hỗ trợ
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 4: ĐIỀU KHOẢN SỬ DỤNG -->
        <div class="modal fade" id="modal-terms" tabindex="-1" aria-labelledby="modalTermsLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-header border-bottom py-3">
                        <h5 class="modal-title fw-bold text-primary d-flex align-items-center" id="modalTermsLabel">
                            <i class="bi bi-file-earmark-text-fill text-secondary me-2"></i> Điều khoản dịch vụ ProjectHub
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="d-flex flex-column gap-3 small text-secondary">
                            <div>
                                <h6 class="fw-bold text-dark">1. Chấp thuận điều khoản</h6>
                                <p class="mb-0">Bằng việc đăng ký tài khoản và sử dụng ProjectHub, bạn đồng ý tuân thủ các quy định dưới đây nhằm xây dựng môi trường học thuật văn minh, tích cực và tôn trọng lẫn nhau.</p>
                            </div>
                            <div>
                                <h6 class="fw-bold text-dark">2. Quyền sở hữu trí tuệ & Mã nguồn</h6>
                                <p class="mb-0">Toàn bộ mã nguồn, tài liệu thiết kế và ý tưởng sản phẩm do sinh viên phát triển hoàn toàn thuộc quyền sở hữu của các thành viên trực tiếp tham gia dự án. ProjectHub không sở hữu và không yêu cầu bất kỳ bản quyền thương mại nào đối với sản phẩm của bạn.</p>
                            </div>
                            <div>
                                <h6 class="fw-bold text-dark">3. Quy tắc ứng xử & Tiêu chuẩn cộng đồng</h6>
                                <p class="mb-0">Thành viên tham gia phải cam kết thái độ hợp tác nghiêm túc, không sử dụng ngôn từ kích động, quấy rối hoặc phân biệt đối xử. Mọi hành vi đạo văn, gian lận học thuật hoặc phát tán mã độc sẽ bị khóa tài khoản vĩnh viễn.</p>
                            </div>
                            <div>
                                <h6 class="fw-bold text-dark">4. Trách nhiệm của thành viên và chủ dự án</h6>
                                <p class="mb-0">Chủ dự án có quyền xét duyệt, phân công và quản lý tiến độ của nhóm. Thành viên tham gia có trách nhiệm hoàn thành đúng hạn các nhiệm vụ được giao trên bảng Kanban hoặc thông báo kịp thời cho nhóm khi có trở ngại.</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top py-2">
                        <button type="button" class="btn btn-primary px-4 btn-sm rounded-3" data-bs-dismiss="modal">Tôi đồng ý</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- MODAL 5: CHÍNH SÁCH BẢO MẬT -->
        <div class="modal fade" id="modal-privacy" tabindex="-1" aria-labelledby="modalPrivacyLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg rounded-4">
                    <div class="modal-header border-bottom py-3">
                        <h5 class="modal-title fw-bold text-primary d-flex align-items-center" id="modalPrivacyLabel">
                            <i class="bi bi-shield-lock-fill text-success me-2"></i> Chính sách bảo mật thông tin
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="d-flex flex-column gap-3 small text-secondary">
                            <div>
                                <h6 class="fw-bold text-dark">1. Thông tin chúng tôi thu thập</h6>
                                <p class="mb-0">Chúng tôi chỉ thu thập các thông tin cần thiết phục vụ học tập gồm: Họ tên, Email, Trường/Khoa, danh sách kỹ năng (Skills), và liên kết mạng xã hội/GitHub do bạn chủ động cung cấp.</p>
                            </div>
                            <div>
                                <h6 class="fw-bold text-dark">2. Cơ chế mã hóa và an toàn bảo mật</h6>
                                <p class="mb-0">Hệ thống áp dụng cơ chế xác thực JWT mã hóa qua Supabase và thiết lập bảo vệ phân quyền chặt chẽ theo hàng (Row Level Security - RLS). Mật khẩu của bạn được băm an toàn và tuyệt đối không thể đọc được bởi quản trị viên.</p>
                            </div>
                            <div>
                                <h6 class="fw-bold text-dark">3. Cam kết không chia sẻ dữ liệu</h6>
                                <p class="mb-0">ProjectHub cam kết 100% không bán, chia sẻ hoặc thương mại hóa dữ liệu cá nhân của sinh viên cho bất kỳ bên quảng cáo thứ ba nào.</p>
                            </div>
                            <div>
                                <h6 class="fw-bold text-dark">4. Quyền kiểm soát dữ liệu cá nhân</h6>
                                <p class="mb-0">Bạn có toàn quyền truy cập, chỉnh sửa hồ sơ, chuyển trạng thái dự án sang riêng tư (Private) hoặc yêu cầu xóa vĩnh viễn tài khoản và dữ liệu liên quan khỏi hệ thống bất cứ lúc nào.</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-top py-2">
                        <button type="button" class="btn btn-primary px-4 btn-sm rounded-3" data-bs-dismiss="modal">Đã hiểu</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Xử lý các link "Khám phá" (Dự án mới, Tìm đồng đội, Thành tựu)
    footerPlaceholder.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (href === currentPage) {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (typeof showToast === 'function') {
                    showToast('Bạn đang xem trang này rồi!', 'info', 2000);
                }
            });
        }
    });

    // Xử lý Form Liên hệ trong Modal
    const contactForm = document.getElementById('footer-contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang gửi...';
            }

            setTimeout(() => {
                const modalEl = document.getElementById('modal-contact');
                if (modalEl) {
                    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                        const instance = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
                        if (instance) instance.hide();
                    }
                    modalEl.classList.remove('show');
                    modalEl.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) backdrop.remove();
                }

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                contactForm.reset();

                if (typeof showToast === 'function') {
                    showToast('Cảm ơn bạn! Ban hỗ trợ ProjectHub đã nhận được yêu cầu và sẽ phản hồi sớm nhất.', 'success');
                } else {
                    alert('Cảm ơn bạn! Ban hỗ trợ ProjectHub đã nhận được yêu cầu.');
                }
            }, 500);
        });
    }

    // Xử lý Form Đăng ký nhận tin với feedback trực quan
    const newsletterForm = document.getElementById('footer-newsletter-form');
    const newsletterInput = document.getElementById('footer-newsletter-email');
    const newsletterBtn = document.getElementById('footer-subscribe-btn');

    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = newsletterInput ? newsletterInput.value.trim() : '';

            if (!email) {
                if (typeof showToast === 'function') {
                    showToast('Vui lòng nhập địa chỉ email của bạn để đăng ký nhận tin.', 'warning');
                }
                newsletterInput?.focus();
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                if (typeof showToast === 'function') {
                    showToast('Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.', 'warning');
                }
                newsletterInput?.focus();
                return;
            }

            if (newsletterBtn) {
                const originalHtml = newsletterBtn.innerHTML;
                newsletterBtn.disabled = true;
                newsletterBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

                setTimeout(() => {
                    newsletterBtn.disabled = false;
                    newsletterBtn.innerHTML = '<i class="bi bi-check2"></i> Đã gửi';
                    newsletterForm.reset();

                    if (typeof showToast === 'function') {
                        showToast(`Đăng ký nhận tin thành công! Bản tin dự án mới sẽ được gửi định kỳ tới ${sanitizeHTML(email)}.`, 'success');
                    } else {
                        alert('Đăng ký nhận tin thành công!');
                    }

                    setTimeout(() => {
                        newsletterBtn.innerHTML = originalHtml;
                    }, 2500);
                }, 400);
            }
        });
    }

    // Hash navigation handler (#guide, #faq, #contact, #terms, #privacy or #modal-guide...)
    if (window.location.hash) {
        const rawKey = window.location.hash.replace('#', '');
        const targetId = rawKey.startsWith('modal-') ? '#' + rawKey : '#modal-' + rawKey;
        const targetModal = document.querySelector(targetId);
        if (targetModal) {
            setTimeout(() => {
                openProjectHubModal(targetId);
            }, 200);
        }
    }
}

// --- Notifications ---

async function getNotifications() {
    const user = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
    if (!user) return [];
    
    // Nếu có ProjectHubNotifications, lấy từ database
    if (window.ProjectHubNotifications && typeof window.ProjectHubNotifications.fetchNotifications === 'function') {
        const res = await window.ProjectHubNotifications.fetchNotifications({ limit: 10 });
        return res.data || [];
    }
    
    const allNotifs = getFromStorage(STORAGE_KEYS.NOTIFICATIONS) || [];
    return allNotifs.filter(n => n.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getUnreadCount() {
    if (window.ProjectHubNotifications && typeof window.ProjectHubNotifications.getUnreadNotificationCount === 'function') {
        return await window.ProjectHubNotifications.getUnreadNotificationCount();
    }
    const notifs = await getNotifications();
    return notifs.filter(n => !n.read && !n.is_read).length;
}

function markNotificationRead(id) {
    if (window.ProjectHubNotifications && typeof window.ProjectHubNotifications.markNotificationAsRead === 'function') {
        window.ProjectHubNotifications.markNotificationAsRead(id);
        return;
    }
    const allNotifs = getFromStorage(STORAGE_KEYS.NOTIFICATIONS) || [];
    const index = allNotifs.findIndex(n => n.id === id);
    if (index !== -1) {
        allNotifs[index].read = true;
        setToStorage(STORAGE_KEYS.NOTIFICATIONS, allNotifs);
    }
}

async function initNotifications() {
    if (window.ProjectHubNotifications && typeof window.ProjectHubNotifications.initNotificationSystem === 'function') {
        await window.ProjectHubNotifications.initNotificationSystem();
        return;
    }

    const user = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
    if (!user) return;
    
    const notifMenu = document.getElementById('notification-menu');
    if (!notifMenu) return;
    
    const notifs = await getNotifications();
    const unreadNotifs = notifs.filter(n => !n.read && !n.is_read);
    
    let html = `
        <div class="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h6 class="mb-0 fw-bold">Thông báo</h6>
            ${unreadNotifs.length > 0 ? `<span class="badge bg-primary rounded-pill">${unreadNotifs.length} mới</span>` : ''}
        </div>
        <div class="list-group list-group-flush" style="max-height: 350px; overflow-y: auto;">
    `;
    
    if (notifs.length === 0) {
        html += `
            <div class="p-4 text-center text-muted">
                <i class="bi bi-bell-slash fs-2 mb-2 d-block"></i>
                <p class="mb-0 small">Không có thông báo nào</p>
            </div>
        `;
    } else {
        notifs.slice(0, 10).forEach(n => {
            const iconMap = {
                'invite': 'bi-envelope-paper text-primary',
                'task': 'bi-check2-square text-success',
                'mention': 'bi-at text-info',
                'join': 'bi-person-plus text-primary',
                'deadline': 'bi-clock-history text-danger',
                'ai': 'bi-robot text-purple',
                'system': 'bi-info-circle text-secondary'
            };
            
            const icon = iconMap[n.type] || 'bi-bell';
            const bgClass = n.read ? 'bg-white' : 'bg-light';
            
            html += `
                <a href="${sanitizeHTML(n.actionUrl || '#')}" class="list-group-item list-group-item-action p-3 ${bgClass}" data-notif-id="${n.id}">
                    <div class="d-flex gap-3">
                        <div class="flex-shrink-0 mt-1">
                            <i class="bi ${icon} fs-5"></i>
                        </div>
                        <div>
                            <p class="mb-1 fw-medium text-dark small">${sanitizeHTML(n.title)}</p>
                            <p class="mb-1 text-muted small text-truncate" style="max-width: 200px;">${sanitizeHTML(n.message || '')}</p>
                            <small class="text-muted" style="font-size: 0.75rem;">${timeAgo(n.createdAt)}</small>
                        </div>
                        ${!n.read ? `<div class="ms-auto"><span class="p-1 bg-primary border border-light rounded-circle d-inline-block"></span></div>` : ''}
                    </div>
                </a>
            `;
        });
    }
    
    html += `
        </div>
        <div class="p-2 border-top text-center">
            <a href="#" class="text-decoration-none small text-primary fw-medium">Xem tất cả</a>
        </div>
    `;
    
    notifMenu.innerHTML = html;
    
    // Setup click handlers for marking as read
    notifMenu.querySelectorAll('[data-notif-id]').forEach(el => {
        el.addEventListener('click', function() {
            const id = this.getAttribute('data-notif-id');
            markNotificationRead(id);
        });
    });
}

// --- Toasts & Modals ---

function showToast(message, type = 'success', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1090';
        document.body.appendChild(container);
    }

    const toastId = generateId();
    const iconMap = {
        'success': 'bi-check-circle-fill text-success',
        'error': 'bi-x-circle-fill text-danger',
        'warning': 'bi-exclamation-triangle-fill text-warning',
        'info': 'bi-info-circle-fill text-info'
    };
    
    const icon = iconMap[type] || iconMap['info'];
    
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-bg-white border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center gap-2">
                    <i class="bi ${icon} fs-5"></i>
                    <span>${sanitizeHTML(message)}</span>
                </div>
                <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    // @ts-ignore (assuming bootstrap is loaded)
    const bsToast = new bootstrap.Toast(toastElement, { delay: duration });
    bsToast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

function showModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        // @ts-ignore
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}

function hideModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        // @ts-ignore
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }
}

function showConfirmModal(title, message, onConfirm) {
    // Check if modal exists, if not create it
    let confirmModal = document.getElementById('globalConfirmModal');
    if (!confirmModal) {
        const html = `
            <div class="modal fade" id="globalConfirmModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header border-bottom-0 pb-0">
                            <h5 class="modal-title fw-bold" id="confirmModalTitle"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body py-4">
                            <p id="confirmModalMessage" class="mb-0 text-muted"></p>
                        </div>
                        <div class="modal-footer border-top-0 pt-0">
                            <button type="button" class="btn btn-light" data-bs-dismiss="modal">Hủy</button>
                            <button type="button" class="btn btn-primary" id="confirmModalBtn">Đồng ý</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        confirmModal = document.getElementById('globalConfirmModal');
    }
    
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    
    const confirmBtn = document.getElementById('confirmModalBtn');
    // Remove old listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', () => {
        hideModal('globalConfirmModal');
        if (typeof onConfirm === 'function') onConfirm();
    });
    
    showModal('globalConfirmModal');
}

// --- Utilities ---

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    
    interval = seconds / 86400;
    if (interval > 1) {
        if (Math.floor(interval) === 1) return "Hôm qua";
        return Math.floor(interval) + " ngày trước";
    }
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    
    return "Vừa xong";
}

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

function sanitizeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.sanitizeHTML = sanitizeHTML;

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// --- UI Helpers ---

function showSkeleton(containerId, count = 3) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="card border-0 shadow-sm mb-3 skeleton-item">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-3">
                        <div class="placeholder-glow">
                            <span class="placeholder rounded-circle" style="width: 40px; height: 40px;"></span>
                        </div>
                        <div class="ms-3 w-100 placeholder-glow">
                            <span class="placeholder col-6"></span>
                            <span class="placeholder col-4 d-block mt-1"></span>
                        </div>
                    </div>
                    <div class="placeholder-glow">
                        <span class="placeholder col-12"></span>
                        <span class="placeholder col-8"></span>
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function hideSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
}

function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split('/').pop() || 'index.html';
    
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentFile.includes(href)) {
            link.classList.add('active');
            link.classList.add('fw-semibold');
        } else {
            link.classList.remove('active');
            link.classList.remove('fw-semibold');
        }
    });
}

function setupMobileNav() {
    try {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!user || window.innerWidth > 768) return;
        
        const pathname = window.location.pathname;
        const currentFile = pathname.split('/').pop() || 'index.html';
        
        // Inject mobile bottom nav
        const mobileNav = document.createElement('div');
        mobileNav.className = 'd-block d-md-none fixed-bottom bg-white border-top shadow-lg';
        mobileNav.style.zIndex = '1030';
        
        mobileNav.innerHTML = `
            <div class="d-flex justify-content-around py-2">
                <a href="index.html" class="text-decoration-none text-center ${currentFile.includes('index') ? 'text-primary' : 'text-muted'}">
                    <i class="bi ${currentFile.includes('index') ? 'bi-house-fill' : 'bi-house'} fs-4 d-block mb-1"></i>
                    <small style="font-size: 0.7rem;">Trang chủ</small>
                </a>
                <a href="projects.html" class="text-decoration-none text-center ${currentFile.includes('project') ? 'text-primary' : 'text-muted'}">
                    <i class="bi ${currentFile.includes('project') ? 'bi-collection-fill' : 'bi-collection'} fs-4 d-block mb-1"></i>
                    <small style="font-size: 0.7rem;">Dự án</small>
                </a>
                <a href="workspace.html" class="text-decoration-none text-center ${currentFile.includes('workspace') ? 'text-primary' : 'text-muted'}">
                    <i class="bi ${currentFile.includes('workspace') ? 'bi-briefcase-fill' : 'bi-briefcase'} fs-4 d-block mb-1"></i>
                    <small style="font-size: 0.7rem;">Workspace</small>
                </a>
                <a href="profile.html" class="text-decoration-none text-center ${currentFile.includes('profile') ? 'text-primary' : 'text-muted'}">
                    <i class="bi ${currentFile.includes('profile') ? 'bi-person-fill' : 'bi-person'} fs-4 d-block mb-1"></i>
                    <small style="font-size: 0.7rem;">Hồ sơ</small>
                </a>
            </div>
        `;
        
        document.body.appendChild(mobileNav);
        
        // Add padding to body so content isn't hidden behind nav
        document.body.style.paddingBottom = '70px';
    } catch (e) {
        console.warn('[Nav] setupMobileNav error:', e);
    }
}

function initGlobalSidebarToggle() {
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('#btn-toggle-sidebar');
        if (toggleBtn) {
            e.preventDefault();
            const sidebar = document.querySelector('.sidebar');
            const backdrop = document.getElementById('sidebar-backdrop');
            if (sidebar) sidebar.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('show');
            return;
        }

        const backdrop = e.target.closest('#sidebar-backdrop');
        if (backdrop) {
            e.preventDefault();
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) sidebar.classList.remove('open');
            backdrop.classList.remove('show');
        }
    });
}

/**
 * Tương tác cho bộ thẻ kính Glassmorphism (hỗ trợ mobile touch / click để fan-out thẻ)
 */
function initGlassDeckInteractivity() {
    const deck = document.getElementById('glassCardDeck');
    if (!deck) return;

    deck.addEventListener('click', (e) => {
        // Nếu click trên thiết bị cảm ứng hoặc click thẻ, toggle hiệu ứng xòe thẻ
        const card = e.target.closest('.glass-card');
        if (card) {
            deck.classList.toggle('is-active');
        }
    });
}

/**
 * Tương tác cho Accordion Timeline (Hover mượt mà, tự động phục hồi thẻ giữa khi rời chuột, click/tap trên mobile & phím điều hướng a11y)
 */
function initAccordionTimeline() {
    const wrappers = document.querySelectorAll('.ph-timeline-wrapper');
    wrappers.forEach(wrapper => {
        const cards = wrapper.querySelectorAll('.ph-timeline-card');
        if (cards.length === 0) return;

        // Lưu thẻ ở giữa làm thẻ mặc định ban đầu (Chặng 03 - mốc 2024 ở giữa)
        const initialActiveCard = wrapper.querySelector('.ph-timeline-card.active') || cards[Math.floor(cards.length / 2)];

        cards.forEach(card => {
            // Khi rê chuột vào bất kỳ thẻ nào: mở rộng thẻ đó, thu nhỏ thẻ giữa mặc định
            card.addEventListener('mouseenter', () => {
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });

            // Click hoặc tap vào thẻ để chọn cố định
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });

            // Hỗ trợ phím Enter hoặc Space khi người dùng điều hướng bằng Tab
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    cards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                }
            });
        });

        // Khi rê chuột ra ngoài vùng timeline: tự động khôi phục lại thẻ ở giữa
        wrapper.addEventListener('mouseleave', () => {
            cards.forEach(c => c.classList.remove('active'));
            if (initialActiveCard) {
                initialActiveCard.classList.add('active');
            }
        });
    });
}



