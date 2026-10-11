/**
 * projects.js — Phase 3: Real Project CRUD via Supabase JS Client
 * Architecture: Supabase anon key + RLS (consistent with Phase 2 profile CRUD)
 * Security: owner_id always from JWT (auth.uid() via RLS), never from form body
 */

'use strict';

// ─── UTILITY HELPERS ─────────────────────────────────────────────────────────

var sanitizeHTML = (typeof window !== 'undefined' && window.sanitizeHTML) || function(str) {
    if (typeof str !== 'string') return str || '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

var debounce = (typeof window !== 'undefined' && window.debounce) || function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const STATUS_MAP = {
    recruiting:  { label: 'Đang tuyển',    color: 'primary' },
    in_progress: { label: 'Đang thực hiện', color: 'warning' },
    completed:   { label: 'Hoàn thành',    color: 'success' },
    archived:    { label: 'Lưu trữ',        color: 'secondary' }
};

const DIFFICULTY_MAP = {
    easy:   { label: 'Dễ',          color: 'success' },
    medium: { label: 'Trung bình',   color: 'warning' },
    hard:   { label: 'Khó',         color: 'danger' }
};

const CATEGORY_MAP = {
    web:     'Web Development',
    mobile:  'Mobile Development',
    ai:      'AI / Machine Learning',
    game:    'Game Development',
    data:    'Data Science',
    iot:     'IoT / Hardware',
    other:   'Khác'
};

const PAGE_SIZE = 12;
let currentGridCols = 3; // Default to 3 columns on desktop (col-xl-4)

const FALLBACK_COMMUNITY_PROJECTS = [
    {
        id: '71cae033-48aa-4af1-8c55-97031b298c9e',
        title: 'Dán logo ảnh hàng loạt tự động',
        description: 'Công cụ web & mobile cho phép đóng dấu watermark, dán logo thương hiệu tự động lên hàng nghìn tấm ảnh cùng lúc mà không cần căn chỉnh thủ công.',
        category: 'mobile',
        technologies: ['Flutter', 'Python', 'Node.js', 'TailwindCSS', 'Figma'],
        difficulty: 'easy',
        status: 'recruiting',
        progress: 20,
        max_members: 5,
        deadline: '2026-10-30',
        image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80',
        is_public: true,
        created_at: '2026-09-27T09:21:38.393145+00:00',
        owner_id: 'd9b57fd0-2150-4a8b-94b0-a179cf38410b',
        profiles: { display_name: 'Lê Bá Thành', avatar_url: '', username: 'lebathanh' }
    },
    {
        id: '9dd81a0d-6963-48e5-91bd-437e9a871ac3',
        title: 'Hệ thống quản lý điểm sinh viên',
        description: 'Ứng dụng web giúp sinh viên theo dõi điểm số, tính GPA và dự đoán điểm cần đạt các môn chuyên ngành qua từng học kỳ.',
        category: 'web',
        technologies: ['React', 'Node.js', 'PostgreSQL', 'TailwindCSS'],
        difficulty: 'medium',
        status: 'recruiting',
        progress: 25,
        max_members: 5,
        deadline: '2026-11-15',
        image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80',
        is_public: true,
        created_at: '2026-09-20T09:14:17.330913+00:00',
        owner_id: 'd9b57fd0-2150-4a8b-94b0-a179cf38410b',
        profiles: { display_name: 'Lê Bá Thành', avatar_url: '', username: 'lebathanh' }
    },
    {
        id: '7cadeea1-3fe4-460a-a008-19a5dc88e3d7',
        title: 'Ứng dụng tìm trọ sinh viên',
        description: 'Mobile app hỗ trợ tìm kiếm, đánh giá và kết nối người cho thuê trọ với sinh viên các trường đại học với bản đồ vị trí trực quan.',
        category: 'mobile',
        technologies: ['Flutter', 'Firebase', 'Supabase', 'Google Maps'],
        difficulty: 'medium',
        status: 'in_progress',
        progress: 60,
        max_members: 4,
        deadline: '2026-10-30',
        image_url: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=600&q=80',
        is_public: true,
        created_at: '2026-09-20T09:13:55.919746+00:00',
        owner_id: 'e5d2607e-f157-4cc1-91cb-f932bdb56e32',
        profiles: { display_name: 'Nguyễn Văn An', avatar_url: '', username: 'vanan_dev' }
    },
    {
        id: '9a1c13de-124b-42eb-9cff-0ed74c418459',
        title: 'Website chia sẻ tài liệu học tập',
        description: 'Nền tảng chia sẻ đề thi, giáo trình và tài liệu ôn tập cho các môn học ngành công nghệ thông tin có tính năng bình luận và đánh giá.',
        category: 'web',
        technologies: ['Vue.js', 'FastAPI', 'TailwindCSS', 'PostgreSQL'],
        difficulty: 'easy',
        status: 'recruiting',
        progress: 15,
        max_members: 4,
        deadline: '2026-11-20',
        image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80',
        is_public: true,
        created_at: '2026-09-20T09:13:56.11724+00:00',
        owner_id: 'd9b57fd0-2150-4a8b-94b0-a179cf38410b',
        profiles: { display_name: 'Trần Minh Quân', avatar_url: '', username: 'quan_tran' }
    },
    {
        id: '7e156de4-b076-4a90-83d5-0e4ff83f9752',
        title: 'EduAI - Trợ lý ôn thi thông minh',
        description: 'Nền tảng ứng dụng AI tạo câu hỏi ôn tập, tóm tắt giáo trình và gợi ý lộ trình học tập cá nhân hóa cho sinh viên các khối ngành.',
        category: 'ai',
        technologies: ['Python', 'OpenAI', 'FastAPI', 'React'],
        difficulty: 'hard',
        status: 'recruiting',
        progress: 45,
        max_members: 5,
        deadline: '2026-12-01',
        image_url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80',
        is_public: true,
        created_at: '2026-09-20T09:13:55.133943+00:00',
        owner_id: 'd9b57fd0-2150-4a8b-94b0-a179cf38410b',
        profiles: { display_name: 'Phạm Hương Ly', avatar_url: '', username: 'huongly_ai' }
    },
    {
        id: 'be61c111-ef66-4ad5-bc63-caec04cc099c',
        title: 'Smart Campus IoT - Giám sát phòng lab',
        description: 'Hệ thống IoT giám sát nhiệt độ, độ ẩm và điện năng tiêu thụ tại các phòng thực hành tin học với cảnh báo theo thời gian thực.',
        category: 'iot',
        technologies: ['ESP32', 'MQTT', 'Node.js', 'React'],
        difficulty: 'hard',
        status: 'completed',
        progress: 100,
        max_members: 3,
        deadline: null,
        image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
        is_public: true,
        created_at: '2026-09-20T09:13:56.25178+00:00',
        owner_id: 'e5d2607e-f157-4cc1-91cb-f932bdb56e32',
        profiles: { display_name: 'Hoàng Quốc Bảo', avatar_url: '', username: 'bao_iot' }
    }
];

// ─── SUPABASE HELPERS ──────────────────────────────────────────────────────────

function getDB() {
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
        return window.supabaseClient;
    }
    if (typeof window.getSupabaseClient === 'function') {
        const c = window.getSupabaseClient();
        if (c && typeof c.from === 'function') return c;
    }
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        const url = 'https://wmqpdxwgdandtvgxduha.supabase.co';
        const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcXBkeHdnZGFuZHR2Z3hkdWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NjI1MDksImV4cCI6MjEwNDIzODUwOX0.u4a9jGhFQgKDydBkNuL5PWBF_9oTl1YWJlaOQjodWNs';
        window.supabaseClient = window.supabase.createClient(url, key, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage }
        });
        return window.supabaseClient;
    }
    if (typeof window.getSupabase === 'function') {
        const client = window.getSupabase();
        if (client && typeof client.from === 'function') return client;
    }
    throw new Error('Supabase client not ready');
}

// ─── PROJECT LIST PAGE ─────────────────────────────────────────────────────────

async function initProjectsPage() {
    const grid        = document.getElementById('projects-grid');
    const emptyState  = document.getElementById('empty-state');
    const resultsInfo = document.getElementById('results-info');
    const pagination  = document.getElementById('pagination');

    if (!grid) return;

    // Show skeleton while loading
    grid.innerHTML = buildSkeletonCards(PAGE_SIZE);

    let currentPage = 1;
    let totalCount  = 0;
    let currentProjects = []; // Cached projects list for instant layout switching

    async function fetchAndRender() {
        const filters = readFilters();
        grid.innerHTML = buildSkeletonCards(PAGE_SIZE);
        if (pagination) pagination.innerHTML = '';

        try {
            if (typeof window.initSupabase === 'function' && (!window.supabaseClient || typeof window.supabaseClient.from !== 'function')) {
                await window.initSupabase();
            }
            const { data, count, error } = await queryProjects(filters, currentPage);

            if (error) {
                console.error('Lỗi truy vấn dự án từ Supabase:', error);
                const rlsNote = error.code === '42P17' 
                    ? '<br><small class="mt-2 d-block">Lưu ý: Phát hiện đệ quy RLS (infinite recursion). Cần cập nhật Policy trong Supabase SQL Editor.</small>' 
                    : '';
                grid.innerHTML = `<div class="col-12"><div class="alert alert-danger">Lỗi tải dự án: ${sanitizeHTML(error.message || 'Lỗi kết nối')}${rlsNote}</div></div>`;
                return;
            }

            totalCount = count || 0;
            currentProjects = data || [];

            if (resultsInfo) resultsInfo.textContent = `Tìm thấy ${totalCount} dự án`;

            if (currentProjects.length === 0) {
                grid.innerHTML = '';
                if (emptyState) emptyState.classList.remove('d-none');
            } else {
                if (emptyState) emptyState.classList.add('d-none');
                grid.innerHTML = currentProjects.map(renderProjectCard).join('');
            }

            renderPagination(pagination, currentPage, totalCount, PAGE_SIZE, (page) => {
                currentPage = page;
                fetchAndRender();
            });
        } catch (err) {
            console.error('Project load error:', err);
            grid.innerHTML = `<div class="col-12"><div class="alert alert-danger">Không thể kết nối Supabase (${sanitizeHTML(err.message || 'Kiểm tra cấu hình')}).</div></div>`;
        }
    }

    function readFilters() {
        return {
            search:     (document.getElementById('search-projects')?.value || '').trim(),
            category:   document.getElementById('filter-category')?.value || '',
            status:     document.getElementById('filter-status')?.value || '',
            difficulty: document.getElementById('filter-difficulty')?.value || '',
            teamSize:   document.getElementById('filter-teamsize')?.value || '',
            sort:       document.getElementById('sort-projects')?.value || 'newest',
            recruiting: document.getElementById('filter-recruiting')?.checked || false
        };
    }

    // Debounced search
    const debouncedRender = debounce(() => { currentPage = 1; fetchAndRender(); }, 350);

    const searchEl = document.getElementById('search-projects');
    if (searchEl) searchEl.addEventListener('input', debouncedRender);

    ['filter-category', 'filter-status', 'filter-difficulty', 'filter-teamsize', 'sort-projects'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { currentPage = 1; fetchAndRender(); });
    });

    const recruitingEl = document.getElementById('filter-recruiting');
    if (recruitingEl) recruitingEl.addEventListener('change', () => { currentPage = 1; fetchAndRender(); });

    // Grid Column View Toggle (3 Columns vs 2 Columns in main content)
    const btnGrid3Cols = document.getElementById('btn-grid-4'); // button with label '3 Cột'
    const btnGrid2Cols = document.getElementById('btn-grid-3'); // button with label '2 Cột'
    if (btnGrid3Cols && btnGrid2Cols) {
        btnGrid3Cols.addEventListener('click', () => {
            if (currentGridCols === 3) return;
            currentGridCols = 3;
            btnGrid3Cols.classList.add('active');
            btnGrid2Cols.classList.remove('active');
            if (currentProjects.length > 0) {
                grid.innerHTML = currentProjects.map(renderProjectCard).join('');
            }
        });
        btnGrid2Cols.addEventListener('click', () => {
            if (currentGridCols === 2) return;
            currentGridCols = 2;
            btnGrid2Cols.classList.add('active');
            btnGrid3Cols.classList.remove('active');
            if (currentProjects.length > 0) {
                grid.innerHTML = currentProjects.map(renderProjectCard).join('');
            }
        });
    }

    // Quick Category Chips
    document.querySelectorAll('.btn-chip[data-cat]').forEach(chip => {
        chip.addEventListener('click', () => {
            const cat = chip.getAttribute('data-cat') || '';
            const catSelect = document.getElementById('filter-category');
            if (catSelect) {
                catSelect.value = cat;
                // Update dropdown label & active state
                const dropdown = document.querySelector('[data-target-select="filter-category"]');
                if (dropdown) {
                    const labelSpan = dropdown.querySelector('.custom-select-label');
                    const matchItem = dropdown.querySelector(`.dropdown-item[data-value="${cat}"]`);
                    if (matchItem && labelSpan) {
                        labelSpan.innerHTML = matchItem.innerHTML;
                        dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                        matchItem.classList.add('active');
                    }
                }
                document.querySelectorAll('.btn-chip[data-cat]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                catSelect.dispatchEvent(new Event('change'));
            }
        });
    });

    // Reset Filters Handler (works for both empty-state button and toolbar button)
    function resetAllFilters() {
        if (searchEl) searchEl.value = '';
        ['filter-category', 'filter-status', 'filter-difficulty', 'filter-teamsize'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const sortEl = document.getElementById('sort-projects');
        if (sortEl) sortEl.value = 'newest';
        if (recruitingEl) recruitingEl.checked = false;

        // Reset category chips
        document.querySelectorAll('.btn-chip[data-cat]').forEach(c => {
            if (c.getAttribute('data-cat') === '') c.classList.add('active');
            else c.classList.remove('active');
        });

        // Reset custom dropdown labels & active states
        document.querySelectorAll('.project-filter-dropdown, .custom-select-dropdown').forEach(dropdown => {
            const firstItem = dropdown.querySelector('.dropdown-item');
            const labelSpan = dropdown.querySelector('.custom-select-label');
            if (firstItem && labelSpan) {
                labelSpan.innerHTML = firstItem.innerHTML;
                dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                firstItem.classList.add('active');
            }
        });

        currentPage = 1;
        fetchAndRender();
    }

    const resetFiltersBtn = document.getElementById('btn-reset-filters');
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);
    const resetFiltersBarBtn = document.getElementById('btn-reset-filters-bar');
    if (resetFiltersBarBtn) resetFiltersBarBtn.addEventListener('click', resetAllFilters);

    // Setup Custom Dropdowns (supports .project-filter-dropdown and legacy .custom-select-dropdown)
    function setupCustomDropdowns() {
        document.querySelectorAll('.project-filter-dropdown, .custom-select-dropdown').forEach(dropdown => {
            const targetId = dropdown.getAttribute('data-target-select');
            const targetSelect = document.getElementById(targetId);
            const labelSpan = dropdown.querySelector('.custom-select-label');
            if (!targetSelect || !labelSpan) return;

            dropdown.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const val = item.getAttribute('data-value') || '';
                    targetSelect.value = val;
                    labelSpan.innerHTML = item.innerHTML;

                    dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');

                    // If category dropdown changes, sync with quick chips
                    if (targetId === 'filter-category') {
                        document.querySelectorAll('.btn-chip[data-cat]').forEach(c => {
                            if (c.getAttribute('data-cat') === val) c.classList.add('active');
                            else c.classList.remove('active');
                        });
                    }

                    // Hide dropdown menu cleanly upon selection
                    const toggleBtn = dropdown.querySelector('.dropdown-toggle');
                    if (toggleBtn && window.bootstrap && typeof window.bootstrap.Dropdown === 'function') {
                        const bsDropdown = window.bootstrap.Dropdown.getInstance(toggleBtn);
                        if (bsDropdown) bsDropdown.hide();
                    }

                    // Dispatch change event to trigger re-query
                    targetSelect.dispatchEvent(new Event('change'));
                });
            });
        });
    }
    setupCustomDropdowns();

    // Read search param from URL if present (e.g. from index.html Hero search or hot tags)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam && searchEl) {
        searchEl.value = searchParam;
    }

    // Initial load
    fetchAndRender();
}

