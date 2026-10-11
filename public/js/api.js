/**
 * api.js - External API integration layer
 * 
 * Current integrations:
 * - GitHub API (public, no auth key needed for basic data)
 * 
 * Future integrations (ready to connect):
 * - Gemini API (for AI Assistant)
 * - OpenAI API (alternative)
 * 
 * SECURITY: Never hardcode API keys here.
 * Use environment variables or user-provided keys via settings.
 */

// ============================================================
// GITHUB API (Consolidated via ProjectHub Backend Proxy)
// ============================================================

const GITHUB_API_BASE = '/api/github';

/**
 * Fetch GitHub user profile via ProjectHub backend proxy
 * @param {string} username - GitHub username
 * @returns {Promise<Object>} GitHub user data
 */
async function fetchGitHubUser(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('user_not_found');
  }
  const cleanUsername = username.trim();
  const response = await fetch(`${GITHUB_API_BASE}/${encodeURIComponent(cleanUsername)}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('user_not_found');
    if (response.status === 403) throw new Error('rate_limited');
    throw new Error('network_error');
  }
  return response.json();
}

/**
 * Fetch GitHub user repositories via ProjectHub backend proxy
 * @param {string} username - GitHub username
 * @param {number} limit - Max repos to fetch (default 6)
 * @returns {Promise<Array>} Repos array
 */
async function fetchGitHubRepos(username, limit = 6) {
  if (!username || typeof username !== 'string') {
    throw new Error('user_not_found');
  }
  const cleanUsername = username.trim();
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 30);
  const response = await fetch(`${GITHUB_API_BASE}/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=${parsedLimit}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('user_not_found');
    if (response.status === 403) throw new Error('rate_limited');
    throw new Error('network_error');
  }
  return response.json();
}

/**
 * Load GitHub profile and repos, render to page
 * @param {string} username - GitHub username
 */
