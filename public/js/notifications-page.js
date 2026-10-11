/**
 * notifications-page.js — Controller for notifications.html
 */

'use strict';

(function() {
    let _currentUser = null;
    let _currentFilter = 'all';
    let _allNotifications = [];

    async function initPage() {
        try {
            // Check auth
            if (typeof getCurrentUser === 'function') {
                _currentUser = await getCurrentUser();
            }
            if (!_currentUser) {
                window.location.href = 'login.html?redirect=notifications.html';
                return;
            }

            setupFilterEvents();
            setupMarkAllReadEvent();

            await loadPageNotifications();

            // Realtime update
            if (window.ProjectHubNotifications && typeof window.ProjectHubNotifications.subscribeToUserNotifications === 'function') {
                window.ProjectHubNotifications.subscribeToUserNotifications(_currentUser.id, (payload, eventType) => {
                    loadPageNotifications();
                });
            }
        } catch (err) {
            console.error('[NotificationsPage] Init error:', err);
        }
    }

    function setupFilterEvents() {
        const buttons = document.querySelectorAll('[data-notif-filter]');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                _currentFilter = btn.getAttribute('data-notif-filter') || 'all';
                renderList();
            });
        });
    }

    function setupMarkAllReadEvent() {
        const btn = document.getElementById('btn-mark-all-read');
        if (btn) {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang xử lý...';
                try {
                    await window.ProjectHubNotifications.markAllNotificationsAsRead();
                    await loadPageNotifications();
                    if (typeof showToast === 'function') {
                        showToast('Đã đánh dấu tất cả là đã đọc.', 'success');
                    }
                } catch (err) {
                    console.error('Mark all read error:', err);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-check2-all me-1"></i>Đánh dấu tất cả đã đọc';
                }
            });
        }
    }

    async function loadPageNotifications() {
        const loadingEl = document.getElementById('loading-state');
        const emptyEl = document.getElementById('empty-state');
        const listEl = document.getElementById('notifications-list');

        if (loadingEl && _allNotifications.length === 0) loadingEl.classList.remove('d-none');
        if (emptyEl) emptyEl.classList.add('d-none');

        try {
            const { data, error } = await window.ProjectHubNotifications.fetchNotifications({ limit: 100 });
            if (error) throw error;
            _allNotifications = data || [];

            // Tự động dọn dẹp các thông báo đã đọc quá 30 ngày để tối ưu bộ nhớ
            await cleanupOldReadNotifications();

            updateTabBadges();
            renderList();
        } catch (err) {
            console.error('[NotificationsPage] Load error:', err);
            if (listEl) {
                listEl.innerHTML = `
                    <div class="alert alert-danger my-3">
                        <i class="bi bi-exclamation-triangle me-2"></i>Không thể tải danh sách thông báo: ${err.message}
                    </div>
                `;
            }
        } finally {
            if (loadingEl) loadingEl.classList.add('d-none');
        }
    }

    /**
     * Tự động dọn dẹp các thông báo đã đọc cũ hơn 30 ngày để giải phóng bộ nhớ
     */
    async function cleanupOldReadNotifications() {
        if (!_currentUser) return;
        try {
            const now = Date.now();
            const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
            const cutoffDate = new Date(now - THIRTY_DAYS_MS).toISOString();

            const expiredIds = _allNotifications
                .filter(n => n.is_read && n.created_at && new Date(n.created_at).getTime() < (now - THIRTY_DAYS_MS))
                .map(n => n.id);

            if (expiredIds.length > 0) {
                const supabase = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : window.supabaseClient;
                if (supabase) {
                    await supabase
                        .from('notifications')
                        .delete()
                        .eq('user_id', _currentUser.id)
                        .eq('is_read', true)
                        .lt('created_at', cutoffDate);
                }

                // Loại bỏ khỏi mảng hiện tại
                _allNotifications = _allNotifications.filter(n => !expiredIds.includes(n.id));
            }
        } catch (e) {
            console.warn('[Notifications] Cleanup expired notifications warning:', e);
        }
    }

    function updateTabBadges() {
        const totalCount = _allNotifications.length;
        const unreadCount = _allNotifications.filter(n => !n.is_read).length;
        const readCount = totalCount - unreadCount;

        const totalBadge = document.getElementById('badge-all-count');
        const unreadBadge = document.getElementById('badge-unread-count');
        const readBadge = document.getElementById('badge-read-count');

        // Chỉ hiển thị số khi > 0, tuyệt đối không hiện số 0 vô ích
        if (totalBadge) {
            totalBadge.textContent = totalCount;
            totalBadge.style.display = totalCount > 0 ? 'inline-block' : 'none';
        }
        if (unreadBadge) {
            unreadBadge.textContent = unreadCount;
            unreadBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }
        if (readBadge) {
            readBadge.textContent = readCount;
            readBadge.style.display = readCount > 0 ? 'inline-block' : 'none';
        }

        const markAllBtn = document.getElementById('btn-mark-all-read');
        if (markAllBtn) {
            markAllBtn.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
        }
    }

    function renderList() {
        const listEl = document.getElementById('notifications-list');
        const emptyEl = document.getElementById('empty-state');
        if (!listEl) return;

        let filtered = _allNotifications;
        if (_currentFilter === 'unread') {
            filtered = _allNotifications.filter(n => !n.is_read);
        } else if (_currentFilter === 'read') {
            filtered = _allNotifications.filter(n => n.is_read);
        }

        if (filtered.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) {
                emptyEl.classList.remove('d-none');
                const emptyMsg = emptyEl.querySelector('p');
                if (emptyMsg) {
                    if (_currentFilter === 'unread') {
                        emptyMsg.textContent = 'Tuyệt vời! Bạn không có thông báo chưa đọc nào.';
                    } else if (_currentFilter === 'read') {
                        emptyMsg.textContent = 'Bạn chưa có thông báo nào đã đọc.';
                    } else {
                        emptyMsg.textContent = 'Hộp thư thông báo của bạn đang trống.';
                    }
                }
            }
            return;
        }

        if (emptyEl) emptyEl.classList.add('d-none');

        const iconsConf = window.ProjectHubNotifications?.NOTIF_ICONS || {};
        const timeAgoFn = window.ProjectHubNotifications?.formatTimeAgo || ((d) => d);

        const html = filtered.map(n => {
            const conf = iconsConf[n.type] || { icon: 'bi-bell', color: 'text-primary' };
            const isUnread = !n.is_read;
            const bgClass = isUnread ? 'bg-white border-primary-subtle shadow-sm' : 'bg-light bg-opacity-50 text-muted';
            const actionUrl = n.action_url;

            return `
                <div class="card mb-3 border ${bgClass} transition-all notif-card" id="notif-card-${n.id}" style="${isUnread ? 'border-left: 4px solid var(--primary, #4F46E5) !important;' : ''}">
                    <div class="card-body p-3 p-md-4">
                        <div class="d-flex align-items-start gap-3">
                            <div class="flex-shrink-0 mt-1">
                                <span class="d-inline-flex align-items-center justify-content-center rounded-circle ${conf.color} bg-opacity-10" style="width: 42px; height: 42px; background-color: currentColor;">
                                    <i class="bi ${conf.icon} fs-5 ${conf.color}"></i>
                                </span>
                            </div>
                            <div class="flex-grow-1 min-w-0">
                                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                                    <h6 class="mb-0 fw-bold ${isUnread ? 'text-dark' : 'text-secondary'}">
                                        ${escapeHtml(n.title)}
                                        ${isUnread ? '<span class="badge bg-primary bg-opacity-10 text-primary ms-2" style="font-size: 0.7rem;">Mới</span>' : ''}
                                    </h6>
                                    <span class="text-muted small" style="font-size: 0.78rem;">
                                        <i class="bi bi-clock me-1"></i>${timeAgoFn(n.created_at)}
                                    </span>
                                </div>
                                <p class="mb-2 text-secondary small ${isUnread ? 'fw-normal text-dark' : ''}">
                                    ${escapeHtml(n.message || '')}
                                </p>
                                <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                                    ${actionUrl ? `
                                        <a href="${escapeHtml(actionUrl)}" class="btn btn-sm btn-primary py-1 px-3" onclick="window.onNotificationNavigate('${n.id}', '${escapeHtml(actionUrl)}')">
                                            <i class="bi bi-arrow-up-right me-1"></i>Xem chi tiết
                                        </a>
                                    ` : ''}
                                    ${isUnread ? `
                                        <button class="btn btn-sm btn-outline-secondary py-1 px-2" onclick="window.onNotificationToggleRead('${n.id}', true)">
                                            <i class="bi bi-check2 me-1"></i>Đánh dấu đã đọc
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-sm btn-link text-danger text-decoration-none py-1 px-2 ms-auto" title="Xóa thông báo" onclick="window.onNotificationDelete('${n.id}')">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = html;
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

    window.onNotificationNavigate = async function(id, url) {
        await window.ProjectHubNotifications.markNotificationAsRead(id);
    };

    window.onNotificationToggleRead = async function(id, targetRead) {
        if (targetRead) {
            await window.ProjectHubNotifications.markNotificationAsRead(id);
            const notif = _allNotifications.find(n => n.id === id);
            if (notif) notif.is_read = true;
            updateTabBadges();
            renderList();
        }
    };

    window.onNotificationDelete = async function(id) {
        if (!confirm('Bạn có chắc muốn xóa thông báo này?')) return;
        const success = await window.ProjectHubNotifications.deleteNotification(id);
        if (success) {
            _allNotifications = _allNotifications.filter(n => n.id !== id);
            updateTabBadges();
            renderList();
            if (typeof showToast === 'function') {
                showToast('Đã xóa thông báo.', 'info');
            }
        }
    };

    document.addEventListener('DOMContentLoaded', initPage);
})();
