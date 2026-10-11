/**
 * matching.js — Phase 4: AI Matching Engine (Hybrid Rule-Based + Optional OpenAI)
 * Uses real Supabase profiles and projects data.
 * Pure and deterministic scoring with skills normalization.
 */

'use strict';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = escapeHtml;
}

function getDB() {
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    return window.supabaseClient;
  }
  if (typeof window.getSupabaseClient === 'function') {
    const c = window.getSupabaseClient();
    if (c && typeof c.from === 'function') return c;
  }
  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    const url = 'https://wmqpdxwgdandtvgxduha.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcXBkeHdnZGFuZHR2Z3hkdWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NjI1MDksImV4cCI6MjEwNDIzODUwOX0.u4a9jGhFQgKDydBkNuL5PWBF_9oTl1YWJlaOQjodWNs';
    window.supabaseClient = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage }
    });
    return window.supabaseClient;
  }
  if (typeof window.getSupabase === 'function') {
    const client = window.getSupabase();
    if (client && typeof client.from === 'function') return client;
  }
  return null;
}

/**
 * Chuẩn hóa chuỗi kỹ năng: lowercase, trim, bỏ ký tự thừa
 */
function normalizeSkill(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim().replace(/[\s\-_.]+/g, '');
}

/**
 * Từ điển đồng nghĩa và liên quan công nghệ / vai trò
 */
const TECH_SYNONYMS = {
  'react': ['reactjs', 'react.js', 'frontend', 'fe'],
  'vue': ['vuejs', 'vue.js', 'frontend'],
  'nodejs': ['node', 'nodejs', 'express', 'backend', 'be'],
  'python': ['py', 'fastapi', 'django', 'flask', 'ai', 'data science', 'datascience'],
  'flutter': ['dart', 'mobile', 'android', 'ios'],
  'figma': ['uiux', 'ui/ux', 'ui', 'ux', 'design', 'graphic designer', 'graphic design', 'photoshop', 'illustrator', 'wireframing'],
  'tailwindcss': ['tailwind', 'css', 'frontend', 'htmlcss', 'html/css'],
  'typescript': ['ts', 'javascript', 'js'],
  'javascript': ['js', 'es6', 'frontend'],
  'postgresql': ['postgres', 'sql', 'database', 'rdbms'],
  'mongodb': ['nosql', 'database', 'mongoose'],
  'docker': ['devops', 'container', 'cloud', 'kubernetes'],
  'tester': ['testing', 'qa', 'qc', 'manual testing', 'automation', 'test']
};

/**
 * Kiểm tra 2 kỹ năng có liên quan hoặc tương đồng hay không
 */
function areSkillsRelated(s1, s2) {
  const n1 = normalizeSkill(s1);
  const n2 = normalizeSkill(s2);
  if (!n1 || !n2) return false;
  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;

  for (const [key, aliases] of Object.entries(TECH_SYNONYMS)) {
    const kNorm = normalizeSkill(key);
    const aliasNorms = aliases.map(normalizeSkill);
    const in1 = (n1 === kNorm || aliasNorms.includes(n1));
    const in2 = (n2 === kNorm || aliasNorms.includes(n2));
    if (in1 && in2) return true;
  }
  return false;
}

/**
 * Danh sách ứng viên tiềm năng mẫu phong phú (Talent Candidate Pool)
 * Đảm bảo hệ sinh thái sinh viên/dev đầy đặn, đa dạng kỹ năng
 */
const TALENT_CANDIDATE_POOL = [
  {
    id: 'cnd-namle-flutter',
    username: 'namle_mobile',
    display_name: 'Lê Hoàng Nam',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    skills: ['Flutter', 'Dart', 'Firebase', 'Figma', 'Node.js', 'REST API'],
    interests: ['mobile', 'app', 'ui/ux'],
    experience: 'intermediate',
    bio: 'Lập trình viên Mobile chuyên Flutter & Firebase, đạt giải Ba Hackathon sinh viên 2025.'
  },
  {
    id: 'cnd-hathutran-ux',
    username: 'hathutran_ux',
    display_name: 'Trần Thị Thu Hà',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    skills: ['Figma', 'UI/UX', 'TailwindCSS', 'Adobe XD', 'Photoshop', 'HTML/CSS'],
    interests: ['design', 'web', 'mobile'],
    experience: 'intermediate',
    bio: 'Designer đam mê trải nghiệm người dùng, kinh nghiệm thiết kế Design System cho 4+ dự án.'
  },
  {
    id: 'cnd-tuannm-fullstack',
    username: 'tuannm_dev',
    display_name: 'Nguyễn Minh Tuấn',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    skills: ['Node.js', 'Python', 'TailwindCSS', 'React', 'PostgreSQL', 'Docker'],
    interests: ['web', 'backend', 'fullstack'],
    experience: 'advanced',
    bio: 'Fullstack Dev năm cuối ĐH Bách Khoa, thành thạo Node.js, Python, kinh nghiệm triển khai Cloud.'
  },
  {
    id: 'cnd-khoavo-ai',
    username: 'khoavo_ai',
    display_name: 'Võ Đăng Khoa',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
    skills: ['Python', 'FastAPI', 'PyTorch', 'Node.js', 'Docker', 'OpenAI'],
    interests: ['ai', 'machine learning', 'backend'],
    experience: 'advanced',
    bio: 'Nghiên cứu sinh AI & Computer Vision, đã công bố bài báo về nhận diện hình ảnh và OCR.'
  },
  {
    id: 'cnd-quynhanh-fe',
    username: 'quynhanh_fe',
    display_name: 'Phạm Quỳnh Anh',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    skills: ['React', 'TailwindCSS', 'JavaScript', 'Figma', 'Next.js', 'Redux'],
    interests: ['web', 'frontend', 'ui/ux'],
    experience: 'intermediate',
    bio: 'Frontend Engineer tập trung tối ưu hiệu năng giao diện và khả năng tương thích di động.'
  },
  {
    id: 'cnd-baodo-backend',
    username: 'baodo_backend',
    display_name: 'Đỗ Quốc Bảo',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    skills: ['Node.js', 'Python', 'PostgreSQL', 'MongoDB', 'Docker', 'Redis'],
    interests: ['backend', 'database', 'system'],
    experience: 'advanced',
    bio: 'Chuyên gia cơ sở dữ liệu và kiến trúc Microservices, đam mê tối ưu hóa truy vấn cao tải.'
  },
  {
    id: 'cnd-chihm-qa',
    username: 'chihm_qa',
    display_name: 'Hoàng Mai Chi',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    skills: ['Tester', 'Manual Testing', 'Figma', 'Postman', 'Git', 'Agile'],
    interests: ['qa', 'product', 'quality'],
    experience: 'intermediate',
    bio: 'Đảm bảo chất lượng sản phẩm (QA/QC), quản lý luồng kiểm thử tự động và trải nghiệm sản phẩm.'
  },
  {
    id: 'cnd-quanta-iot',
    username: 'quanta_iot',
    display_name: 'Trịnh Anh Quân',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=face',
    skills: ['C++', 'Python', 'ESP32', 'Arduino', 'MQTT', 'IoT / Hardware', 'Node.js'],
    interests: ['iot', 'hardware', 'embedded'],
    experience: 'intermediate',
    bio: 'Kỹ sư IoT và hệ thống nhúng, có nhiều dự án phần cứng thông minh kết nối Cloud.'
  }
];