async function queryProjects(filters, page) {
    const offset = (page - 1) * PAGE_SIZE;

    try {
        const supabase = getDB();
        if (supabase && typeof supabase.from === 'function') {
            let q = supabase
                .from('projects')
                .select(`
                    id, title, description, category, technologies,
                    difficulty, status, progress, max_members, deadline,
                    image_url, is_public, created_at, owner_id,
                    profiles:owner_id ( display_name, avatar_url, username )
                `, { count: 'exact' })
                .eq('is_public', true);

            if (filters.search) {
                q = q.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
            }
            if (filters.category) {
                q = q.eq('category', filters.category);
            }
            if (filters.status) {
                q = q.eq('status', filters.status);
            } else if (filters.recruiting) {
                q = q.eq('status', 'recruiting');
            }
            if (filters.difficulty) {
                q = q.eq('difficulty', filters.difficulty);
            }
            if (filters.teamSize === '1-3') {
                q = q.lte('max_members', 3);
            } else if (filters.teamSize === '4-6') {
                q = q.gte('max_members', 4).lte('max_members', 6);
            } else if (filters.teamSize === '7+') {
                q = q.gte('max_members', 7);
            }

            // Sort
            if (filters.sort === 'oldest') {
                q = q.order('created_at', { ascending: true });
            } else if (filters.sort === 'progress') {
                q = q.order('progress', { ascending: false });
            } else {
                q = q.order('created_at', { ascending: false });
            }

            q = q.range(offset, offset + PAGE_SIZE - 1);

            const res = await q;
            if (!res.error) {
                return res;
            }
            console.warn('[queryProjects] Direct query returned error:', res.error?.message, 'Code:', res.error?.code);
        }
    } catch (directErr) {
        console.warn('[queryProjects] Direct query exception:', directErr.message);
    }

    // Fallback: Query backend API /api/projects
    try {
        const params = new URLSearchParams({
            page: String(page),
            pageSize: String(PAGE_SIZE),
            search: filters.search || '',
            category: filters.category || '',
            status: filters.status || '',
            difficulty: filters.difficulty || '',
            teamSize: filters.teamSize || '',
            sort: filters.sort || 'newest',
            recruiting: filters.recruiting ? 'true' : 'false'
        });
        const res = await fetch(`/api/projects?${params.toString()}`);
        if (res.ok) {
            const json = await res.json();
            return { data: json.data || [], count: json.count || 0, error: null };
        }
    } catch (fallbackErr) {
        console.warn('[queryProjects] Server fallback exception:', fallbackErr.message);
    }

    // Fallback 2: Sử dụng danh sách dự án cộng đồng dự phòng đã xác thực
    let filtered = [...FALLBACK_COMMUNITY_PROJECTS];
    if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(p => (p.title || '').toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s));
    }
    if (filters.category) {
        filtered = filtered.filter(p => p.category === filters.category);
    }
    if (filters.status) {
        filtered = filtered.filter(p => p.status === filters.status);
    } else if (filters.recruiting) {
        filtered = filtered.filter(p => p.status === 'recruiting');
    }
    if (filters.difficulty) {
        filtered = filtered.filter(p => p.difficulty === filters.difficulty);
    }
    if (filters.teamSize === '1-3') {
        filtered = filtered.filter(p => (p.max_members || 5) <= 3);
    } else if (filters.teamSize === '4-6') {
        filtered = filtered.filter(p => (p.max_members || 5) >= 4 && (p.max_members || 5) <= 6);
    } else if (filters.teamSize === '7+') {
        filtered = filtered.filter(p => (p.max_members || 5) >= 7);
    }

    if (filters.sort === 'progress') {
        filtered.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    }

    return { data: filtered, count: filtered.length, error: null };
}

