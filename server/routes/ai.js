/**
 * routes/ai.js — AI Assistant endpoints
 * Tất cả OpenAI calls phải đi qua đây — KHÔNG gọi từ frontend
 */
'use strict';

const express = require('express');
const router  = express.Router();
const openaiService = require('../services/openaiService');
const geminiService = require('../services/geminiService');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/ai/chat
 * Body: { message: string, projectContext?: object, conversationHistory?: array }
 * Auth: Bearer token (Supabase JWT)
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { message, projectContext, conversationHistory, userProfile } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Tin nhắn không được để trống.' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Tin nhắn không được vượt quá 2000 ký tự.' });
    }

    if (geminiService.isConfigured()) {
      const result = await geminiService.chat({
        message: message.trim(),
        projectContext,
        conversationHistory: conversationHistory || [],
        userProfile
      });
      if (result.success) {
        return res.json(result);
      }
    }

    if (openaiService.isConfigured()) {
      const response = await openaiService.chat({
        message: message.trim(),
        projectContext,
        conversationHistory: conversationHistory || [],
        userId: req.user?.id || 'anonymous',
      });
      return res.json({ success: true, reply: response, source: 'openai' });
    }

    // Graceful fallback nếu chưa cấu hình API key
    return res.json({
      success: false,
      fallback: true,
      message: 'AI API chưa được cấu hình. Sử dụng Smart Fallback Engine.'
    });
  } catch (err) {
    console.warn('[AI Route Chat Error]:', err.message);
    return res.json({ success: false, fallback: true, error: err.message });
  }
});

/**
 * POST /api/ai/analyze-project
 * Phân tích project và tạo breakdown tasks
 */
router.post('/analyze-project', requireAuth, async (req, res, next) => {
  try {
    const { project } = req.body;
    if (!project || !project.title) {
      return res.status(400).json({ error: 'Thiếu thông tin project.' });
    }

    if (!openaiService.isConfigured()) {
      return res.status(503).json({
        error: 'Tính năng phân tích dự án bằng AI chưa khả dụng do chưa cấu hình OPENAI_API_KEY trong file .env trên server.'
      });
    }

    const analysis = await openaiService.analyzeProject(project, req.user.id);
    res.json(analysis);
  } catch (err) {
    if (err.code === 'OPENAI_NOT_CONFIGURED' || err.status === 503) {
      return res.status(503).json({ error: err.message });
    }
    if (err.status === 401 || err.code === 'invalid_api_key') {
      return res.status(502).json({ error: 'OPENAI_API_KEY không hợp lệ hoặc đã hết hạn.' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Đã vượt quá hạn mức gọi OpenAI API. Vui lòng thử lại sau.' });
    }
    return res.status(err.status || 500).json({
      error: 'Lỗi khi phân tích dự án bằng AI: ' + (err.message || 'Không xác định')
    });
  }
});

/**
 * POST /api/ai/match-members
 * AI matching — tính điểm phù hợp giữa user và project
 * Hỗ trợ fallback sang rule-based khi OpenAI chưa có API key hoặc lỗi
 */
router.post('/match-members', requireAuth, async (req, res) => {
  const { project, candidates } = req.body;
  if (!project || !Array.isArray(candidates)) {
    return res.status(400).json({ error: 'Thiếu dữ liệu matching.' });
  }

  // 1. Tính toán Rule-based matches chuẩn
  const ruleBasedMatches = candidates.map(candidate => calculateRuleBasedMatch(project, candidate))
    .sort((a, b) => b.score - a.score);

  // 2. Thử gọi OpenAI nếu có API key hợp lệ
  if (openaiService.isConfigured()) {
    try {
      const aiMatches = await openaiService.matchMembers(project, candidates);
      if (Array.isArray(aiMatches) && aiMatches.length > 0) {
        // Merge kết quả AI với rule-based để đảm bảo đầy đủ trường dữ liệu
        const merged = ruleBasedMatches.map(rb => {
          const aiMatch = aiMatches.find(m => String(m.id) === String(rb.id));
          if (aiMatch && typeof aiMatch.score === 'number') {
            return {
              ...rb,
              score: Math.max(0, Math.min(100, Math.round(aiMatch.score))),
              reasons: (Array.isArray(aiMatch.reasons) && aiMatch.reasons.length > 0) ? aiMatch.reasons : rb.reasons
            };
          }
          return rb;
        }).sort((a, b) => b.score - a.score);

        return res.json({ matches: merged, engine: 'openai' });
      }
    } catch (err) {
      console.warn('[AI Match] OpenAI call failed, falling back to rule-based engine:', err.message);
    }
  }

  // Fallback sang rule-based
  res.json({ matches: ruleBasedMatches, engine: 'rule-based' });
});

function calculateRuleBasedMatch(project, candidate) {
  const projTechs = (project.technologies || []).map(t => String(t).toLowerCase().trim()).filter(Boolean);
  const candSkills = (candidate.skills || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
  const candInterests = (candidate.interests || []).map(i => String(i).toLowerCase().trim()).filter(Boolean);
  const projCategory = String(project.category || '').toLowerCase().trim();

  // 1. Skill overlap (50%)
  const matchedTechs = projTechs.filter(t => candSkills.some(s => s === t || s.includes(t) || t.includes(s)));
  const skillScore = projTechs.length > 0 ? (matchedTechs.length / projTechs.length) : 0.6;

  // 2. Interest / Category fit (20%)
  const interestMatch = candInterests.some(i => i.includes(projCategory) || projCategory.includes(i));
  const interestScore = interestMatch ? 1.0 : 0.3;

  // 3. Experience fit (15%)
  const expScores = { beginner: 0.7, intermediate: 0.9, advanced: 1.0 };
  const expScore = expScores[candidate.experience] || 0.7;

  // 4. Activity / Profile completeness (15%)
  const profileScore = candSkills.length >= 3 ? 1.0 : (candSkills.length / 3);

  let finalScore = Math.round((skillScore * 50) + (interestScore * 20) + (expScore * 15) + (profileScore * 15));
  finalScore = Math.max(10, Math.min(99, finalScore));

  const reasons = [];
  if (matchedTechs.length > 0) {
    reasons.push(`Trùng khớp công nghệ: ${matchedTechs.slice(0, 3).join(', ')}`);
  }
  if (interestMatch) {
    reasons.push(`Quan tâm đến lĩnh vực: ${project.category || 'dự án'}`);
  }
  if (candidate.experience === 'advanced' || candidate.experience === 'intermediate') {
    reasons.push(`Kinh nghiệm ${candidate.experience === 'advanced' ? 'nâng cao' : 'trung cấp'} phù hợp`);
  }
  if (reasons.length === 0) {
    reasons.push('Có tiềm năng học hỏi và đóng góp cho dự án');
  }

  return {
    id: candidate.id,
    score: finalScore,
    matchedSkills: matchedTechs,
    missingSkills: projTechs.filter(t => !matchedTechs.includes(t)),
    reasons
  };
}

module.exports = router;