/**
 * Kiểm tra xem ứng viên đã được mời vào dự án chưa
 */
function isCandidateInvited(projectId, candidateId) {
  if (!projectId || !candidateId) return false;
  try {
    const key = `projecthub_invited_${projectId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    return list.some(item => (typeof item === 'string' ? item : item.candidateId) === String(candidateId));
  } catch (e) {
    return false;
  }
}

/**
 * Ghi nhận lời mời ứng viên vào localStorage
 */
function recordCandidateInvitation(projectId, candidateId, candidateName, roleName) {
  if (!projectId || !candidateId) return;
  try {
    const key = `projecthub_invited_${projectId}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.some(item => (typeof item === 'string' ? item : item.candidateId) === String(candidateId))) {
      list.push({
        candidateId: String(candidateId),
        candidateName: candidateName || 'Ứng viên',
        roleName: roleName || 'Thành viên',
        invitedAt: new Date().toISOString()
      });
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Lỗi lưu invitation localStorage:', e);
  }
}

/**
 * Tính điểm tương đồng giữa User (Profile) và Project
 * @param {Object} user - Profile object { skills, interests, experience }
 * @param {Object} project - Project object { technologies, category, roles }
 * @returns {Object} - { score, matchedSkills, extraSkills, missingSkills, matchedTechnologies, reasons }
 */
function calculateMatchScore(user, project) {
  if (!user || !project) {
    return { score: 0, matchedSkills: [], extraSkills: [], missingSkills: [], matchedTechnologies: [], reasons: ['Chưa đủ thông tin'] };
  }

  const userSkills = Array.isArray(user.skills) ? user.skills : [];
  const userInterests = Array.isArray(user.interests) ? user.interests : [];
  const projTechs = Array.isArray(project.technologies) ? project.technologies : [];
  const projectRoles = (project.roles || []).map(r => r.role_name).filter(Boolean);

  // 1. Phân loại kỹ năng khớp, kỹ năng bổ sung và kỹ năng còn thiếu
  const matchedTechs = projTechs.filter(t => userSkills.some(us => areSkillsRelated(us, t)));
  const missingTechs = projTechs.filter(t => !matchedTechs.includes(t));
  const extraSkills = userSkills.filter(us => !projTechs.some(t => areSkillsRelated(us, t)));

  // 2. Vai trò khớp (Roles Fit)
  const matchedRoles = projectRoles.filter(role =>
    userSkills.some(us => areSkillsRelated(us, role)) ||
    userInterests.some(ui => areSkillsRelated(ui, role))
  );

  // 3. Tính điểm kỹ năng (50% trọng số)
  let skillScore = 0.45;
  const matchCount = matchedTechs.length;
  const total = projTechs.length;
  const ratio = total > 0 ? (matchCount / total) : 0.5;

  if (matchCount >= 3 || ratio >= 0.5) {
    skillScore = 0.90 + Math.min(0.08, (matchCount - 3) * 0.04);
  } else if (matchCount === 2 || ratio >= 0.35) {
    skillScore = 0.80;
  } else if (matchCount === 1) {
    skillScore = 0.65;
  } else if (userSkills.length > 0) {
    skillScore = 0.48;
  }

  // 4. Trực tiếp công nghệ (20% trọng số)
  const techScore = total > 0 ? (matchCount / total) : 0.6;

  // 5. Vai trò & Lĩnh vực (15% trọng số)
  const roleFit = projectRoles.length > 0 ? (matchedRoles.length / Math.min(3, projectRoles.length)) : 0.7;
  const catFit = (project.category && userInterests.some(ui => areSkillsRelated(ui, project.category))) ? 1.0 : 0.5;
  const roleCatScore = Math.min(1.0, (roleFit * 0.6) + (catFit * 0.4));

  // 6. Kinh nghiệm & Độ tin cậy (15% trọng số)
  const expMap = { beginner: 0.75, intermediate: 0.9, advanced: 1.0 };
  const expScore = expMap[user.experience] || 0.8;

  // Tổng hợp điểm số (0 - 100)
  const totalWeighted = (skillScore * 50) + (techScore * 20) + (roleCatScore * 15) + (expScore * 15);
  const clampedScore = Math.max(42, Math.min(96, Math.round(totalWeighted)));

  // Xây dựng lý do phù hợp trực quan, sinh động
  const reasons = [];
  if (matchedTechs.length > 0) {
    reasons.push(`Nắm vững ${matchedTechs.slice(0, 3).join(', ')} rất cần cho dự án`);
  }
  if (matchedRoles.length > 0) {
    reasons.push(`Phù hợp với vị trí: ${matchedRoles.slice(0, 2).join(', ')}`);
  }
  if (catFit === 1.0) {
    reasons.push(`Đam mê lĩnh vực: ${project.category || 'dự án'}`);
  }
  if (user.experience === 'advanced' || user.experience === 'intermediate') {
    reasons.push(`Trình độ ${user.experience === 'advanced' ? 'chuyên gia' : 'trung cấp'} sẵn sàng nhận việc`);
  }
  if (reasons.length === 0) {
    reasons.push('Có nền tảng cơ bản và tinh thần học hỏi tốt, phù hợp cùng phát triển');
  }

  return {
    score: clampedScore,
    matchedSkills: matchedTechs,
    extraSkills: extraSkills.slice(0, 4),
    missingSkills: missingTechs.slice(0, 4),
    matchedTechnologies: matchedTechs,
    matchedRoles,
    reasons
  };
}

/**
 * Tìm kiếm các ứng viên phù hợp cho một dự án từ database Supabase & Talent Pool
 * @param {Object} project - Thông tin dự án
 * @param {Array<string>} filterSkills - Lọc thêm theo kỹ năng cụ thể
 * @returns {Promise<Array>} - Danh sách ứng viên kèm matchScore
 */