function renderProjectCard(project) {
    const status     = STATUS_MAP[project.status] || STATUS_MAP.recruiting;
    const difficulty = DIFFICULTY_MAP[project.difficulty] || DIFFICULTY_MAP.medium;
    const category   = CATEGORY_MAP[project.category] || project.category || 'Khác';

    let techs = [];
    if (Array.isArray(project.technologies)) {
        techs = project.technologies;
    } else if (typeof project.technologies === 'string') {
        try {
            const parsed = JSON.parse(project.technologies);
            techs = Array.isArray(parsed) ? parsed : project.technologies.split(/[\s,]+/);
        } catch (_) {
            techs = project.technologies.split(/[\s,]+/);
        }
    }
    techs = techs.filter(Boolean);
    let techHtml = techs.slice(0, 3).map(t => `<span class="badge bg-light text-dark border me-1 mb-1">${sanitizeHTML(t)}</span>`).join('');
    if (techs.length > 3) techHtml += `<span class="badge bg-light text-dark border me-1 mb-1">+${techs.length - 3}</span>`;

    const owner     = project.profiles || {};
    const ownerName = sanitizeHTML(owner.display_name || 'Người dùng');
    const avatarSrc = owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=4F46E5&color=fff&size=64`;
    const imageUrl  = project.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(project.title)}&background=random&size=400&bold=true&format=svg`;
    const deadline  = project.deadline ? new Date(project.deadline).toLocaleDateString('vi-VN') : 'Không có';
    const colClass  = currentGridCols === 2 ? 'col-12 col-md-6 col-xl-6' : 'col-12 col-md-6 col-xl-4';

    return `
        <div class="${colClass}">
            <div class="card project-card border shadow-sm h-100">
                <div class="position-relative overflow-hidden" style="border-radius: 14px 14px 0 0;">
                    <img src="${imageUrl}" class="project-img card-img-top" alt="${sanitizeHTML(project.title)}"
                         style="height: 160px; object-fit: cover; transition: transform 0.35s ease;"
                         onerror="this.src='https://ui-avatars.com/api/?name=Project&background=e9ecef&color=6c757d&size=400&format=svg'">
                    <span class="badge bg-${status.color} position-absolute top-0 end-0 m-2 shadow-sm">${status.label}</span>
                </div>
                <div class="card-body d-flex flex-column p-3">
                    <div class="d-flex align-items-center gap-1 mb-2">
                        <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle small py-1 px-2">${sanitizeHTML(category)}</span>
                        <span class="badge bg-${difficulty.color}-subtle text-${difficulty.color}-emphasis border border-${difficulty.color}-subtle small py-1 px-2">${difficulty.label}</span>
                    </div>
                    <h5 class="card-title fw-bold text-truncate mb-1 fs-6" title="${sanitizeHTML(project.title)}">${sanitizeHTML(project.title)}</h5>
                    <p class="card-text text-muted small mb-3 flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.45;">
                        ${sanitizeHTML(project.description)}
                    </p>

                    <div class="mb-3 d-flex flex-wrap align-items-center" style="min-height: 28px;">
                        ${techHtml || '<span class="text-muted small fst-italic">Chưa có công nghệ</span>'}
                    </div>

                    <div class="d-flex justify-content-between align-items-center mb-2 pt-2 border-top">
                        <div class="d-flex align-items-center" title="Người tạo: ${ownerName}">
                            <img src="${avatarSrc}" class="rounded-circle me-1" width="22" height="22" style="object-fit:cover" alt="${ownerName}">
                            <small class="text-muted text-truncate" style="max-width: 95px;">${ownerName}</small>
                        </div>
                        <small class="text-muted" title="Hạn chót"><i class="bi bi-calendar3 me-1"></i>${deadline}</small>
                    </div>

                    ${project.progress > 0 ? `
                    <div class="mb-3">
                        <div class="d-flex justify-content-between mb-1" style="font-size: 0.75rem;">
                            <span class="text-muted">Tiến độ</span>
                            <span class="fw-bold text-success">${project.progress}%</span>
                        </div>
                        <div class="progress" style="height: 4px;">
                            <div class="progress-bar bg-success rounded-pill" style="width: ${project.progress}%"></div>
                        </div>
                    </div>` : ''}

                    <div class="mt-auto pt-2">
                        <a href="project-detail.html?id=${project.id}" class="btn btn-outline-primary btn-sm w-100 rounded-pill fw-semibold py-1">
                            Xem chi tiết <i class="bi bi-arrow-right ms-1"></i>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPagination(container, currentPage, total, pageSize, onPageChange) {
    if (!container) return;
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '<nav><ul class="pagination">';

    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage - 1}">‹</a>
    </li>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`;
        } else if (Math.abs(i - currentPage) === 2) {
            html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        }
    }

    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage + 1}">›</a>
    </li>`;

    html += '</ul></nav>';
    container.innerHTML = html;

    container.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(link.dataset.page);
            if (page >= 1 && page <= totalPages && page !== currentPage) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                onPageChange(page);
            }
        });
    });
}

// ─── PROJECT DETAIL PAGE ───────────────────────────────────────────────────────

/**
 * Kiểm tra xem người dùng có phải Quản trị viên (Admin) không
 */
function checkIsAdmin(user, profile) {
    if (!user) return false;
    const email = (user.email || '').toLowerCase().trim();
    if (email === 'lamasono80@gmail.com') return true;
    if (user.role === 'admin' || user.is_admin === true) return true;
    if (user.app_metadata && (user.app_metadata.role === 'admin' || user.app_metadata.is_admin === true)) return true;
    if (user.user_metadata && (user.user_metadata.role === 'admin' || user.user_metadata.is_admin === true)) return true;
    if (profile && (profile.role === 'admin' || profile.is_admin === true)) return true;
    return false;
}

async function initProjectDetailPage() {
    const container = document.querySelector('.container');
    const urlParams = new URLSearchParams(window.location.search);
    let projectId = urlParams.get('id');

    // Nếu không có id trên URL, tự động fallback về dự án mới nhất để tránh báo lỗi khi truy cập trực tiếp
    if (!projectId) {
        try {
            const supabase = getDB();
            const { data } = await supabase.from('projects').select('id').order('created_at', { ascending: false }).limit(1).single();
            if (data && data.id) {
                projectId = data.id;
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', `project-detail.html?id=${projectId}`);
                }
            }
        } catch (e) {
            projectId = '7e156de4-b076-4a90-83d5-0e4ff83f9752';
        }
    }

    if (!projectId) {
        if (container) container.innerHTML = '<div class="alert alert-danger mt-5 text-center">Thiếu ID dự án.</div>';
        return;
    }

    const titleEl = document.getElementById('project-title');
    if (titleEl) titleEl.textContent = 'Đang tải...';

    try {
        const supabase = getDB();

        // 1. Tải thông tin project và owner profile
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select(`
                *,
                profiles:owner_id ( id, display_name, avatar_url, username, github_url )
            `)
            .eq('id', projectId)
            .single();

        if (projErr || !project) {
            if (container) container.innerHTML = '<div class="alert alert-danger mt-5 text-center">Không tìm thấy dự án hoặc bạn không có quyền xem.</div>';
            return;
        }

        // 2. Tải các vị trí tuyển dụng (project_roles)
        const { data: roles } = await supabase
            .from('project_roles')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        // 3. Tải danh sách thành viên hiện tại (project_members)
        const { data: members } = await supabase
            .from('project_members')
            .select(`
                id, project_id, user_id, role_name, joined_at, status,
                profiles:user_id ( id, display_name, avatar_url, username, skills, experience )
            `)
            .eq('project_id', projectId)
            .eq('status', 'active')
            .order('joined_at', { ascending: true });

        // 4. Lấy current user session & profile
        let currentUser = null;
        let currentProfile = null;
        if (typeof getCurrentUser === 'function') {
            currentUser = await getCurrentUser();
        }
        if (currentUser && typeof getCurrentProfile === 'function') {
            currentProfile = await getCurrentProfile();
        }

        const isOwner = currentUser && currentUser.id === project.owner_id;
        const isMember = currentUser && Array.isArray(members) && members.some(m => m.user_id === currentUser.id);
        const isAdmin = checkIsAdmin(currentUser, currentProfile);
        const hasAccess = isOwner || isMember || isAdmin;

        // 5. Nếu là Owner hoặc Admin: tải danh sách pending join requests
        let pendingRequests = [];
        if (isOwner || isAdmin) {
            const { data: reqs } = await supabase
                .from('project_join_requests')
                .select(`
                    id, project_id, user_id, role_name, message, status, created_at,
                    profiles:user_id ( id, display_name, avatar_url, username, skills, experience )
                `)
                .eq('project_id', projectId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            pendingRequests = reqs || [];
        }

        // 6. Nếu là User chưa là thành viên: kiểm tra request gần nhất của user cho project này
        let myLatestRequest = null;
        if (currentUser && !isOwner && !isMember && !isAdmin) {
            const { data: userReqs } = await supabase
                .from('project_join_requests')
                .select('id, status, role_name, message, created_at')
                .eq('project_id', projectId)
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(1);
            if (userReqs && userReqs.length > 0) {
                myLatestRequest = userReqs[0];
            }
        }

        // 7. KIỂM TRA QUYỀN TRUY CẬP:
        // Yêu cầu: Chỉ khi nào tham gia mới coi và ấn được, còn lại không tham gia hoặc không phải admin thì không coi được
        if (!hasAccess) {
            renderRestrictedDetailPage(project, roles || [], members || [], {
                currentUser,
                currentProfile,
                myLatestRequest,
                isProjectFull: (members ? members.length : 0) + 1 >= (project.max_members || 5)
            });
            return;
        }

        // 8. Nếu CÓ QUYỀN: Render giao diện chi tiết dự án đầy đủ
        populateDetailPage(project, roles || [], members || [], {
            currentUser,
            currentProfile,
            isOwner,
            isMember,
            isAdmin,
            myLatestRequest,
            pendingRequests
        });

        // 9. Kích hoạt widgets AI Matching
        setupDetailMatchingWidget(project, { isOwner, isMember, isAdmin, currentUser, currentProfile });

    } catch (err) {
        console.error('Detail page error:', err);
        if (container) container.innerHTML = `<div class="alert alert-danger mt-5 text-center">Lỗi: ${sanitizeHTML(err.message)}</div>`;
    }
}

function populateDetailPage(project, roles, members, ctx) {
    const { currentUser, isOwner, isMember, isAdmin, myLatestRequest, pendingRequests } = ctx;

    const status     = STATUS_MAP[project.status] || STATUS_MAP.recruiting;
    const difficulty = DIFFICULTY_MAP[project.difficulty] || DIFFICULTY_MAP.medium;
    const category   = CATEGORY_MAP[project.category] || project.category || 'Khác';
    const owner      = project.profiles || {};
    const ownerName  = owner.display_name || 'Người dùng';

    document.title = `${project.title} - ProjectHub`;

    // Banner image
    const bannerEl = document.getElementById('project-banner-img');
    if (bannerEl) {
        bannerEl.src = project.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(project.title)}&background=4F46E5&color=fff&size=1200&format=svg`;
        bannerEl.alt = project.title;
    }

    // Breadcrumb & title & description
    const breadcrumb = document.getElementById('breadcrumb-title');
    if (breadcrumb) breadcrumb.textContent = project.title;
    const titleEl = document.getElementById('project-title');
    if (titleEl) titleEl.textContent = project.title;
    const descEl = document.getElementById('project-description');
    if (descEl) descEl.textContent = project.description;

    // Badges
    const badgesEl = document.getElementById('project-badges');
    if (badgesEl) {
        badgesEl.innerHTML = `
            <span class="badge bg-${status.color} me-1">${status.label}</span>
            <span class="badge bg-info text-dark me-1">${sanitizeHTML(category)}</span>
            <span class="badge bg-${difficulty.color} me-1">${difficulty.label}</span>
        `;
    }

    // Technologies
    const techEl = document.getElementById('project-technologies');
    if (techEl) {
        techEl.innerHTML = (project.technologies || []).map(t =>
            `<span class="badge-tech">${sanitizeHTML(t)}</span>`
        ).join('') || '<span class="text-muted small">Chưa có công nghệ cụ thể</span>';
    }

    // Goal & Problem
    const goalEl = document.getElementById('project-goals');
    if (goalEl) goalEl.textContent = project.goal || 'Chưa cập nhật mục tiêu.';
    const problemEl = document.getElementById('project-problem');
    if (problemEl) problemEl.textContent = project.problem || 'Chưa cập nhật vấn đề cần giải quyết.';

    // Owner info
    const ownerEl = document.getElementById('project-owner');
    if (ownerEl) {
        const avatarSrc = owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=4F46E5&color=fff&size=128`;
        ownerEl.innerHTML = `
            <img src="${avatarSrc}" class="rounded-circle me-3" style="width:50px;height:50px;object-fit:cover" alt="${sanitizeHTML(ownerName)}">
            <div>
                <div class="fw-bold">${sanitizeHTML(ownerName)}</div>
                <div class="text-muted small">Project Owner${owner.username ? ' · @' + sanitizeHTML(owner.username) : ''}</div>
                ${owner.github_url ? `<a href="${sanitizeHTML(owner.github_url)}" target="_blank" rel="noopener" class="small text-decoration-none"><i class="bi bi-github me-1"></i>GitHub</a>` : ''}
            </div>
        `;
    }

    // Member count calculation (1 Owner + active members)
    const maxMembers = project.max_members || 5;
    const totalMembersCount = (members ? members.length : 0) + 1;
    const isProjectFull = totalMembersCount >= maxMembers;

    // Stats
    const statDeadline = document.getElementById('stat-deadline');
    if (statDeadline) statDeadline.textContent = project.deadline ? new Date(project.deadline).toLocaleDateString('vi-VN') : 'Không có';
    const statMembers = document.getElementById('stat-members');
    if (statMembers) statMembers.textContent = `${totalMembersCount} / ${maxMembers}`;
    const statStatus = document.getElementById('stat-status');
    if (statStatus) statStatus.innerHTML = `<span class="badge bg-${status.color}">${status.label}</span>`;

    // Progress
    const progressText = document.getElementById('progress-text');
    const progressBar  = document.getElementById('progress-bar');
    if (progressText) progressText.textContent = (project.progress || 0) + '%';
    if (progressBar)  progressBar.style.width = (project.progress || 0) + '%';

    // Tasks / Workspace box on Project Detail
    const projectTasksEl = document.getElementById('project-tasks');
    if (projectTasksEl) {
        if (isOwner || isMember || isAdmin) {
            projectTasksEl.innerHTML = `
                <div class="d-flex align-items-center justify-content-between p-3 bg-light rounded border">
                    <div>
                        <div class="fw-semibold text-dark"><i class="bi bi-kanban text-primary me-2"></i>Workspace & Kanban Board</div>
                        <small class="text-muted">Quản lý và thực hiện nhiệm vụ của dự án</small>
                    </div>
                    <a href="workspace.html?id=${project.id}" class="btn btn-sm btn-primary">
                        Vào Workspace <i class="bi bi-arrow-right ms-1"></i>
                    </a>
                </div>
            `;
        } else {
            projectTasksEl.innerHTML = `
                <p class="text-muted fst-italic mb-0 small"><i class="bi bi-lock me-1"></i>Chỉ thành viên của dự án mới có quyền truy cập Workspace và nhiệm vụ.</p>
            `;
        }
    }

    // ── TEAM MEMBERS LIST ──
    renderTeamMembersList(project, members, { currentUser, isOwner, isAdmin });

    // ── ACTION BUTTONS ──
    renderActionButtons(project, { currentUser, isOwner, isMember, isAdmin, isProjectFull, myLatestRequest });

    // ── OPEN ROLES & JOIN MODAL SETUP ──
    setupOpenPositions(roles, isProjectFull, project);

    // ── OWNER JOIN REQUESTS MANAGEMENT ──
    if (isOwner || isAdmin) {
        renderOwnerRequestsList(pendingRequests, project);
    }

    // ── GITHUB REPOSITORY CARD (Phase 7) ──
    renderProjectGitHubCard(project.github_url, isOwner || isAdmin, project.id);

    // ── AI ANALYSIS & RELATED PROJECTS ──
    renderAIAnalysis(project);
    loadRelatedProjects(project);

    // ── COMMUNITY REVIEWS & 5-STAR RATING (Section 7) ──
    setupProjectReviews(project, ctx);
}

/**
 * Render giao diện Giới hạn Quyền Xem Dự án (Restricted Locked Gateway)
 * Yêu cầu: Chỉ khi nào tham gia mới coi và ấn được, còn lại không tham gia hoặc không phải admin thì không coi được.
 */
function renderRestrictedDetailPage(project, roles, members, ctx) {
    const { currentUser, currentProfile, myLatestRequest, isProjectFull } = ctx;

    const status     = STATUS_MAP[project.status] || STATUS_MAP.recruiting;
    const difficulty = DIFFICULTY_MAP[project.difficulty] || DIFFICULTY_MAP.medium;
    const category   = CATEGORY_MAP[project.category] || project.category || 'Khác';
    const owner      = project.profiles || {};
    const ownerName  = owner.display_name || 'Chủ dự án';

    document.title = `${project.title} (Riêng tư) - ProjectHub`;

    // 1. Banner image
    const bannerEl = document.getElementById('project-banner-img');
    if (bannerEl) {
        bannerEl.src = project.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(project.title)}&background=4F46E5&color=fff&size=1200&format=svg`;
        bannerEl.alt = project.title;
    }

    // 2. Breadcrumb & Title & Short description
    const breadcrumb = document.getElementById('breadcrumb-title');
    if (breadcrumb) breadcrumb.textContent = project.title;
    const titleEl = document.getElementById('project-title');
    if (titleEl) titleEl.textContent = project.title;
    const descEl = document.getElementById('project-description');
    if (descEl) descEl.textContent = project.description || 'Dự án này được thiết lập chế độ riêng tư.';

    // 3. Badges
    const badgesEl = document.getElementById('project-badges');
    if (badgesEl) {
        badgesEl.innerHTML = `
            <span class="badge bg-danger bg-opacity-10 text-danger border border-danger me-1">
                <i class="bi bi-shield-lock-fill me-1"></i>Nội dung bảo vệ
            </span>
            <span class="badge bg-secondary me-1"><i class="bi bi-lock me-1"></i>Chỉ thành viên mới được xem</span>
            <span class="badge bg-info text-dark me-1">${sanitizeHTML(category)}</span>
            <span class="badge bg-${difficulty.color} me-1">${difficulty.label}</span>
        `;
    }

    // 4. Technologies
    const techEl = document.getElementById('project-technologies');
    if (techEl) {
        techEl.innerHTML = (project.technologies || []).map(t =>
            `<span class="badge-tech">${sanitizeHTML(t)}</span>`
        ).join('') || '<span class="text-muted small">Chưa có công nghệ cụ thể</span>';
    }

    // 5. Owner info
    const ownerEl = document.getElementById('project-owner');
    if (ownerEl) {
        const avatarSrc = owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=4F46E5&color=fff&size=128`;
        ownerEl.innerHTML = `
            <img src="${avatarSrc}" class="rounded-circle me-3" style="width:50px;height:50px;object-fit:cover" alt="${sanitizeHTML(ownerName)}">
            <div>
                <div class="fw-bold">${sanitizeHTML(ownerName)}</div>
                <div class="text-muted small">Chủ dự án${owner.username ? ' · @' + sanitizeHTML(owner.username) : ''}</div>
            </div>
        `;
    }

    // 6. Action buttons in Header
    const actionButtons = document.getElementById('action-buttons');
    if (actionButtons) {
        if (!currentUser) {
            actionButtons.innerHTML = `
                <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
                <button class="btn btn-primary" onclick="promptLoginToJoin()">
                    <i class="bi bi-box-arrow-in-right me-1"></i>Đăng nhập để tham gia
                </button>
            `;
        } else if (myLatestRequest && myLatestRequest.status === 'pending') {
            actionButtons.innerHTML = `
                <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
                <span class="badge bg-warning text-dark d-flex align-items-center p-2 px-3 fs-6">
                    <i class="bi bi-clock-history me-2"></i>Đã gửi yêu cầu tham gia
                </span>
                <button class="btn btn-outline-danger" onclick="cancelJoinRequest('${myLatestRequest.id}')">
                    <i class="bi bi-x-circle me-1"></i>Hủy yêu cầu
                </button>
            `;
        } else if (isProjectFull) {
            actionButtons.innerHTML = `
                <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
                <button class="btn btn-secondary" disabled>
                    <i class="bi bi-slash-circle me-1"></i>Đã đủ thành viên
                </button>
            `;
        } else {
            actionButtons.innerHTML = `
                <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
                <button class="btn btn-primary" id="btn-join-project" data-bs-toggle="modal" data-bs-target="#join-modal">
                    <i class="bi bi-person-plus me-1"></i>Tham gia dự án
                </button>
            `;
            const joinBtn = document.getElementById('btn-join-project');
            if (joinBtn) {
                joinBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof openProjectHubModal === 'function') {
                        openProjectHubModal('#join-modal');
                    }
                });
            }
        }

        // Share button handler
        actionButtons.querySelectorAll('.btn-share-project').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = window.location.href;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).then(() => {
                        if (typeof showToast === 'function') showToast('Đã sao chép liên kết dự án!', 'success');
                        else alert('Đã sao chép liên kết dự án!');
                    }).catch(() => prompt('Sao chép liên kết dự án:', url));
                } else {
                    prompt('Sao chép liên kết dự án:', url);
                }
            });
        });
    }

    // 7. Setup modal ứng tuyển
    setupOpenPositions(roles || [], isProjectFull, project);

    // 8. Thay thế lưới nội dung (.row.g-4) bằng Card Bảo Vệ Quyền Riêng Tư (Restricted Locked Gateway)
    const contentRow = document.querySelector('.container .row.g-4') || document.querySelector('#main-content .row.g-4');
    if (!contentRow) return;

    const openRoles = Array.isArray(roles) ? roles.filter(r => !r.is_filled) : [];

    let statusBoxHtml = '';
    let actionButtonsCta = '';

    if (!currentUser) {
        statusBoxHtml = `
            <div class="alert alert-info border-info d-inline-block text-start mb-4 p-3 px-4 rounded-3 shadow-sm" style="max-width: 620px;">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-info-circle-fill fs-5 text-info"></i>
                    <strong>Bạn chưa đăng nhập vào ProjectHub</strong>
                </div>
                <div class="small text-secondary">
                    Vui lòng đăng nhập để gửi yêu cầu tham gia dự án. Sau khi được Chủ dự án chấp thuận, bạn sẽ có quyền xem toàn bộ nội dung, nhiệm vụ và làm việc cùng nhóm.
                </div>
            </div>
        `;
        actionButtonsCta = `
            <a href="login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}" class="btn btn-primary px-4 py-2 fw-semibold shadow-sm">
                <i class="bi bi-box-arrow-in-right me-1"></i> Đăng nhập để tham gia
            </a>
            <a href="projects.html" class="btn btn-outline-secondary px-4 py-2">
                <i class="bi bi-arrow-left me-1"></i> Khám phá dự án khác
            </a>
        `;
    } else if (myLatestRequest && myLatestRequest.status === 'pending') {
        statusBoxHtml = `
            <div class="alert alert-warning border-warning d-inline-block text-start mb-4 p-3 px-4 rounded-3 shadow-sm" style="max-width: 620px;">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-hourglass-split fs-5 text-warning"></i>
                    <strong>Yêu cầu tham gia của bạn đang chờ phê duyệt</strong>
                </div>
                <div class="small text-secondary">
                    Vị trí ứng tuyển: <strong class="text-dark">${sanitizeHTML(myLatestRequest.role_name || 'Thành viên dự án')}</strong>.<br>
                    Chủ dự án đang xem xét yêu cầu của bạn. Bạn sẽ nhận được thông báo ngay khi được phê duyệt và cấp quyền vào dự án.
                </div>
            </div>
        `;
        actionButtonsCta = `
            <button class="btn btn-outline-danger px-4 py-2 fw-semibold" onclick="cancelJoinRequest('${myLatestRequest.id}')">
                <i class="bi bi-x-circle me-1"></i> Hủy yêu cầu tham gia
            </button>
            <a href="projects.html" class="btn btn-outline-secondary px-4 py-2">
                <i class="bi bi-arrow-left me-1"></i> Xem các dự án khác
            </a>
        `;
    } else if (myLatestRequest && myLatestRequest.status === 'rejected') {
        statusBoxHtml = `
            <div class="alert alert-danger border-danger d-inline-block text-start mb-4 p-3 px-4 rounded-3 shadow-sm" style="max-width: 620px;">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-exclamation-octagon-fill fs-5 text-danger"></i>
                    <strong>Yêu cầu tham gia trước đó chưa được duyệt</strong>
                </div>
                <div class="small text-secondary">
                    Bạn có thể cập nhật thông tin và gửi lại yêu cầu tham gia mới với lời giới thiệu chi tiết hơn.
                </div>
            </div>
        `;
        actionButtonsCta = `
            <button class="btn btn-primary px-4 py-2 fw-semibold shadow-sm" data-bs-toggle="modal" data-bs-target="#join-modal">
                <i class="bi bi-arrow-repeat me-1"></i> Gửi lại yêu cầu tham gia
            </button>
            <a href="projects.html" class="btn btn-outline-secondary px-4 py-2">
                <i class="bi bi-arrow-left me-1"></i> Xem các dự án khác
            </a>
        `;
    } else if (isProjectFull) {
        statusBoxHtml = `
            <div class="alert alert-secondary border-secondary d-inline-block text-start mb-4 p-3 px-4 rounded-3 shadow-sm" style="max-width: 620px;">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <i class="bi bi-slash-circle fs-5 text-secondary"></i>
                    <strong>Dự án hiện đã đủ thành viên</strong>
                </div>
                <div class="small text-muted">
                    Dự án này đã tuyển đủ số lượng thành viên tối đa (${project.max_members || 5}/${project.max_members || 5}) và tạm dừng nhận thêm ứng viên mới.
                </div>
            </div>
        `;
        actionButtonsCta = `
            <a href="projects.html" class="btn btn-primary px-4 py-2 fw-semibold">
                <i class="bi bi-arrow-left me-1"></i> Tìm dự án đang tuyển khác
            </a>
        `;
    } else {
        actionButtonsCta = `
            <button class="btn btn-primary px-4 py-2 fw-semibold shadow-sm" data-bs-toggle="modal" data-bs-target="#join-modal">
                <i class="bi bi-person-plus-fill me-1"></i> Ứng tuyển / Gửi yêu cầu tham gia
            </button>
            <a href="projects.html" class="btn btn-outline-secondary px-4 py-2">
                <i class="bi bi-arrow-left me-1"></i> Xem các dự án khác
            </a>
        `;
    }

    let rolesPreviewHtml = '';
    if (openRoles.length > 0 && !isProjectFull) {
        rolesPreviewHtml = `
            <div class="mt-4 pt-3 border-top text-start" style="max-width: 760px; margin: 0 auto;">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="fw-bold mb-0 text-dark" style="font-family: 'Manrope', sans-serif;">
                        <i class="bi bi-briefcase-fill text-primary me-2"></i>Các vị trí dự án đang tuyển dụng (${openRoles.length})
                    </h5>
                    <span class="badge bg-primary bg-opacity-10 text-primary px-3 py-2">Đang tuyển</span>
                </div>
                <div class="row g-3">
                    ${openRoles.map(r => `
                        <div class="col-md-6">
                            <div class="p-3 rounded-3 border bg-white h-100 d-flex flex-column justify-content-between shadow-xs">
                                <div>
                                    <div class="fw-bold text-dark fs-6 mb-1">${sanitizeHTML(r.role_name)}</div>
                                    ${r.description ? `<p class="text-secondary small mb-2">${sanitizeHTML(r.description)}</p>` : ''}
                                    ${r.skills_needed && r.skills_needed.length > 0 ? `
                                        <div class="mb-3 d-flex flex-wrap gap-1">
                                            ${r.skills_needed.map(s => `<span class="badge bg-light text-dark border" style="font-size: 0.72rem;">${sanitizeHTML(s)}</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                <button class="btn btn-sm btn-outline-primary w-100 btn-apply-role mt-2" data-role-name="${sanitizeHTML(r.role_name)}">
                                    <i class="bi bi-send me-1"></i> Ứng tuyển vị trí này
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    contentRow.innerHTML = `
        <div class="col-12">
            <div class="card card-custom border-0 shadow-sm overflow-hidden" style="border-radius: 20px; background: linear-gradient(180deg, var(--surface, #ffffff) 0%, var(--surface-2, #f8fafc) 100%);">
                <div class="card-body p-4 p-md-5 text-center">
                    <div class="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow-sm" style="width: 84px; height: 84px; background: rgba(79, 70, 229, 0.1); color: var(--primary, #4F46E5);">
                        <i class="bi bi-shield-lock-fill" style="font-size: 2.75rem;"></i>
                    </div>
                    <h2 class="fw-bold text-dark mb-2" style="font-family: 'Manrope', sans-serif;">Nội dung dự án được bảo vệ</h2>
                    <p class="text-secondary mx-auto mb-4" style="max-width: 620px; font-size: 1.05rem; line-height: 1.6;">
                        Chỉ <strong>Chủ dự án</strong>, <strong>Thành viên đã tham gia</strong> hoặc <strong>Quản trị viên (Admin)</strong> mới có quyền xem chi tiết nhiệm vụ, tiến độ, tài liệu nội bộ và tương tác với dự án này.
                    </p>

                    ${statusBoxHtml}

                    <div class="d-flex flex-wrap justify-content-center gap-2 mb-3">
                        ${actionButtonsCta}
                    </div>

                    ${rolesPreviewHtml}
                </div>
            </div>
        </div>
    `;

    // Gắn sự kiện cho các nút ứng tuyển từng vị trí
    contentRow.querySelectorAll('.btn-apply-role').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!currentUser) {
                promptLoginToJoin();
                return;
            }
            const rName = btn.getAttribute('data-role-name');
            const joinRoleSelect = document.getElementById('join-role');
            if (joinRoleSelect && rName) {
                joinRoleSelect.value = rName;
            }
            if (typeof openProjectHubModal === 'function') {
                openProjectHubModal('#join-modal');
            } else if (typeof bootstrap !== 'undefined') {
                const modalEl = document.getElementById('join-modal');
                if (modalEl) new bootstrap.Modal(modalEl).show();
            }
        });
    });
}

/**
 * Render GitHub Repository Card trên trang chi tiết dự án
 */
async function renderProjectGitHubCard(githubUrl, isOwner, projectId) {
    const cardEl = document.getElementById('project-github-card');
    const unlinkedEl = document.getElementById('project-github-unlinked');
    const bodyEl = document.getElementById('project-github-body');
    const refreshBtn = document.getElementById('btn-refresh-github');
    const linkNowBtn = document.getElementById('link-github-now-btn');

    if (!cardEl || !unlinkedEl || !bodyEl) return;

    if (linkNowBtn) {
        linkNowBtn.href = `edit-project.html?id=${encodeURIComponent(projectId)}`;
    }

    if (!githubUrl || !githubUrl.trim()) {
        cardEl.style.display = 'none';
        if (isOwner) {
            unlinkedEl.style.display = 'block';
        } else {
            unlinkedEl.style.display = 'none';
        }
        return;
    }

    unlinkedEl.style.display = 'none';
    cardEl.style.display = 'block';

    async function fetchAndDisplay(refresh = false) {
        bodyEl.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                <div class="text-muted small">Đang tải dữ liệu từ GitHub...</div>
            </div>
        `;

        try {
            const url = `/api/github/repository?url=${encodeURIComponent(githubUrl)}${refresh ? '&refresh=true' : ''}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                bodyEl.innerHTML = `
                    <div class="alert alert-warning py-2 px-3 small mb-2">
                        <i class="bi bi-exclamation-triangle me-1"></i>${sanitizeHTML(data.error || 'Không thể tải thông tin repo.')}
                    </div>
                    <a href="${sanitizeHTML(githubUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-dark w-100">
                        <i class="bi bi-box-arrow-up-right me-1"></i>Truy cập liên kết
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

            const formattedDate = data.updated_at
                ? new Date(data.updated_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' })
                : '-';

            bodyEl.innerHTML = `
                <div class="d-flex align-items-start gap-2 mb-2">
                    ${data.owner_avatar ? `<img src="${sanitizeHTML(data.owner_avatar)}" class="rounded" width="24" height="24" alt="Owner">` : '<i class="bi bi-folder2 text-secondary"></i>'}
                    <div class="flex-grow-1 text-truncate">
                        <a href="${sanitizeHTML(data.html_url)}" target="_blank" rel="noopener noreferrer" class="fw-bold text-dark text-decoration-none hover-primary">
                            ${sanitizeHTML(data.full_name || data.name)}
                        </a>
                    </div>
                </div>

                ${data.description ? `<p class="text-muted small mb-3 text-break" style="max-height: 4.5em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${sanitizeHTML(data.description)}</p>` : '<p class="text-muted small fst-italic mb-3">Chưa có mô tả cho repository này.</p>'}

                <div class="d-flex flex-wrap gap-2 mb-3 small">
                    <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                        <i class="bi bi-star-fill text-warning"></i> ${Number(data.stars || 0).toLocaleString()}
                    </span>
                    <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                        <i class="bi bi-diagram-2 text-secondary"></i> ${Number(data.forks || 0).toLocaleString()}
                    </span>
                    <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                        <i class="bi bi-exclamation-circle text-info"></i> ${Number(data.open_issues || 0).toLocaleString()}
                    </span>
                    ${data.language ? `
                        <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                            <span class="d-inline-block rounded-circle" style="width: 8px; height: 8px; background-color: ${langColor};"></span>
                            ${sanitizeHTML(data.language)}
                        </span>
                    ` : ''}
                    <span class="badge bg-light text-dark border d-flex align-items-center gap-1">
                        <i class="bi bi-git"></i> ${sanitizeHTML(data.default_branch || 'main')}
                    </span>
                </div>

                <div class="d-flex justify-content-between align-items-center text-muted small mb-3">
                    <span><i class="bi bi-clock-history me-1"></i>Cập nhật: ${formattedDate}</span>
                </div>

                <a href="${sanitizeHTML(data.html_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-dark w-100 fw-medium">
                    <i class="bi bi-github me-1"></i>Xem trên GitHub
                </a>
            `;
        } catch (fetchErr) {
            console.error('GitHub fetch error:', fetchErr);
            bodyEl.innerHTML = `
                <div class="alert alert-danger py-2 px-3 small mb-2">
                    <i class="bi bi-exclamation-circle me-1"></i>Không thể kết nối đến máy chủ GitHub.
                </div>
            `;
        }
    }

    fetchAndDisplay(false);

    if (refreshBtn) {
        refreshBtn.onclick = (e) => {
            e.preventDefault();
            fetchAndDisplay(true);
        };
    }
}

/**
 * Phân tích dự án thông minh (AI Analysis widget)
 */
function renderAIAnalysis(project) {
    const aiLoading = document.getElementById('ai-loading');
    const aiResult  = document.getElementById('ai-result');
    const skillsEl  = document.getElementById('ai-skills');
    const techEl    = document.getElementById('ai-tech');
    const diffEl    = document.getElementById('ai-difficulty');
    const teamEl    = document.getElementById('ai-team-size');

    if (!aiLoading || !aiResult) return;

    // 1. Kỹ năng cần thiết
    const projectTechs = Array.isArray(project.technologies) ? project.technologies : [];
    const skillsList = [];

    const hasFrontend = projectTechs.some(t => /react|vue|angular|html|css|tailwind|flutter/i.test(t)) || /web|frontend|mobile/i.test(project.category || '');
    const hasBackend  = projectTechs.some(t => /node|express|python|django|fastapi|java|spring|php|laravel|go|c#/i.test(t)) || /backend|api|server/i.test(project.category || '');
    const hasDatabase = projectTechs.some(t => /sql|postgres|mysql|mongo|supabase|firebase|redis/i.test(t));

    if (hasFrontend) {
        skillsList.push('Thiết kế giao diện Responsive & Tối ưu trải nghiệm người dùng (UX/UI)');
        skillsList.push('Xây dựng component có tính tái sử dụng & Quản lý state logic');
    }
    if (hasBackend) {
        skillsList.push('Thiết kế & Xây dựng RESTful API / WebSocket thời gian thực');
        skillsList.push('Bảo mật dữ liệu, phân quyền người dùng (Auth/JWT) & Xử lý lỗi hệ thống');
    }
    if (hasDatabase) {
        skillsList.push('Mô hình hóa dữ liệu (ERD) & Viết truy vấn tối ưu hiệu năng');
    }
    skillsList.push('Quản lý mã nguồn với Git/GitHub flow & Phối hợp tiến độ linh hoạt qua Kanban');

    if (skillsEl) {
        skillsEl.innerHTML = skillsList.slice(0, 4).map(s => `<li class="mb-1">${sanitizeHTML(s)}</li>`).join('');
    }

    // 2. Công nghệ đề xuất
    const techSuggestions = new Set([...projectTechs]);
    if (hasFrontend && !projectTechs.some(t => /tailwind/i.test(t))) techSuggestions.add('Tailwind CSS');
    if (!projectTechs.some(t => /git/i.test(t))) techSuggestions.add('Git/GitHub');
    if (hasBackend && !projectTechs.some(t => /docker|postman/i.test(t))) techSuggestions.add('Postman');
    if (!projectTechs.some(t => /vercel|render|docker/i.test(t))) techSuggestions.add('Vercel');

    if (techEl) {
        techEl.innerHTML = Array.from(techSuggestions).slice(0, 6).map(t => 
            `<span class="badge bg-light text-dark border me-1 mb-1">${sanitizeHTML(t)}</span>`
        ).join('');
    }

    // 3. Độ khó dự án
    if (diffEl) {
        const diffConfig = {
            easy:   { label: 'Cơ bản / Nhập môn', cls: 'bg-success' },
            medium: { label: 'Trung bình / Thực chiến', cls: 'bg-warning text-dark' },
            hard:   { label: 'Nâng cao / Chuyên sâu', cls: 'bg-danger text-white' }
        };
        const cfg = diffConfig[project.difficulty] || diffConfig.medium;
        diffEl.textContent = cfg.label;
        diffEl.className = `badge ${cfg.cls} px-2 py-1`;
    }

    // 4. Quy mô đội nhóm lý tưởng
    if (teamEl) {
        const maxMem = project.max_members || 4;
        teamEl.textContent = `${maxMem} thành viên (Quy mô tối ưu để phân chia rõ vai trò Frontend, Backend và Đảm bảo tiến độ)`;
    }

    // Ẩn spinner & hiển thị kết quả
    aiLoading.classList.add('d-none');
    aiResult.classList.remove('d-none');
}

/**
 * Tải danh sách dự án liên quan ở Sidebar
 */
async function loadRelatedProjects(project) {
    const container = document.getElementById('related-projects');
    if (!container || !project) return;

    try {
        const supabase = getDB();
        let query = supabase
            .from('projects')
            .select('id, title, category, technologies, difficulty, image_url')
            .neq('id', project.id)
            .eq('is_public', true);

        if (project.category) {
            query = query.eq('category', project.category);
        }

        let { data: related, error } = await query.limit(3);
        if (error || !related || related.length === 0) {
            // Fallback: lấy 3 dự án công khai bất kỳ khác
            const { data: fallback } = await supabase
                .from('projects')
                .select('id, title, category, technologies, difficulty, image_url')
                .neq('id', project.id)
                .eq('is_public', true)
                .limit(3);
            related = fallback || [];
        }

        if (related.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted small">Chưa có dự án liên quan khác.</div>';
            return;
        }

        container.innerHTML = related.map(p => {
            const techs = (p.technologies || []).slice(0, 2).map(t => `<span class="badge bg-light text-secondary border me-1" style="font-size:0.7rem;">${sanitizeHTML(t)}</span>`).join('');
            return `
                <a href="project-detail.html?id=${p.id}" class="list-group-item list-group-item-action p-3 text-decoration-none">
                    <div class="fw-semibold text-dark mb-1 text-truncate">${sanitizeHTML(p.title)}</div>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">${sanitizeHTML(p.category || 'Khác')}</small>
                        <div>${techs}</div>
                    </div>
                </a>
            `;
        }).join('');
    } catch (err) {
        console.warn('Load related projects error:', err);
        container.innerHTML = '<div class="text-center p-4 text-muted small">Chưa có dự án liên quan khác.</div>';
    }
}

/**
 * Section 7: Xử lý Đánh giá 5 sao & Nhận xét từ cộng đồng (Pure HTML/CSS 5-Star Rating Component)
 */
function setupProjectReviews(project, ctx) {
    const ratingContainer = document.getElementById('interactive-star-rating');
    const statusTextEl    = document.getElementById('rating-status-text');
    const submitBtn       = document.getElementById('btn-submit-review');
    const commentInput    = document.getElementById('review-comment-input');
    const reviewsList     = document.getElementById('community-reviews-list');

    if (!ratingContainer || !reviewsList) return;

    const sanitize = (typeof sanitizeHTML === 'function') ? sanitizeHTML : (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

    const RATING_TEXTS = {
        '5': 'Tuyệt vời (5/5 sao)',
        '4': 'Rất tốt (4/5 sao)',
        '3': 'Khá tốt (3/5 sao)',
        '2': 'Tạm ổn (2/5 sao)',
        '1': 'Cần cải thiện (1/5 sao)'
    };

    // 1. Phản hồi trực quan động khi click chọn mức sao
    const radioInputs = ratingContainer.querySelectorAll('input[type="radio"]');
    radioInputs.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            if (statusTextEl && RATING_TEXTS[val]) {
                statusTextEl.textContent = RATING_TEXTS[val];
                statusTextEl.className = 'badge bg-warning-subtle text-warning border border-warning-subtle fw-semibold px-3 py-2 rounded-pill';
            }
        });
    });

    // 2. Tải các đánh giá đã lưu trong localStorage (nếu có)
    const storageKey = `project_reviews_${project.id}`;
    let savedReviews = [];
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            savedReviews = JSON.parse(stored);
            if (Array.isArray(savedReviews)) {
                // Đảo ngược để khi prepend các review mới nhất sẽ lên trên cùng
                [...savedReviews].reverse().forEach(rev => {
                    const card = createReviewCardElement(rev, sanitize);
                    reviewsList.prepend(card);
                });
            }
        }
    } catch (e) {
        console.warn('Lỗi đọc reviews từ localStorage:', e);
    }

    // 3. Xử lý gửi đánh giá
    if (submitBtn && !submitBtn.dataset.bound) {
        submitBtn.dataset.bound = 'true';
        submitBtn.addEventListener('click', () => {
            const comment = commentInput ? commentInput.value.trim() : '';
            if (!comment) {
                if (typeof showToast === 'function') {
                    showToast('Vui lòng nhập nội dung đánh giá của bạn!', 'warning');
                } else {
                    alert('Vui lòng nhập nội dung đánh giá của bạn!');
                }
                if (commentInput) commentInput.focus();
                return;
            }

            const checkedRadio = ratingContainer.querySelector('input[name="rate"]:checked');
            const ratingValue = checkedRadio ? parseInt(checkedRadio.value, 10) : 5;

            const currentUser = ctx?.currentUser;
            const currentProfile = ctx?.currentProfile;
            const authorName = currentProfile?.display_name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Thành viên cộng đồng');
            const authorSub = currentProfile?.skills?.join(', ') || 'Thành viên ProjectHub';
            const avatarUrl = currentProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=4F46E5&color=fff&size=64`;

            const newReview = {
                id: 'rev_' + Date.now(),
                authorName,
                authorSub,
                avatarUrl,
                rating: ratingValue,
                comment,
                createdAt: 'Vừa xong'
            };

            // Thêm review vào đầu danh sách
            const revCard = createReviewCardElement(newReview, sanitize);
            reviewsList.prepend(revCard);

            // Lưu vào localStorage
            try {
                const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
                stored.unshift(newReview);
                localStorage.setItem(storageKey, JSON.stringify(stored.slice(0, 30)));
            } catch (err) {
                console.warn('Lỗi lưu review vào localStorage:', err);
            }

            // Reset form
            if (commentInput) commentInput.value = '';
            const star5 = document.getElementById('star5');
            if (star5) {
                star5.checked = true;
                if (statusTextEl) {
                    statusTextEl.textContent = RATING_TEXTS['5'];
                    statusTextEl.className = 'badge bg-primary-subtle text-primary border border-primary-subtle fw-semibold px-3 py-2 rounded-pill';
                }
            }

            // Thông báo thành công
            if (typeof showToast === 'function') {
                showToast('Cảm ơn bạn đã gửi đánh giá cho dự án!', 'success');
            }
        });
    }
}

/**
 * Khởi tạo phần tử HTML thẻ review
 */
function createReviewCardElement(rev, sanitize) {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-3 border bg-white review-card-item shadow-sm';
    
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rev.rating) {
            starsHtml += '<i class="bi bi-star-fill text-warning me-1"></i>';
        } else {
            starsHtml += '<i class="bi bi-star text-muted me-1"></i>';
        }
    }

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="d-flex align-items-center gap-2">
                <img src="${sanitize(rev.avatarUrl)}" width="36" height="36" class="rounded-circle" alt="${sanitize(rev.authorName)}">
                <div>
                    <div class="fw-semibold text-dark small">${sanitize(rev.authorName)}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${sanitize(rev.authorSub)} • ${sanitize(rev.createdAt || 'Gần đây')}</div>
                </div>
            </div>
            <div class="small d-flex align-items-center">
                ${starsHtml}
            </div>
        </div>
        <p class="text-secondary small mb-0">${sanitize(rev.comment)}</p>
    `;
    return card;
}

/**
 * Render danh sách thành viên nhóm (Owner + Members)
 */
function renderTeamMembersList(project, members, { currentUser, isOwner, isAdmin }) {
    const container = document.getElementById('team-members-list');
    const badgeCount = document.getElementById('team-members-count');
    if (!container) return;

    const totalCount = (members ? members.length : 0) + 1;
    if (badgeCount) badgeCount.textContent = `${totalCount} người`;

    const owner = project.profiles || {};
    const ownerName = sanitizeHTML(owner.display_name || 'Chủ dự án');
    const ownerAvatar = owner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName)}&background=4F46E5&color=fff&size=64`;

    let html = `
        <div class="d-flex align-items-center justify-content-between p-2 rounded bg-light">
            <div class="d-flex align-items-center gap-2">
                <img src="${ownerAvatar}" class="rounded-circle" width="36" height="36" style="object-fit:cover" alt="${ownerName}">
                <div>
                    <div class="fw-semibold small text-truncate" style="max-width: 150px;">${ownerName}</div>
                    <span class="badge bg-primary bg-opacity-10 text-primary" style="font-size: 0.7rem;">Chủ dự án</span>
                </div>
            </div>
            <a href="profile.html?user=${project.owner_id}" class="btn btn-sm btn-link text-decoration-none p-0">Hồ sơ</a>
        </div>
    `;

    if (members && members.length > 0) {
        html += members.map(m => {
            const prof = m.profiles || {};
            const mName = sanitizeHTML(prof.display_name || 'Thành viên');
            const mAvatar = prof.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(mName)}&background=10B981&color=fff&size=64`;
            const roleName = sanitizeHTML(m.role_name || 'Thành viên');
            const isMe = currentUser && currentUser.id === m.user_id;

            return `
                <div class="d-flex align-items-center justify-content-between p-2 rounded border-bottom">
                    <div class="d-flex align-items-center gap-2">
                        <img src="${mAvatar}" class="rounded-circle" width="36" height="36" style="object-fit:cover" alt="${mName}">
                        <div>
                            <div class="fw-medium small text-truncate" style="max-width: 140px;">
                                ${mName} ${isMe ? '<span class="text-primary">(Bạn)</span>' : ''}
                            </div>
                            <span class="text-muted" style="font-size: 0.75rem;"><i class="bi bi-person-badge me-1"></i>${roleName}</span>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-1">
                        <a href="profile.html?user=${m.user_id}" class="btn btn-sm btn-light border p-1 px-2" title="Xem hồ sơ">
                            <i class="bi bi-person"></i>
                        </a>
                        ${(isOwner || isAdmin) ? `
                        <button class="btn btn-sm btn-outline-danger p-1 px-2" title="Xóa khỏi team" onclick="removeTeamMember('${project.id}', '${m.user_id}', '${mName}')">
                            <i class="bi bi-trash"></i>
                        </button>` : ''}
                        ${isMe && !isOwner ? `
                        <button class="btn btn-sm btn-outline-secondary p-1 px-2" title="Rời dự án" onclick="leaveTeamMember('${project.id}')">
                            <i class="bi bi-box-arrow-right"></i>
                        </button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = html;
}

/**
 * Render nút thao tác động trên Project Detail
 */
function renderActionButtons(project, { currentUser, isOwner, isMember, isAdmin, isProjectFull, myLatestRequest }) {
    const actionButtons = document.getElementById('action-buttons');
    if (!actionButtons) return;

    // 1. Trường hợp là OWNER
    if (isOwner) {
        actionButtons.innerHTML = `
            <a href="workspace.html?id=${project.id}" class="btn btn-success">
                <i class="bi bi-kanban me-1"></i>Workspace
            </a>
            <button class="btn btn-outline-secondary btn-share-project">
                <i class="bi bi-share me-1"></i>Chia sẻ
            </button>
            <a href="edit-project.html?id=${project.id}" class="btn btn-outline-warning">
                <i class="bi bi-pencil-square me-1"></i>Sửa dự án
            </a>
            <button class="btn btn-outline-danger" id="btn-delete-project">
                <i class="bi bi-trash me-1"></i>Xóa
            </button>
            <a href="#owner-requests-card" class="btn btn-primary" onclick="document.getElementById('owner-requests-card')?.scrollIntoView({behavior:'smooth'})">
                <i class="bi bi-people me-1"></i>Quản lý thành viên
            </a>
        `;

        document.getElementById('btn-delete-project')?.addEventListener('click', () => {
            if (typeof showConfirmModal === 'function') {
                showConfirmModal(
                    'Xóa dự án',
                    `Bạn có chắc muốn xóa dự án "${project.title}"? Hành động này không thể hoàn tác.`,
                    () => deleteProjectAndRedirect(project.id)
                );
            } else if (confirm(`Xóa dự án "${project.title}"? Không thể hoàn tác!`)) {
                deleteProjectAndRedirect(project.id);
            }
        });
    } else if (isAdmin) {
        // 1.5. Trường hợp là ADMIN (Quản trị viên)
        actionButtons.innerHTML = `
            <a href="workspace.html?id=${project.id}" class="btn btn-success">
                <i class="bi bi-kanban me-1"></i>Workspace (Admin)
            </a>
            <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
            <span class="badge bg-danger text-white d-flex align-items-center p-2 px-3 fs-6">
                <i class="bi bi-shield-check me-1"></i>Quản trị viên
            </span>
            <a href="edit-project.html?id=${project.id}" class="btn btn-outline-warning">
                <i class="bi bi-pencil-square me-1"></i>Sửa (Admin)
            </a>
            <button class="btn btn-outline-danger" id="btn-delete-project">
                <i class="bi bi-trash me-1"></i>Xóa
            </button>
            <a href="#owner-requests-card" class="btn btn-primary" onclick="document.getElementById('owner-requests-card')?.scrollIntoView({behavior:'smooth'})">
                <i class="bi bi-people me-1"></i>Quản lý thành viên
            </a>
        `;

        document.getElementById('btn-delete-project')?.addEventListener('click', () => {
            if (typeof showConfirmModal === 'function') {
                showConfirmModal(
                    'Xóa dự án (Admin)',
                    `Bạn có chắc muốn xóa dự án "${project.title}" với tư cách Quản trị viên? Hành động này không thể hoàn tác.`,
                    () => deleteProjectAndRedirect(project.id)
                );
            } else if (confirm(`Xóa dự án "${project.title}"? Không thể hoàn tác!`)) {
                deleteProjectAndRedirect(project.id);
            }
        });
    } else if (isMember) {
        // 2. Trường hợp là THÀNH VIÊN ĐÃ ĐƯỢC DUYỆT
        actionButtons.innerHTML = `
            <a href="workspace.html?id=${project.id}" class="btn btn-success">
                <i class="bi bi-kanban me-1"></i>Vào Workspace
            </a>
            <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
            <span class="badge bg-success d-flex align-items-center p-2 px-3 fs-6">
                <i class="bi bi-check-circle-fill me-2"></i>Bạn là thành viên
            </span>
            <button class="btn btn-outline-danger btn-sm" onclick="leaveTeamMember('${project.id}')">
                <i class="bi bi-box-arrow-right me-1"></i>Rời dự án
            </button>
        `;
    } else if (myLatestRequest && myLatestRequest.status === 'pending') {
        // 3. Trường hợp ĐÃ GỬI YÊU CẦU VÀ ĐANG CHỜ DUYỆT (PENDING)
        actionButtons.innerHTML = `
            <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
            <span class="badge bg-warning text-dark d-flex align-items-center p-2 px-3 fs-6">
                <i class="bi bi-clock-history me-2"></i>Đã gửi yêu cầu tham gia
            </span>
            <button class="btn btn-outline-danger" onclick="cancelJoinRequest('${myLatestRequest.id}')">
                <i class="bi bi-x-circle me-1"></i>Hủy yêu cầu
            </button>
        `;
    } else if (isProjectFull) {
        // 4. Dự án đã đủ thành viên
        actionButtons.innerHTML = `
            <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
            <button class="btn btn-secondary" disabled>
                <i class="bi bi-slash-circle me-1"></i>Đã đủ thành viên (${project.max_members || 5}/${project.max_members || 5})
            </button>
        `;
    } else if (project.status !== 'recruiting') {
        // 5. Dự án không trong trạng thái tuyển dụng
        actionButtons.innerHTML = `
            <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
            <button class="btn btn-secondary" disabled>
                <i class="bi bi-lock me-1"></i>Dự án hiện không tuyển thành viên
            </button>
        `;
    } else {
        // 6. Người dùng bình thường / Khách chưa gửi yêu cầu
        actionButtons.innerHTML = `
            <button class="btn btn-outline-secondary btn-share-project"><i class="bi bi-share me-1"></i>Chia sẻ</button>
            <button class="btn btn-primary" id="btn-join-project" ${currentUser ? 'data-bs-toggle="modal" data-bs-target="#join-modal"' : 'onclick="promptLoginToJoin()"'}>
                <i class="bi bi-person-plus me-1"></i>Tham gia dự án
            </button>
        `;

        const joinBtn = document.getElementById('btn-join-project');
        if (joinBtn && currentUser) {
            joinBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof openProjectHubModal === 'function') {
                    openProjectHubModal('#join-modal');
                }
            });
        }
    }

    // Xử lý sự kiện sao chép liên kết chia sẻ dự án
    actionButtons.querySelectorAll('.btn-share-project').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = window.location.href;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    if (typeof showToast === 'function') {
                        showToast('Đã sao chép liên kết dự án vào clipboard!', 'success');
                    } else {
                        alert('Đã sao chép liên kết dự án vào clipboard!');
                    }
                }).catch(() => {
                    prompt('Sao chép liên kết dự án:', url);
                });
            } else {
                prompt('Sao chép liên kết dự án:', url);
            }
        });
    });
}

function promptLoginToJoin() {
    if (typeof showToast === 'function') {
        showToast('Vui lòng đăng nhập để gửi yêu cầu tham gia dự án.', 'info');
    }
    const currentUrl = window.location.pathname.split('/').pop() + window.location.search;
    setTimeout(() => {
        window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
    }, 1000);
}

/**
 * Thiết lập danh sách vị trí ứng tuyển và modal gửi yêu cầu
 */
function setupOpenPositions(roles, isProjectFull, project) {
    const posCard  = document.getElementById('open-positions-card');
    const posList  = document.getElementById('open-positions-list');
    const posCount = document.getElementById('open-positions-count');
    const joinRole = document.getElementById('join-role');
    const submitBtn = document.getElementById('btn-submit-join');

    const openRoles = Array.isArray(roles) ? roles.filter(r => !r.is_filled) : [];

    if (posCount) posCount.textContent = openRoles.length;

    // Dropdown chọn role trong modal
    if (joinRole) {
        if (openRoles.length > 0) {
            joinRole.innerHTML = '<option value="">-- Chọn vị trí --</option>' +
                openRoles.map(r => `<option value="${sanitizeHTML(r.role_name)}" data-role-id="${r.id}">${sanitizeHTML(r.role_name)}</option>`).join('');
        } else {
            joinRole.innerHTML = '<option value="Thành viên dự án">Thành viên chung</option>';
        }
    }

    if (posList) {
        if (isProjectFull) {
            posList.innerHTML = '<div class="text-center text-muted py-2">Dự án đã đủ thành viên.</div>';
        } else if (openRoles.length > 0) {
            posList.innerHTML = openRoles.map(r => `
                <div class="role-card">
                    <div class="fw-bold mb-1">${sanitizeHTML(r.role_name)}</div>
                    ${r.description ? `<div class="text-muted small mb-2">${sanitizeHTML(r.description)}</div>` : ''}
                    ${r.skills_needed?.length ? `<div class="mb-2">${r.skills_needed.map(s => `<span class="badge bg-light text-dark border me-1">${sanitizeHTML(s)}</span>`).join('')}</div>` : ''}
                    <button class="btn btn-sm btn-outline-primary w-100 btn-apply-role" data-role-name="${sanitizeHTML(r.role_name)}">
                        Ứng tuyển vị trí này
                    </button>
                </div>
            `).join('');

            posList.querySelectorAll('.btn-apply-role').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rName = btn.getAttribute('data-role-name');
                    const joinRoleSelect = document.getElementById('join-role');
                    if (joinRoleSelect && rName) {
                        joinRoleSelect.value = rName;
                    }
                    if (typeof openProjectHubModal === 'function') {
                        openProjectHubModal('#join-modal');
                    }
                });
            });
        } else {
            posList.innerHTML = '<div class="text-center text-muted py-2">Không có vị trí tuyển cụ thể.</div>';
        }
    }

    // Xử lý gửi yêu cầu tham gia (Submit Join Form)
    if (submitBtn) {
        // Xóa listener cũ bằng cloneNode
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

        newSubmitBtn.addEventListener('click', async () => {
            const roleSelect = document.getElementById('join-role');
            const messageEl  = document.getElementById('join-message');

            const roleName = roleSelect?.value?.trim() || 'Thành viên dự án';
            const selectedOpt = roleSelect?.options[roleSelect?.selectedIndex];
            const roleId = selectedOpt?.dataset?.roleId || null;
            const message  = messageEl?.value?.trim() || '';

            if (!message) {
                if (typeof showToast === 'function') showToast('Vui lòng nhập lời giới thiệu ngắn.', 'warning');
                return;
            }

            newSubmitBtn.disabled = true;
            newSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang gửi...';

            try {
                const currentUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
                if (!currentUser) throw new Error('Vui lòng đăng nhập trước khi gửi yêu cầu.');

                const supabase = getDB();
                const { error } = await supabase
                    .from('project_join_requests')
                    .insert({
                        project_id: project.id,
                        user_id: currentUser.id,
                        role_id: roleId,
                        role_name: roleName,
                        message: message,
                        status: 'pending'
                    });

                if (error) {
                    if (error.code === '23505') {
                        throw new Error('Bạn đã có yêu cầu đang chờ duyệt cho dự án này.');
                    }
                    throw error;
                }

                // Phase 6: Gửi thông báo đến Chủ dự án
                if (typeof createNotification === 'function' && project && project.owner_id) {
                    const applicantName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Thành viên mới';
                    createNotification({
                        userId: project.owner_id,
                        projectId: project.id,
                        type: 'join_request',
                        title: 'Yêu cầu tham gia dự án mới',
                        message: `${applicantName} muốn ứng tuyển vị trí "${roleName}" trong dự án "${project.title}".`,
                        actionUrl: `project-detail.html?id=${project.id}`,
                        data: { applicant_id: currentUser.id, role_name: roleName }
                    });
                }

                // Ẩn modal và dọn dẹp backdrop
                const modalEl = document.getElementById('join-modal');
                if (modalEl) {
                    if (typeof closeProjectHubModal === 'function') {
                        closeProjectHubModal(modalEl);
                    } else if (typeof bootstrap !== 'undefined') {
                        const bsModal = bootstrap.Modal.getInstance(modalEl);
                        if (bsModal) bsModal.hide();
                    }
                }

                if (typeof showToast === 'function') showToast('Đã gửi yêu cầu tham gia thành công!', 'success');
                setTimeout(() => initProjectDetailPage(), 600);

            } catch (err) {
                console.error('Submit join request error:', err);
                if (typeof showToast === 'function') showToast(err.message || 'Lỗi gửi yêu cầu', 'error');
            } finally {
                newSubmitBtn.disabled = false;
                newSubmitBtn.innerHTML = 'Gửi yêu cầu';
            }
        });
    }
}

/**
 * Render khu vực quản lý yêu cầu tham gia (dành riêng cho Owner)
 */
function renderOwnerRequestsList(requests, project) {
    const card = document.getElementById('owner-requests-card');
    const container = document.getElementById('owner-requests-list');
    const countBadge = document.getElementById('pending-requests-count');
    if (!card || !container) return;

    card.classList.remove('d-none');

    const pendingReqs = Array.isArray(requests) ? requests : [];
    if (countBadge) countBadge.textContent = `${pendingReqs.length} yêu cầu mới`;

    if (pendingReqs.length === 0) {
        container.innerHTML = `
            <div class="p-4 text-center text-muted">
                <i class="bi bi-inbox fs-3 mb-2 d-block"></i>
                <span>Chưa có yêu cầu tham gia mới nào.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = pendingReqs.map(req => {
        const prof = req.profiles || {};
        const appName = sanitizeHTML(prof.display_name || 'Ứng viên');
        const appAvatar = prof.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(appName)}&background=4F46E5&color=fff&size=64`;
        const appUsername = sanitizeHTML(prof.username || '');
        const role = sanitizeHTML(req.role_name || 'Thành viên');
        const msg = sanitizeHTML(req.message || '');
        const time = typeof timeAgo === 'function' ? timeAgo(req.created_at) : new Date(req.created_at).toLocaleDateString('vi-VN');

        const skills = (prof.skills || []).slice(0, 4).map(s => `<span class="badge bg-light text-dark border me-1">${sanitizeHTML(s)}</span>`).join('');

        return `
            <div class="list-group-item p-3">
                <div class="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
                    <div class="d-flex gap-3">
                        <img src="${appAvatar}" class="rounded-circle mt-1" width="48" height="48" style="object-fit:cover;" alt="${appName}">
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <h6 class="mb-0 fw-bold">${appName}</h6>
                                <span class="badge bg-primary bg-opacity-10 text-primary small">${role}</span>
                            </div>
                            <small class="text-muted d-block mb-1">@${appUsername} · ${time}</small>
                            <p class="mb-2 small text-secondary bg-light p-2 rounded">${msg}</p>
                            <div class="d-flex flex-wrap gap-1">${skills}</div>
                        </div>
                    </div>
                    <div class="d-flex flex-md-column gap-2 ms-auto flex-shrink-0">
                        <button class="btn btn-sm btn-success px-3" onclick="acceptJoinRequest('${req.id}', '${appName}')">
                            <i class="bi bi-check-lg me-1"></i>Chấp nhận
                        </button>
                        <button class="btn btn-sm btn-outline-danger px-3" onclick="rejectJoinRequest('${req.id}', '${appName}')">
                            <i class="bi bi-x-lg me-1"></i>Từ chối
                        </button>
                        <a href="profile.html?user=${req.user_id}" class="btn btn-sm btn-outline-primary px-3">
                            <i class="bi bi-person me-1"></i>Hồ sơ
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Xử lý chấp nhận yêu cầu tham gia (Chủ dự án - Atomic RPC)
 */
async function acceptJoinRequest(requestId, applicantName) {
    try {
        const supabase = getDB();

        // Lấy thông tin request trước khi duyệt
        const { data: reqInfo } = await supabase
            .from('project_join_requests')
            .select('user_id, project_id, projects:project_id(title)')
            .eq('id', requestId)
            .single();

        // Gọi RPC nguyên tử accept_join_request
        const { data, error } = await supabase.rpc('accept_join_request', { p_request_id: requestId });

        if (error) throw error;
        if (data && data.success === false) {
            throw new Error(data.error || 'Không thể chấp nhận yêu cầu.');
        }

        // Phase 6: Gửi thông báo đến ứng viên
        if (reqInfo && typeof createNotification === 'function') {
            const projectTitle = reqInfo.projects?.title || 'Dự án';
            createNotification({
                userId: reqInfo.user_id,
                projectId: reqInfo.project_id,
                type: 'join_request_accepted',
                title: 'Yêu cầu tham gia được chấp nhận!',
                message: `Chúc mừng! Bạn đã chính thức trở thành thành viên của dự án "${projectTitle}".`,
                actionUrl: `workspace.html?id=${reqInfo.project_id}`
            });
        }

        if (typeof showToast === 'function') {
            showToast(`Đã thêm ${applicantName || 'thành viên'} vào dự án!`, 'success');
        }
        setTimeout(() => initProjectDetailPage(), 500);

    } catch (err) {
        console.error('Accept join request error:', err);
        if (typeof showToast === 'function') {
            showToast(err.message || 'Lỗi khi chấp nhận yêu cầu', 'error');
        }
    }
}

/**
 * Xử lý từ chối yêu cầu tham gia (Chủ dự án)
 */
async function rejectJoinRequest(requestId, applicantName) {
    if (!confirm(`Bạn có chắc muốn từ chối yêu cầu của ${applicantName || 'ứng viên'}?`)) return;

    try {
        const supabase = getDB();

        // Lấy thông tin request trước khi từ chối
        const { data: reqInfo } = await supabase
            .from('project_join_requests')
            .select('user_id, project_id, projects:project_id(title)')
            .eq('id', requestId)
            .single();

        const { error } = await supabase
            .from('project_join_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId);

        if (error) throw error;

        // Phase 6: Gửi thông báo đến ứng viên
        if (reqInfo && typeof createNotification === 'function') {
            const projectTitle = reqInfo.projects?.title || 'Dự án';
            createNotification({
                userId: reqInfo.user_id,
                projectId: reqInfo.project_id,
                type: 'join_request_rejected',
                title: 'Yêu cầu tham gia không được duyệt',
                message: `Yêu cầu tham gia dự án "${projectTitle}" của bạn đã bị từ chối.`,
                actionUrl: `project-detail.html?id=${reqInfo.project_id}`
            });
        }

        if (typeof showToast === 'function') {
            showToast(`Đã từ chối yêu cầu của ${applicantName || 'ứng viên'}.`, 'info');
        }
        setTimeout(() => initProjectDetailPage(), 500);

    } catch (err) {
        console.error('Reject join request error:', err);
        if (typeof showToast === 'function') {
            showToast(err.message || 'Lỗi khi từ chối yêu cầu', 'error');
        }
    }
}

/**
 * Hủy yêu cầu tham gia đã gửi (Người gửi)
 */
async function cancelJoinRequest(requestId) {
    if (!confirm('Bạn có chắc muốn hủy yêu cầu tham gia dự án này?')) return;

    try {
        const supabase = getDB();
        const { error } = await supabase
            .from('project_join_requests')
            .update({ status: 'cancelled' })
            .eq('id', requestId);

        if (error) throw error;

        if (typeof showToast === 'function') {
            showToast('Đã hủy yêu cầu tham gia.', 'success');
        }
        setTimeout(() => initProjectDetailPage(), 500);

    } catch (err) {
        console.error('Cancel join request error:', err);
        if (typeof showToast === 'function') {
            showToast(err.message || 'Lỗi khi hủy yêu cầu', 'error');
        }
    }
}

/**
 * Xóa thành viên khỏi dự án (Chủ dự án)
 */
async function removeTeamMember(projectId, userId, memberName) {
    if (!confirm(`Bạn có chắc muốn xóa "${memberName}" khỏi danh sách thành viên dự án?`)) return;

    try {
        const supabase = getDB();
        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw error;

        // Phase 6: Gửi thông báo tới thành viên bị xóa
        if (typeof createNotification === 'function' && userId) {
            createNotification({
                userId: userId,
                projectId: projectId,
                type: 'member_removed',
                title: 'Thông báo rời dự án',
                message: `Bạn đã được đưa ra khỏi danh sách thành viên của dự án.`,
                actionUrl: `projects.html`
            });
        }

        if (typeof showToast === 'function') {
            showToast(`Đã xóa ${memberName} khỏi nhóm.`, 'info');
        }
        setTimeout(() => initProjectDetailPage(), 500);

    } catch (err) {
        console.error('Remove team member error:', err);
        if (typeof showToast === 'function') {
            showToast(err.message || 'Lỗi khi xóa thành viên', 'error');
        }
    }
}

/**
 * Tự rời khỏi dự án (Thành viên)
 */
async function leaveTeamMember(projectId) {
    if (!confirm('Bạn có chắc muốn rời khỏi dự án này?')) return;

    try {
        const currentUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
        if (!currentUser) return;

        const supabase = getDB();
        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', currentUser.id);

        if (error) throw error;

        if (typeof showToast === 'function') {
            showToast('Bạn đã rời khỏi dự án.', 'info');
        }
        setTimeout(() => initProjectDetailPage(), 500);

    } catch (err) {
        console.error('Leave project error:', err);
        if (typeof showToast === 'function') {
            showToast(err.message || 'Lỗi khi rời dự án', 'error');
        }
    }
}

/**
 * Thiết lập widget AI Matching trên Project Detail
 */
async function setupDetailMatchingWidget(project, { isOwner, isMember, currentUser, currentProfile }) {
    // 1. OWNER VIEW: Gợi ý các ứng viên tiềm năng
    if (isOwner) {
        const candidatesCard = document.getElementById('owner-candidates-card');
        const candidatesList = document.getElementById('owner-candidates-list');

        if (candidatesCard && candidatesList && typeof window.findMatchingCandidates === 'function') {
            candidatesCard.classList.remove('d-none');
            const topCandidates = await window.findMatchingCandidates(project);

            if (topCandidates && topCandidates.length > 0) {
                candidatesList.innerHTML = topCandidates.slice(0, 3).map(c => {
                    const cName = sanitizeHTML(c.display_name || 'Ứng viên');
                    const cAvatar = c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(cName)}&background=4F46E5&color=fff&size=64`;
                    const scoreColor = c.matchScore >= 80 ? 'success' : (c.matchScore >= 60 ? 'primary' : 'warning');
                    const matchedSkills = (c.matchedSkills || []).slice(0, 3).map(s => `<span class="badge bg-success bg-opacity-10 text-success border me-1">${sanitizeHTML(s)}</span>`).join('');

                    return `
                        <div class="col-md-4">
                            <div class="card border p-3 h-100 position-relative">
                                <span class="position-absolute top-0 end-0 m-2 badge bg-${scoreColor}">${c.matchScore}% Phù hợp</span>
                                <div class="text-center mb-2">
                                    <img src="${cAvatar}" class="rounded-circle mb-1" width="48" height="48" style="object-fit:cover;" alt="${cName}">
                                    <h6 class="mb-0 fw-bold text-truncate" title="${cName}">${cName}</h6>
                                    <small class="text-muted">@${sanitizeHTML(c.username || '')}</small>
                                </div>
                                <div class="mb-2 small">
                                    <span class="text-muted d-block mb-1">Kỹ năng khớp:</span>
                                    <div class="d-flex flex-wrap gap-1">${matchedSkills || '<span class="text-muted">Chưa có</span>'}</div>
                                </div>
                                <a href="profile.html?user=${c.id}" class="btn btn-sm btn-outline-primary mt-auto w-100">
                                    <i class="bi bi-person me-1"></i>Xem hồ sơ
                                </a>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                candidatesList.innerHTML = '<div class="col-12 text-muted text-center py-2">Chưa tìm thấy ứng viên phù hợp cho dự án này.</div>';
            }
        }
        return;
    }

    // 2. APPLICANT / VIEWER VIEW: Hiển thị mức độ phù hợp của bản thân với dự án
    if (currentUser && !isOwner && typeof window.calculateMatchScore === 'function') {
        const userMatchCard = document.getElementById('user-match-card');
        const matchScoreEl  = document.getElementById('user-match-score');
        const matchBarEl    = document.getElementById('user-match-bar');
        const matchSkillsEl = document.getElementById('user-match-skills');
        const matchReasonEl = document.getElementById('user-match-reason');

        if (userMatchCard) {
            userMatchCard.classList.remove('d-none');

            const profileToMatch = currentProfile || {
                skills: currentUser.user_metadata?.skills || [],
                interests: currentUser.user_metadata?.interests || [],
                experience: 'intermediate'
            };

            const result = window.calculateMatchScore(profileToMatch, project);
            const scoreColor = result.score >= 80 ? 'success' : (result.score >= 60 ? 'primary' : 'warning');

            if (matchScoreEl) {
                matchScoreEl.textContent = `${result.score}% Phù hợp`;
                matchScoreEl.className = `badge bg-${scoreColor} fs-6 px-3 py-2`;
            }
            if (matchBarEl) {
                matchBarEl.style.width = `${result.score}%`;
                matchBarEl.className = `progress-bar bg-${scoreColor}`;
            }
            if (matchSkillsEl) {
                matchSkillsEl.innerHTML = (result.matchedSkills || []).map(s => 
                    `<span class="badge bg-success bg-opacity-10 text-success border border-success me-1">${sanitizeHTML(s)}</span>`
                ).join('') || '<span class="text-muted small">Chưa có kỹ năng khớp trực tiếp</span>';
            }
            if (matchReasonEl) {
                matchReasonEl.textContent = (result.reasons && result.reasons[0]) ? result.reasons[0] : 'Phù hợp với các yêu cầu của dự án';
            }
        }
    }
}

async function deleteProjectAndRedirect(projectId) {
    try {
        const supabase = getDB();
        const { error } = await supabase.from('projects').delete().eq('id', projectId);
        if (error) throw error;
        if (typeof showToast === 'function') showToast('Đã xóa dự án thành công!', 'success');
        setTimeout(() => { window.location.href = 'projects.html'; }, 1000);
    } catch (err) {
        console.error('Delete error:', err);
        if (typeof showToast === 'function') showToast('Lỗi khi xóa: ' + err.message, 'error');
    }
}

// ─── CREATE PROJECT PAGE ───────────────────────────────────────────────────────

async function initCreateProjectPage() {
    const form = document.getElementById('create-project-form');
    if (!form) return;

    // Auth guard
    let currentUser = null;
    if (typeof getCurrentUser === 'function') {
        currentUser = await getCurrentUser();
    }
    if (!currentUser) {
        window.location.href = 'login.html?redirect=create-project.html';
        return;
    }

    let technologies = [];

    // Tech Tags
    const techInput     = document.getElementById('cp-tech-input');
    const techContainer = document.getElementById('tech-tags-container');

    function renderTags() {
        document.querySelectorAll('#tech-tags-container .tech-tag').forEach(el => el.remove());
        technologies.forEach((t, i) => {
            const tag = document.createElement('div');
            tag.className = 'tech-tag';
            tag.innerHTML = `${sanitizeHTML(t)} <span class="remove" data-index="${i}">&times;</span>`;
            techContainer.insertBefore(tag, techInput);
        });
        document.querySelectorAll('.tech-tag .remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                technologies.splice(idx, 1);
                renderTags();
                updatePreview();
            });
        });
    }

    if (techInput) {
        techInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = techInput.value.trim().replace(/,$/, '');
                if (val && !technologies.includes(val) && technologies.length < 20) {
                    technologies.push(val);
                    renderTags();
                    updatePreview();
                }
                techInput.value = '';
            }
        });
    }

    // Roles toggle
    document.querySelectorAll('.role-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const qtyInput = e.target.closest('.role-item').querySelector('.role-qty');
            if (qtyInput) {
                qtyInput.disabled = !e.target.checked;
                if (e.target.checked && !qtyInput.value) qtyInput.value = 1;
            }
        });
    });

    // Image preview
    const uploadArea      = document.getElementById('image-upload-area');
    const fileInput       = document.getElementById('cp-image-file');
    const previewWrapper  = document.getElementById('image-preview-wrapper');
    const imgPreview      = document.getElementById('image-preview');
    const removeImageBtn  = document.getElementById('btn-remove-image');
    let   selectedImageFile = null;

    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-remove-image')) fileInput?.click();
        });
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('border-primary'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('border-primary'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-primary');
            const file = e.dataTransfer.files[0];
            if (file) handleImageSelect(file);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files?.[0]) handleImageSelect(e.target.files[0]);
        });
    }

    function handleImageSelect(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            if (typeof showToast === 'function') showToast('Vui lòng chọn file ảnh hợp lệ (JPG, PNG, WebP, GIF)', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            if (typeof showToast === 'function') showToast('Ảnh phải nhỏ hơn 5MB', 'error');
            return;
        }
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (imgPreview) imgPreview.src = e.target.result;
            if (previewWrapper) previewWrapper.classList.remove('d-none');
            updatePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedImageFile = null;
            if (fileInput) fileInput.value = '';
            const hiddenUrl = document.getElementById('cp-image-url');
            if (hiddenUrl) hiddenUrl.value = '';
            if (previewWrapper) previewWrapper.classList.add('d-none');
            updatePreview('');
        });
    }

    // GitHub verification button (Phase 7)
    const verifyGithubBtn = document.getElementById('btn-verify-github');
    const githubUrlInput = document.getElementById('cp-github-url');
    const githubFeedback = document.getElementById('github-verify-feedback');

    if (verifyGithubBtn && githubUrlInput) {
        verifyGithubBtn.addEventListener('click', async () => {
            const val = githubUrlInput.value.trim();
            if (!val) {
                if (githubFeedback) {
                    githubFeedback.className = 'mt-2 small text-warning';
                    githubFeedback.innerHTML = '<i class="bi bi-info-circle me-1"></i>Vui lòng nhập URL hoặc tên repo GitHub.';
                    githubFeedback.classList.remove('d-none');
                }
                return;
            }

            verifyGithubBtn.disabled = true;
            verifyGithubBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang kiểm tra...';

            try {
                const res = await fetch(`/api/github/repository?url=${encodeURIComponent(val)}`);
                const data = await res.json();

                if (!res.ok) {
                    if (githubFeedback) {
                        githubFeedback.className = 'mt-2 small text-danger';
                        githubFeedback.innerHTML = `<i class="bi bi-x-circle me-1"></i>${sanitizeHTML(data.error || 'Repository không tồn tại hoặc không thể truy cập.')}`;
                        githubFeedback.classList.remove('d-none');
                    }
                } else {
                    if (githubFeedback) {
                        githubFeedback.className = 'mt-2 small text-success';
                        githubFeedback.innerHTML = `
                            <i class="bi bi-check-circle me-1"></i>Hợp lệ: <strong>${sanitizeHTML(data.full_name || data.name)}</strong>
                            (${Number(data.stars || 0).toLocaleString()} <i class="bi bi-star-fill text-warning"></i>, ${sanitizeHTML(data.language || 'Code')})
                        `;
                        githubFeedback.classList.remove('d-none');
                    }
                }
            } catch (err) {
                if (githubFeedback) {
                    githubFeedback.className = 'mt-2 small text-danger';
                    githubFeedback.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Lỗi kết nối đến máy chủ GitHub.';
                    githubFeedback.classList.remove('d-none');
                }
            } finally {
                verifyGithubBtn.disabled = false;
                verifyGithubBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Kiểm tra Repo';
            }
        });
    }

    // Live preview
    function updatePreview(imageDataUrl) {
        const title = document.getElementById('cp-title')?.value || 'Tên dự án';
        const desc  = document.getElementById('cp-desc')?.value || 'Mô tả dự án...';
        const cat   = document.getElementById('cp-field')?.value;

        const previewTitle = document.getElementById('preview-title');
        const previewDesc  = document.getElementById('preview-desc');
        const previewField = document.getElementById('preview-field');
        const previewTech  = document.getElementById('preview-tech');
        const previewImg   = document.getElementById('preview-img-container');

        if (previewTitle) previewTitle.textContent = title;
        if (previewDesc)  previewDesc.textContent  = desc;
        if (previewField) previewField.textContent  = cat ? (CATEGORY_MAP[cat.toLowerCase()] || cat) : 'Lĩnh vực';
        if (previewTech)  previewTech.innerHTML = technologies.map(t => `<span class="badge bg-light text-dark border me-1">${sanitizeHTML(t)}</span>`).join('');
        if (previewImg) {
            if (imageDataUrl) {
                previewImg.style.backgroundImage = `url(${imageDataUrl})`;
                previewImg.style.backgroundSize  = 'cover';
                previewImg.style.backgroundPosition = 'center';
            } else {
                previewImg.style.backgroundImage = '';
            }
        }

        // Update form progress
        let filled = 0;
        if (document.getElementById('cp-title')?.value) filled++;
        if (document.getElementById('cp-desc')?.value)  filled++;
        if (document.getElementById('cp-field')?.value) filled++;
        if (document.querySelector('input[name="cp-difficulty"]:checked')) filled++;
        const pct = Math.round((filled / 4) * 100);
        const bar = document.getElementById('form-progress-bar');
        const txt = document.getElementById('form-progress-text');
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = pct + '% hoàn thành';
    }

    ['cp-title', 'cp-desc', 'cp-field'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => updatePreview(''));
    });
    document.querySelectorAll('input[name="cp-difficulty"]').forEach(r => r.addEventListener('change', () => updatePreview('')));

    // Save draft button
    const draftBtn = document.getElementById('btn-save-draft');
    if (draftBtn) {
        draftBtn.addEventListener('click', () => submitProject(form, technologies, selectedImageFile, currentUser, false));
    }

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitProject(form, technologies, selectedImageFile, currentUser, true);
    });
}