async function loadGitHubProfile(username) {
  if (!username) return;
  
  const container = document.getElementById('github-section') || document.getElementById('github-repos-container');
  if (!container) return;
  
  // Show loading skeleton
  container.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <div class="text-muted mt-2"><small>Tải dữ liệu GitHub...</small></div>
    </div>
  `;
  
  try {
    const [user, repos] = await Promise.all([
      fetchGitHubUser(username),
      fetchGitHubRepos(username, 6)
    ]);
    
    container.innerHTML = renderGitHubProfile(user, repos);
    
  } catch (error) {
    container.innerHTML = renderGitHubError(error, username);
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
 * Render GitHub profile card
 */
function renderGitHubProfile(user, repos) {
  let reposHtml = '';
  if (repos && repos.length > 0) {
    reposHtml = `<div class="row g-3 mt-4">` + repos.map(repo => renderRepoCard(repo)).join('') + `</div>`;
  } else {
    reposHtml = `<div class="text-center text-muted mt-4 p-3 bg-light rounded"><small>Người dùng này chưa có kho lưu trữ công khai nào.</small></div>`;
  }

  const name = escapeHtml(user.name || user.login);
  const login = escapeHtml(user.login);
  const bio = user.bio ? escapeHtml(user.bio) : '';
  const location = user.location ? escapeHtml(user.location) : '';
  const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.login)}&background=4F46E5&color=fff`;

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-body p-4">
        <div class="d-flex align-items-start align-items-sm-center flex-column flex-sm-row mb-3">
          <img src="${avatarUrl}" alt="${login}" class="rounded-circle mb-3 mb-sm-0 me-sm-4 shadow-sm" width="80" height="80" onerror="this.src='https://ui-avatars.com/api/?name=User&background=4F46E5&color=fff'">
          <div>
            <h4 class="mb-1 fw-bold">${name}</h4>
            <a href="${escapeHtml(user.html_url)}" target="_blank" rel="noopener noreferrer" class="text-decoration-none text-muted mb-2 d-inline-block"><i class="bi bi-github"></i> @${login}</a>
            ${bio ? `<p class="card-text text-secondary mb-1 small">${bio}</p>` : ''}
            ${location ? `<p class="card-text text-secondary small mb-0"><i class="bi bi-geo-alt me-1"></i>${location}</p>` : ''}
          </div>
        </div>
        
        <div class="d-flex gap-4 text-muted mt-3 py-2 border-top border-bottom">
          <div class="text-center"><span class="fs-5 fw-bold text-dark d-block">${Number(user.public_repos) || 0}</span> <small>Repos</small></div>
          <div class="text-center"><span class="fs-5 fw-bold text-dark d-block">${Number(user.followers) || 0}</span> <small>Followers</small></div>
          <div class="text-center"><span class="fs-5 fw-bold text-dark d-block">${Number(user.following) || 0}</span> <small>Following</small></div>
        </div>
        
        ${reposHtml}
      </div>
    </div>
  `;
}

/**
 * Render error state for GitHub section
 */
function renderGitHubError(error, username) {
  let message = 'Đã có lỗi xảy ra khi tải dữ liệu GitHub.';
  let icon = 'bi-exclamation-triangle';
  const safeUser = escapeHtml(username);
  
  if (error.message === 'user_not_found') {
    message = `Không tìm thấy người dùng GitHub: <strong>${safeUser}</strong>. Vui lòng kiểm tra lại username.`;
    icon = 'bi-person-x';
  } else if (error.message === 'rate_limited') {
    message = 'Đã vượt quá giới hạn truy cập API GitHub công khai. Vui lòng thử lại sau.';
    icon = 'bi-stopwatch';
  }

  return `
    <div class="alert alert-warning border-warning border-opacity-50 bg-warning bg-opacity-10 rounded-3 p-4 d-flex align-items-center" role="alert">
      <i class="bi ${icon} fs-2 text-warning me-3"></i>
      <div>
        <h6 class="alert-heading fw-bold mb-1">Lỗi tải dữ liệu</h6>
        <div class="mb-2 text-dark">${message}</div>
        <button class="btn btn-sm btn-outline-warning fw-medium" onclick="loadGitHubProfile('${safeUser}')">
          <i class="bi bi-arrow-clockwise me-1"></i>Thử lại
        </button>
      </div>
    </div>
  `;
}

/**
 * Render individual repo card
 */
function renderRepoCard(repo) {
  const languageColors = {
    JavaScript: '#F7DF1E', TypeScript: '#3178C6', Python: '#3776AB',
    Java: '#ED8B00', CSS: '#1572B6', HTML: '#E34F26', Vue: '#4FC08D',
    React: '#61DAFB', Go: '#00ADD8', Rust: '#DEA584', C: '#555555',
    'C++': '#f34b7d', 'C#': '#178600', PHP: '#4F5D95', Ruby: '#701516'
  };
  
  const langColor = languageColors[repo.language] || '#6e7681';
  const langDot = repo.language ? `<span class="d-inline-block rounded-circle me-1" style="width: 10px; height: 10px; background-color: ${langColor};"></span>${escapeHtml(repo.language)}` : '';
  const desc = escapeHtml(repo.description || 'Không có mô tả');
  const repoName = escapeHtml(repo.name);
  const repoUrl = escapeHtml(repo.html_url);
  const updatedDate = repo.updated_at ? new Date(repo.updated_at).toLocaleDateString('vi-VN') : '';

  return `
    <div class="col-md-6">
      <div class="card h-100 border border-opacity-50 bg-light bg-opacity-50 hover-shadow transition-all" style="font-size: 0.9rem;">
        <div class="card-body p-3 d-flex flex-column">
          <h6 class="mb-2 text-truncate fw-bold">
            <a href="${repoUrl}" target="_blank" rel="noopener noreferrer" class="text-decoration-none text-primary">
              <i class="bi bi-journal-code me-2 text-muted"></i>${repoName}
            </a>
          </h6>
          <p class="text-muted small mb-3 flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.4;">${desc}</p>
          
          <div class="d-flex flex-wrap align-items-center gap-3 text-secondary" style="font-size: 0.8rem;">
            ${langDot ? `<div class="d-flex align-items-center">${langDot}</div>` : ''}
            ${repo.stargazers_count > 0 ? `<div class="d-flex align-items-center" title="Stars"><i class="bi bi-star me-1"></i>${Number(repo.stargazers_count)}</div>` : ''}
            ${repo.forks_count > 0 ? `<div class="d-flex align-items-center" title="Forks"><i class="bi bi-diagram-2 me-1"></i>${Number(repo.forks_count)}</div>` : ''}
            ${updatedDate ? `<div class="ms-auto" title="Cập nhật lần cuối">Cập nhật: ${updatedDate}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// GITHUB USERNAME INPUT HANDLER
// ============================================================

/**
 * Initialize GitHub username input and fetch button
 * Used on profile.html and portfolio.html
 */
function initGitHubFetch() {
  const input = document.getElementById('github-username-input');
  const fetchBtn = document.getElementById('fetch-github-btn');
  // Assume a global getCurrentUser exists, or provide safe fallback
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  
  // Pre-fill with user's GitHub if available
  if (input && user?.github) {
    input.value = user.github;
  }
  
  if (fetchBtn) {
    fetchBtn.addEventListener('click', async () => {
      const username = input?.value?.trim();
      if (!username) { 
        if (typeof showToast === 'function') showToast('Vui lòng nhập GitHub username', 'warning'); 
        else alert('Vui lòng nhập GitHub username');
        return; 
      }
      
      // Save username to user profile
      if (typeof updateCurrentUser === 'function') {
        updateCurrentUser({ github: username });
      }
      
      await loadGitHubProfile(username);
    });
  }
  
  // Auto-load if user has GitHub
  if (user?.github) {
    loadGitHubProfile(user.github);
  }
}

// ============================================================
// AI API LAYER (Consolidated via ProjectHub Backend /api/ai/chat)
// ============================================================

/**
 * Gửi tin nhắn tới AI Assistant qua ProjectHub Backend (/api/ai/chat)
 * Tuyệt đối không gọi trực tiếp OpenAI/Gemini từ browser và không lưu API key ở client.
 * @param {string} message - Tin nhắn người dùng
 * @param {Object} context - Thông tin context dự án
 * @returns {Promise<string>} Phản hồi từ AI
 */
async function sendToAI(message, context = {}) {
  try {
    if (typeof authFetch === 'function') {
      const res = await authFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, projectContext: context })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) return data.reply;
      }
    }
  } catch (err) {
    console.warn('[AI] Backend AI service error, falling back:', err.message);
  }
  // Graceful fallback khi chưa đăng nhập hoặc OpenAI chưa cấu hình key server
  return mockAIResponse(message, context);
}

/**
 * Mock AI response (Fallback khi AI service chưa cấu hình hoặc offline)
 */
function mockAIResponse(message, context) {
  // Trả về câu trả lời có cấu trúc và hữu ích theo ngữ cảnh
  return new Promise(resolve => {
    setTimeout(() => {
      const response = typeof getAIResponse === 'function' 
        ? getAIResponse(message) 
        : 'Xin chào! Tôi là ProjectHub AI Assistant. Tôi có thể giúp bạn lập kế hoạch, phân chia công việc và tư vấn giải pháp kỹ thuật cho dự án.';
      resolve(response);
    }, 600 + Math.random() * 400);
  });
}

// ============================================================
// AUTHENTICATED API HELPER
// ============================================================

/**
 * Gửi HTTP request có kèm Supabase Auth Bearer token
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (typeof getCurrentSession === 'function') {
    const session = await getCurrentSession();
    if (session && session.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }
  return fetch(url, { ...options, headers });
}

window.authFetch = authFetch;

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
  const page = window.location.pathname.split('/').pop();
  if (page === 'profile.html' || page === 'portfolio.html') {
    initGitHubFetch();
  }
});