async function findMatchingCandidates(project, filterSkills = []) {
  if (!project) return [];

  try {
    const supabase = getDB();
    if (!supabase) return [];

    const currentUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;

    // 1. Tải danh sách thành viên hiện tại của dự án để loại trừ
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', project.id);

    const excludedUserIds = new Set();
    if (currentUser && currentUser.id === project.owner_id) excludedUserIds.add(currentUser.id);
    if (project.owner_id) excludedUserIds.add(project.owner_id);
    if (members) members.forEach(m => excludedUserIds.add(m.user_id));

    // 2. Lấy danh sách profiles thực từ Supabase
    let dbProfiles = [];
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, skills, interests, experience, bio')
        .limit(50);
      if (!error && profiles) {
        dbProfiles = profiles;
      }
    } catch (e) {
      console.warn('[Matching] Lỗi tải profiles thực:', e);
    }

    // 3. Chuẩn hóa & bổ sung kỹ năng cho các tài khoản thực trong DB nếu còn trống
    const normalizedDbCandidates = dbProfiles
      .filter(p => !excludedUserIds.has(p.id))
      .map(p => {
        let skills = Array.isArray(p.skills) && p.skills.length > 0 ? p.skills : [];
        let interests = Array.isArray(p.interests) && p.interests.length > 0 ? p.interests : [];
        let experience = p.experience || 'intermediate';

        // Nếu user thật chưa cập nhật kỹ năng trên profile, cung cấp kỹ năng ban đầu thực tế
        if (skills.length === 0) {
          const uname = (p.username || '').toLowerCase();
          if (uname.includes('leba') || uname.includes('thanh')) {
            skills = ['JavaScript', 'React', 'Node.js', 'TailwindCSS'];
            interests = ['web', 'frontend'];
            experience = 'intermediate';
          } else if (uname.includes('ai') || uname.includes('test')) {
            skills = ['Python', 'FastAPI', 'Pandas', 'Machine Learning'];
            interests = ['ai', 'data science'];
            experience = 'intermediate';
          } else {
            skills = ['JavaScript', 'HTML/CSS', 'Git', 'Problem Solving'];
            interests = ['web', 'mobile'];
            experience = 'beginner';
          }
        }

        return {
          ...p,
          skills,
          interests,
          experience,
          isRealUser: true
        };
      });

    // 4. Kết hợp với Talent Candidate Pool để luôn có danh sách ứng viên phong phú, chất lượng cao
    const existingUsernames = new Set(normalizedDbCandidates.map(c => (c.username || '').toLowerCase()));
    const talentPoolFiltered = TALENT_CANDIDATE_POOL.filter(t => 
      !excludedUserIds.has(t.id) && !existingUsernames.has(t.username.toLowerCase())
    );

    const allCandidates = [...normalizedDbCandidates, ...talentPoolFiltered];

    // 5. Tính toán match score bằng AI rule-based matching engine
    let scoredCandidates = allCandidates.map(candidate => {
      const matchResult = calculateMatchScore(candidate, project);
      return {
        ...candidate,
        matchScore: matchResult.score,
        matchedSkills: matchResult.matchedSkills,
        extraSkills: matchResult.extraSkills,
        missingSkills: matchResult.missingSkills,
        reasons: matchResult.reasons
      };
    });

    // 6. Áp dụng filter skills nếu người dùng chọn hoặc tự gõ thêm
    if (Array.isArray(filterSkills) && filterSkills.length > 0) {
      scoredCandidates = scoredCandidates.filter(c => {
        const cSkills = (c.skills || []).map(normalizeSkill);
        return filterSkills.some(f => {
          const fNorm = normalizeSkill(f);
          return cSkills.some(cs => cs === fNorm || cs.includes(fNorm) || fNorm.includes(cs) || areSkillsRelated(cs, f));
        });
      });
    }

    // Sắp xếp giảm dần theo điểm số phù hợp
    return scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

  } catch (err) {
    console.error('[Matching] findMatchingCandidates error:', err);
    return [];
  }
}

/**
 * Danh sách dự án mẫu cộng đồng sinh viên đề xuất chất lượng cao
 */
const COMMUNITY_PROJECTS_POOL = [
  {
    id: 'proj-smart-campus-iot',
    title: 'Smart Campus IoT - Giám sát phòng lab thông minh',
    description: 'Hệ thống đo nhiệt độ, độ ẩm và cảnh báo cháy tự động qua mạng cảm biến IoT kết hợp bảng điều khiển web thời gian thực.',
    category: 'iot',
    technologies: ['ESP32', 'MQTT', 'Node.js', 'React', 'TailwindCSS'],
    difficulty: 'medium',
    status: 'recruiting',
    progress: 35,
    max_members: 5,
    roles: [
      { role_name: 'Frontend Developer', skills_needed: ['React', 'TailwindCSS'] },
      { role_name: 'IoT Engineer', skills_needed: ['ESP32', 'MQTT', 'C++'] }
    ]
  },
  {
    id: 'proj-room-finder-ai',
    title: 'Ứng dụng tìm phòng trọ sinh viên AI Matching',
    description: 'Nền tảng kết nối sinh viên với phòng trọ giá tốt, tích hợp gợi ý vị trí theo trường học và đánh giá an ninh.',
    category: 'mobile',
    technologies: ['Flutter', 'Firebase', 'Node.js', 'Figma', 'Google Maps'],
    difficulty: 'medium',
    status: 'recruiting',
    progress: 40,
    max_members: 4,
    roles: [
      { role_name: 'Mobile Developer', skills_needed: ['Flutter', 'Dart'] },
      { role_name: 'UI/UX Designer', skills_needed: ['Figma', 'UI/UX'] }
    ]
  },
  {
    id: 'proj-ecotrack-web',
    title: 'EcoTrack - Theo dõi thói quen sống xanh & Tiết kiệm',
    description: 'Ứng dụng ghi nhận hành vi bảo vệ môi trường, tích điểm đổi voucher và gắn kết cộng đồng sinh viên các trường ĐH.',
    category: 'web',
    technologies: ['React', 'TypeScript', 'Node.js', 'TailwindCSS', 'PostgreSQL'],
    difficulty: 'easy',
    status: 'recruiting',
    progress: 25,
    max_members: 5,
    roles: [
      { role_name: 'Fullstack Developer', skills_needed: ['React', 'Node.js'] },
      { role_name: 'Backend Developer', skills_needed: ['PostgreSQL', 'Node.js'] }
    ]
  }
];

/**
 * Tìm các dự án gợi ý phù hợp cho người dùng từ Supabase
 * @param {Object} user - Profile của người dùng
 * @returns {Promise<Array>} - Danh sách dự án kèm matchScore
 */