async function submitProject(form, technologies, imageFile, currentUser, isPublic) {
    const submitBtn = document.getElementById('btn-submit-project');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang lưu...';
    }

    try {
        const diffRadio = document.querySelector('input[name="cp-difficulty"]:checked');

        // Map form category value (e.g. "Web") to schema value (e.g. "web")
        const rawCategory = document.getElementById('cp-field')?.value || '';
        const category    = rawCategory.toLowerCase() || 'other';

        // 1. Upload ảnh bìa lên Cloudinary nếu có file được chọn
        let uploadedImageUrl = document.getElementById('cp-image-url')?.value?.trim() || null;
        if (imageFile) {
            try {
                let session = null;
                if (typeof getCurrentSession === 'function') {
                    session = await getCurrentSession();
                } else {
                    const client = getDB();
                    const res = await client?.auth.getSession();
                    session = res?.data?.session;
                }

                if (session && session.access_token) {
                    const formData = new FormData();
                    formData.append('image', imageFile);

                    const uploadRes = await fetch('/api/upload/project-image', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: formData,
                    });

                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        uploadedImageUrl = uploadData.url;
                    } else {
                        const errData = await uploadRes.json();
                        console.warn('[Project] Tải ảnh bìa thất bại:', errData.error);
                        if (typeof showToast === 'function') {
                            showToast(errData.error || 'Không thể tải ảnh bìa lên máy chủ.', 'warning');
                        }
                    }
                }
            } catch (uploadEx) {
                console.warn('[Project] Lỗi kết nối khi tải ảnh:', uploadEx);
            }
        }

        const rawGithubUrl = document.getElementById('cp-github-url')?.value?.trim() || null;

        const projectData = {
            owner_id:    currentUser.id,          // Supabase RLS will also verify this
            title:       document.getElementById('cp-title')?.value?.trim() || '',
            description: document.getElementById('cp-desc')?.value?.trim() || '',
            goal:        document.getElementById('cp-goals')?.value?.trim() || null,
            problem:     document.getElementById('cp-problem')?.value?.trim() || null,
            category:    category,
            technologies: technologies,
            difficulty:  diffRadio ? diffRadio.value : 'medium',
            deadline:    document.getElementById('cp-deadline')?.value || null,
            max_members: 5,
            status:      'recruiting',
            is_public:   isPublic,
            progress:    0,
            image_url:   uploadedImageUrl,
            github_url:  rawGithubUrl
        };

        // Validate required
        if (!projectData.title || !projectData.description || !projectData.category) {
            throw new Error('Vui lòng điền đầy đủ: tên dự án, mô tả và lĩnh vực.');
        }
        if (projectData.title.length > 200) throw new Error('Tên dự án tối đa 200 ký tự.');
        if (!['easy','medium','hard'].includes(projectData.difficulty)) projectData.difficulty = 'medium';

        const supabase = getDB();
        const { data: project, error } = await supabase
            .from('projects')
            .insert(projectData)
            .select()
            .single();

        if (error) throw error;

        // Insert project_roles if any checked
        const roleInserts = [];
        document.querySelectorAll('.role-checkbox:checked').forEach(cb => {
            const roleName = cb.value;
            const qty = parseInt(cb.closest('.role-item').querySelector('.role-qty')?.value) || 1;
            for (let i = 0; i < qty; i++) {
                roleInserts.push({ project_id: project.id, role_name: roleName });
            }
        });

        if (roleInserts.length > 0) {
            await supabase.from('project_roles').insert(roleInserts);
        }

        if (typeof showToast === 'function') showToast('Tạo dự án thành công! Đang chuyển đến Không gian làm việc...', 'success');
        setTimeout(() => { window.location.href = `workspace.html?id=${project.id}`; }, 800);

    } catch (err) {
        console.error('Create project error:', err);
        if (typeof showToast === 'function') {
            showToast(err.message || 'Lỗi tạo dự án', 'error');
        } else {
            alert('Lỗi: ' + err.message);
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Tạo dự án';
        }
    }
}

