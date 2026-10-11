// This file seeds demo data into localStorage on first load
// All data is in Vietnamese context

const DEMO_DATA = {
  users: [
    {
      id: 'u1',
      name: 'Nguyễn Minh Khoa',
      username: 'minhkhoa',
      email: 'minhkhoa@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh+Khoa&background=4F46E5&color=fff&size=128',
      bio: 'Full-stack developer đam mê xây dựng các sản phẩm có ý nghĩa. Đang học năm 3 CNTT.',
      skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
      interests: ['Web Development', 'AI/ML', 'Open Source'],
      github: 'minhkhoa',
      website: '',
      experience: 'Intermediate',
      joinDate: '2024-09-01',
      projectsCompleted: 3,
      projectsActive: 2,
      role: 'Full-Stack Developer',
      achievements: ['First Project', 'Team Player', 'AI Enthusiast']
    },
    {
      id: 'u2',
      name: 'Trần Thị Lan',
      username: 'thilan',
      email: 'thilan@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Tran+Thi+Lan&background=06B6D4&color=fff&size=128',
      bio: 'UI/UX Designer với 2 năm kinh nghiệm. Yêu thích tạo ra những trải nghiệm người dùng tuyệt vời.',
      skills: ['Figma', 'UI/UX', 'Prototyping', 'CSS', 'User Research'],
      interests: ['Design', 'Mobile Apps'],
      github: 'thilan_design',
      website: '',
      experience: 'Intermediate',
      joinDate: '2024-10-15',
      projectsCompleted: 2,
      projectsActive: 3,
      role: 'UI/UX Designer',
      achievements: ['Design Expert', 'Team Player']
    },
    {
      id: 'u3',
      name: 'Lê Văn Tú',
      username: 'letu',
      email: 'letu@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Le+Van+Tu&background=10B981&color=fff&size=128',
      bio: 'Backend Engineer chuyên về microservices và cơ sở dữ liệu phân tán.',
      skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'Kubernetes'],
      interests: ['Backend', 'System Design', 'DevOps'],
      github: 'letu_backend',
      website: '',
      experience: 'Advanced',
      joinDate: '2024-08-20',
      projectsCompleted: 5,
      projectsActive: 1,
      role: 'Backend Developer',
      achievements: ['Code Ninja', 'Problem Solver']
    },
    {
      id: 'u4',
      name: 'Phạm Thu Hà',
      username: 'thuha',
      email: 'thuha@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Pham+Thu+Ha&background=F59E0B&color=fff&size=128',
      bio: 'Data Scientist với niềm đam mê với NLP và Computer Vision.',
      skills: ['Python', 'TensorFlow', 'PyTorch', 'SQL', 'Data Analysis'],
      interests: ['AI/ML', 'Data Science', 'Research'],
      github: 'thuha_data',
      website: '',
      experience: 'Intermediate',
      joinDate: '2024-11-05',
      projectsCompleted: 1,
      projectsActive: 1,
      role: 'Data Scientist',
      achievements: ['Data Explorer']
    },
    {
      id: 'u5',
      name: 'Hoàng Quốc Việt',
      username: 'quocviet',
      email: 'quocviet@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Hoang+Quoc+Viet&background=EF4444&color=fff&size=128',
      bio: 'Mobile Developer (iOS/Android) yêu thích tạo ra các ứng dụng mượt mà.',
      skills: ['Flutter', 'Dart', 'Swift', 'Kotlin', 'Firebase'],
      interests: ['Mobile Apps', 'UX Design', 'IoT'],
      github: 'viet_mobile',
      website: '',
      experience: 'Intermediate',
      joinDate: '2024-09-10',
      projectsCompleted: 4,
      projectsActive: 2,
      role: 'Mobile Developer',
      achievements: ['App Creator', 'Fast Learner']
    },
    {
      id: 'u6',
      name: 'Bùi Thị Trang',
      username: 'thitrang',
      email: 'thitrang@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Bui+Thi+Trang&background=8B5CF6&color=fff&size=128',
      bio: 'Marketing Specialist, chuyên gia trong việc phát triển cộng đồng và growth hacking.',
      skills: ['Digital Marketing', 'SEO', 'Content Strategy', 'Analytics', 'Social Media'],
      interests: ['Marketing', 'Community Building', 'Startup'],
      github: '',
      website: 'thitrang.com',
      experience: 'Advanced',
      joinDate: '2024-10-01',
      projectsCompleted: 2,
      projectsActive: 2,
      role: 'Marketing Specialist',
      achievements: ['Growth Hacker', 'Communicator']
    },
    {
      id: 'u7',
      name: 'Đặng Bảo Nam',
      username: 'baonam',
      email: 'baonam@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Dang+Bao+Nam&background=EC4899&color=fff&size=128',
      bio: 'DevOps Engineer quan tâm đến CI/CD, cloud architecture và automation.',
      skills: ['AWS', 'Linux', 'Jenkins', 'Terraform', 'Ansible'],
      interests: ['Cloud Computing', 'Security', 'Automation'],
      github: 'nam_devops',
      website: '',
      experience: 'Advanced',
      joinDate: '2024-07-15',
      projectsCompleted: 6,
      projectsActive: 3,
      role: 'DevOps Engineer',
      achievements: ['Cloud Master', 'Automator']
    },
    {
      id: 'u8',
      name: 'Vũ Thanh Mai',
      username: 'thanhmai',
      email: 'thanhmai@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Vu+Thanh+Mai&background=3B82F6&color=fff&size=128',
      bio: 'Content Writer sáng tạo, yêu thích viết blog và xây dựng nội dung thương hiệu.',
      skills: ['Copywriting', 'Content Creation', 'Editing', 'WordPress', 'Storytelling'],
      interests: ['Writing', 'Branding', 'Media'],
      github: '',
      website: 'mai-writes.net',
      experience: 'Intermediate',
      joinDate: '2024-12-01',
      projectsCompleted: 1,
      projectsActive: 1,
      role: 'Content Writer',
      achievements: ['Wordsmith']
    },
    {
      id: 'u9',
      name: 'Ngô Hải Đăng',
      username: 'haidang',
      email: 'haidang@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Ngo+Hai+Dang&background=6366F1&color=fff&size=128',
      bio: 'Game Developer với niềm đam mê với Unity và thiết kế game 3D.',
      skills: ['C#', 'Unity', 'Blender', 'Game Design', 'C++'],
      interests: ['Game Dev', 'AR/VR', '3D Modeling'],
      github: 'dang_games',
      website: '',
      experience: 'Intermediate',
      joinDate: '2024-11-20',
      projectsCompleted: 2,
      projectsActive: 1,
      role: 'Game Developer',
      achievements: ['Game Jam Winner', 'Creative']
    },
    {
      id: 'u10',
      name: 'Đoàn Quỳnh Như',
      username: 'quynhnhu',
      email: 'quynhnhu@email.com',
      password: 'demo123',
      avatar: 'https://ui-avatars.com/api/?name=Doan+Quynh+Nhu&background=14B8A6&color=fff&size=128',
      bio: 'Product Manager luôn hướng tới giải quyết các vấn đề thực tế của người dùng.',
      skills: ['Agile', 'Scrum', 'Jira', 'Product Strategy', 'Wireframing'],
      interests: ['Product Management', 'Startup', 'Strategy'],
      github: '',
      website: '',
      experience: 'Advanced',
      joinDate: '2024-09-25',
      projectsCompleted: 4,
      projectsActive: 2,
      role: 'Product Manager',
      achievements: ['Leader', 'Visionary']
    }
  ],
  projects: [
    {
      id: 'p1',
      title: 'AI Study Assistant',
      description: 'Ứng dụng hỗ trợ học tập thông minh sử dụng AI để tạo quiz, tóm tắt tài liệu và lên kế hoạch học tập cá nhân hóa.',
      objective: 'Giúp sinh viên học tập hiệu quả hơn với sự hỗ trợ của AI',
      problem: 'Sinh viên mất nhiều thời gian tự tổ chức tài liệu và kế hoạch học tập',
      ownerId: 'u1',
      ownerName: 'Nguyễn Minh Khoa',
      members: ['u1', 'u2', 'u3', 'u4'],
      maxMembers: 5,
      roles: [
        { title: 'Frontend Developer', filled: true, count: 1 },
        { title: 'Backend Developer', filled: true, count: 1 },
        { title: 'UI/UX Designer', filled: true, count: 1 },
        { title: 'AI/ML Engineer', filled: true, count: 1 },
        { title: 'QA Tester', filled: false, count: 1 }
      ],
      skills: ['React', 'Node.js', 'Python', 'OpenAI API', 'MongoDB'],
      technologies: ['React', 'Node.js', 'Python', 'MongoDB', 'OpenAI'],
      field: 'AI/ML',
      difficulty: 'Hard',
      progress: 65,
      status: 'active',
      deadline: '2025-03-15',
      createdAt: '2024-11-01',
      image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80',
      looking: true,
      tags: ['AI', 'Education', 'Web App'],
      tasks: ['t1', 't2', 't3', 't4']
    },
    {
      id: 'p2',
      title: 'Smart Campus',
      description: 'Hệ thống quản lý thông minh cho khuôn viên trường đại học, bao gồm điểm danh qua nhận diện khuôn mặt và quản lý phòng học.',
      objective: 'Tự động hóa các quy trình quản lý trong trường học',
      problem: 'Điểm danh thủ công tốn thời gian, quản lý cơ sở vật chất chưa hiệu quả',
      ownerId: 'u3',
      ownerName: 'Lê Văn Tú',
      members: ['u3', 'u5', 'u10'],
      maxMembers: 4,
      roles: [
        { title: 'Backend Developer', filled: true, count: 1 },
        { title: 'Mobile Developer', filled: true, count: 1 },
        { title: 'Product Manager', filled: true, count: 1 },
        { title: 'Computer Vision Engineer', filled: false, count: 1 }
      ],
      skills: ['Spring Boot', 'Flutter', 'OpenCV', 'PostgreSQL'],
      technologies: ['Java', 'Flutter', 'PostgreSQL', 'Docker'],
      field: 'Education / IoT',
      difficulty: 'Hard',
      progress: 40,
      status: 'active',
      deadline: '2025-05-20',
      createdAt: '2024-10-15',
      image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&q=80',
      looking: true,
      tags: ['IoT', 'Mobile', 'Campus'],
      tasks: ['t5', 't6', 't7']
    },
    {
      id: 'p3',
      title: 'Green Garden App',
      description: 'Mạng xã hội dành cho người yêu cây cảnh, chia sẻ kinh nghiệm chăm sóc cây và mua bán trao đổi cây trồng.',
      objective: 'Tạo cộng đồng kết nối những người đam mê làm vườn',
      problem: 'Thiếu một nền tảng chuyên biệt và uy tín cho người yêu cây',
      ownerId: 'u5',
      ownerName: 'Hoàng Quốc Việt',
      members: ['u5', 'u2', 'u6'],
      maxMembers: 3,
      roles: [
        { title: 'Mobile Developer', filled: true, count: 1 },
        { title: 'UI/UX Designer', filled: true, count: 1 },
        { title: 'Marketing Specialist', filled: true, count: 1 }
      ],
      skills: ['Flutter', 'Firebase', 'Figma', 'Digital Marketing'],
      technologies: ['Flutter', 'Firebase', 'Figma'],
      field: 'Social',
      difficulty: 'Medium',
      progress: 90,
      status: 'active',
      deadline: '2025-01-10',
      createdAt: '2024-09-10',
      image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=600&q=80',
      looking: false,
      tags: ['Social', 'Nature', 'Mobile'],
      tasks: ['t8', 't9']
    },
    {
      id: 'p4',
      title: 'Community Event Hub',
      description: 'Nền tảng giúp sinh viên dễ dàng tìm kiếm, đăng ký và tổ chức các sự kiện tình nguyện, câu lạc bộ.',
      objective: 'Tăng cường sự tham gia của sinh viên vào các hoạt động ngoại khóa',
      problem: 'Thông tin sự kiện bị phân mảnh trên nhiều group Facebook, khó theo dõi',
      ownerId: 'u10',
      ownerName: 'Đoàn Quỳnh Như',
      members: ['u10', 'u1', 'u8'],
      maxMembers: 5,
      roles: [
        { title: 'Product Manager', filled: true, count: 1 },
        { title: 'Frontend Developer', filled: true, count: 1 },
        { title: 'Content Writer', filled: true, count: 1 },
        { title: 'Backend Developer', filled: false, count: 1 },
        { title: 'Marketing Specialist', filled: false, count: 1 }
      ],
      skills: ['React', 'Node.js', 'Content Writing', 'Product Management'],
      technologies: ['React', 'Express', 'MongoDB'],
      field: 'Community',
      difficulty: 'Medium',
      progress: 20,
      status: 'active',
      deadline: '2025-04-30',
      createdAt: '2024-12-01',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
      looking: true,
      tags: ['Events', 'Community', 'Web'],
      tasks: ['t10', 't11', 't12']
    },
    {
      id: 'p5',
      title: 'Health Tracker Pro',
      description: 'Ứng dụng theo dõi sức khỏe tổng hợp, phân tích chỉ số cơ thể và đề xuất thực đơn dinh dưỡng.',
      objective: 'Cải thiện thói quen sống và sức khỏe của người dùng',
      problem: 'Nhiều người dùng gặp khó khăn trong việc duy trì lối sống lành mạnh',
      ownerId: 'u4',
      ownerName: 'Phạm Thu Hà',
      members: ['u4', 'u5', 'u7'],
      maxMembers: 4,
      roles: [
        { title: 'Data Scientist', filled: true, count: 1 },
        { title: 'Mobile Developer', filled: true, count: 1 },
        { title: 'DevOps Engineer', filled: true, count: 1 },
        { title: 'Nutrition Expert', filled: false, count: 1 }
      ],
      skills: ['Python', 'Data Analysis', 'Flutter', 'AWS'],
      technologies: ['Python', 'Flutter', 'AWS'],
      field: 'Health',
      difficulty: 'Hard',
      progress: 55,
      status: 'active',
      deadline: '2025-06-15',
      createdAt: '2024-11-15',
      image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&q=80',
      looking: true,
      tags: ['Health', 'Data', 'Mobile'],
      tasks: ['t13', 't14']
    },
    {
      id: 'p6',
      title: 'Library Management System',
      description: 'Hệ thống quản lý thư viện hiện đại cho các trường đại học, tích hợp mượn trả tự động qua RFID.',
      objective: 'Hiện đại hóa quy trình mượn trả sách thư viện',
      problem: 'Hệ thống cũ chậm chạp, hay xảy ra lỗi dữ liệu',
      ownerId: 'u7',
      ownerName: 'Đặng Bảo Nam',
      members: ['u7', 'u3'],
      maxMembers: 5,
      roles: [
        { title: 'DevOps Engineer', filled: true, count: 1 },
        { title: 'Backend Developer', filled: true, count: 1 },
        { title: 'Frontend Developer', filled: false, count: 1 },
        { title: 'Hardware Engineer', filled: false, count: 1 },
        { title: 'QA Tester', filled: false, count: 1 }
      ],
      skills: ['AWS', 'Java', 'RFID', 'React'],
      technologies: ['Java', 'Spring', 'React', 'AWS'],
      field: 'Education',
      difficulty: 'Medium',
      progress: 15,
      status: 'active',
      deadline: '2025-08-01',
      createdAt: '2024-12-10',
      image: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=600&q=80',
      looking: true,
      tags: ['System', 'Library', 'IoT'],
      tasks: ['t15', 't16']
    },
    {
      id: 'p7',
      title: 'Student Portfolio Hub',
      description: 'Nền tảng giúp sinh viên xây dựng hồ sơ năng lực số, trưng bày dự án và kết nối với nhà tuyển dụng.',
      objective: 'Cầu nối giữa sinh viên tài năng và doanh nghiệp',
      problem: 'Sinh viên khó khăn trong việc thể hiện năng lực thực tế qua CV truyền thống',
      ownerId: 'u2',
      ownerName: 'Trần Thị Lan',
      members: ['u2', 'u1', 'u8', 'u6'],
      maxMembers: 4,
      roles: [
        { title: 'UI/UX Designer', filled: true, count: 1 },
        { title: 'Full-stack Developer', filled: true, count: 1 },
        { title: 'Content Writer', filled: true, count: 1 },
        { title: 'Marketing Specialist', filled: true, count: 1 }
      ],
      skills: ['Figma', 'React', 'Node.js', 'Marketing', 'Copywriting'],
      technologies: ['Figma', 'MERN Stack'],
      field: 'Career',
      difficulty: 'Medium',
      progress: 100,
      status: 'completed',
      deadline: '2024-11-30',
      createdAt: '2024-07-01',
      image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=600&q=80',
      looking: false,
      tags: ['Portfolio', 'Career', 'Web'],
      tasks: ['t17', 't18']
    },
    {
      id: 'p8',
      title: 'EcoMap',
      description: 'Bản đồ tương tác theo dõi và báo cáo các vấn đề môi trường tại địa phương (rác thải, ô nhiễm nguồn nước).',
      objective: 'Nâng cao ý thức bảo vệ môi trường và báo cáo nhanh sự cố',
      problem: 'Người dân không biết báo cáo sự cố môi trường ở đâu',
      ownerId: 'u9',
      ownerName: 'Ngô Hải Đăng',
      members: ['u9', 'u4', 'u2'],
      maxMembers: 5,
      roles: [
        { title: 'Game/3D Developer', filled: true, count: 1 },
        { title: 'Data Scientist', filled: true, count: 1 },
        { title: 'UI/UX Designer', filled: true, count: 1 },
        { title: 'Backend Developer', filled: false, count: 1 },
        { title: 'GIS Expert', filled: false, count: 1 }
      ],
      skills: ['Unity', 'Python', 'Figma', 'GIS'],
      technologies: ['Unity', 'Mapbox', 'Python'],
      field: 'Environment',
      difficulty: 'Hard',
      progress: 30,
      status: 'active',
      deadline: '2025-07-20',
      createdAt: '2024-11-25',
      image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&q=80',
      looking: true,
      tags: ['Environment', 'Map', '3D'],
      tasks: ['t19', 't20']
    }
  ],
  tasks: [
    {
      id: 't1', projectId: 'p1', title: 'Thiết kế UI trang Dashboard', description: 'Tạo wireframe và prototype cho trang dashboard chính', assignee: 'u2', assigneeName: 'Trần Thị Lan', priority: 'high', status: 'done', deadline: '2024-12-15', tags: ['UI', 'Design'], createdAt: '2024-11-05', updatedAt: '2024-12-10'
    },
    {
      id: 't2', projectId: 'p1', title: 'Xây dựng API cho module Quiz', description: 'Tạo RESTful API để lấy và chấm điểm bài quiz', assignee: 'u3', assigneeName: 'Lê Văn Tú', priority: 'high', status: 'done', deadline: '2024-12-20', tags: ['Backend', 'API'], createdAt: '2024-11-10', updatedAt: '2024-12-15'
    },
    {
      id: 't3', projectId: 'p1', title: 'Tích hợp OpenAI API', description: 'Sử dụng prompt engineering để tạo quiz tự động từ văn bản', assignee: 'u4', assigneeName: 'Phạm Thu Hà', priority: 'high', status: 'inprogress', deadline: '2025-01-10', tags: ['AI', 'Integration'], createdAt: '2024-12-01', updatedAt: '2024-12-25'
    },
    {
      id: 't4', projectId: 'p1', title: 'Phát triển Frontend Quiz Component', description: 'Tạo giao diện làm bài quiz với React', assignee: 'u1', assigneeName: 'Nguyễn Minh Khoa', priority: 'medium', status: 'todo', deadline: '2025-01-20', tags: ['Frontend', 'React'], createdAt: '2024-12-20', updatedAt: '2024-12-20'
    },
    {
      id: 't5', projectId: 'p2', title: 'Thiết kế Database Schema', description: 'Lên cấu trúc CSDL cho hệ thống Smart Campus', assignee: 'u3', assigneeName: 'Lê Văn Tú', priority: 'high', status: 'done', deadline: '2024-11-01', tags: ['Database', 'Backend'], createdAt: '2024-10-20', updatedAt: '2024-10-30'
    },
    {
      id: 't6', projectId: 'p2', title: 'Xây dựng app Flutter cơ bản', description: 'Setup project và làm các màn hình auth', assignee: 'u5', assigneeName: 'Hoàng Quốc Việt', priority: 'medium', status: 'inprogress', deadline: '2025-01-15', tags: ['Mobile', 'Flutter'], createdAt: '2024-12-10', updatedAt: '2024-12-25'
    },
    {
      id: 't7', projectId: 'p2', title: 'Nghiên cứu thư viện Face Recognition', description: 'Đánh giá OpenCV vs các giải pháp cloud', assignee: 'u3', assigneeName: 'Lê Văn Tú', priority: 'low', status: 'todo', deadline: '2025-02-10', tags: ['Research', 'AI'], createdAt: '2024-12-25', updatedAt: '2024-12-25'
    },
    {
      id: 't8', projectId: 'p3', title: 'Testing toàn bộ hệ thống', description: 'Bug bash trước khi release', assignee: 'u5', assigneeName: 'Hoàng Quốc Việt', priority: 'high', status: 'inprogress', deadline: '2025-01-05', tags: ['Testing', 'QA'], createdAt: '2024-12-20', updatedAt: '2024-12-26'
    },
    {
      id: 't9', projectId: 'p3', title: 'Chuẩn bị chiến dịch Marketing Launch', description: 'Viết bài PR và lên kế hoạch ads', assignee: 'u6', assigneeName: 'Bùi Thị Trang', priority: 'high', status: 'inprogress', deadline: '2025-01-08', tags: ['Marketing', 'Launch'], createdAt: '2024-12-15', updatedAt: '2024-12-20'
    },
    {
      id: 't10', projectId: 'p4', title: 'Lên kế hoạch sản phẩm MVP', description: 'Định nghĩa các tính năng cốt lõi cho phase 1', assignee: 'u10', assigneeName: 'Đoàn Quỳnh Như', priority: 'high', status: 'done', deadline: '2024-12-10', tags: ['Product', 'Planning'], createdAt: '2024-12-02', updatedAt: '2024-12-09'
    },
    {
      id: 't11', projectId: 'p4', title: 'Setup repository & CI/CD', description: 'Khởi tạo Git repo và Github Actions', assignee: 'u1', assigneeName: 'Nguyễn Minh Khoa', priority: 'medium', status: 'done', deadline: '2024-12-15', tags: ['DevOps', 'Setup'], createdAt: '2024-12-11', updatedAt: '2024-12-14'
    },
    {
      id: 't12', projectId: 'p4', title: 'Viết nội dung giới thiệu', description: 'Soạn thảo copy cho landing page', assignee: 'u8', assigneeName: 'Vũ Thanh Mai', priority: 'low', status: 'todo', deadline: '2025-01-05', tags: ['Content'], createdAt: '2024-12-20', updatedAt: '2024-12-20'
    },
    {
      id: 't13', projectId: 'p5', title: 'Thu thập dataset dinh dưỡng', description: 'Crawl và làm sạch dữ liệu thực phẩm', assignee: 'u4', assigneeName: 'Phạm Thu Hà', priority: 'high', status: 'inprogress', deadline: '2025-01-20', tags: ['Data', 'Crawler'], createdAt: '2024-12-05', updatedAt: '2024-12-25'
    },
    {
      id: 't14', projectId: 'p5', title: 'Cấu hình AWS Infrastructure', description: 'Setup EC2, S3 và RDS', assignee: 'u7', assigneeName: 'Đặng Bảo Nam', priority: 'medium', status: 'todo', deadline: '2025-02-01', tags: ['AWS', 'DevOps'], createdAt: '2024-12-25', updatedAt: '2024-12-25'
    },
    {
      id: 't15', projectId: 'p6', title: 'Khảo sát quy trình thư viện thực tế', description: 'Phỏng vấn thủ thư về các pain points', assignee: 'u3', assigneeName: 'Lê Văn Tú', priority: 'high', status: 'done', deadline: '2024-12-20', tags: ['Research', 'Requirement'], createdAt: '2024-12-11', updatedAt: '2024-12-19'
    },
    {
      id: 't16', projectId: 'p6', title: 'Thiết kế API mượn trả sách', description: 'Lên swagger doc cho các endpoints core', assignee: 'u3', assigneeName: 'Lê Văn Tú', priority: 'medium', status: 'inprogress', deadline: '2025-01-15', tags: ['Backend', 'API'], createdAt: '2024-12-22', updatedAt: '2024-12-26'
    },
    {
      id: 't17', projectId: 'p7', title: 'Fix bug UI trên mobile', description: 'Một số element bị lệch trên iPhone 13', assignee: 'u2', assigneeName: 'Trần Thị Lan', priority: 'low', status: 'done', deadline: '2024-11-25', tags: ['Bug', 'UI'], createdAt: '2024-11-20', updatedAt: '2024-11-24'
    },
    {
      id: 't18', projectId: 'p7', title: 'Viết báo cáo tổng kết dự án', description: 'Tài liệu hand-over và báo cáo thành tích', assignee: 'u8', assigneeName: 'Vũ Thanh Mai', priority: 'medium', status: 'done', deadline: '2024-11-30', tags: ['Documentation'], createdAt: '2024-11-25', updatedAt: '2024-11-29'
    },
    {
      id: 't19', projectId: 'p8', title: 'Tạo 3D Model cho bản đồ', description: 'Model các dạng địa hình và marker', assignee: 'u9', assigneeName: 'Ngô Hải Đăng', priority: 'high', status: 'inprogress', deadline: '2025-01-30', tags: ['3D', 'Design'], createdAt: '2024-12-05', updatedAt: '2024-12-25'
    },
    {
      id: 't20', projectId: 'p8', title: 'Phân tích dữ liệu ô nhiễm giả định', description: 'Tạo dummy data để test heat map', assignee: 'u4', assigneeName: 'Phạm Thu Hà', priority: 'medium', status: 'todo', deadline: '2025-02-15', tags: ['Data', 'Testing'], createdAt: '2024-12-26', updatedAt: '2024-12-26'
    }
  ],
  notifications: [
    {
      id: 'n1', userId: 'u1', type: 'invite', title: 'Bạn được mời tham gia dự án', message: 'Lê Văn Tú mời bạn tham gia dự án Smart Campus', read: false, createdAt: '2024-12-25T10:30:00', projectId: 'p2', actionUrl: 'project-detail.html?id=p2'
    },
    {
      id: 'n2', userId: 'u1', type: 'task', title: 'Task mới được giao', message: 'Bạn được giao task "Phát triển Frontend Quiz Component"', read: false, createdAt: '2024-12-20T14:15:00', projectId: 'p1', actionUrl: 'workspace.html?id=p1'
    },
    {
      id: 'n3', userId: 'u1', type: 'mention', title: 'Có người nhắc đến bạn', message: 'Trần Thị Lan đã nhắc đến bạn trong một bình luận ở AI Study Assistant', read: true, createdAt: '2024-12-18T09:20:00', projectId: 'p1', actionUrl: 'workspace.html?id=p1'
    },
    {
      id: 'n4', userId: 'u1', type: 'system', title: 'Cập nhật hệ thống', message: 'ProjectHub vừa cập nhật tính năng mới: AI Assistant!', read: true, createdAt: '2024-12-10T08:00:00', projectId: null, actionUrl: '#'
    },
    {
      id: 'n5', userId: 'u1', type: 'join', title: 'Thành viên mới', message: 'Phạm Thu Hà đã tham gia dự án AI Study Assistant', read: true, createdAt: '2024-12-05T16:45:00', projectId: 'p1', actionUrl: 'project-detail.html?id=p1'
    },
    {
      id: 'n6', userId: 'u2', type: 'task', title: 'Task hoàn thành', message: 'Task "Thiết kế UI trang Dashboard" đã được duyệt', read: false, createdAt: '2024-12-12T11:00:00', projectId: 'p1', actionUrl: 'workspace.html?id=p1'
    },
    {
      id: 'n7', userId: 'u3', type: 'deadline', title: 'Sắp đến hạn deadline', message: 'Task "Xây dựng API cho module Quiz" sắp đến hạn (2 ngày nữa)', read: false, createdAt: '2024-12-18T08:00:00', projectId: 'p1', actionUrl: 'workspace.html?id=p1'
    },
    {
      id: 'n8', userId: 'u4', type: 'invite', title: 'Bạn được mời tham gia dự án', message: 'Ngô Hải Đăng mời bạn tham gia dự án EcoMap', read: true, createdAt: '2024-11-26T15:20:00', projectId: 'p8', actionUrl: 'project-detail.html?id=p8'
    },
    {
      id: 'n9', userId: 'u10', type: 'ai', title: 'AI Suggestion', message: 'AI Assistant đã đề xuất cấu trúc dự án cho Community Event Hub', read: false, createdAt: '2024-12-05T10:10:00', projectId: 'p4', actionUrl: 'workspace.html?id=p4'
    },
    {
      id: 'n10', userId: 'u1', type: 'deadline', title: 'Dự án sắp hoàn thành', message: 'Dự án Student Portfolio Hub đã hoàn thành 100%!', read: true, createdAt: '2024-11-30T17:00:00', projectId: 'p7', actionUrl: 'project-detail.html?id=p7'
    }
  ],
  messages: [
    { id: 'm1', projectId: 'p1', senderId: 'u3', senderName: 'Lê Văn Tú', senderAvatar: 'https://ui-avatars.com/api/?name=Le+Van+Tu&background=10B981&color=fff&size=128', content: 'Mọi người ơi, hôm nay mình đã hoàn thành phần API cho module quiz rồi nhé! Chạy mượt lắm.', timestamp: '2024-12-15T09:00:00', replyTo: null },
    { id: 'm2', projectId: 'p1', senderId: 'u1', senderName: 'Nguyễn Minh Khoa', senderAvatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh+Khoa&background=4F46E5&color=fff&size=128', content: 'Tuyệt vời quá anh Tú, em sẽ bắt đầu ghép API vào frontend luôn.', timestamp: '2024-12-15T09:15:00', replyTo: 'm1' },
    { id: 'm3', projectId: 'p1', senderId: 'u2', senderName: 'Trần Thị Lan', senderAvatar: 'https://ui-avatars.com/api/?name=Tran+Thi+Lan&background=06B6D4&color=fff&size=128', content: 'Thiết kế dashboard cũng xong rồi, Khoa xem qua Figma nhé.', timestamp: '2024-12-15T09:30:00', replyTo: null },
    { id: 'm4', projectId: 'p1', senderId: 'u1', senderName: 'Nguyễn Minh Khoa', senderAvatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh+Khoa&background=4F46E5&color=fff&size=128', content: 'Vâng em thấy rồi, UI đẹp xỉu chị Lan ơi!', timestamp: '2024-12-15T09:45:00', replyTo: 'm3' },
    { id: 'm5', projectId: 'p1', senderId: 'u4', senderName: 'Phạm Thu Hà', senderAvatar: 'https://ui-avatars.com/api/?name=Pham+Thu+Ha&background=F59E0B&color=fff&size=128', content: 'Phần tích hợp OpenAI mình đang gặp chút issue với rate limit, mọi người có account plus không?', timestamp: '2024-12-16T10:00:00', replyTo: null },
    { id: 'm6', projectId: 'p1', senderId: 'u1', senderName: 'Nguyễn Minh Khoa', senderAvatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh+Khoa&background=4F46E5&color=fff&size=128', content: 'Em có nè chị Hà, để em gửi API key qua DM cho chị.', timestamp: '2024-12-16T10:10:00', replyTo: 'm5' },
    { id: 'm7', projectId: 'p1', senderId: 'u4', senderName: 'Phạm Thu Hà', senderAvatar: 'https://ui-avatars.com/api/?name=Pham+Thu+Ha&background=F59E0B&color=fff&size=128', content: 'Cảm ơn Khoa nhé, mình test lại liền.', timestamp: '2024-12-16T10:15:00', replyTo: 'm6' },
    { id: 'm8', projectId: 'p1', senderId: 'u3', senderName: 'Lê Văn Tú', senderAvatar: 'https://ui-avatars.com/api/?name=Le+Van+Tu&background=10B981&color=fff&size=128', content: 'Cuối tuần này team mình họp sync một chút không? Xem tiến độ chung đến đâu rồi.', timestamp: '2024-12-20T14:00:00', replyTo: null },
    { id: 'm9', projectId: 'p1', senderId: 'u2', senderName: 'Trần Thị Lan', senderAvatar: 'https://ui-avatars.com/api/?name=Tran+Thi+Lan&background=06B6D4&color=fff&size=128', content: 'Chủ nhật 8h tối được không mng?', timestamp: '2024-12-20T14:30:00', replyTo: 'm8' },
    { id: 'm10', projectId: 'p1', senderId: 'u1', senderName: 'Nguyễn Minh Khoa', senderAvatar: 'https://ui-avatars.com/api/?name=Nguyen+Minh+Khoa&background=4F46E5&color=fff&size=128', content: 'Chốt nha chị, em sẽ gửi Google Meet link.', timestamp: '2024-12-20T14:45:00', replyTo: 'm9' }
  ],
  portfolio: {}
};

/**
 * Opt-in developer/mock utility to seed demo data into localStorage.
 * IMPORTANT:
 * - Does NOT execute automatically on file load.
 * - NEVER creates or overwrites `ph_current_user` so real Supabase auth sessions are never affected.
 */
function seedDemoData(force = false) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (!force && localStorage.getItem('projecthub_seeded')) return;
  
  localStorage.setItem('ph_users', JSON.stringify(DEMO_DATA.users));
  localStorage.setItem('ph_projects', JSON.stringify(DEMO_DATA.projects));
  localStorage.setItem('ph_tasks', JSON.stringify(DEMO_DATA.tasks));
  localStorage.setItem('ph_notifications', JSON.stringify(DEMO_DATA.notifications));
  localStorage.setItem('ph_messages', JSON.stringify(DEMO_DATA.messages));
  
  // NOTE: ph_current_user is intentionally omitted to preserve real Supabase authentication
  localStorage.setItem('projecthub_seeded', 'true');
  console.log('[DemoData] Demo collections seeded to localStorage (mock data only; auth untouched).');
}

// Export strictly as opt-in helper for development/testing
if (typeof window !== 'undefined') {
  window.DEMO_DATA = DEMO_DATA;
  window.seedDemoData = seedDemoData;
}
