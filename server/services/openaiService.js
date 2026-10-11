/**
 * services/openaiService.js — OpenAI Integration
 *
 * QUAN TRỌNG:
 * - API key CHỈ được đọc từ process.env — KHÔNG hardcode
 * - Không thực thi code AI trả về
 * - Luôn validate và sanitize output trước khi trả về frontend
 * - Chỉ gọi từ backend routes
 */
'use strict';

let openaiClient = null;

function isConfigured() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) return false;
  if (apiKey.includes('your-openai-key') || apiKey.startsWith('sk-...')) {
    return false;
  }
  return true;
}

function getClient() {
  if (!isConfigured()) {
    const err = new Error('Dịch vụ OpenAI chưa được cấu hình hợp lệ trong .env. Vui lòng thiết lập OPENAI_API_KEY.');
    err.code = 'OPENAI_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY.trim();
    const { OpenAI } = require('openai');
    openaiClient = new OpenAI({
      apiKey,
      timeout: 30000,   // 30 seconds timeout ngăn ngừa treo request
      maxRetries: 2,    // Tự động thử lại 2 lần với backoff
    });
  }
  return openaiClient;
}

// System prompt cho ProjectHub AI
const SYSTEM_PROMPT = `Bạn là ProjectHub AI — trợ lý thông minh giúp học sinh, sinh viên và lập trình viên quản lý dự án.

Bạn có thể:
1. Phân tích project và đề xuất cách chia tasks
2. Lập kế hoạch và timeline
3. Đề xuất công nghệ phù hợp
4. Phân tích tiến độ và cảnh báo rủi ro
5. Tìm roles còn thiếu trong team
6. Trả lời câu hỏi về quản lý dự án

Quy tắc:
- Trả lời bằng tiếng Việt
- Rõ ràng, ngắn gọn, thực tế
- Không bịa đặt thông tin
- Không thực thi code hay script
- Không cung cấp thông tin cá nhân nhạy cảm`;

/**
 * Chat với AI assistant
 */
async function chat({ message, projectContext, conversationHistory, userId }) {
  const client = getClient();

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Thêm context về project nếu có
  if (projectContext && projectContext.title) {
    messages.push({
      role: 'system',
      content: `Thông tin project hiện tại:\n- Tên: ${projectContext.title}\n- Mô tả: ${projectContext.description || 'N/A'}\n- Tiến độ: ${projectContext.progress || 0}%\n- Công nghệ: ${(projectContext.technologies || []).join(', ')}`,
    });
  }

  // Lịch sử conversation (tối đa 10 tin nhắn gần nhất)
  const recentHistory = (conversationHistory || []).slice(-10);
  messages.push(...recentHistory);

  // Tin nhắn hiện tại
  messages.push({ role: 'user', content: message });

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: 1000,
    temperature: 0.7,
  });

  const reply = completion.choices[0]?.message?.content;
  if (!reply) throw new Error('AI không trả về phản hồi.');

  return reply;
}

/**
 * Phân tích project và tạo task breakdown
 */
async function analyzeProject(project, userId) {
  const client = getClient();

  const prompt = `Phân tích project sau và tạo task breakdown:
- Tên: ${project.title}
- Mô tả: ${project.description}
- Mục tiêu: ${project.goal || ''}
- Công nghệ: ${(project.technologies || []).join(', ')}
- Thời hạn: ${project.deadline || 'Chưa xác định'}
- Team size: ${project.teamSize || 'Chưa xác định'}

Trả về JSON với cấu trúc:
{
  "summary": "Tóm tắt ngắn về project",
  "tasks": [
    { "title": "...", "description": "...", "priority": "high|medium|low", "estimatedDays": 3 }
  ],
  "risks": ["rủi ro 1", "rủi ro 2"],
  "suggestions": ["gợi ý 1", "gợi ý 2"],
  "missingRoles": ["role còn thiếu"]
}`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Bạn là chuyên gia phân tích dự án phần mềm. Trả về JSON hợp lệ, không có markdown.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1500,
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('AI không trả về phân tích.');

  // Parse và validate JSON an toàn — phòng ngừa ngoại lệ SyntaxError khi AI phản hồi sai định dạng
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    console.warn('[OpenAI] Parse JSON analyzeProject thất bại, trả về cấu trúc mặc định an toàn:', parseErr.message);
    parsed = {
      summary: raw.substring(0, 300),
      tasks: [],
      risks: [],
      suggestions: [],
      missingRoles: []
    };
  }

  return {
    summary: String(parsed.summary || ''),
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 20) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
    missingRoles: Array.isArray(parsed.missingRoles) ? parsed.missingRoles.slice(0, 5) : [],
  };
}

/**
 * AI Matching — tính điểm phù hợp giữa project và candidates
 */
async function matchMembers(project, candidates) {
  const client = getClient();

  const prompt = `Project cần tuyển:
- Tên: ${project.title}
- Roles cần: ${JSON.stringify(project.requiredRoles || [])}
- Công nghệ: ${(project.technologies || []).join(', ')}

Danh sách candidates (chỉ có thông tin kỹ năng):
${candidates.map((c, i) => `${i + 1}. ID: ${c.id}, Skills: ${(c.skills || []).join(', ')}, Interests: ${(c.interests || []).join(', ')}, Experience: ${c.experience}`).join('\n')}

Tính điểm phù hợp (0-100) cho từng candidate. Trả về JSON:
{
  "scores": [
    { "id": "...", "score": 85, "reasons": ["lý do 1"] }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Bạn là hệ thống matching thành viên dự án. Trả về JSON hợp lệ.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 800,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('AI không trả về kết quả matching.');

  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    console.warn('[OpenAI] Parse JSON matchMembers thất bại:', parseErr.message);
    parsed = { scores: [] };
  }

  return Array.isArray(parsed.scores) ? parsed.scores : [];
}

module.exports = { chat, analyzeProject, matchMembers, isConfigured };
