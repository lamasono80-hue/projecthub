/**
 * chat.js — Phase 6: Project Realtime Chat & Team Presence
 * Realtime messaging per project with history pagination, deduplication,
 * strict XSS protection, scroll management, and online member tracking.
 */

'use strict';

(function(window) {
    let _projectId = null;
    let _currentUser = null;
    let _currentProfile = null;
    let _messagesMap = new Map(); // id -> message object
    let _oldestTimestamp = null;
    let _hasMoreHistory = true;
    let _isLoadingHistory = false;
    let _chatChannel = null;
    let _presenceChannel = null;
    let _profilesCache = new Map();
    let _unreadChatCount = 0;
    let _isChatTabActive = false;

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

    function formatChatTime(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${mins}`;
    }

    function formatChatDateBadge(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Hôm nay';

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';

        return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    /**
     * Khởi tạo Project Chat
     */
    async function initProjectChat(projectId, user, profile) {
        _projectId = projectId;
        _currentUser = user;
        _currentProfile = profile;
        _messagesMap.clear();
        _oldestTimestamp = null;
        _hasMoreHistory = true;
        _unreadChatCount = 0;

        // Lưu thông tin người dùng vào cache
        if (profile) {
            _profilesCache.set(user.id, {
                id: user.id,
                display_name: profile.display_name || user.email?.split('@')[0],
                avatar_url: profile.avatar_url
            });
        }

        setupChatDOM();
        await loadInitialMessages();
        setupRealtimeChat();
        setupPresence();
    }

    /**
     * Gắn sự kiện DOM cho input và button
     */
    function setupChatDOM() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('btn-send-message');
        const loadMoreBtn = document.getElementById('btn-load-more-messages');

        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            input.addEventListener('input', () => {
                // Auto-expand textarea chiều cao tối đa 120px
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sendMessage();
            });
        }

        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                loadMoreMessages();
            });
        }
    }

    /**
     * Tải 30 tin nhắn mới nhất
     */
    async function loadInitialMessages() {
        const container = document.getElementById('chat-messages-container');
        const spinner = document.getElementById('chat-loading-spinner');
        if (spinner) spinner.classList.remove('d-none');

        try {
            const supabase = getDB();
            if (!supabase || !_projectId) return;

            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    project_id,
                    sender_id,
                    content,
                    created_at,
                    profiles:sender_id ( id, display_name, avatar_url, username )
                `)
                .eq('project_id', _projectId)
                .order('created_at', { ascending: false })
                .limit(30);

            if (error) throw error;

            const messages = (data || []).reverse();
            if (messages.length > 0) {
                _oldestTimestamp = messages[0].created_at;
                messages.forEach(msg => {
                    _messagesMap.set(msg.id, msg);
                    if (msg.profiles) {
                        _profilesCache.set(msg.sender_id, msg.profiles);
                    }
                });
            }

            if ((data || []).length < 30) {
                _hasMoreHistory = false;
                const loadBtn = document.getElementById('btn-load-more-messages');
                if (loadBtn) loadBtn.classList.add('d-none');
            }

            renderAllMessages();
            scrollToBottom(true);

        } catch (err) {
            console.error('[Chat] Error loading initial messages:', err);
        } finally {
            if (spinner) spinner.classList.add('d-none');
        }
    }

    /**
     * Tải thêm tin nhắn cũ (History Pagination không giật màn hình)
     */
    async function loadMoreMessages() {
        if (_isLoadingHistory || !_hasMoreHistory || !_oldestTimestamp) return;

        const loadBtn = document.getElementById('btn-load-more-messages');
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        _isLoadingHistory = true;
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang tải tin cũ...';
        }

        // Lưu lại vị trí scroll trước khi chèn tin nhắn cũ
        const prevScrollHeight = container.scrollHeight;
        const prevScrollTop = container.scrollTop;

        try {
            const supabase = getDB();
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    project_id,
                    sender_id,
                    content,
                    created_at,
                    profiles:sender_id ( id, display_name, avatar_url, username )
                `)
                .eq('project_id', _projectId)
                .lt('created_at', _oldestTimestamp)
                .order('created_at', { ascending: false })
                .limit(30);

            if (error) throw error;

            const olderMessages = (data || []).reverse();
            if (olderMessages.length > 0) {
                _oldestTimestamp = olderMessages[0].created_at;
                
                // Trộn vào Map để đảm bảo không trùng
                const newMap = new Map();
                olderMessages.forEach(msg => {
                    newMap.set(msg.id, msg);
                    if (msg.profiles) _profilesCache.set(msg.sender_id, msg.profiles);
                });
                _messagesMap.forEach((val, key) => {
                    newMap.set(key, val);
                });
                _messagesMap = newMap;
            }

            if ((data || []).length < 30) {
                _hasMoreHistory = false;
                if (loadBtn) loadBtn.classList.add('d-none');
            }

            renderAllMessages();

            // Khôi phục vị trí scroll sau khi chèn tin nhắn cũ
            requestAnimationFrame(() => {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
            });

        } catch (err) {
            console.error('[Chat] Error loading more messages:', err);
        } finally {
            _isLoadingHistory = false;
            if (loadBtn) {
                loadBtn.disabled = false;
                loadBtn.innerHTML = '<i class="bi bi-arrow-up-circle me-1"></i>Tải thêm tin nhắn cũ';
            }
        }
    }

    /**
     * Gửi tin nhắn mới
     */
    async function sendMessage() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('btn-send-message');
        if (!input || !_projectId || !_currentUser) return;

        const content = input.value.trim();
        if (!content) return;

        if (content.length > 2000) {
            if (typeof window.showToast === 'function') {
                window.showToast('Tin nhắn không được vượt quá 2000 ký tự.', 'warning');
            }
            return;
        }

        // Disable nút gửi tạm thời
        if (sendBtn) sendBtn.disabled = true;
        input.value = '';
        input.style.height = 'auto';

        try {
            const supabase = getDB();
            const { data, error } = await supabase
                .from('messages')
                .insert([{
                    project_id: _projectId,
                    sender_id: _currentUser.id,
                    content: content
                }])
                .select(`
                    id,
                    project_id,
                    sender_id,
                    content,
                    created_at
                `)
                .single();

            if (error) throw error;

            // Render ngay vào map nếu có
            if (data) {
                data.profiles = _profilesCache.get(_currentUser.id) || {
                    display_name: _currentProfile?.display_name || _currentUser.email?.split('@')[0],
                    avatar_url: _currentProfile?.avatar_url
                };
                appendSingleMessage(data);
                scrollToBottom(true);
            }

        } catch (err) {
            console.error('[Chat] Error sending message:', err);
            if (typeof window.showToast === 'function') {
                window.showToast(err.message || 'Lỗi gửi tin nhắn.', 'error');
            }
            // Khôi phục lại nội dung nếu gửi thất bại
            input.value = content;
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
        }
    }

    /**
     * Render toàn bộ danh sách tin nhắn
     */
    function renderAllMessages() {
        const listEl = document.getElementById('chat-messages-list');
        if (!listEl) return;

        if (_messagesMap.size === 0) {
            listEl.innerHTML = `
                <div class="text-center py-5 text-muted" id="chat-empty-state">
                    <i class="bi bi-chat-heart display-4 text-primary text-opacity-50 mb-3 d-block"></i>
                    <h6 class="fw-bold">Chưa có tin nhắn nào</h6>
                    <p class="small mb-0">Hãy gửi tin nhắn đầu tiên để bắt đầu thảo luận cùng nhóm dự án!</p>
                </div>
            `;
            return;
        }

        let html = '';
        let lastDateStr = null;

        _messagesMap.forEach(msg => {
            const msgDate = new Date(msg.created_at).toDateString();
            if (msgDate !== lastDateStr) {
                lastDateStr = msgDate;
                html += `
                    <div class="text-center my-3">
                        <span class="badge bg-light text-muted border px-3 py-1 fw-normal" style="font-size: 0.72rem;">
                            ${formatChatDateBadge(msg.created_at)}
                        </span>
                    </div>
                `;
            }
            html += generateMessageBubbleHtml(msg);
        });

        listEl.innerHTML = html;
    }

    /**
     * Chèn 1 tin nhắn vào cuối danh sách (từ send hoặc realtime)
     */
    function appendSingleMessage(msg) {
        if (_messagesMap.has(msg.id)) return; // Tránh trùng lặp
        _messagesMap.set(msg.id, msg);

        const listEl = document.getElementById('chat-messages-list');
        const emptyState = document.getElementById('chat-empty-state');
        if (emptyState) emptyState.remove();

        if (listEl) {
            const temp = document.createElement('div');
            temp.innerHTML = generateMessageBubbleHtml(msg);
            while (temp.firstChild) {
                listEl.appendChild(temp.firstChild);
            }
        }
    }

    /**
     * Tạo HTML cho bubble tin nhắn
     */
    function generateMessageBubbleHtml(msg) {
        const isMine = _currentUser && msg.sender_id === _currentUser.id;
        const profile = msg.profiles || _profilesCache.get(msg.sender_id) || {};
        const senderName = profile.display_name || (isMine ? 'Bạn' : 'Thành viên');
        const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=4F46E5&color=fff&size=64`;
        const timeStr = formatChatTime(msg.created_at);

        if (isMine) {
            return `
                <div class="d-flex justify-content-end mb-3 message-bubble" id="msg-${msg.id}">
                    <div class="d-flex flex-column align-items-end" style="max-width: 75%;">
                        <div class="bg-primary text-white p-3 rounded-4 shadow-sm" style="border-bottom-right-radius: 4px !important; word-break: break-word; white-space: pre-wrap;">
                            ${escapeHtml(msg.content)}
                        </div>
                        <small class="text-muted mt-1" style="font-size: 0.7rem;">
                            ${timeStr} <i class="bi bi-check2 text-primary"></i>
                        </small>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="d-flex justify-content-start align-items-start gap-2 mb-3 message-bubble" id="msg-${msg.id}">
                    <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(senderName)}" class="rounded-circle flex-shrink-0 shadow-sm" style="width: 34px; height: 34px; object-fit: cover; margin-top: 2px;">
                    <div class="d-flex flex-column" style="max-width: 75%;">
                        <span class="small fw-semibold text-secondary mb-1" style="font-size: 0.75rem;">${escapeHtml(senderName)}</span>
                        <div class="bg-white text-dark p-3 rounded-4 shadow-sm border" style="border-bottom-left-radius: 4px !important; word-break: break-word; white-space: pre-wrap;">
                            ${escapeHtml(msg.content)}
                        </div>
                        <small class="text-muted mt-1" style="font-size: 0.7rem;">
                            ${timeStr}
                        </small>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Tự động cuộn xuống đáy
     */
    function scrollToBottom(force = false) {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        const isNearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 150;
        if (force || isNearBottom) {
            requestAnimationFrame(() => {
                container.scrollTop = container.scrollHeight;
            });
        }
    }

    /**
     * Kích hoạt Realtime Channel cho Chat
     */
    function setupRealtimeChat() {
        const supabase = getDB();
        if (!supabase || !_projectId) return;

        if (_chatChannel) {
            supabase.removeChannel(_chatChannel);
            _chatChannel = null;
        }

        _chatChannel = supabase.channel(`project-chat-${_projectId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `project_id=eq.${_projectId}`
                },
                async (payload) => {
                    const newMsg = payload.new;
                    if (_messagesMap.has(newMsg.id)) return;

                    // Lấy profile của sender nếu chưa có trong cache
                    if (!_profilesCache.has(newMsg.sender_id)) {
                        const { data: p } = await supabase
                            .from('profiles')
                            .select('id, display_name, avatar_url, username')
                            .eq('id', newMsg.sender_id)
                            .single();
                        if (p) _profilesCache.set(newMsg.sender_id, p);
                    }
                    newMsg.profiles = _profilesCache.get(newMsg.sender_id);

                    appendSingleMessage(newMsg);
                    scrollToBottom(false);

                    // Nếu người gửi không phải mình và user không ở tab Chat, tăng badge
                    if (_currentUser && newMsg.sender_id !== _currentUser.id && !_isChatTabActive) {
                        _unreadChatCount++;
                        updateChatBadge(_unreadChatCount);
                    }
                }
            )
            .subscribe();
    }

    /**
     * Cập nhật badge tin nhắn chưa đọc trên Tab Thảo luận
     */
    function updateChatBadge(count) {
        const badge = document.getElementById('ws-chat-badge');
        if (!badge) return;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }

    /**
     * Kích hoạt Supabase Presence (Theo dõi Online Status)
     */
    function setupPresence() {
        const supabase = getDB();
        if (!supabase || !_projectId || !_currentUser) return;

        if (_presenceChannel) {
            supabase.removeChannel(_presenceChannel);
            _presenceChannel = null;
        }

        const channel = supabase.channel(`room-presence-${_projectId}`, {
            config: {
                presence: {
                    key: _currentUser.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                renderOnlinePresence(state);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                const state = channel.presenceState();
                renderOnlinePresence(state);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                const state = channel.presenceState();
                renderOnlinePresence(state);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const name = _currentProfile?.display_name || _currentUser.email?.split('@')[0] || 'User';
                    const avatar = _currentProfile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4F46E5&color=fff`;
                    await channel.track({
                        user_id: _currentUser.id,
                        name: name,
                        avatar: avatar,
                        online_at: new Date().toISOString()
                    });
                }
            });

        _presenceChannel = channel;
    }

    /**
     * Hiển thị số lượng và danh sách online
     */
    function renderOnlinePresence(presenceState) {
        const onlineCountEl = document.getElementById('ws-online-count');
        const presenceIndicator = document.getElementById('ws-presence-indicator');
        if (!onlineCountEl) return;

        const uniqueUsers = Object.keys(presenceState || {});
        const count = uniqueUsers.length;
        onlineCountEl.textContent = count;

        if (presenceIndicator) {
            const names = [];
            for (const key in presenceState) {
                const pList = presenceState[key];
                if (pList && pList[0]) names.push(pList[0].name || 'Thành viên');
            }
            presenceIndicator.title = `Đang online (${count}):\n${names.join(', ')}`;
        }
    }

    /**
     * Được gọi khi user chuyển tab trong Workspace
     */
    function setChatTabActive(active) {
        _isChatTabActive = active;
        if (active) {
            _unreadChatCount = 0;
            updateChatBadge(0);
            scrollToBottom(true);
            const input = document.getElementById('chat-input');
            if (input) input.focus();
        }
    }

    /**
     * Dọn dẹp channels khi rời trang
     */
    function cleanupChat() {
        const supabase = getDB();
        if (supabase) {
            if (_chatChannel) supabase.removeChannel(_chatChannel);
            if (_presenceChannel) supabase.removeChannel(_presenceChannel);
        }
        _chatChannel = null;
        _presenceChannel = null;
    }

    window.addEventListener('beforeunload', cleanupChat);

    // Export API ra window
    window.ProjectHubChat = {
        initProjectChat,
        sendMessage,
        loadMoreMessages,
        setChatTabActive,
        cleanupChat
    };

    window.initProjectChat = initProjectChat;
    window.setChatTabActive = setChatTabActive;

})(window);