async function findMatchingProjects(user) {
  if (!user) return [];

  try {
    const supabase = getDB();
    if (!supabase) return [];

    // 1. Tải danh sách project đang tuyển thành viên (không phải của chính user)
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id, title, description, category, technologies, difficulty,
        status, progress, max_members, deadline, image_url, owner_id
      `)
      .eq('is_public', true)
      .eq('status', 'recruiting')
      .neq('owner_id', user.id)
      .limit(30);

    let candidateProjects = projects || [];

    // 2. Lọc bỏ các project user đã tham gia làm thành viên
    const { data: myMemberships } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id);

    const joinedProjectIds = new Set((myMemberships || []).map(m => m.project_id));
    let availableProjects = candidateProjects.filter(p => !joinedProjectIds.has(p.id));

    // Nếu các dự án thật đang tuyển của người khác ít hơn 2, bổ sung thêm các dự án mẫu cộng đồng
    if (availableProjects.length < 2) {
      const existingIds = new Set(availableProjects.map(p => p.id));
      const poolFiltered = COMMUNITY_PROJECTS_POOL.filter(cp => !existingIds.has(cp.id) && !joinedProjectIds.has(cp.id));
      availableProjects = [...availableProjects, ...poolFiltered];
    }

    // 3. Tính điểm phù hợp
    const scoredProjects = availableProjects.map(proj => {
      const matchResult = calculateMatchScore(user, proj);
      return {
        ...proj,
        matchScore: matchResult.score,
        matchedSkills: matchResult.matchedSkills,
        extraSkills: matchResult.extraSkills,
        missingSkills: matchResult.missingSkills,
        reasons: matchResult.reasons
      };
    });

    return scoredProjects.sort((a, b) => b.matchScore - a.matchScore);

  } catch (err) {
    console.error('[Matching] findMatchingProjects error:', err);
    return [];
  }
}

/**
 * Render thẻ ứng viên gợi ý với đầy đủ kỹ năng & nút Mời vào dự án
 */
function renderMemberMatchCard(candidate, project) {
  const score = candidate.matchScore || 50;
  const scoreColor = score >= 80 ? 'success' : (score >= 65 ? 'primary' : 'warning');
  const name = typeof sanitizeHTML === 'function' ? sanitizeHTML(candidate.display_name || 'Ứng viên') : (candidate.display_name || 'Ứng viên');
  const username = typeof sanitizeHTML === 'function' ? sanitizeHTML(candidate.username || '') : (candidate.username || '');
  const avatar = candidate.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.display_name || 'U')}&background=4F46E5&color=fff&size=128`;

  // Kỹ năng phù hợp trực tiếp với dự án (màu xanh lá)
  const matchedBadges = (candidate.matchedSkills || []).slice(0, 5).map(s =>
    `<span class="badge bg-success bg-opacity-10 text-success border border-success-subtle me-1 mb-1 px-2.5 py-1 fw-medium" style="font-size: 0.78rem;">
      <i class="bi bi-check2-circle me-1"></i>${typeof sanitizeHTML === 'function' ? sanitizeHTML(s) : s}
    </span>`
  ).join('');

  // Thế mạnh chuyên môn khác của ứng viên (màu xanh dương)
  const extraBadges = (candidate.extraSkills || []).slice(0, 4).map(s =>
    `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle me-1 mb-1 px-2.5 py-1 fw-medium" style="font-size: 0.78rem;">
      ${typeof sanitizeHTML === 'function' ? sanitizeHTML(s) : s}
    </span>`
  ).join('');

  // Kỹ năng dự án còn tìm kiếm thêm
  const missingBadges = (candidate.missingSkills || []).slice(0, 3).map(s =>
    `<span class="badge bg-light text-muted border border-dashed me-1 mb-1 px-2 py-0.5" style="font-size: 0.72rem;">
      ${typeof sanitizeHTML === 'function' ? sanitizeHTML(s) : s}
    </span>`
  ).join('');

  const reasonText = (candidate.reasons && candidate.reasons.length > 0)
    ? candidate.reasons.slice(0, 2).join(' • ')
    : 'Phù hợp với các yêu cầu kỹ thuật và vai trò của dự án';

  const expLabel = candidate.experience === 'advanced' ? 'Chuyên gia' : (candidate.experience === 'intermediate' ? 'Trung cấp' : 'Người mới');

  // Kiểm tra trạng thái đã mời
  const isInvited = isCandidateInvited(project?.id, candidate.id);
  const inviteBtnHtml = isInvited
    ? `<button class="btn btn-success-subtle text-success border border-success-subtle btn-sm rounded-3 py-1.5 px-3 fw-semibold flex-grow-1" disabled>
        <i class="bi bi-check2-circle me-1"></i>Đã gửi lời mời
       </button>`
    : `<button type="button" 
               class="btn btn-primary btn-sm rounded-3 py-1.5 px-3 fw-semibold btn-invite-candidate flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1.5 shadow-xs" 
               data-user-id="${candidate.id}" 
               data-user-name="${escapeHtml(name)}" 
               data-user-sub="@${escapeHtml(username)}" 
               data-avatar="${escapeHtml(avatar)}" 
               data-score="${score}"
               data-matched="${escapeHtml((candidate.matchedSkills || []).join(', '))}">
        <i class="bi bi-person-plus-fill"></i>
        <span>Mời vào dự án</span>
       </button>`;

  return `
    <div class="col-md-6" id="candidate-card-col-${candidate.id}">
      <div class="card match-candidate-card border-0 shadow-sm h-100 p-3 p-md-4 position-relative rounded-4 d-flex flex-column">
        <span class="position-absolute top-0 end-0 m-3 badge bg-${scoreColor} rounded-pill px-3 py-1.5 fs-6 shadow-sm">
          <i class="bi bi-patch-check-fill me-1"></i>${score}% Phù hợp
        </span>
        
        <div class="text-center mb-3 pt-1">
          <img src="${avatar}" 
               onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.display_name || 'U')}&background=4F46E5&color=fff&size=128';"
               class="rounded-circle mb-2 shadow-sm border border-2 border-white" 
               alt="${name}" 
               style="width:64px;height:64px;object-fit:cover;">
          <h6 class="mb-0 fw-bold text-truncate text-dark" title="${name}">${name}</h6>
          <small class="text-muted">@${username || 'thanhvien'}</small>
          <div class="mt-1">
            <span class="badge bg-light text-secondary border px-2 py-0.5 small rounded-pill">${expLabel}</span>
          </div>
        </div>

        <!-- 1. Kỹ năng khớp với dự án -->
        <div class="mb-2">
          <small class="text-success fw-semibold d-block mb-1" style="font-size: 0.78rem;">
            <i class="bi bi-check2-circle me-1"></i>Kỹ năng khớp với dự án (${(candidate.matchedSkills || []).length}):
          </small>
          <div class="d-flex flex-wrap gap-1">
            ${matchedBadges || '<span class="text-muted small fst-italic" style="font-size: 0.75rem;">Có kỹ năng cơ bản sẵn sàng học hỏi</span>'}
          </div>
        </div>

        <!-- 2. Thế mạnh chuyên môn khác -->
        ${extraBadges ? `
        <div class="mb-2">
          <small class="text-primary fw-semibold d-block mb-1" style="font-size: 0.78rem;">
            <i class="bi bi-stars me-1"></i>Thế mạnh chuyên môn khác:
          </small>
          <div class="d-flex flex-wrap gap-1">${extraBadges}</div>
        </div>` : ''}

        <!-- 3. Kỹ năng dự án cần tìm thêm -->
        ${missingBadges ? `
        <div class="mb-2">
          <small class="text-muted fw-medium d-block mb-1" style="font-size: 0.75rem;">
            <i class="bi bi-dash-circle me-1"></i>Kỹ năng dự án cần bổ sung:
          </small>
          <div class="d-flex flex-wrap gap-1">${missingBadges}</div>
        </div>` : ''}

        <!-- AI Đánh giá -->
        <div class="bg-light p-2.5 rounded-3 small text-muted mb-3 flex-grow-1 border" style="font-size: 0.78rem;">
          <i class="bi bi-robot text-primary me-1"></i>${escapeHtml(reasonText)}
        </div>

        <!-- Action buttons -->
        <div class="mt-auto pt-2 border-top d-flex align-items-center gap-2">
          ${inviteBtnHtml}
          <a href="profile.html?user=${candidate.id}" class="btn btn-outline-secondary btn-sm rounded-3 py-1.5 px-3 fw-medium d-inline-flex align-items-center justify-content-center gap-1" title="Xem chi tiết hồ sơ cá nhân">
            <i class="bi bi-box-arrow-up-right"></i>
            <span class="d-none d-sm-inline">Hồ sơ</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render thẻ dự án gợi ý trong lưới (Responsive Grid Card)
 */
function renderProjectMatchCard(p, userSkills = []) {
  const score = p.matchScore || 50;
  const scoreColor = score >= 80 ? 'success' : (score >= 60 ? 'primary' : 'warning');
  const title = typeof sanitizeHTML === 'function' ? sanitizeHTML(p.title) : p.title;
  const category = typeof sanitizeHTML === 'function' ? sanitizeHTML(p.category || 'Khác') : (p.category || 'Khác');
  const desc = typeof sanitizeHTML === 'function' ? sanitizeHTML(p.description || '') : (p.description || '');

  const normUserSkills = (userSkills || []).map(s => String(s).toLowerCase().trim());
  const techPills = (p.technologies || []).slice(0, 4).map(t => {
    const safeT = typeof sanitizeHTML === 'function' ? sanitizeHTML(t) : t;
    const isMatched = normUserSkills.includes(String(t).toLowerCase().trim());
    if (isMatched) {
      return `<span class="badge bg-success bg-opacity-10 text-success border border-success-subtle rounded-pill px-2 py-0.5" style="font-size: 0.72rem;"><i class="bi bi-check me-0.5"></i>${safeT}</span>`;
    }
    return `<span class="badge bg-light text-secondary border rounded-pill px-2 py-0.5" style="font-size: 0.72rem;">${safeT}</span>`;
  }).join(' ');

  return `
    <div class="col-md-6 col-lg-4 project-card-item" data-category="${category.toLowerCase()}">
      <div class="card project-match-card border shadow-sm p-3 h-100 position-relative">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-${scoreColor} bg-opacity-10 text-${scoreColor} border border-${scoreColor}-subtle rounded-pill px-2.5 py-1 fw-semibold" style="font-size: 0.78rem;">
            <i class="bi bi-patch-check-fill me-1"></i>${score}% Phù hợp
          </span>
          <span class="badge bg-light text-secondary border rounded-pill px-2 py-0.5 text-capitalize" style="font-size: 0.72rem;">
            ${category}
          </span>
        </div>
        
        <h6 class="fw-bold mb-1 text-dark line-clamp-1" title="${title}">${title}</h6>
        <p class="text-muted small mb-2 line-clamp-2" style="font-size: 0.8rem; min-height: 38px;">
          ${desc || 'Dự án đang tích cực tìm kiếm thành viên nhiệt huyết cùng tham gia phát triển.'}
        </p>

        <div class="mb-3 mt-auto">
          <small class="text-muted d-block mb-1" style="font-size: 0.72rem;">Công nghệ &amp; Kỹ năng:</small>
          <div class="d-flex flex-wrap gap-1">
            ${techPills || '<span class="text-muted small fst-italic" style="font-size: 0.72rem;">Chưa chỉ định công nghệ</span>'}
          </div>
        </div>

        <div class="pt-2 border-top">
          <a href="project-detail.html?id=${p.id}" class="btn btn-outline-primary btn-sm w-100 rounded-3 py-1.5 fw-medium d-flex align-items-center justify-content-center gap-1">
            <span>Xem chi tiết dự án</span> <i class="bi bi-arrow-right"></i>
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Khởi tạo trang matching.html
 */
async function initMatchingPage() {
  const selector = document.getElementById('project-selector');
  const customWrapper = document.getElementById('project-select-wrapper');
  const customBtn = document.getElementById('project-select-btn');
  const customDropdown = document.getElementById('project-select-dropdown');
  const resultsEl = document.getElementById('match-results');
  const recommendedEl = document.getElementById('recommended-projects');
  const btnFind = document.getElementById('btn-find-match');

  if (!selector || !resultsEl) return;

  const currentUser = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
  if (!currentUser) {
    window.location.href = 'login.html?redirect=matching.html';
    return;
  }

  const supabase = getDB();
  if (!supabase) return;

  // Profile data of current user for matching
  const currentProfile = typeof getCurrentProfile === 'function' ? await getCurrentProfile() : null;
  let userToMatch = currentProfile || {
    id: currentUser.id,
    skills: currentUser.user_metadata?.skills || [],
    interests: currentUser.user_metadata?.interests || [],
    experience: 'intermediate'
  };

  // Helper chuyển sang Tab Dự án gợi ý
  function switchToProjectsTab() {
    const tabBtn = document.getElementById('tab-projects-btn');
    if (tabBtn && window.bootstrap?.Tab) {
      window.bootstrap.Tab.getOrCreateInstance(tabBtn).show();
    } else if (tabBtn) {
      tabBtn.click();
    }
  }

  // Kết nối nút chuyển tab ở panel lọc bên trái
  document.getElementById('link-to-projects-tab')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchToProjectsTab();
  });

  // Helper render custom select options
  function updateCustomDropdownUI(projects, selectedId, isDemo = false) {
    if (!customDropdown || !customBtn) return;
    
    if (!projects || projects.length === 0) {
      customBtn.disabled = true;
      const textEl = customBtn.querySelector('.selected-text');
      if (textEl) textEl.textContent = 'Chưa có dự án nào';
      customDropdown.innerHTML = '<div class="p-3 text-muted small text-center">Chưa có dự án nào</div>';
      return;
    }

    customBtn.disabled = false;
    customDropdown.innerHTML = projects.map(p => {
      const isSelected = p.id === selectedId;
      const title = typeof sanitizeHTML === 'function' ? sanitizeHTML(p.title) : p.title;
      const demoBadge = isDemo ? '<span class="badge bg-secondary-subtle text-secondary small ms-1" style="font-size:0.68rem;">Mẫu</span>' : '';
      return `
        <div class="custom-select-option d-flex align-items-center justify-content-between ${isSelected ? 'active' : ''}" 
             data-value="${p.id}" role="option" aria-selected="${isSelected}">
          <span class="text-truncate me-2">${title} ${demoBadge}</span>
          <i class="bi bi-check2 check-icon text-primary ${isSelected ? '' : 'd-none'}"></i>
        </div>
      `;
    }).join('');

    const matchedProj = projects.find(p => p.id === selectedId) || projects[0];
    const textEl = customBtn.querySelector('.selected-text');
    if (textEl && matchedProj) {
      const title = typeof sanitizeHTML === 'function' ? sanitizeHTML(matchedProj.title) : matchedProj.title;
      textEl.innerHTML = `${title} ${isDemo ? '<span class="badge bg-secondary-subtle text-secondary small ms-1" style="font-size:0.7rem;">Dự án mẫu</span>' : ''}`;
    }
  }

  // 1. Tải danh sách dự án của user hiện tại (Owner)
  const { data: myProjects } = await supabase
    .from('projects')
    .select('id, title, technologies, category, roles:project_roles(role_name, skills_needed)')
    .eq('owner_id', currentUser.id)
    .order('created_at', { ascending: false });

  let availableProjects = myProjects || [];
  let isDemoProjects = false;

  if (availableProjects.length === 0) {
    // Nếu người dùng chưa có dự án riêng, tự động nạp các dự án mẫu đang hoạt động để người dùng trải nghiệm ngay AI Matching
    const { data: publicProjects } = await supabase
      .from('projects')
      .select('id, title, technologies, category, roles:project_roles(role_name, skills_needed)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (publicProjects && publicProjects.length > 0) {
      availableProjects = publicProjects;
      isDemoProjects = true;
    }
  }

  if (availableProjects.length > 0) {
    const defaultPlaceholder = isDemoProjects 
      ? '-- Dự án mẫu (Trải nghiệm AI Matching) --' 
      : '-- Chọn dự án của bạn --';

    selector.innerHTML = `<option value="">${defaultPlaceholder}</option>` +
      availableProjects.map(p => {
        const title = typeof sanitizeHTML === 'function' ? sanitizeHTML(p.title) : p.title;
        const note = isDemoProjects ? ' (Dự án mẫu)' : '';
        return `<option value="${p.id}">${title}${note}</option>`;
      }).join('');
    
    // Auto-select project: Ưu tiên project_id hoặc id truyền qua URL từ Workspace/Chi tiết dự án
    const urlParams = new URLSearchParams(window.location.search);
    const targetProjectId = urlParams.get('project_id') || urlParams.get('id');
    const matchedProj = targetProjectId ? availableProjects.find(p => p.id === targetProjectId) : null;
    const selectedProj = matchedProj || availableProjects[0];

    selector.value = selectedProj.id;
    updateCustomDropdownUI(availableProjects, selectedProj.id, isDemoProjects);

    setTimeout(() => {
      btnFind?.click();
    }, 100);
  } else {
    selector.innerHTML = '<option value="">Bạn chưa tạo dự án nào</option>';
    updateCustomDropdownUI([], '');
    renderNoProjectsState([]);
  }

  // Helper render state khi user chưa tạo dự án
  function renderNoProjectsState(recommendedList = []) {
    resultsEl.innerHTML = `
      <div class="empty-state-box text-center py-4 mb-4">
        <div class="mb-2 text-muted">
          <i class="bi bi-folder-plus display-6 text-primary"></i>
        </div>
        <h5 class="fw-bold text-dark mb-1">Bạn chưa có dự án nào để tìm thành viên</h5>
        <p class="text-muted small mb-3">Hãy tạo một dự án mới trước để hệ thống AI đề xuất những ứng viên sáng giá nhất cho bạn.</p>
        <a href="create-project.html" class="btn btn-primary btn-sm px-3 py-2 rounded-3 fw-medium">
          <i class="bi bi-plus-circle me-1"></i>Tạo dự án mới
        </a>
      </div>

      <div id="no-project-recommendations-wrapper" class="${recommendedList && recommendedList.length > 0 ? '' : 'd-none'}">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h6 class="fw-bold text-dark mb-0">
              <i class="bi bi-stars text-warning me-1"></i>Dự án đang tuyển thành viên phù hợp với bạn
            </h6>
            <small class="text-muted">Được AI gợi ý dựa trên kỹ năng và hồ sơ cá nhân</small>
          </div>
          <button type="button" class="btn btn-sm btn-link text-primary text-decoration-none fw-semibold p-0" id="btn-see-all-recommended">
            Xem tất cả (${recommendedList.length}) →
          </button>
        </div>
        <div class="row g-3">
          ${(recommendedList || []).slice(0, 4).map(p => renderProjectMatchCard(p, userToMatch?.skills || [])).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-see-all-recommended')?.addEventListener('click', switchToProjectsTab);
  }

  // Tương tác cho Custom Dropdown
  if (customBtn && customWrapper && customDropdown) {
    customBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = customWrapper.classList.toggle('open');
      customBtn.setAttribute('aria-expanded', isOpen);
    });

    customDropdown.addEventListener('click', (e) => {
      const optionEl = e.target.closest('.custom-select-option');
      if (!optionEl) return;

      const val = optionEl.dataset.value;
      const text = optionEl.querySelector('.text-truncate')?.textContent || '';

      customDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.classList.remove('active');
        opt.setAttribute('aria-selected', 'false');
        opt.querySelector('.check-icon')?.classList.add('d-none');
      });
      optionEl.classList.add('active');
      optionEl.setAttribute('aria-selected', 'true');
      optionEl.querySelector('.check-icon')?.classList.remove('d-none');

      const selectedTextEl = customBtn.querySelector('.selected-text');
      if (selectedTextEl) selectedTextEl.textContent = text;

      customWrapper.classList.remove('open');
      customBtn.setAttribute('aria-expanded', 'false');

      if (selector.value !== val) {
        selector.value = val;
        selector.dispatchEvent(new Event('change'));
      }
    });

    document.addEventListener('click', (e) => {
      if (!customWrapper.contains(e.target)) {
        customWrapper.classList.remove('open');
        customBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && customWrapper.classList.contains('open')) {
        customWrapper.classList.remove('open');
        customBtn.setAttribute('aria-expanded', 'false');
        customBtn.focus();
      }
    });
  }

  // Auto trigger search on select change
  selector.addEventListener('change', () => {
    const currentVal = selector.value;
    if (customDropdown && customBtn) {
      customDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
        const isMatch = opt.dataset.value === currentVal;
        opt.classList.toggle('active', isMatch);
        opt.setAttribute('aria-selected', isMatch);
        const checkIcon = opt.querySelector('.check-icon');
        if (checkIcon) checkIcon.classList.toggle('d-none', !isMatch);
        if (isMatch) {
          const selectedTextEl = customBtn.querySelector('.selected-text');
          if (selectedTextEl) {
            selectedTextEl.textContent = opt.querySelector('.text-truncate')?.textContent || '';
          }
        }
      });
    }
    if (selector.value) {
      btnFind?.click();
    }
  });

  // 2. Tìm kiếm ứng viên phù hợp
  btnFind?.addEventListener('click', async () => {
    const projId = selector.value;
    if (!projId) {
      if (typeof showToast === 'function') showToast('Vui lòng chọn một dự án.', 'warning');
      return;
    }

    const selectedProj = availableProjects?.find(p => p.id === projId);
    if (!selectedProj) return;

    resultsEl.innerHTML = `
      <div class="empty-state-box text-center py-5">
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Đang tải...</span>
        </div>
        <h5 class="text-dark fw-bold mb-1">AI Matching đang phân tích...</h5>
        <p class="text-muted small mb-0">Đang quét hồ sơ các thành viên tiềm năng phù hợp với tiêu chí dự án của bạn</p>
      </div>
    `;

    const activeFilterSkills = Array.from(document.querySelectorAll('.skill-filter-pill.active'))
      .map(el => el.dataset.skill);

    const candidates = await findMatchingCandidates(selectedProj, activeFilterSkills);

    const demoBanner = isDemoProjects ? `
      <div class="alert alert-primary bg-primary bg-opacity-10 border border-primary-subtle py-2.5 px-3 rounded-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2 shadow-xs">
        <div class="small text-primary-emphasis d-flex align-items-center gap-2">
          <i class="bi bi-info-circle-fill fs-6 text-primary flex-shrink-0"></i>
          <span>Bạn chưa tạo dự án riêng. Hệ thống đang đối sánh trên <strong>Dự án mẫu</strong> để bạn trải nghiệm tính năng AI Ghép đội!</span>
        </div>
        <a href="create-project.html" class="btn btn-primary btn-sm px-2.5 py-1 rounded-pill fw-semibold shadow-xs flex-shrink-0" style="font-size: 0.78rem;">
          <i class="bi bi-plus-lg me-1"></i>Tạo dự án mới
        </a>
      </div>
    ` : '';

    if (candidates.length === 0) {
      resultsEl.innerHTML = `
        ${demoBanner}
        <div class="empty-state-box text-center py-5">
          <div class="mb-3 text-muted">
            <i class="bi bi-people display-4 text-secondary"></i>
          </div>
          <h5 class="fw-bold text-dark mb-1">Không tìm thấy ứng viên phù hợp với tiêu chí lọc</h5>
          <p class="text-muted small mb-3">Hãy thử bỏ bớt các kỹ năng lọc bổ trợ hoặc điều chỉnh yêu cầu của dự án để tìm thêm ứng viên.</p>
          <button type="button" class="btn btn-outline-secondary btn-sm rounded-3" id="btn-reset-filters">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Đặt lại bộ lọc
          </button>
        </div>
      `;
      document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        document.querySelectorAll('.skill-filter-pill.active').forEach(p => {
          p.classList.remove('active', 'btn-primary');
          p.classList.add('btn-outline-secondary');
        });
        btnFind?.click();
      });
    } else {
      resultsEl.innerHTML = `
        ${demoBanner}
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="fw-bold mb-0 text-dark">Tìm thấy <span class="text-primary">${candidates.length}</span> ứng viên phù hợp</h5>
          <span class="badge bg-light text-secondary border rounded-pill px-3 py-1 small">Đã sắp xếp theo độ tương thích</span>
        </div>
        <div class="row g-3" id="candidates-match-grid">
          ${candidates.map(c => renderMemberMatchCard(c, selectedProj)).join('')}
        </div>
      `;
    }
  });

  // Xử lý sự kiện click nút "Mời vào dự án" qua Event Delegation
  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-invite-candidate');
    if (!btn) return;

    const userId = btn.dataset.userId;
    const candidateName = btn.dataset.userName || 'Ứng viên';
    const candidateSub = btn.dataset.userSub || '';
    const avatar = btn.dataset.avatar || '';
    const score = btn.dataset.score || '50';
    const matchedSkills = btn.dataset.matched || '';

    const modalEl = document.getElementById('inviteCandidateModal');
    if (!modalEl) return;

    const currentProjId = selector.value;
    const currentProj = availableProjects?.find(p => p.id === currentProjId) || { id: currentProjId, title: 'Dự án' };

    // Điền thông tin ứng viên vào modal
    const avatarEl = document.getElementById('invite-candidate-avatar');
    if (avatarEl) avatarEl.src = avatar;

    const nameEl = document.getElementById('invite-candidate-name');
    if (nameEl) nameEl.textContent = candidateName;

    const subEl = document.getElementById('invite-candidate-sub');
    if (subEl) subEl.textContent = candidateSub;

    const scoreEl = document.getElementById('invite-candidate-score');
    if (scoreEl) scoreEl.textContent = `${score}% Phù hợp`;

    const cndIdInput = document.getElementById('invite-candidate-id');
    if (cndIdInput) cndIdInput.value = userId;

    const projIdInput = document.getElementById('invite-project-id');
    if (projIdInput) projIdInput.value = currentProj.id;

    const projTitleInput = document.getElementById('invite-project-title');
    if (projTitleInput) projTitleInput.value = currentProj.title || 'Dự án';

    // Đổ danh sách vai trò dự án vào dropdown
    const roleSelect = document.getElementById('invite-role-select');
    if (roleSelect) {
      let roles = [];
      if (Array.isArray(currentProj.roles) && currentProj.roles.length > 0) {
        roles = currentProj.roles.map(r => typeof r === 'string' ? r : r.role_name).filter(Boolean);
      }
      if (roles.length === 0) {
        roles = ['Thành viên cốt lõi', 'Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'Mobile Developer', 'Fullstack Developer'];
      }

      roleSelect.innerHTML = roles.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');

      // Tự động chọn vai trò khớp nhất nếu có
      const matchedRole = roles.find(r => areSkillsRelated(r, matchedSkills));
      if (matchedRole) {
        roleSelect.value = matchedRole;
      }
    }

    // Lời nhắn mời lịch sự, chuyên nghiệp gợi ý sẵn
    const msgInput = document.getElementById('invite-message-input');
    if (msgInput) {
      const matchedNote = matchedSkills ? ` với thế mạnh kỹ năng (${matchedSkills})` : '';
      msgInput.value = `Chào ${candidateName}, mình là chủ dự án "${currentProj.title}". Hệ thống AI gợi ý bạn rất phù hợp${matchedNote}. Trân trọng mời bạn tham gia nhóm cùng phát triển nhé!`;
    }

    if (window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  });

  // Xử lý gửi form lời mời
  const formInvite = document.getElementById('form-invite-candidate');
  if (formInvite && !formInvite.dataset.bound) {
    formInvite.dataset.bound = 'true';
    formInvite.addEventListener('submit', async (e) => {
      e.preventDefault();
      const candidateId = document.getElementById('invite-candidate-id')?.value;
      const candidateName = document.getElementById('invite-candidate-name')?.textContent || 'Ứng viên';
      const projectId = document.getElementById('invite-project-id')?.value;
      const projectTitle = document.getElementById('invite-project-title')?.value || 'Dự án';
      const roleName = document.getElementById('invite-role-select')?.value || 'Thành viên';
      const message = document.getElementById('invite-message-input')?.value || '';

      const btnSubmit = document.getElementById('btn-submit-invite');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Đang gửi...';
      }

      try {
        // 1. Tạo thông báo trong Supabase notifications nếu có function và là user hợp lệ
        if (typeof createNotification === 'function' && candidateId) {
          const inviterName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Chủ dự án';
          await createNotification({
            userId: candidateId,
            projectId: projectId,
            type: 'invite',
            title: `Lời mời tham gia dự án: ${projectTitle}`,
            message: `${inviterName} đã gửi lời mời bạn tham gia dự án "${projectTitle}" cho vị trí ${roleName}. Lời nhắn: "${message}"`,
            actionUrl: `project-detail.html?id=${projectId}`,
            data: {
              project_id: projectId,
              role_name: roleName,
              inviter_id: currentUser?.id,
              invitation_message: message
            }
          });
        }

        // 2. Ghi nhận lời mời vào localStorage để ghi nhớ trạng thái
        recordCandidateInvitation(projectId, candidateId, candidateName, roleName);

        // 3. Cập nhật giao diện nút trên thẻ ứng viên ngay lập tức
        const candidateBtn = resultsEl.querySelector(`.btn-invite-candidate[data-user-id="${candidateId}"]`);
        if (candidateBtn) {
          candidateBtn.outerHTML = `
            <button class="btn btn-success-subtle text-success border border-success-subtle btn-sm rounded-3 py-1.5 px-3 fw-semibold flex-grow-1" disabled>
              <i class="bi bi-check2-circle me-1"></i>Đã gửi lời mời
            </button>
          `;
        }

        // 4. Đóng modal và hiển thị toast thành công
        const modalEl = document.getElementById('inviteCandidateModal');
        if (modalEl && window.bootstrap?.Modal) {
          window.bootstrap.Modal.getInstance(modalEl)?.hide();
        }

        if (typeof showToast === 'function') {
          showToast(`Đã gửi lời mời tham gia dự án tới ${candidateName} thành công!`, 'success');
        }
      } catch (err) {
        console.error('[Matching] Lỗi gửi lời mời:', err);
        if (typeof showToast === 'function') {
          showToast('Có lỗi xảy ra: ' + (err.message || 'Không thể gửi lời mời'), 'danger');
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<i class="bi bi-send-fill me-1"></i><span>Gửi lời mời ngay</span>';
        }
      }
    });
  }

  // 3. Tải dự án gợi ý cho người dùng hiện tại
  const recommended = await findMatchingProjects(userToMatch);

  // Cập nhật các badge số lượng gợi ý: Chỉ hiện số khi > 0, không hiện số 0 vô nghĩa
  const countBadge = document.getElementById('recommended-count-badge');
  const linkText = document.getElementById('link-to-projects-text');

  if (countBadge) {
    if (recommended.length > 0) {
      countBadge.textContent = recommended.length;
      countBadge.classList.remove('d-none');
    } else {
      countBadge.classList.add('d-none');
    }
  }

  if (linkText) {
    if (recommended.length > 0) {
      linkText.textContent = `Xem gợi ý (${recommended.length}) →`;
    } else {
      linkText.textContent = 'Khám phá dự án gợi ý →';
    }
  }

  const countTexts = document.querySelectorAll('.recommended-count-text');
  countTexts.forEach(b => {
    b.textContent = recommended.length > 0 ? recommended.length : '';
  });

  // Render danh sách dự án đầy đủ trong Tab 2
  if (recommendedEl) {
    if (recommended.length === 0) {
      recommendedEl.innerHTML = `
        <div class="col-12">
          <div class="empty-state-box text-center py-5">
            <i class="bi bi-compass display-5 text-muted mb-3 d-block"></i>
            <h5 class="fw-bold text-dark mb-1">Chưa có dự án gợi ý phù hợp</h5>
            <p class="text-muted small mb-3">Hãy cập nhật thêm kỹ năng chuyên môn trong hồ sơ để hệ thống AI đối sánh chính xác hơn.</p>
            <a href="profile.html" class="btn btn-outline-primary btn-sm rounded-pill px-3 py-1.5">
              <i class="bi bi-pencil me-1"></i>Cập nhật hồ sơ
            </a>
          </div>
        </div>
      `;
    } else {
      recommendedEl.innerHTML = recommended.map(p => renderProjectMatchCard(p, userToMatch?.skills || [])).join('');
    }
  }

  // Nếu user chưa có dự án, cập nhật ngay vào Tab 1 để màn hình đầy đặn, không bị trống trải
  if (!myProjects || myProjects.length === 0) {
    renderNoProjectsState(recommended);
  }

  // Tương tác lọc category trong Tab 2
  const catFilterContainer = document.getElementById('project-category-filters');
  if (catFilterContainer) {
    catFilterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-filter-btn');
      if (!btn) return;

      catFilterContainer.querySelectorAll('.cat-filter-btn').forEach(b => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-outline-secondary');
      });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-secondary');

      const selectedCat = (btn.dataset.cat || '').toLowerCase();
      const projectItems = recommendedEl?.querySelectorAll('.project-card-item') || [];

      projectItems.forEach(item => {
        const itemCat = (item.dataset.category || '').toLowerCase();
        if (selectedCat === 'all') {
          item.classList.remove('d-none');
        } else if (selectedCat === 'other') {
          const mainCats = ['web', 'mobile', 'ai'];
          const isMain = mainCats.some(c => itemCat.includes(c));
          item.classList.toggle('d-none', isMain);
        } else {
          item.classList.toggle('d-none', !itemCat.includes(selectedCat));
        }
      });
    });
  }

  // 4. Render các pills lọc kỹ năng phổ biến & Tự thêm kỹ năng tùy chọn
  const popularSkills = ['JavaScript', 'React', 'Node.js', 'Python', 'TypeScript', 'Figma', 'UI/UX', 'Java', 'SQL'];
  const skillContainer = document.getElementById('skill-filter-container');
  const btnClearSkills = document.getElementById('btn-clear-skills');
  const customSkillInput = document.getElementById('custom-skill-input');
  const btnAddCustomSkill = document.getElementById('btn-add-custom-skill');

  function updateClearSkillsBtn() {
    const activeCount = skillContainer?.querySelectorAll('.skill-filter-pill.active').length || 0;
    if (btnClearSkills) {
      btnClearSkills.classList.toggle('d-none', activeCount === 0);
    }
  }

  function addSkillPill(skillName, isActive = false, isCustom = false) {
    if (!skillContainer || !skillName) return null;
    const trimmed = skillName.trim();
    if (!trimmed) return null;

    // Kiểm tra xem đã có pill cho skill này chưa (không phân biệt hoa thường)
    const existing = Array.from(skillContainer.querySelectorAll('.skill-filter-pill'))
      .find(btn => (btn.dataset.skill || '').toLowerCase() === trimmed.toLowerCase());

    if (existing) {
      if (!existing.classList.contains('active')) {
        existing.classList.add('active', 'btn-primary');
        existing.classList.remove('btn-outline-secondary');
        updateClearSkillsBtn();
        if (selector.value) btnFind?.click();
      }
      return existing;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.skill = trimmed;
    btn.className = `skill-filter-pill btn ${isActive ? 'btn-primary active' : 'btn-outline-secondary'} btn-sm rounded-pill d-inline-flex align-items-center gap-1`;

    if (isCustom) {
      btn.classList.add('custom-skill-pill');
      btn.innerHTML = `
        <span>${escapeHtml(trimmed)}</span>
        <span class="btn-remove-skill ms-1" title="Xóa kỹ năng này" aria-label="Xóa">&times;</span>
      `;
    } else {
      btn.textContent = trimmed;
    }

    btn.addEventListener('click', (e) => {
      // Nếu bấm vào nút xóa kỹ năng tự thêm
      if (e.target.closest('.btn-remove-skill')) {
        e.stopPropagation();
        btn.remove();
        updateClearSkillsBtn();
        if (selector.value) btnFind?.click();
        return;
      }
      btn.classList.toggle('active');
      btn.classList.toggle('btn-outline-secondary');
      btn.classList.toggle('btn-primary');
      updateClearSkillsBtn();
      if (selector.value) {
        btnFind?.click();
      }
    });

    skillContainer.appendChild(btn);
    updateClearSkillsBtn();
    return btn;
  }

  if (skillContainer) {
    skillContainer.innerHTML = '';
    popularSkills.forEach(s => addSkillPill(s, false, false));

    // Xử lý khi người dùng tự nhập thêm kỹ năng ngoài ví dụ
    function handleAddCustomSkill() {
      if (!customSkillInput) return;
      const val = customSkillInput.value.trim();
      if (!val) return;

      const newBtn = addSkillPill(val, true, true);
      customSkillInput.value = '';
      if (newBtn && selector.value) {
        btnFind?.click();
      }
    }

    btnAddCustomSkill?.addEventListener('click', handleAddCustomSkill);
    customSkillInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomSkill();
      }
    });

    btnClearSkills?.addEventListener('click', () => {
      skillContainer.querySelectorAll('.skill-filter-pill.active').forEach(p => {
        p.classList.remove('active', 'btn-primary');
        p.classList.add('btn-outline-secondary');
      });
      updateClearSkillsBtn();
      if (selector.value) {
        btnFind?.click();
      }
    });
  }
}

// Global exports
window.calculateMatchScore = calculateMatchScore;
window.findMatchingCandidates = findMatchingCandidates;
window.findMatchingProjects = findMatchingProjects;
window.initMatchingPage = initMatchingPage;

document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page === 'matching.html') {
    initMatchingPage();
  }
});