// ─── EDIT PROJECT PAGE ─────────────────────────────────────────────────────────

async function initEditProjectPage() {
    const form      = document.getElementById('edit-project-form');
    const container = document.querySelector('.container');
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (!projectId) {
        if (container) container.innerHTML = '<div class="alert alert-danger mt-5 text-center">Thiếu ID dự án.</div>';
        return;
    }

    // Auth guard
    let currentUser = null;
    if (typeof getCurrentUser === 'function') currentUser = await getCurrentUser();
    if (!currentUser) {
        window.location.href = `login.html?redirect=${encodeURIComponent('edit-project.html?id=' + projectId)}`;
        return;
    }

    // Load project
    try {
        const supabase = getDB();
        const { data: project, error } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error || !project) {
            if (container) container.innerHTML = '<div class="alert alert-danger mt-5 text-center">Không tìm thấy dự án.</div>';
            return;
        }

        // Ownership & Admin check
        const currentProfile = typeof getCurrentProfile === 'function' ? await getCurrentProfile() : null;
        const isAdmin = checkIsAdmin(currentUser, currentProfile);
        if (!isAdmin && project.owner_id !== currentUser.id) {
            if (container) container.innerHTML = '<div class="alert alert-danger mt-5 text-center">Bạn không có quyền chỉnh sửa dự án này.</div>';
            return;
        }

        // Populate form
        populateEditForm(project);
        setupEditForm(form, project, currentUser);

    } catch (err) {
        console.error('Edit page error:', err);
        if (container) container.innerHTML = `<div class="alert alert-danger mt-5 text-center">Lỗi: ${sanitizeHTML(err.message)}</div>`;
    }
}

