/**
 * routes/github.js — GitHub API proxy
 * Proxy qua đây để có thể dùng GITHUB_TOKEN (tăng rate limit 60→5000 req/h)
 * và để frontend không cần biết token
 */
'use strict';

const express = require('express');
const router  = express.Router();
const githubService = require('../services/githubService');

/**
 * GET /api/github/repository
 * Query: ?url=https://github.com/owner/repo (hoặc ?url=owner/repo)
 *        &refresh=true (tùy chọn: bỏ qua cache)
 * Trả về thông tin chi tiết repository
 */
router.get('/repository', async (req, res, next) => {
  try {
    const rawUrl = req.query.url || req.query.repo;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({
        error: 'Vui lòng cung cấp tham số url (ví dụ: ?url=https://github.com/facebook/react hoặc ?url=facebook/react).'
      });
    }

    const parsed = githubService.parseGitHubRepo(rawUrl);
    if (!parsed) {
      return res.status(400).json({
        error: 'Đường dẫn GitHub repository không hợp lệ. Ví dụ hợp lệ: https://github.com/facebook/react hoặc facebook/react.'
      });
    }

    const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
    const repoData = await githubService.getRepository(parsed.owner, parsed.repo, { refresh });
    return res.json(repoData);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({
        error: 'Không tìm thấy repository trên GitHub hoặc đây là repository riêng tư (private).'
      });
    }
    if (err.status === 403) {
      return res.status(403).json({
        error: 'Đã đạt giới hạn số lượt gọi GitHub API. Vui lòng thử lại sau.'
      });
    }
    if (err.status === 504 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'Không thể kết nối đến GitHub API (hết thời gian chờ).'
      });
    }
    next(err);
  }
});

/**
 * GET /api/github/:username
 * Trả về GitHub profile + repos của user
 */
router.get('/:username', async (req, res, next) => {
  try {
    const { username } = req.params;

    // Validate username — chỉ cho phép ký tự hợp lệ GitHub
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
      return res.status(400).json({ error: 'GitHub username không hợp lệ.' });
    }

    const data = await githubService.getProfile(username);
    res.json(data);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: 'GitHub user không tồn tại.' });
    }
    if (err.status === 403) {
      return res.status(403).json({ error: 'Đã đạt giới hạn số lượt gọi GitHub API. Vui lòng thử lại sau.' });
    }
    if (err.status === 504 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Không thể kết nối đến GitHub API (hết thời gian chờ).' });
    }
    next(err);
  }
});

/**
 * GET /api/github/:username/repos
 * Trả về danh sách repositories
 */
router.get('/:username/repos', async (req, res, next) => {
  try {
    const { username } = req.params;
    const { sort = 'updated', per_page = 6 } = req.query;

    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
      return res.status(400).json({ error: 'GitHub username không hợp lệ.' });
    }

    const repos = await githubService.getRepos(username, { sort, per_page: Math.min(Number(per_page), 30) });
    res.json(repos);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: 'GitHub user không tồn tại.' });
    }
    if (err.status === 403) {
      return res.status(403).json({ error: 'Đã đạt giới hạn số lượt gọi GitHub API. Vui lòng thử lại sau.' });
    }
    if (err.status === 504 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Không thể kết nối đến GitHub API (hết thời gian chờ).' });
    }
    next(err);
  }
});

module.exports = router;
