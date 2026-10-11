/**
 * services/githubService.js — GitHub REST API Integration
 * Proxy qua đây để dùng GITHUB_TOKEN (tăng rate limit)
 */
'use strict';

const https = require('https');

const GITHUB_API_BASE = 'https://api.github.com';

function getHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'ProjectHub/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

/**
 * HTTP GET helper
 */
function githubGet(pathOrUrl, redirectCount = 0) {
  if (redirectCount > 3) {
    return Promise.reject(new Error('Quá nhiều lần chuyển hướng GitHub API.'));
  }

  return new Promise((resolve, reject) => {
    let urlObj;
    if (/^https?:\/\//i.test(pathOrUrl)) {
      urlObj = new URL(pathOrUrl);
    } else {
      urlObj = new URL(pathOrUrl, 'https://api.github.com');
    }

    // Hostname validation: strictly allow only api.github.com
    if (urlObj.hostname.toLowerCase() !== 'api.github.com') {
      const err = new Error('Chỉ được phép kết nối tới api.github.com');
      err.status = 400;
      return reject(err);
    }

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: getHeaders(),
    };

    const req = https.request(options, (res) => {
      // Tự động theo dõi chuyển hướng (GitHub 301 Moved Permanently / 302 / 307 / 308)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return resolve(githubGet(res.headers.location, redirectCount + 1));
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 404) {
          const err = new Error('Not Found');
          err.status = 404;
          return reject(err);
        }
        if (res.statusCode === 403) {
          const err = new Error('GitHub API rate limit reached. Cấu hình GITHUB_TOKEN để tăng giới hạn.');
          err.status = 403;
          return reject(err);
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('GitHub API trả về response không hợp lệ.'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      const err = new Error('GitHub API timeout.');
      err.status = 504;
      reject(err);
    });
    req.end();
  });
}

/**
 * Lấy GitHub profile
 */
async function getProfile(username) {
  const user = await githubGet(`/users/${encodeURIComponent(username)}`);
  // Chỉ trả về fields cần thiết (không trả về toàn bộ raw response)
  return {
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    bio: user.bio,
    location: user.location,
    company: user.company,
    blog: user.blog,
    html_url: user.html_url,
    public_repos: user.public_repos,
    followers: user.followers,
    following: user.following,
    created_at: user.created_at,
  };
}

/**
 * Lấy danh sách repositories
 */
async function getRepos(username, { sort = 'updated', per_page = 6 } = {}) {
  const repos = await githubGet(
    `/users/${encodeURIComponent(username)}/repos?sort=${sort}&per_page=${per_page}&type=owner`
  );

  if (!Array.isArray(repos)) return [];

  // Chỉ trả về fields cần thiết
  return repos.map(r => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    html_url: r.html_url,
    homepage: r.homepage,
    language: r.language,
    stargazers_count: r.stargazers_count,
    forks_count: r.forks_count,
    topics: r.topics || [],
    updated_at: r.updated_at,
    fork: r.fork,
  }));
}

// In-memory cache cho repository: TTL 5 phút
const repoCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Phân tích và trích xuất { owner, repo } từ URL hoặc chuỗi owner/repo
 * Hỗ trợ:
 * - https://github.com/owner/repo
 * - http://github.com/owner/repo/
 * - github.com/owner/repo.git
 * - owner/repo
 */
function parseGitHubRepo(input) {
  if (!input || typeof input !== 'string') return null;
  let str = input.trim();

  // Bỏ trailing slash và .git
  str = str.replace(/\/+$/, '').replace(/\.git$/, '');

  // Từ chối path traversal (..)
  if (/\.\./.test(str)) {
    return null;
  }

  // Trích xuất path nếu là URL
  if (/^https?:\/\//i.test(str)) {
    try {
      const parsed = new URL(str);
      // Chỉ chấp nhận domain github.com (chống SSRF / Open Redirect)
      if (parsed.hostname.toLowerCase() !== 'github.com' && parsed.hostname.toLowerCase() !== 'www.github.com') {
        return null;
      }
      str = parsed.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  } else if (/^github\.com\//i.test(str)) {
    str = str.replace(/^github\.com\//i, '');
  }

  // str bây giờ phải là format owner/repo
  const parts = str.split('/');
  if (parts.length !== 2) return null;

  const [owner, repo] = parts;

  // Validate owner (GitHub username format: 1-39 chars)
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(owner)) {
    return null;
  }

  // Validate repo (1-100 chars)
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(repo)) {
    return null;
  }

  return { owner, repo };
}

/**
 * Lấy thông tin repository từ GitHub REST API với cache bộ nhớ 5 phút
 */
async function getRepository(owner, repo, { refresh = false } = {}) {
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;

  if (!refresh) {
    const cached = repoCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, _cached: true };
    }
  }

  const data = await githubGet(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);

  const result = {
    id: data.id,
    name: data.name,
    full_name: data.full_name,
    owner: (data.owner && data.owner.login) ? data.owner.login : owner,
    owner_avatar: (data.owner && data.owner.avatar_url) ? data.owner.avatar_url : null,
    description: data.description || '',
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    open_issues: data.open_issues_count || 0,
    default_branch: data.default_branch || 'main',
    language: data.language || null,
    html_url: data.html_url,
    homepage: data.homepage || null,
    topics: Array.isArray(data.topics) ? data.topics : [],
    is_fork: Boolean(data.fork),
    created_at: data.created_at,
    updated_at: data.updated_at,
    pushed_at: data.pushed_at,
    archived: Boolean(data.archived),
    visibility: data.visibility || (data.private ? 'private' : 'public'),
  };

  repoCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

module.exports = {
  getProfile,
  getRepos,
  getRepository,
  parseGitHubRepo,
};