function populateEditForm(project) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    setVal('ep-title',      project.title);
    setVal('ep-desc',       project.description);
    setVal('ep-goals',      project.goal);
    setVal('ep-problem',    project.problem);
    setVal('ep-deadline',   project.deadline);
    setVal('ep-max-members', project.max_members || 5);
    setVal('ep-github-url', project.github_url);
    setVal('ep-image-url',  project.image_url);

    // Image preview
    const previewWrapper = document.getElementById('ep-image-preview-wrapper');
    const imgPreview     = document.getElementById('ep-image-preview');
    if (project.image_url && imgPreview && previewWrapper) {
        imgPreview.src = project.image_url;
        previewWrapper.classList.remove('d-none');
    }

    // Category
    const catEl = document.getElementById('ep-field');
    if (catEl) catEl.value = project.category || 'other';

    // Status
    const statusEl = document.getElementById('ep-status');
    if (statusEl) statusEl.value = project.status || 'recruiting';

    // Difficulty radio
    const diffRadio = document.querySelector(`input[name="ep-difficulty"][value="${project.difficulty || 'medium'}"]`);
    if (diffRadio) diffRadio.checked = true;

    // Technologies
    const techsInput = document.getElementById('ep-technologies');
    if (techsInput) techsInput.value = (project.technologies || []).join(', ');

    // Is public
    const publicEl = document.getElementById('ep-is-public');
    if (publicEl) publicEl.checked = project.is_public !== false;
}

