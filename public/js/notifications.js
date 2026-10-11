/**
 * notifications.js — Phase 6: Realtime Notification Center
 * Supabase Realtime + Database-backed Notifications for ProjectHub
 */

'use strict';

(function(window) {
    let _activeNotificationSubscription = null;
    let _cachedUnreadCount = 0;

    const NOTIF_ICONS = {
        'join_request': { icon: 'bi-person-plus', color: 'text-primary', bg: 'bg-primary' },
        'JOIN_REQUEST': { icon: 'bi-person-plus', color: 'text-primary', bg: 'bg-primary' },
        'join_request_accepted': { icon: 'bi-person-check', color: 'text-success', bg: 'bg-success' },
        'JOIN_REQUEST_ACCEPTED': { icon: 'bi-person-check', color: 'text-success', bg: 'bg-success' },
        'join_request_rejected': { icon: 'bi-person-x', color: 'text-danger', bg: 'bg-danger' },
        'JOIN_REQUEST_REJECTED': { icon: 'bi-person-x', color: 'text-danger', bg: 'bg-danger' },
        'task_assigned': { icon: 'bi-check2-square', color: 'text-success', bg: 'bg-success' },
        'TASK_ASSIGNED': { icon: 'bi-check2-square', color: 'text-success', bg: 'bg-success' },
        'task_status_changed': { icon: 'bi-arrow-repeat', color: 'text-info', bg: 'bg-info' },
        'TASK_STATUS_CHANGED': { icon: 'bi-arrow-repeat', color: 'text-info', bg: 'bg-info' },
        'member_removed': { icon: 'bi-person-dash', color: 'text-warning', bg: 'bg-warning' },
        'PROJECT_MEMBER_REMOVED': { icon: 'bi-person-dash', color: 'text-warning', bg: 'bg-warning' },
        'new_message': { icon: 'bi-chat-dots', color: 'text-primary', bg: 'bg-primary' },
        'NEW_MESSAGE': { icon: 'bi-chat-dots', color: 'text-primary', bg: 'bg-primary' },
        'invite': { icon: 'bi-envelope-paper', color: 'text-primary', bg: 'bg-primary' },
        'system': { icon: 'bi-info-circle', color: 'text-secondary', bg: 'bg-secondary' }
    };

    function getDB() {
        return typeof window.getSupabaseClient === 'function'
            ? window.getSupabaseClient()
            : window.supabaseClient;
    }

    function formatTimeAgo(dateString) {
        if (!dateString) return '';
        const now = new Date();
        const date = new Date(dateString);
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 30) return 'Vừa xong';
        if (seconds < 60) return `${seconds} giây trước`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} phút trước`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} giờ trước`;
        const days = Math.floor(hours / 24);
        if (days === 1) return 'Hôm qua';
        if (days < 30) return `${days} ngày trước`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} tháng trước`;
        return `${Math.floor(months / 12)} năm trước`;
    }

    function sanitize(str) {
        if (typeof window.sanitizeHTML === 'function') {
            return window.sanitizeHTML(str);
        }
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Lấy số lượng thông báo chưa đọc
     */
    async function getUnreadNotificationCount() {
        try {
            const supabase = getDB();
            if (!supabase) return 0;
            const currentUser = typeof window.getCurrentUser === 'function' ? await window.getCurrentUser() : null;
            if (!currentUser) return 0;

            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser.id)
                .eq('is_read', false);

            if (error) {
                console.warn('[Notifications] Error getting unread count:', error.message);
                return 0;
            }
            _cachedUnreadCount = count || 0;
            return _cachedUnreadCount;
        } catch (err) {
            console.warn('[Notifications] getUnreadNotificationCount error:', err);
            return 0;
        }
    }

    /**
     * Lấy danh sách thông báo của người dùng hiện tại
     */
    async function fetchNotifications({ limit = 30, filter = 'all' } = {}) {
        try {
            const supabase = getDB();
            if (!supabase) return { data: [], error: new Error('Supabase client not available') };
            const currentUser = typeof window.getCurrentUser === 'function' ? await window.getCurrentUser() : null;
            if (!currentUser) return { data: [], error: null };

            let query = supabase
                .from('notifications')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (filter === 'unread') {
                query = query.eq('is_read', false);
            } else if (filter === 'read') {
                query = query.eq('is_read', true);
            }

            const { data, error } = await query;
            return { data: data || [], error };
        } catch (err) {
            console.error('[Notifications] fetchNotifications error:', err);
            return { data: [], error: err };
        }
    }

    /**
     * Tạo thông báo mới (Gửi thông báo tới người dùng)
     */
    async function createNotification({ userId, projectId = null, type, title, message = '', actionUrl = '', data = {} }) {
        try {
            if (!userId || !title) return false;
            const supabase = getDB();
            if (!supabase) return false;

            const payload = {
                user_id: userId,
                project_id: projectId,
                type: type || 'system',
                title: title.trim(),
                message: (message || '').trim(),
                action_url: actionUrl || null,
                is_read: false,
                data: data || {}
            };

            const { error } = await supabase
                .from('notifications')
                .insert([payload]);

            if (error) {
                console.warn('[Notifications] createNotification warning:', error.message);
                return false;
            }
            return true;
        } catch (err) {
            console.warn('[Notifications] createNotification failed:', err);
            return false;
        }
    }

    /**
     * Đánh dấu 1 thông báo đã đọc
     */
    async function markNotificationAsRead(id) {
        try {
            if (!id) return false;
            const supabase = getDB();
            if (!supabase) return false;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);

            if (error) throw error;

            if (_cachedUnreadCount > 0) {
                _cachedUnreadCount = Math.max(0, _cachedUnreadCount - 1);
                updateNavbarNotificationBadge(_cachedUnreadCount);
            }
            return true;
        } catch (err) {
            console.error('[Notifications] markNotificationAsRead error:', err);
            return false;
        }
    }

    /**
     * Đánh dấu tất cả thông báo là đã đọc
     */
    async function markAllNotificationsAsRead() {
        try {
            const supabase = getDB();
            if (!supabase) return false;
            const currentUser = typeof window.getCurrentUser === 'function' ? await window.getCurrentUser() : null;
            if (!currentUser) return false;

            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUser.id)
                .eq('is_read', false);

            if (error) throw error;

            _cachedUnreadCount = 0;
            updateNavbarNotificationBadge(0);
            return true;
        } catch (err) {
            console.error('[Notifications] markAllNotificationsAsRead error:', err);
            return false;
        }
    }

    /**
     * Xóa 1 thông báo
     */
    async function deleteNotification(id) {
        try {
            if (!id) return false;
            const supabase = getDB();
            if (!supabase) return false;

            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('[Notifications] deleteNotification error:', err);
            return false;
        }
    }

    /**
     * Cập nhật badge chuông thông báo trên Navbar
     */
    function updateNavbarNotificationBadge(count) {
        const btn = document.getElementById('notificationDropdown');
        if (!btn) return;

        let badge = btn.querySelector('.notif-badge');
        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'notif-badge position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
                badge.style.fontSize = '0.65rem';
                badge.style.padding = '0.25em 0.45em';
                btn.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('d-none');
        } else {
            if (badge) badge.classList.add('d-none');
        }
    }

    /**
     * Render menu dropdown thông báo trên Navbar
     */
    function renderNavbarNotifications(notifications) {
        const menu = document.getElementById('notification-menu');
        if (!menu) return;

        const unreadList = (notifications || []).filter(n => !n.is_read);
        const unreadCount = unreadList.length;

        let itemsHtml = '';
        if (!notifications || notifications.length === 0) {
            itemsHtml = `
                <div class="p-4 text-center text-muted">
                    <i class="bi bi-bell-slash fs-2 mb-2 d-block text-secondary"></i>
                    <p class="mb-0 small">Không có thông báo nào</p>
                </div>
            `;
        } else {
            itemsHtml = notifications.slice(0, 10).map(n => {
                const conf = NOTIF_ICONS[n.type] || NOTIF_ICONS['system'];
                const bgClass = n.is_read ? 'bg-white' : 'bg-light';
                const actionUrl = n.action_url || '#';
                
                return `
                    <div class="list-group-item list-group-item-action p-3 ${bgClass} position-relative notif-nav-item border-bottom" data-notif-id="${n.id}">
                        <div class="d-flex gap-3 align-items-start">
                            <div class="flex-shrink-0 mt-1">
                                <span class="d-inline-flex align-items-center justify-content-center rounded-circle ${conf.color} bg-opacity-10" style="width: 32px; height: 32px; background-color: currentColor;">
                                    <i class="bi ${conf.icon} fs-6 ${conf.color}"></i>
                                </span>
                            </div>
                            <div class="flex-grow-1 min-w-0" style="cursor: pointer;" onclick="window.handleNavbarNotifClick('${n.id}', '${sanitize(actionUrl)}')">
                                <p class="mb-1 fw-semibold text-dark small text-truncate" title="${sanitize(n.title)}">${sanitize(n.title)}</p>
                                ${n.message ? `<p class="mb-1 text-muted small text-truncate" style="max-width: 240px;" title="${sanitize(n.message)}">${sanitize(n.message)}</p>` : ''}
                                <small class="text-muted" style="font-size: 0.72rem;"><i class="bi bi-clock me-1"></i>${formatTimeAgo(n.created_at)}</small>
                            </div>
                            ${!n.is_read ? `
                                <button class="btn btn-sm btn-link p-0 text-primary ms-1 flex-shrink-0" title="Đánh dấu đã đọc" onclick="window.handleNavbarNotifMarkRead('${n.id}', event)">
                                    <span class="p-1 bg-primary border border-light rounded-circle d-inline-block"></span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        menu.innerHTML = `
            <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                <div class="d-flex align-items-center gap-2">
                    <h6 class="mb-0 fw-bold">Thông báo</h6>
                    ${unreadCount > 0 ? `<span class="badge bg-primary rounded-pill">${unreadCount} mới</span>` : ''}
                </div>
                ${unreadCount > 0 ? `
                    <button class="btn btn-sm btn-link text-decoration-none p-0 text-primary small" onclick="window.handleNavbarMarkAllRead(event)">
                        Đã đọc tất cả
                    </button>
                ` : ''}
            </div>
            <div class="list-group list-group-flush" style="max-height: 380px; overflow-y: auto;">
                ${itemsHtml}
            </div>
            <div class="p-2 border-top text-center bg-white">
                <a href="notifications.html" class="text-decoration-none small text-primary fw-medium d-flex align-items-center justify-content-center gap-1 py-1">
                    <span>Xem tất cả thông báo</span>
                    <i class="bi bi-arrow-right"></i>
                </a>
            </div>
        `;
    }

    // Handlers gắn vào window cho click event trong HTML string
    window.handleNavbarNotifClick = async function(id, url) {
        await markNotificationAsRead(id);
        if (url && url !== '#' && url !== 'javascript:void(0)') {
            window.location.href = url;
        }
    };

    window.handleNavbarNotifMarkRead = async function(id, evt) {
        if (evt) evt.stopPropagation();
        await markNotificationAsRead(id);
        // Refresh navbar menu
        await refreshNavbarNotifications();
    };

    window.handleNavbarMarkAllRead = async function(evt) {
        if (evt) evt.stopPropagation();
        await markAllNotificationsAsRead();
        await refreshNavbarNotifications();
    };

    async function refreshNavbarNotifications() {
        const { data } = await fetchNotifications({ limit: 10 });
        const unread = await getUnreadNotificationCount();
        updateNavbarNotificationBadge(unread);
        renderNavbarNotifications(data);
    }

    /**
     * Kích hoạt Supabase Realtime cho thông báo của người dùng
     */
    function subscribeToUserNotifications(userId, onNotificationReceived) {
        const supabase = getDB();
        if (!supabase || !userId) return null;

        if (_activeNotificationSubscription) {
            supabase.removeChannel(_activeNotificationSubscription);
            _activeNotificationSubscription = null;
        }

        const channel = supabase.channel(`user-notif-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newNotif = payload.new;
                    _cachedUnreadCount += 1;
                    updateNavbarNotificationBadge(_cachedUnreadCount);

                    // Hiển thị toast thông báo realtime
                    if (typeof window.showToast === 'function') {
                        window.showToast(`🔔 ${newNotif.title}: ${newNotif.message || ''}`, 'info', 4000);
                    }

                    // Tải lại navbar menu
                    refreshNavbarNotifications();

                    if (typeof onNotificationReceived === 'function') {
                        onNotificationReceived(newNotif, 'INSERT');
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    // Cập nhật lại số lượng chưa đọc
                    getUnreadNotificationCount().then(c => {
                        updateNavbarNotificationBadge(c);
                    });
                    if (typeof onNotificationReceived === 'function') {
                        onNotificationReceived(payload.new, 'UPDATE');
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    getUnreadNotificationCount().then(c => {
                        updateNavbarNotificationBadge(c);
                    });
                    if (typeof onNotificationReceived === 'function') {
                        onNotificationReceived(payload.old, 'DELETE');
                    }
                }
            )
            .subscribe();

        _activeNotificationSubscription = channel;
        return channel;
    }

    /**
     * Khởi tạo hệ thống thông báo cho người dùng
     */
    let _isInitializingNotifications = false;
    async function initNotificationSystem() {
        try {
            const currentUser = typeof window.getCurrentUser === 'function' ? await window.getCurrentUser() : null;
            if (!currentUser) {
                if (window.location.pathname.includes('notifications.html') || window.location.pathname.endsWith('/notifications')) {
                    window.location.href = 'login.html?redirect=notifications.html';
                }
                return;
            }

            // 1. Tải unread count & hiển thị badge
            const count = await getUnreadNotificationCount();
            updateNavbarNotificationBadge(count);

            // 2. Tải 10 thông báo mới nhất cho dropdown
            const { data } = await fetchNotifications({ limit: 10 });
            renderNavbarNotifications(data);

            // 3. Kết nối Realtime listener
            subscribeToUserNotifications(currentUser.id);
        } catch (err) {
            console.warn('[Notifications] initNotificationSystem error:', err);
        } finally {
            _isInitializingNotifications = false;
        }
    }

    // Export API ra window object
    window.ProjectHubNotifications = {
        fetchNotifications,
        getUnreadNotificationCount,
        createNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        updateNavbarNotificationBadge,
        renderNavbarNotifications,
        refreshNavbarNotifications,
        subscribeToUserNotifications,
        initNotificationSystem,
        formatTimeAgo,
        NOTIF_ICONS
    };

    // Alias tiện ích toàn cục
    window.createNotification = createNotification;
    window.getUnreadNotificationCount = getUnreadNotificationCount;
    window.markNotificationAsRead = markNotificationAsRead;
    window.markAllNotificationsAsRead = markAllNotificationsAsRead;

})(window);
