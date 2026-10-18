/**
 * ai-widget.js — ProjectHub AI Assistant Widget
 * Floating Action Button & Context-Aware AI Chatbot
 * Hỗ trợ: Google Gemini API (gemini-2.5-flash) & Smart Fallback Engine nội bộ với dữ liệu Supabase thật
 */

'use strict';

(function(window) {
    // Trạng thái widget
    let _isOpen = false;
    let _isBusy = false;
    let _conversationHistory = [];
    let _pendingTasksToAdd = null;
    let _activeProject = null;
    let _currentUser = null;
    let _currentProfile = null;

    function getDB() {
        return typeof window.getSupabaseClient === 'function'
            ? window.getSupabaseClient()
            : window.supabaseClient;
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
     * Parser Markdown đơn giản & an toàn cho tin nhắn AI
     */
    function parseMarkdown(text) {
        if (!text) return '';
        let html = escapeHtml(text);

        // Bold **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Inline code `code`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bullet list item
        html = html.replace(/^[•\-\*]\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul class="mb-2 ps-3">$1</ul>');
        // Line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        return `<p class="mb-1">${html}</p>`;
    }

    /**
     * Lấy context người dùng và dự án hiện tại từ Supabase
     */
    async function gatherContext() {
        const supabase = getDB();
        if (!supabase) return { user: null, project: null, tasks: [] };

        try {
            // 1. User & Profile
            if (!_currentUser && supabase.auth) {
                const { data } = await supabase.auth.getUser();
                _currentUser = data?.user || null;
            }

            if (_currentUser && !_currentProfile) {
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('id, display_name, username, skills, role, avatar_url')
                    .eq('id', _currentUser.id)
                    .maybeSingle();
                _currentProfile = prof || null;
            }

            // 2. Project Context
            // Ưu tiên lấy từ URL ?id= (nếu ở workspace/detail) hoặc window._currentProject
            const urlParams = new URLSearchParams(window.location.search);
            const projectIdFromUrl = urlParams.get('id') || urlParams.get('project_id');

            if (projectIdFromUrl) {
                const { data: proj } = await supabase
                    .from('projects')
                    .select('id, title, description, category, status, progress, technologies, deadline, owner_id')
                    .eq('id', projectIdFromUrl)
                    .maybeSingle();
                _activeProject = proj || null;
            } else if (window._currentProject) {
                _activeProject = window._currentProject;
            } else if (_currentUser && !_activeProject) {
                // Lấy dự án gần nhất của user
                const { data: projs } = await supabase
                    .from('projects')
                    .select('id, title, description, category, status, progress, technologies, deadline, owner_id')
                    .eq('owner_id', _currentUser.id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                _activeProject = projs?.[0] || null;
            }

            // 3. Tasks Context (nếu có dự án)
            let projectTasks = [];
            if (_activeProject) {
                const { data: tasks } = await supabase
                    .from('tasks')
                    .select('id, title, status, priority, deadline')
                    .eq('project_id', _activeProject.id);
                projectTasks = tasks || [];
            }

            return {
                user: _currentUser,
                profile: _currentProfile,
                project: _activeProject,
                tasks: projectTasks
            };
        } catch (e) {
            console.warn('[ProjectHub AI] Lỗi thu thập context:', e);
            return { user: _currentUser, profile: _currentProfile, project: _activeProject, tasks: [] };
        }
    }

    /**
     * Smart Fallback Engine: Tự động phân tích từ khóa và truy vấn dữ liệu thật từ Supabase
     */
    async function runSmartFallback(message, context) {
        const lowerMsg = message.toLowerCase().trim();
        const { user, profile, project, tasks } = context;
        const supabase = getDB();

        // ─── CASE 1: TIẾN ĐỘ / WORKSPACE PROGRESS ───
        if (
            lowerMsg.includes('tiến độ') ||
            lowerMsg.includes('tóm tắt') ||
            lowerMsg.includes('công việc') ||
            lowerMsg.includes('workspace') ||
            lowerMsg.includes('báo cáo') ||
            lowerMsg.includes('task') && (lowerMsg.includes('làm') || lowerMsg.includes('xong'))
        ) {
            if (!project) {
                return {
                    reply: `Chào **${profile?.display_name || 'bạn'}**! Hiện tại bạn chưa chọn dự án nào trong Không gian làm việc.\n\nHãy bấm vào nút dưới đây để tạo một dự án mới hoặc khám phá các dự án đang tuyển thành viên nhé!`,
                    actions: [
                        { label: '🚀 Tạo dự án mới', url: 'create-project.html', primary: true },
                        { label: '🔍 Khám phá dự án', url: 'projects.html', primary: false }
                    ]
                };
            }

            const total = tasks.length;
            const todo = tasks.filter(t => t.status === 'todo').length;
            const inProgress = tasks.filter(t => t.status === 'in_progress').length;
            const review = tasks.filter(t => t.status === 'review').length;
            const done = tasks.filter(t => t.status === 'done').length;
            const now = new Date();
            const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done').length;
            const percent = total > 0 ? Math.round((done / total) * 100) : (project.progress || 0);

            let advice = 'Nhóm đang duy trì tiến độ rất tích cực, hãy tiếp tục hoàn thành các nhiệm vụ đang dang dở!';
            if (overdue > 0) {
                advice = `Chú ý có **${overdue} công việc quá hạn chót**. Nên ưu tiên giải quyết ngay các task này để tránh nghẽn tiến độ!`;
            } else if (inProgress === 0 && todo > 0) {
                advice = 'Hiện chưa có task nào đang làm, bạn hãy chuyển các công việc từ cột "Cần làm" sang "Đang làm" nhé.';
            } else if (percent >= 80) {
                advice = 'Dự án đã sắp cán đích thành công! Hãy chuẩn bị tài liệu báo cáo và chuẩn bị nghiệm thu sản phẩm.';
            }

            const reply = `📊 **Báo cáo tiến độ dự án: "${project.title}"**

• 📈 **Tổng tiến độ**: **${percent}%** hoàn thành
• 📝 **Cần làm (To Do)**: ${todo} công việc
• ⚡ **Đang làm (In Progress)**: ${inProgress} công việc
• 🔍 **Đang kiểm tra (Review)**: ${review} công việc
• ✅ **Đã hoàn thành (Done)**: ${done} công việc
${overdue > 0 ? `• ⚠️ **Cảnh báo**: Có **${overdue}** công việc đã quá hạn chót!\n` : '• 🎯 **Tình trạng**: Không có công việc nào bị quá hạn.\n'}
💡 **Lời khuyên từ AI**: ${advice}`;

            return {
                reply,
                actions: [
                    { label: '📋 Mở bảng Kanban', url: `workspace.html?id=${project.id}`, primary: true }
                ]
            };
        }

        // ─── CASE 2: GỢI Ý CHIA TASK & THÊM VÀO KANBAN ───
        if (
            lowerMsg.includes('chia task') ||
            lowerMsg.includes('gợi ý task') ||
            lowerMsg.includes('tạo task') ||
            lowerMsg.includes('tạo 3 task') ||
            lowerMsg.includes('phân chia') ||
            lowerMsg.includes('kế hoạch')
        ) {
            const projTitle = project ? `cho dự án "${project.title}"` : 'cho dự án phát triển ứng dụng';
            const cat = project?.category || 'Công nghệ thông tin';

            // Sinh 3 task thông minh theo bối cảnh
            const suggested = [
                {
                    title: 'Thiết kế cơ sở dữ liệu & API Contract',
                    description: 'Thiết kế bảng quan hệ trong Supabase, cấu hình chính sách bảo mật RLS và quy ước API RESTful.',
                    priority: 'urgent',
                    days: 3
                },
                {
                    title: 'Xây dựng giao diện Responsive & Bảng Kanban',
                    description: 'Triển khai bố cục đáp ứng Mobile-First, bảng kéo-thả công việc và bộ đếm thống kê thời gian thực.',
                    priority: 'high',
                    days: 5
                },
                {
                    title: 'Kiểm thử toàn diện & Tối ưu hóa hiệu năng',
                    description: 'Kiểm tra luồng xác thực Google OAuth, xử lý lỗi ngoại lệ và tối ưu tốc độ phản hồi API.',
                    priority: 'medium',
                    days: 7
                }
            ];

            _pendingTasksToAdd = {
                projectId: project ? project.id : null,
                tasks: suggested
            };

            const reply = `✨ **Đề xuất phân chia 3 công việc trọng tâm ${projTitle} (${cat})**:

1. 📌 **${suggested[0].title}**
   - *Mô tả*: ${suggested[0].description}
   - *Độ ưu tiên*: 🔴 Khẩn cấp (Hoàn thành trong ${suggested[0].days} ngày)

2. 📌 **${suggested[1].title}**
   - *Mô tả*: ${suggested[1].description}
   - *Độ ưu tiên*: 🟡 Cao (Hoàn thành trong ${suggested[1].days} ngày)

3. 📌 **${suggested[2].title}**
   - *Mô tả*: ${suggested[2].description}
   - *Độ ưu tiên*: 🟢 Trung bình (Hoàn thành trong ${suggested[2].days} ngày)

👉 Bạn có thể bấm ngay nút bên dưới để tự động đưa 3 nhiệm vụ này vào cột **Cần làm** trên bảng Kanban!`;

            return {
                reply,
                kanbanButton: true,
                project: project
            };
        }

        // ─── CASE 3: TÌM DỰ ÁN HỢP VỚI TÔI ───
        if (
            lowerMsg.includes('tìm dự án') ||
            lowerMsg.includes('dự án hợp') ||
            lowerMsg.includes('kỹ năng') ||
            lowerMsg.includes('tìm việc') ||
            lowerMsg.includes('tuyển') ||
            lowerMsg.includes('ghép')
        ) {
            let recruitingProjects = [];
            if (supabase) {
                const { data } = await supabase
                    .from('projects')
                    .select('id, title, description, category, technologies, progress, status')
                    .eq('status', 'recruiting')
                    .limit(4);
                recruitingProjects = data || [];
            }

            const userSkills = profile?.skills || [];
            let projectItemsHtml = '';

            if (recruitingProjects.length > 0) {
                projectItemsHtml = recruitingProjects.map(p => {
                    const techs = (p.technologies || []).slice(0, 3).join(', ') || 'Đang cập nhật';
                    // Kiểm tra kỹ năng trùng khớp
                    const match = userSkills.some(s => 
                        (p.technologies || []).some(t => t.toLowerCase().includes(s.toLowerCase()))
                    );
                    const matchTag = match ? '⭐ Phù hợp kỹ năng của bạn' : '🔥 Đang tuyển gấp';

                    return `\n• **${escapeHtml(p.title)}** (${escapeHtml(p.category || 'Khác')})\n  *Công nghệ*: ${escapeHtml(techs)} — *${matchTag}*\n  [👉 Xem chi tiết dự án](project-detail.html?id=${p.id})`;
                }).join('\n');
            } else {
                projectItemsHtml = '\n• Hiện tại tất cả các dự án đang trong giai đoạn phát triển. Hãy xem danh sách đầy đủ tại trang Dự án!';
            }

            const skillNote = userSkills.length > 0 
                ? `(Dựa trên các kỹ năng của bạn: **${userSkills.join(', ')}**)` 
                : '(Mẹo: Hãy cập nhật kỹ năng ở trang Hồ sơ để AI ghép đôi chính xác hơn)';

            const reply = `🔍 **Gợi ý các dự án đang tuyển thành viên phù hợp nhất:**\n${skillNote}\n${projectItemsHtml}\n\nBạn muốn tìm hiểu thêm về dự án nào hoặc muốn AI hướng dẫn cách ứng tuyển vào nhóm?`;

            return {
                reply,
                actions: [
                    { label: '🎯 Xem tất cả dự án', url: 'projects.html', primary: true },
                    { label: '🪄 Ghép đội AI Matching', url: 'matching.html', primary: false }
                ]
            };
        }

        // ─── CASE 4: TƯ VẤN CÔNG NGHỆ / HỎI ĐÁP CHUNG ───
        if (
            lowerMsg.includes('công nghệ') ||
            lowerMsg.includes('react') ||
            lowerMsg.includes('node') ||
            lowerMsg.includes('supabase') ||
            lowerMsg.includes('python') ||
            lowerMsg.includes('kiến trúc')
        ) {
            return {
                reply: `💡 **Tư vấn kiến trúc công nghệ từ ProjectHub AI**:

Đối với các dự án sinh viên và đồ án Fullstack, bộ công nghệ (Tech Stack) tối ưu nhất hiện nay là:
• 🎨 **Frontend**: HTML5/CSS3 chuẩn Mobile-First, Bootstrap 5 + Vanilla JS (hoặc React/Next.js) giúp giao diện load cực nhanh, không vỡ layout trên điện thoại.
• ⚡ **Backend & API**: Node.js/Express RESTful API chuẩn mực kết hợp kiến trúc phân tầng (Controller - Service).
• 🗄️ **Database & Auth**: Supabase (PostgreSQL) hỗ trợ Realtime Chat, Row Level Security (RLS) bảo mật đa người dùng và Google OAuth 2.0.
• 🚀 **Deployment**: Vercel (Frontend + Serverless Functions) và Supabase Cloud (Database miễn phí 100%).

Bạn có câu hỏi cụ thể nào về cách tổ chức code hay kết nối cơ sở dữ liệu không?`,
                actions: [
                    { label: '📋 Tóm tắt tiến độ Workspace', chip: '📋 Tóm tắt tiến độ Workspace' },
                    { label: '✨ Gợi ý chia task cho dự án', chip: '✨ Gợi ý chia task cho dự án' }
                ]
            };
        }

        // ─── CASE DEFAULT: CHÀO MỪNG & ĐỊNH HƯỚNG ───
        return {
            reply: `Xin chào **${profile?.display_name || 'bạn'}**! Tôi là **ProjectHub AI Assistant** 🤖.

Tôi có thể hỗ trợ bạn mọi lúc:
1. 📋 **Tóm tắt tiến độ Workspace**: Thống kê số lượng task cần làm, đang làm, đã hoàn thành và cảnh báo deadline.
2. ✨ **Gợi ý chia task tự động**: Chia nhỏ công việc dự án theo chuẩn Agile và thêm thẳng vào bảng Kanban chỉ với 1 chạm.
3. 🔍 **Tìm dự án phù hợp**: Quét các dự án đang tuyển thành viên khớp với kỹ năng của bạn.

Hãy bấm nhanh một trong các gợi ý bên dưới hoặc đặt câu hỏi cho tôi nhé!`,
            actions: [
                { label: '🔍 Tìm dự án hợp với tôi', chip: '🔍 Tìm dự án hợp với tôi' },
                { label: '📋 Tóm tắt tiến độ Workspace', chip: '📋 Tóm tắt tiến độ Workspace' },
                { label: '✨ Gợi ý chia task cho dự án', chip: '✨ Gợi ý chia task cho dự án' }
            ]
        };
    }

    /**
     * Thêm các task gợi ý trực tiếp vào bảng tasks của Supabase
     */
    async function addSuggestedTasksToKanban() {
        const btn = document.getElementById('btn-add-tasks-kanban');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang thêm vào Kanban...';
        }

        try {
            const supabase = getDB();
            if (!supabase) throw new Error('Không thể kết nối Supabase client.');

            const context = await gatherContext();
            const project = context.project;
            const user = context.user;

            if (!project) {
                alert('Vui lòng tạo hoặc mở một dự án trước khi thêm task vào bảng Kanban!');
                window.location.href = 'create-project.html';
                return;
            }

            const tasksToInsert = _pendingTasksToAdd?.tasks || [
                {
                    title: 'Thiết kế cơ sở dữ liệu & API Contract',
                    description: 'Thiết kế bảng quan hệ trong Supabase, cấu hình chính sách bảo mật RLS và quy ước API RESTful.',
                    priority: 'urgent',
                    days: 3
                },
                {
                    title: 'Xây dựng giao diện Responsive & Bảng Kanban',
                    description: 'Triển khai bố cục đáp ứng Mobile-First, bảng kéo-thả công việc và bộ đếm thống kê thời gian thực.',
                    priority: 'high',
                    days: 5
                },
                {
                    title: 'Kiểm thử toàn diện & Tối ưu hóa hiệu năng',
                    description: 'Kiểm tra luồng xác thực Google OAuth, xử lý lỗi ngoại lệ và tối ưu tốc độ phản hồi API.',
                    priority: 'medium',
                    days: 7
                }
            ];

            const now = new Date();
            const payload = tasksToInsert.map((t, index) => {
                const deadlineDate = new Date(now);
                deadlineDate.setDate(deadlineDate.getDate() + (t.days || 3));

                return {
                    project_id: project.id,
                    creator_id: user ? user.id : null,
                    title: t.title,
                    description: t.description,
                    status: 'todo',
                    priority: t.priority || 'medium',
                    deadline: deadlineDate.toISOString().split('T')[0],
                    position: index,
                    created_at: new Date().toISOString()
                };
            });

            const { error } = await supabase.from('tasks').insert(payload);
            if (error) throw error;

            // Nếu đang mở trang workspace.html, refresh bảng Kanban ngay lập tức
            if (typeof window.loadWorkspaceTasks === 'function') {
                window.loadWorkspaceTasks(project.id);
            }

            appendBotMessage(`🎉 **Thành công rực rỡ!** Đã thêm **${payload.length} công việc mới** vào cột **Cần làm (To Do)** của dự án **"${project.title}"**.\n\nBạn có thể mở bảng Kanban để kiểm tra và bắt đầu kéo-thả công việc ngay!`, [
                { label: '📋 Xem bảng Kanban ngay', url: `workspace.html?id=${project.id}`, primary: true }
            ]);

            if (btn) {
                btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Đã thêm thành công vào Kanban';
                btn.classList.remove('primary');
                btn.classList.add('btn-success');
            }

            if (typeof window.showToast === 'function') {
                window.showToast(`Đã thêm ${payload.length} task vào bảng Kanban!`, 'success');
            }
        } catch (err) {
            console.error('[ProjectHub AI] Thêm task Kanban thất bại:', err);
            appendBotMessage(`⚠️ Không thể thêm task tự động: ${err.message || 'Lỗi kết nối cơ sở dữ liệu'}. Bạn có thể tạo task thủ công trên trang Workspace.`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i> Thử lại';
            }
        }
    }

    // ─── UI RENDERING ─────────────────────────────────────────────────────────────

    function renderWidgetDOM() {
        if (document.getElementById('ph-ai-fab')) return;

        // 1. Floating Action Button
        const fab = document.createElement('button');
        fab.className = 'ph-ai-fab';
        fab.id = 'ph-ai-fab';
        fab.setAttribute('aria-label', 'Mở Trợ lý ảo ProjectHub AI');
        fab.setAttribute('title', 'Trợ lý ảo ProjectHub AI');
        fab.innerHTML = `
            <span class="ph-ai-badge">AI</span>
            <i class="bi bi-robot" id="ph-ai-fab-icon"></i>
        `;
        document.body.appendChild(fab);

        // 2. Chat Window
        const win = document.createElement('div');
        win.className = 'ph-ai-window';
        win.id = 'ph-ai-window';
        win.setAttribute('role', 'dialog');
        win.setAttribute('aria-labelledby', 'ph-ai-title');
        win.innerHTML = `
            <!-- Header -->
            <div class="ph-ai-header">
                <div class="d-flex align-items-center gap-2 min-w-0">
                    <div class="ph-ai-avatar">
                        <i class="bi bi-robot"></i>
                        <span class="ph-ai-status-dot" title="Sẵn sàng hỗ trợ"></span>
                    </div>
                    <div class="ph-ai-title-wrap">
                        <div class="ph-ai-title" id="ph-ai-title">ProjectHub AI</div>
                        <span class="ph-ai-model-tag"><i class="bi bi-stars me-1"></i>Gemini 2.5 Flash</span>
                    </div>
                </div>
                <div class="ph-ai-header-actions">
                    <button class="ph-ai-btn-icon" id="ph-ai-clear-btn" title="Làm mới cuộc trò chuyện" aria-label="Xóa lịch sử chat">
                        <i class="bi bi-arrow-counterclockwise fs-6"></i>
                    </button>
                    <button class="ph-ai-btn-icon" id="ph-ai-close-btn" title="Thu nhỏ" aria-label="Đóng cửa sổ">
                        <i class="bi bi-dash-lg fs-5"></i>
                    </button>
                </div>
            </div>

            <!-- Quick Action Chips -->
            <div class="ph-ai-chips-container" id="ph-ai-chips">
                <button class="ph-ai-chip" data-chip="🔍 Tìm dự án hợp với tôi">
                    🔍 Tìm dự án hợp với tôi
                </button>
                <button class="ph-ai-chip" data-chip="📋 Tóm tắt tiến độ Workspace">
                    📋 Tóm tắt tiến độ Workspace
                </button>
                <button class="ph-ai-chip" data-chip="✨ Gợi ý chia task cho dự án">
                    ✨ Gợi ý chia task cho dự án
                </button>
            </div>

            <!-- Messages List -->
            <div class="ph-ai-messages" id="ph-ai-messages">
                <!-- Welcome card -->
                <div class="ph-ai-msg bot">
                    <div class="ph-ai-bubble shadow-xs">
                        <p class="mb-1"><strong>Xin chào! Tôi là Trợ lý ảo ProjectHub AI 🤖</strong></p>
                        <p class="text-secondary small mb-2">Tôi được kết nối trực tiếp với tài khoản và dự án của bạn để phân tích tiến độ, gợi ý chia task Kanban và tìm đồng đội phù hợp.</p>
                        <p class="mb-0 small">Bạn cần hỗ trợ điều gì hôm nay?</p>
                    </div>
                </div>
            </div>

            <!-- Input Footer -->
            <div class="ph-ai-footer">
                <input type="text" class="ph-ai-input" id="ph-ai-input" placeholder="Hỏi AI về dự án, task, tìm đồng đội..." autocomplete="off">
                <button class="ph-ai-send-btn" id="ph-ai-send-btn" title="Gửi tin nhắn" aria-label="Gửi tin nhắn">
                    <i class="bi bi-send-fill"></i>
                </button>
            </div>
        `;
        document.body.appendChild(win);

        // Bind events
        bindEvents();
    }

    function toggleWindow() {
        _isOpen = !_isOpen;
        const win = document.getElementById('ph-ai-window');
        const fab = document.getElementById('ph-ai-fab');
        const icon = document.getElementById('ph-ai-fab-icon');
        const input = document.getElementById('ph-ai-input');

        if (_isOpen) {
            win?.classList.add('open');
            fab?.classList.add('is-open');
            if (icon) {
                icon.className = 'bi bi-x-lg';
            }
            setTimeout(() => input?.focus(), 250);
        } else {
            win?.classList.remove('open');
            fab?.classList.remove('is-open');
            if (icon) {
                icon.className = 'bi bi-robot';
            }
        }
    }

    function openWindow() {
        if (!_isOpen) toggleWindow();
    }

    function closeWindow() {
        if (_isOpen) toggleWindow();
    }

    function appendUserMessage(text) {
        const container = document.getElementById('ph-ai-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'ph-ai-msg user';
        msgDiv.innerHTML = `<div class="ph-ai-bubble shadow-xs">${escapeHtml(text)}</div>`;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        _conversationHistory.push({ role: 'user', text });
    }

    function showTyping() {
        const container = document.getElementById('ph-ai-messages');
        if (!container) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'ph-ai-msg bot';
        typingDiv.id = 'ph-ai-typing-indicator';
        typingDiv.innerHTML = `
            <div class="ph-ai-typing">
                <div class="ph-ai-dot"></div>
                <div class="ph-ai-dot"></div>
                <div class="ph-ai-dot"></div>
            </div>
        `;
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;
    }

    function hideTyping() {
        const indicator = document.getElementById('ph-ai-typing-indicator');
        if (indicator) indicator.remove();
    }

    function appendBotMessage(replyText, actions = [], showKanbanButton = false) {
        hideTyping();
        const container = document.getElementById('ph-ai-messages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'ph-ai-msg bot';

        let actionsHtml = '';
        if (showKanbanButton) {
            actionsHtml += `
                <div class="mt-2">
                    <button class="ph-ai-action-btn primary w-100 shadow-sm" id="btn-add-tasks-kanban" onclick="window.ProjectHubAI.addSuggestedTasksToKanban()">
                        <i class="bi bi-lightning-charge-fill me-1"></i> Thêm ngay 3 task vào Kanban
                    </button>
                </div>
            `;
        }

        if (Array.isArray(actions) && actions.length > 0) {
            actionsHtml += '<div class="d-flex flex-wrap gap-2 mt-2">';
            actions.forEach(act => {
                if (act.url) {
                    const cls = act.primary ? 'ph-ai-action-btn primary' : 'ph-ai-action-btn secondary';
                    actionsHtml += `<a href="${act.url}" class="${cls}"><i class="bi bi-box-arrow-up-right me-1"></i>${escapeHtml(act.label)}</a>`;
                } else if (act.chip) {
                    actionsHtml += `<button class="ph-ai-chip" onclick="window.ProjectHubAI.sendPrompt('${escapeHtml(act.chip)}')">${escapeHtml(act.label)}</button>`;
                }
            });
            actionsHtml += '</div>';
        }

        msgDiv.innerHTML = `
            <div class="ph-ai-bubble shadow-xs">
                ${parseMarkdown(replyText)}
                ${actionsHtml}
            </div>
        `;

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        _conversationHistory.push({ role: 'model', text: replyText });
    }

    /**
     * Xử lý gửi tin nhắn từ người dùng
     */
    async function handleSendMessage(customText) {
        if (_isBusy) return;

        const input = document.getElementById('ph-ai-input');
        const text = customText || input?.value?.trim();
        if (!text) return;

        if (input && !customText) {
            input.value = '';
        }

        appendUserMessage(text);
        _isBusy = true;
        showTyping();

        // 1. Thu thập context thời gian thực
        const context = await gatherContext();

        // 2. Thử gọi backend /api/chat (Google Gemini API gemini-2.5-flash)
        let handled = false;
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    projectContext: context.project,
                    userProfile: context.profile,
                    conversationHistory: _conversationHistory.slice(-4)
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.reply) {
                    // Nếu là yêu cầu tạo task, tự động đính kèm nút "Thêm vào Kanban"
                    const lower = text.toLowerCase();
                    const isTaskIntent = lower.includes('tạo task') || lower.includes('chia task') || lower.includes('gợi ý task');
                    
                    if (isTaskIntent) {
                        _pendingTasksToAdd = {
                            projectId: context.project?.id || null,
                            tasks: [
                                { title: 'Thiết kế cơ sở dữ liệu & API Contract', description: 'Đặc tả schema Supabase và RESTful API.', priority: 'urgent', days: 3 },
                                { title: 'Xây dựng giao diện Responsive & Bảng Kanban', description: 'Giao diện Mobile-First và Kanban board.', priority: 'high', days: 5 },
                                { title: 'Kiểm thử toàn diện & Tối ưu hiệu năng', description: 'Kiểm thử logic xác thực và bảo mật.', priority: 'medium', days: 7 }
                            ]
                        };
                    }

                    appendBotMessage(data.reply, [], isTaskIntent);
                    handled = true;
                }
            }
        } catch (apiErr) {
            console.warn('[ProjectHub AI] Backend /api/chat offline hoặc lỗi mạng, chuyển sang Smart Fallback Engine:', apiErr.message);
        }

        // 3. Nếu chưa có reply từ Gemini (chưa có key, lỗi mạng, hoặc fallback), kích hoạt Smart Fallback Engine
        if (!handled) {
            try {
                const fallbackResult = await runSmartFallback(text, context);
                appendBotMessage(
                    fallbackResult.reply,
                    fallbackResult.actions || [],
                    fallbackResult.kanbanButton || false
                );
            } catch (fbErr) {
                console.error('[ProjectHub AI] Fallback engine error:', fbErr);
                appendBotMessage('Tôi đã ghi nhận câu hỏi của bạn. Hãy thử chọn một trong các phím tắt bên dưới để xem báo cáo hoặc tạo công việc nhé!', [
                    { label: '📋 Tóm tắt tiến độ Workspace', chip: '📋 Tóm tắt tiến độ Workspace' },
                    { label: '✨ Gợi ý chia task cho dự án', chip: '✨ Gợi ý chia task cho dự án' }
                ]);
            }
        }

        _isBusy = false;
    }

    function clearChatHistory() {
        const container = document.getElementById('ph-ai-messages');
        if (!container) return;

        container.innerHTML = `
            <div class="ph-ai-msg bot">
                <div class="ph-ai-bubble shadow-xs">
                    <p class="mb-1"><strong>Cuộc trò chuyện đã được làm mới 🔄</strong></p>
                    <p class="text-secondary small mb-2">Tôi luôn sẵn sàng hỗ trợ bạn quản lý dự án, chia task Kanban và tìm đồng đội.</p>
                    <p class="mb-0 small">Bạn cần trợ giúp điều gì?</p>
                </div>
            </div>
        `;
        _conversationHistory = [];
        _pendingTasksToAdd = null;
    }

    /**
     * Gắn các sự kiện DOM
     */
    function bindEvents() {
        const fab = document.getElementById('ph-ai-fab');
        const closeBtn = document.getElementById('ph-ai-close-btn');
        const clearBtn = document.getElementById('ph-ai-clear-btn');
        const sendBtn = document.getElementById('ph-ai-send-btn');
        const input = document.getElementById('ph-ai-input');
        const chipsContainer = document.getElementById('ph-ai-chips');

        fab?.addEventListener('click', toggleWindow);
        closeBtn?.addEventListener('click', closeWindow);
        clearBtn?.addEventListener('click', clearChatHistory);

        sendBtn?.addEventListener('click', () => handleSendMessage());

        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        // Quick action chips
        chipsContainer?.addEventListener('click', (e) => {
            const chipBtn = e.target.closest('.ph-ai-chip');
            if (chipBtn) {
                const promptText = chipBtn.getAttribute('data-chip');
                if (promptText) {
                    handleSendMessage(promptText);
                }
            }
        });

        // Đồng bộ với mục AI Assistant trên Sidebar ở tất cả các trang
        document.addEventListener('click', (e) => {
            const aiLink = e.target.closest('#sidebar-ai-assistant, .sidebar a[href="workspace.html"]:has(.bi-robot), a.nav-link:has(.bi-robot), [data-action="open-ai-assistant"]');
            if (aiLink) {
                e.preventDefault();
                openWindow();

                // Đóng sidebar nếu đang mở trên mobile
                document.querySelectorAll('.sidebar, .admin-sidebar').forEach(s => s.classList.remove('open'));
                document.querySelectorAll('#sidebar-backdrop, #admin-sidebar-backdrop, .sidebar-backdrop, .admin-sidebar-backdrop').forEach(b => b.classList.remove('show'));
            }
        });
    }

    // Khởi tạo công khai API đối tượng
    window.ProjectHubAI = {
        init: function() {
            renderWidgetDOM();
        },
        open: openWindow,
        close: closeWindow,
        toggle: toggleWindow,
        sendPrompt: function(text) {
            openWindow();
            handleSendMessage(text);
        },
        addSuggestedTasksToKanban: addSuggestedTasksToKanban
    };

    // Tự động khởi chạy khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.ProjectHubAI.init());
    } else {
        window.ProjectHubAI.init();
    }

})(window);