function setupEditForm(form, project, currentUser) {
    let selectedImageFile = null;

    // Image upload handling
    const uploadArea     = document.getElementById('ep-image-upload-area');
    const fileInput      = document.getElementById('ep-image-file');
    const previewWrapper = document.getElementById('ep-image-preview-wrapper');
    const imgPreview     = document.getElementById('ep-image-preview');
    const removeBtn      = document.getElementById('btn-remove-ep-image');
    const imageUrlInput  = document.getElementById('ep-image-url');

    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-remove-ep-image')) fileInput.click();
        });
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('border-primary'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('border-primary'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('border-primary');
            const file = e.dataTransfer.files[0];
            if (file) handleImageSelect(file);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files?.[0]) handleImageSelect(e.target.files[0]);
        });
    }

    function handleImageSelect(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            if (typeof showToast === 'function') showToast('Vui lòng chọn file ảnh hợp lệ (JPG, PNG, WebP, GIF)', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            if (typeof showToast === 'function') showToast('Ảnh phải nhỏ hơn 5MB', 'error');
            return;
        }
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (imgPreview) imgPreview.src = e.target.result;
            if (previewWrapper) previewWrapper.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedImageFile = null;
            if (fileInput) fileInput.value = '';
            if (imageUrlInput) imageUrlInput.value = '';
            if (previewWrapper) previewWrapper.classList.add('d-none');
            if (imgPreview) imgPreview.src = '';
        });
    }

    // GitHub verify button in edit form
    const verifyGithubBtn = document.getElementById('btn-verify-github-edit');
    const githubUrlInput  = document.getElementById('ep-github-url');
    const githubFeedback  = document.getElementById('ep-github-verify-feedback');

    if (verifyGithubBtn && githubUrlInput) {
        verifyGithubBtn.addEventListener('click', async () => {
            const val = githubUrlInput.value.trim();
            if (!val) {
                if (githubFeedback) {
                    githubFeedback.className = 'mt-2 small text-warning';
                    githubFeedback.innerHTML = '<i class="bi bi-info-circle me-1"></i>Vui lòng nhập đường dẫn GitHub repo.';
                    githubFeedback.classList.remove('d-none');
                }
                return;
            }

            verifyGithubBtn.disabled = true;
            verifyGithubBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang kiểm tra...';

            try {
                const res = await fetch(`/api/github/repository?url=${encodeURIComponent(val)}`);
                const data = await res.json();

                if (!res.ok) {
                    if (githubFeedback) {
                        githubFeedback.className = 'mt-2 small text-danger';
                        githubFeedback.innerHTML = `<i class="bi bi-x-circle me-1"></i>${sanitizeHTML(data.error || 'Repository không tồn tại hoặc không thể truy cập.')}`;
                        githubFeedback.classList.remove('d-none');
                    }
                } else {
                    if (githubFeedback) {
                        githubFeedback.className = 'mt-2 small text-success';
                        githubFeedback.innerHTML = `
                            <i class="bi bi-check-circle me-1"></i>Hợp lệ: <strong>${sanitizeHTML(data.full_name || data.name)}</strong>
                            (${Number(data.stars || 0).toLocaleString()} <i class="bi bi-star-fill text-warning"></i>, ${sanitizeHTML(data.language || 'Code')})
                        `;
                        githubFeedback.classList.remove('d-none');
                    }
                }
            } catch (err) {
                if (githubFeedback) {
                    githubFeedback.className = 'mt-2 small text-danger';
                    githubFeedback.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Lỗi kết nối đến máy chủ GitHub.';
                    githubFeedback.classList.remove('d-none');
                }
            } finally {
                verifyGithubBtn.disabled = false;
                verifyGithubBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Kiểm tra Repo';
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-update-project');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang lưu...'; }

        try {
            const diffRadio = document.querySelector('input[name="ep-difficulty"]:checked');

            // Parse technologies from comma-separated input
            const techsRaw = document.getElementById('ep-technologies')?.value || '';
            const techs    = techsRaw.split(',').map(t => t.trim()).filter(Boolean);

            const rawCat  = document.getElementById('ep-field')?.value || '';
            const catEnum = ['web','mobile','ai','game','data','iot','other'];
            const category = catEnum.includes(rawCat.toLowerCase()) ? rawCat.toLowerCase() : rawCat || 'other';

            // Upload image if a new file is chosen
            let finalImageUrl = imageUrlInput?.value?.trim() || project.image_url;
            if (selectedImageFile) {
                let session = null;
                if (typeof getCurrentSession === 'function') {
                    session = await getCurrentSession();
                } else {
                    const client = getDB();
                    const res = await client?.auth.getSession();
                    session = res?.data?.session;
                }

                if (session && session.access_token) {
                    const formData = new FormData();
                    formData.append('image', selectedImageFile);
                    formData.append('projectId', project.id);

                    const uploadRes = await fetch(`/api/upload/project-image?projectId=${encodeURIComponent(project.id)}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: formData,
                    });

                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        finalImageUrl = uploadData.url;
                    } else {
                        const errJson = await uploadRes.json();
                        if (typeof showToast === 'function') {
                            showToast(errJson.error || 'Lỗi khi tải ảnh bìa lên Cloudinary.', 'warning');
                        }
                    }
                }
            } else if (imageUrlInput && !imageUrlInput.value.trim() && previewWrapper && previewWrapper.classList.contains('d-none')) {
                // User explicitly removed the image
                finalImageUrl = null;
            }

            const rawGithub = document.getElementById('ep-github-url')?.value?.trim() || null;

            const updates = {
                title:        document.getElementById('ep-title')?.value?.trim() || '',
                description:  document.getElementById('ep-desc')?.value?.trim() || '',
                goal:         document.getElementById('ep-goals')?.value?.trim() || null,
                problem:      document.getElementById('ep-problem')?.value?.trim() || null,
                category:     category,
                technologies: techs,
                difficulty:   diffRadio ? diffRadio.value : project.difficulty,
                status:       document.getElementById('ep-status')?.value || project.status,
                max_members:  parseInt(document.getElementById('ep-max-members')?.value) || 5,
                deadline:     document.getElementById('ep-deadline')?.value || null,
                image_url:    finalImageUrl,
                github_url:   rawGithub,
                is_public:    document.getElementById('ep-is-public')?.checked ?? true
            };

            if (!updates.title || !updates.description) throw new Error('Tên và mô tả không được để trống.');

            const supabase = getDB();
            const { error } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', project.id)
                .eq('owner_id', currentUser.id);    // RLS double-check at app level

            if (error) throw error;

            if (typeof showToast === 'function') showToast('Cập nhật dự án thành công!', 'success');
            setTimeout(() => { window.location.href = `project-detail.html?id=${project.id}`; }, 800);

        } catch (err) {
            console.error('Update error:', err);
            if (typeof showToast === 'function') showToast(err.message || 'Lỗi cập nhật', 'error');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Lưu thay đổi'; }
        }
    });

    // Cancel buttons
    ['btn-cancel-edit', 'btn-cancel-edit-bottom'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                window.location.href = `project-detail.html?id=${project.id}`;
            });
        }
    });
}

// ─── DASHBOARD MY PROJECTS ─────────────────────────────────────────────────────

async function loadDashboardMyProjects(userId) {
    const container = document.getElementById('dashboard-projects-list');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary me-2"></div>
            <span class="text-muted small">Đang tải dự án...</span>
        </div>
    `;

    try {
        const supabase = getDB();
        const { data: projects, error } = await supabase
            .from('projects')
            .select('id, title, status, progress, category, technologies, deadline, created_at')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        // Update stat
        const statProjects = document.getElementById('stat-projects');
        if (statProjects) statProjects.textContent = projects?.length || 0;

        if (!projects || projects.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-folder-plus fs-1 text-muted mb-3 d-block"></i>
                    <p class="text-muted mb-3">Bạn chưa có dự án nào.</p>
                    <a href="create-project.html" class="btn btn-primary btn-sm">
                        <i class="bi bi-plus-lg me-1"></i>Tạo dự án đầu tiên
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(p => {
            const status = STATUS_MAP[p.status] || STATUS_MAP.recruiting;
            const cat    = CATEGORY_MAP[p.category] || p.category || 'Khác';
            const techs  = (p.technologies || []).slice(0, 3);
            const deadline = p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : null;

            return `
                <div class="d-flex align-items-start py-3 border-bottom">
                    <div class="flex-grow-1 me-3">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <a href="project-detail.html?id=${p.id}" class="fw-semibold text-dark text-decoration-none text-truncate" style="max-width: 300px;">${sanitizeHTML(p.title)}</a>
                            <span class="badge bg-${status.color} flex-shrink-0">${status.label}</span>
                        </div>
                        <div class="d-flex align-items-center gap-2 text-muted small mb-2">
                            <span><i class="bi bi-tag me-1"></i>${sanitizeHTML(cat)}</span>
                            ${deadline ? `<span><i class="bi bi-calendar3 me-1"></i>${deadline}</span>` : ''}
                        </div>
                        <div class="mb-2">
                            ${techs.map(t => `<span class="badge bg-light text-dark border me-1">${sanitizeHTML(t)}</span>`).join('')}
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <div class="progress flex-grow-1" style="height: 5px;">
                                <div class="progress-bar bg-success" style="width: ${p.progress || 0}%"></div>
                            </div>
                            <small class="text-muted fw-medium" style="min-width: 35px;">${p.progress || 0}%</small>
                        </div>
                    </div>
                    <div class="d-flex flex-column gap-1">
                        <a href="workspace.html?id=${p.id}" class="btn btn-sm btn-outline-success"><i class="bi bi-kanban me-1"></i>Workspace</a>
                        <a href="project-detail.html?id=${p.id}" class="btn btn-sm btn-outline-primary">Xem</a>
                        <a href="edit-project.html?id=${p.id}" class="btn btn-sm btn-outline-secondary">Sửa</a>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Dashboard projects error:', err);
        container.innerHTML = `<div class="alert alert-warning small">Lỗi tải dự án: ${sanitizeHTML(err.message)}</div>`;
    }
}

// ─── SKELETON LOADER ──────────────────────────────────────────────────────────

function buildSkeletonCards(count = 12) {
    const colClass = currentGridCols === 2 ? 'col-12 col-md-6 col-xl-6' : 'col-12 col-md-6 col-xl-4';
    const card = `
        <div class="${colClass}">
            <div class="card border shadow-sm h-100" style="border-radius: 14px;">
                <div class="placeholder-glow" style="height:160px; background:var(--surface-2, #e9ecef); border-radius: 14px 14px 0 0;"></div>
                <div class="card-body p-3">
                    <div class="placeholder-glow mb-2"><span class="placeholder col-6 rounded"></span></div>
                    <div class="placeholder-glow mb-2"><span class="placeholder col-10 rounded"></span></div>
                    <div class="placeholder-glow mb-3"><span class="placeholder col-8 rounded"></span></div>
                    <div class="placeholder-glow"><span class="placeholder col-12 rounded-pill" style="height:30px;"></span></div>
                </div>
            </div>
        </div>`;
    return Array(count).fill(card).join('');
}

// ─── DASHBOARD JOIN REQUESTS ───────────────────────────────────────────────────

async function loadDashboardJoinRequests(userId) {
    const container = document.getElementById('dashboard-requests-list');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary me-2"></div>
            <span class="text-muted small">Đang tải yêu cầu tham gia...</span>
        </div>
    `;

    try {
        const supabase = getDB();
        const { data: requests, error } = await supabase
            .from('project_join_requests')
            .select(`
                id, project_id, role_name, message, status, created_at,
                projects:project_id ( id, title, category, status )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!requests || requests.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-3 mb-2 d-block"></i>
                    <small>Bạn chưa gửi yêu cầu tham gia dự án nào.</small>
                </div>
            `;
            return;
        }

        const statusBadges = {
            pending:   { label: 'Chờ duyệt', color: 'warning text-dark' },
            accepted:  { label: 'Đã chấp nhận', color: 'success' },
            rejected:  { label: 'Bị từ chối', color: 'danger' },
            cancelled: { label: 'Đã hủy', color: 'secondary' }
        };

        container.innerHTML = requests.map(r => {
            const p = r.projects || {};
            const pTitle = sanitizeHTML(p.title || 'Dự án');
            const st = statusBadges[r.status] || { label: r.status, color: 'secondary' };
            const time = typeof timeAgo === 'function' ? timeAgo(r.created_at) : new Date(r.created_at).toLocaleDateString('vi-VN');

            return `
                <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
                    <div>
                        <a href="project-detail.html?id=${r.project_id}" class="fw-semibold text-dark text-decoration-none small text-truncate d-block" style="max-width: 250px;">
                            ${pTitle}
                        </a>
                        <small class="text-muted"><i class="bi bi-person-badge me-1"></i>${sanitizeHTML(r.role_name || 'Thành viên')} · ${time}</small>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-${st.color}">${st.label}</span>
                        ${r.status === 'pending' ? `
                            <button class="btn btn-sm btn-outline-danger p-0 px-2" title="Hủy yêu cầu" onclick="cancelJoinRequest('${r.id}')">
                                <i class="bi bi-x"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Dashboard requests error:', err);
        container.innerHTML = `<div class="alert alert-warning small">Lỗi tải yêu cầu: ${sanitizeHTML(err.message)}</div>`;
    }
}

// ─── DASHBOARD RECOMMENDED PROJECTS ───────────────────────────────────────────

async function loadDashboardRecommendedProjects(profile) {
    const container = document.getElementById('dashboard-recommended-list');
    if (!container) return;

    container.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary me-2"></div>
            <span class="text-muted small">Đang phân tích dự án phù hợp...</span>
        </div>
    `;

    try {
        if (typeof window.findMatchingProjects !== 'function') {
            container.innerHTML = '<p class="text-muted small">Tính năng gợi ý chưa sẵn sàng.</p>';
            return;
        }

        const recommended = await window.findMatchingProjects(profile);

        if (!recommended || recommended.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-stars fs-3 mb-2 d-block text-warning"></i>
                    <small>Chưa có dự án gợi ý nào phù hợp với kỹ năng hiện tại.</small>
                </div>
            `;
            return;
        }

        container.innerHTML = recommended.slice(0, 3).map(p => {
            const scoreColor = p.matchScore >= 80 ? 'success' : (p.matchScore >= 60 ? 'primary' : 'warning');
            const techs = (p.technologies || []).slice(0, 3).map(t => `<span class="badge bg-light text-dark border me-1">${sanitizeHTML(t)}</span>`).join('');

            return `
                <div class="p-3 border rounded mb-2 bg-white shadow-sm">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <a href="project-detail.html?id=${p.id}" class="fw-bold text-dark text-decoration-none text-truncate" style="max-width: 200px;">
                            ${sanitizeHTML(p.title)}
                        </a>
                        <span class="badge bg-${scoreColor}">${p.matchScore}% Phù hợp</span>
                    </div>
                    <small class="text-muted d-block mb-2">${sanitizeHTML(p.category || 'Khác')}</small>
                    <div class="d-flex flex-wrap gap-1 mb-2">${techs}</div>
                    <a href="project-detail.html?id=${p.id}" class="btn btn-outline-primary btn-sm w-100">
                        Xem chi tiết & Tham gia
                    </a>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Dashboard recommended error:', err);
        container.innerHTML = `<div class="alert alert-warning small">Lỗi tải gợi ý: ${sanitizeHTML(err.message)}</div>`;
    }
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
 
function bootProjectsApp() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (page === 'projects.html' || page === 'projects' || document.getElementById('projects-grid')) initProjectsPage();
    if (page === 'project-detail.html' || page === 'project-detail' || document.getElementById('project-detail-container') || document.querySelector('[data-page="project-detail"]')) initProjectDetailPage();
    if (page === 'create-project.html' || page === 'create-project' || document.getElementById('create-project-form')) initCreateProjectPage();
    if (page === 'edit-project.html' || page === 'edit-project' || document.getElementById('edit-project-form')) initEditProjectPage();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootProjectsApp);
} else {
    bootProjectsApp();
}

// Export for dashboard.js and other pages to call
window.loadDashboardMyProjects = loadDashboardMyProjects;
window.loadDashboardJoinRequests = loadDashboardJoinRequests;
window.loadDashboardRecommendedProjects = loadDashboardRecommendedProjects;
window.acceptJoinRequest = acceptJoinRequest;
window.rejectJoinRequest = rejectJoinRequest;
window.cancelJoinRequest = cancelJoinRequest;
window.removeTeamMember = removeTeamMember;
window.leaveTeamMember = leaveTeamMember;
window.promptLoginToJoin = promptLoginToJoin;
window.sanitizeHTML = sanitizeHTML;
window.checkIsAdmin = checkIsAdmin;
window.renderRestrictedDetailPage = renderRestrictedDetailPage;

