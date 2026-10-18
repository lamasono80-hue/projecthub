/**
 * ProjectHub - Project Detail Page Enhancements & Utilities
 * project-detail.js
 * 
 * Chức năng:
 * 1. Khóa bảo mật 'Kho mã nguồn GitHub' (Chỉ cho Chủ dự án & Thành viên đã duyệt)
 * 2. Cảnh báo hạn chót (Deadline Overdue Status)
 * 3. Ẩn / Hiển thị thẻ 'Mức độ phù hợp của bạn' (AI Matching) & Empty state gợi ý kỹ năng
 * 4. Nút '🔗 Sao chép link dự án' (Copy Share Link)
 */

(function () {
    'use strict';

    /**
     * Sao chép liên kết dự án vào clipboard và hiển thị thông báo phản hồi
     */
    async function copyProjectShareLink() {
        const url = window.location.href;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const tempInput = document.createElement('input');
                tempInput.value = url;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
            }

            if (typeof showToast === 'function') {
                showToast('Đã sao chép liên kết dự án vào clipboard! Hãy gửi cho bạn bè để ứng tuyển.', 'success');
            } else {
                alert('Đã sao chép liên kết dự án vào clipboard!');
            }
        } catch (err) {
            console.warn('Clipboard copy error:', err);
            prompt('Sao chép liên kết dự án:', url);
        }
    }

    /**
     * Kiểm tra và format hạn chót của dự án (So sánh với ngày hiện tại)
     * @param {string|Date} deadline
     * @returns {{ isOverdue: boolean, dateStr: string, badgeHtml: string }}
     */
    function checkProjectDeadline(deadline) {
        if (!deadline) {
            return {
                isOverdue: false,
                dateStr: 'Không có',
                badgeHtml: '<span class="text-muted">Không có</span>'
            };
        }

        const deadlineDate = new Date(deadline);
        if (isNaN(deadlineDate.getTime())) {
            return {
                isOverdue: false,
                dateStr: String(deadline),
                badgeHtml: `<span class="text-dark">${String(deadline)}</span>`
            };
        }

        const dateStr = deadlineDate.toLocaleDateString('vi-VN');
        // Tính đến hết 23:59:59 của ngày hạn chót
        const endOfDay = new Date(deadlineDate);
        endOfDay.setHours(23, 59, 59, 999);
        const isOverdue = endOfDay.getTime() < Date.now();

        const badgeHtml = isOverdue
            ? `<div class="d-inline-flex flex-wrap align-items-center justify-content-end gap-1 text-end">
                 <span class="text-danger fw-semibold">${dateStr}</span>
                 <span class="badge bg-danger text-white px-2 py-1" style="font-size: 0.72rem; vertical-align: middle;">
                     <i class="bi bi-exclamation-circle me-1"></i>Đã kết thúc / Quá hạn
                 </span>
               </div>`
            : `<span class="fw-semibold text-dark">${dateStr}</span>`;

        return { isOverdue, dateStr, badgeHtml };
    }

    /**
     * Gắn sự kiện sao chép liên kết cho toàn bộ các nút .btn-share-project
     */
    function bindShareProjectButtons() {
        document.querySelectorAll('.btn-share-project').forEach(btn => {
            if (!btn.dataset.hasShareBound) {
                btn.dataset.hasShareBound = 'true';
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    copyProjectShareLink();
                });
            }
        });
    }

    // Tự động kích hoạt khi DOM đã sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bindShareProjectButtons();
        });
    } else {
        bindShareProjectButtons();
    }

    // Xuất ra window để các module khác có thể sử dụng
    window.copyProjectShareLink = copyProjectShareLink;
    window.checkProjectDeadline = checkProjectDeadline;
    window.bindShareProjectButtons = bindShareProjectButtons;

})();
