/**
 * services/geminiService.js — Google Gemini API Integration
 * Model: gemini-2.5-flash (với tự động fallback sang gemini-1.5-flash)
 */
'use strict';

function isConfigured() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) return false;
  if (apiKey.includes('your-gemini') || apiKey.startsWith('TODO')) return false;
  return true;
}

const SYSTEM_PROMPT = `Bạn là Trợ lý ảo AI ProjectHub — hệ thống đồng hành cùng học sinh, sinh viên và lập trình viên trong việc quản lý dự án, cộng tác nhóm và thực hiện đồ án tốt nghiệp/khởi nghiệp công nghệ.

Nhiệm vụ của bạn:
1. Giải đáp thắc mắc về phân chia công việc theo chuẩn Agile / Kanban.
2. Đề xuất các task cụ thể (kèm độ ưu tiên, hạn chót hợp lý) khi người dùng yêu cầu chia việc cho dự án.
3. Tóm tắt và phân tích tiến độ, nhắc nhở các rủi ro chậm deadline.
4. Gợi ý công nghệ (React, Node.js, Python, Supabase, Tailwind...) phù hợp với yêu cầu bài toán.
5. Định hướng kết nối thành viên và cải thiện hồ sơ năng lực (Portfolio).

Phong cách phản hồi:
- Sử dụng tiếng Việt chuẩn mực, thân thiện, súc tích và truyền cảm hứng.
- Định dạng câu trả lời bằng Markdown rõ ràng (tiêu đề, gạch đầu dòng, in đậm từ khóa quan trọng).
- Trả lời thẳng vào trọng tâm, không dông dài.`;

async function callGemini(modelName, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(25000) // 25 seconds timeout
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.error?.message || `Gemini API HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error('Gemini API trả về nội dung rỗng');
  }
  return reply;
}

async function chat({ message, projectContext, conversationHistory, userProfile }) {
  if (!isConfigured()) {
    return { success: false, fallback: true, message: 'GEMINI_API_KEY chưa được cấu hình trong .env' };
  }

  const apiKey = process.env.GEMINI_API_KEY.trim();

  // Xây dựng context rõ ràng
  let contextualPrompt = '';
  if (projectContext && projectContext.title) {
    contextualPrompt += `[Ngữ cảnh dự án hiện tại: Tên: "${projectContext.title}", Lĩnh vực: ${projectContext.category || 'Chung'}, Tiến độ: ${projectContext.progress || 0}%, Công nghệ: ${(projectContext.technologies || []).join(', ')}]\n`;
  }
  if (userProfile && (userProfile.display_name || userProfile.skills)) {
    contextualPrompt += `[Thông tin người dùng: "${userProfile.display_name || 'Người dùng'}", Kỹ năng: ${(userProfile.skills || []).join(', ')}]\n`;
  }
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const historyText = conversationHistory.slice(-4).map(h => `${h.role === 'user' ? 'Người dùng' : 'AI'}: ${h.text}`).join('\n');
    contextualPrompt += `[Lịch sử trao đổi gần nhất:\n${historyText}]\n`;
  }
  contextualPrompt += `Người dùng hỏi: ${message}`;

  try {
    // Ưu tiên gemini-2.5-flash theo yêu cầu
    const reply = await callGemini('gemini-2.5-flash', contextualPrompt, apiKey);
    return { success: true, reply, model: 'gemini-2.5-flash', source: 'gemini' };
  } catch (err) {
    console.warn('[Gemini 2.5 Flash] Thử lại với gemini-1.5-flash:', err.message);
    try {
      const fallbackReply = await callGemini('gemini-1.5-flash', contextualPrompt, apiKey);
      return { success: true, reply: fallbackReply, model: 'gemini-1.5-flash', source: 'gemini' };
    } catch (fbErr) {
      console.warn('[Gemini Fallback Error]:', fbErr.message);
      return { success: false, fallback: true, error: fbErr.message };
    }
  }
}

module.exports = {
  isConfigured,
  chat
};
