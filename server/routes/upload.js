/**
 * routes/upload.js — Image upload endpoint
 * Upload flow: Frontend → Express → Cloudinary → trả URL → Frontend lưu URL vào Supabase
 * KHÔNG lưu binary vào PostgreSQL
 */
'use strict';

const path     = require('path');
const fs       = require('fs');
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const cloudinaryService = require('../services/cloudinaryService');
const { requireAuth, getSupabaseAdmin } = require('../middleware/auth');

// Lưu file tạm vào memory (không ghi disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB max
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    if (!allowedExts.includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Chỉ hỗ trợ file ảnh: JPEG, PNG, WebP, GIF.'));
    }
    cb(null, true);
  },
});

// Helper xử lý multer single file với các tên trường có thể có (avatar, image, cover)
function singleUpload(fieldNames) {
  const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  return (req, res, next) => {
    upload.fields(fields.map(f => ({ name: f, maxCount: 1 })))(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File quá lớn. Tối đa 5MB.' });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      // Gán req.file từ file đầu tiên tìm thấy
      if (req.files) {
        for (const field of fields) {
          if (req.files[field] && req.files[field][0]) {
            req.file = req.files[field][0];
            break;
          }
        }
      }
      next();
    });
  };
}

// Helper upload trực tiếp lên Supabase Storage bucket
async function uploadToSupabaseStorage(bucket, filename, buffer, contentType) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: contentType || 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return publicData.publicUrl;
}

// Helper lưu file local khi cả Supabase Storage và Cloudinary đều lỗi
async function saveLocalUpload(subfolder, filename, buffer) {
  const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', subfolder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/${subfolder}/${filename}`;
}

/**
 * POST /api/upload/avatar
 * Body: multipart/form-data với field "avatar" hoặc "image"
 * Auth: Required
 * Response: { url: string, public_id: string }
 */
router.post('/avatar', requireAuth, singleUpload(['avatar', 'image']), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file ảnh được upload.' });
  }

  const ext = path.extname(req.file.originalname || '.png').toLowerCase() || '.png';
  const filename = `avatar-${req.user.id}-${Date.now()}${ext}`;

  // 1. ƯU TIÊN SỐ 1: Tải trực tiếp lên Supabase Storage (Bucket 'avatars')
  try {
    const uploadedUrl = await uploadToSupabaseStorage('avatars', filename, req.file.buffer, req.file.mimetype);

    // Đồng bộ trực tiếp vào Supabase profiles và auth.users
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('profiles')
        .update({ avatar_url: uploadedUrl, updated_at: new Date().toISOString() })
        .eq('id', req.user.id);
      await supabase.auth.admin.updateUserById(req.user.id, {
        user_metadata: { avatar_url: uploadedUrl }
      });
    } catch (dbErr) {
      console.warn('[Upload] Đồng bộ Supabase avatar vào DB cảnh báo:', dbErr.message);
    }

    return res.json({
      url: uploadedUrl,
      public_id: `supabase_avatars_${filename}`,
    });
  } catch (supabaseErr) {
    console.warn('[Upload] Supabase Storage avatar upload thất bại, thử Cloudinary/Local:', supabaseErr.message);
  }

  // 2. Thử Cloudinary nếu đã cấu hình
  if (cloudinaryService.isConfigured()) {
    try {
      const result = await cloudinaryService.uploadAvatar(req.file.buffer, req.user.id);
      
      // Đồng bộ ngay vào Supabase DB với service_role
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('profiles')
          .update({ avatar_url: result.secure_url, updated_at: new Date().toISOString() })
          .eq('id', req.user.id);
        await supabase.auth.admin.updateUserById(req.user.id, {
          user_metadata: { avatar_url: result.secure_url }
        });
      } catch (dbErr) {
        console.warn('[Upload] Đồng bộ Cloudinary avatar vào DB cảnh báo:', dbErr.message);
      }

      return res.json({
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (uploadErr) {
      console.warn('[Upload] Cloudinary upload thất bại, tự động chuyển sang local storage:', uploadErr.message);
    }
  }

  // 3. Local storage fallback an toàn
  try {
    const uploadedUrl = await saveLocalUpload('avatars', filename, req.file.buffer);

    // Đồng bộ trực tiếp vào Supabase profiles và auth.users
    try {
      const supabase = getSupabaseAdmin();
      await supabase
        .from('profiles')
        .update({ avatar_url: uploadedUrl, updated_at: new Date().toISOString() })
        .eq('id', req.user.id);
      await supabase.auth.admin.updateUserById(req.user.id, {
        user_metadata: { avatar_url: uploadedUrl }
      });
    } catch (dbErr) {
      console.warn('[Upload] Đồng bộ Local avatar vào DB cảnh báo:', dbErr.message);
    }

    return res.json({
      url: uploadedUrl,
      public_id: `local_${filename}`,
    });
  } catch (err) {
    console.error('[Upload] Lỗi lưu avatar local:', err);
    return res.status(500).json({
      error: 'Lỗi khi lưu ảnh đại diện trên máy chủ: ' + err.message
    });
  }
});

/**
 * POST /api/upload/project-image
 * Body: multipart/form-data với field "image" hoặc "cover", optional "projectId" hoặc "project_id"
 * Auth: Required
 * Response: { url: string, public_id: string }
 */
router.post('/project-image', requireAuth, singleUpload(['image', 'cover']), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file ảnh được upload.' });
  }

  const projectId = req.body.projectId || req.body.project_id || req.query.projectId || req.query.project_id;

  // Nếu projectId được cung cấp, xác minh quyền sở hữu dự án
  if (projectId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      return res.status(400).json({ error: 'projectId không hợp lệ.' });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { data: project, error: pErr } = await supabase
        .from('projects')
        .select('id, owner_id')
        .eq('id', projectId)
        .maybeSingle();

      if (pErr) {
        return res.status(500).json({ error: 'Lỗi khi kiểm tra quyền sở hữu dự án.' });
      }

      if (project && project.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Bạn không có quyền cập nhật ảnh bìa của dự án này.' });
      }
    } catch (dbErr) {
      return res.status(500).json({ error: 'Lỗi kết nối cơ sở dữ liệu.' });
    }
  }

  const ext = path.extname(req.file.originalname || '.png').toLowerCase() || '.png';
  const filename = `project-${projectId || req.user.id}-${Date.now()}${ext}`;

  // 1. ƯU TIÊN SỐ 1: Tải trực tiếp lên Supabase Storage (Bucket 'projects')
  try {
    const uploadedUrl = await uploadToSupabaseStorage('projects', filename, req.file.buffer, req.file.mimetype);

    if (projectId) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('projects')
          .update({ image_url: uploadedUrl, updated_at: new Date().toISOString() })
          .eq('id', projectId);
      } catch (dbErr) {
        console.warn('[Upload] DB sync Supabase project cover error:', dbErr.message);
      }
    }

    return res.json({
      url: uploadedUrl,
      public_id: `supabase_projects_${filename}`,
    });
  } catch (supabaseErr) {
    console.warn('[Upload] Supabase project cover upload thất bại, thử Cloudinary/Local:', supabaseErr.message);
  }

  // 2. Thử Cloudinary nếu đã cấu hình
  if (cloudinaryService.isConfigured()) {
    try {
      const result = await cloudinaryService.uploadProjectCover(req.file.buffer, {
        projectId,
        userId: req.user.id,
      });

      if (projectId) {
        try {
          const supabase = getSupabaseAdmin();
          await supabase
            .from('projects')
            .update({ image_url: result.secure_url, updated_at: new Date().toISOString() })
            .eq('id', projectId);
        } catch (dbErr) {
          console.warn('[Upload] DB sync project cover error:', dbErr.message);
        }
      }

      return res.json({
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (uploadErr) {
      console.warn('[Upload] Cloudinary project cover upload thất bại, chuyển local fallback:', uploadErr.message);
    }
  }

  // 3. Local fallback
  try {
    const uploadedUrl = await saveLocalUpload('projects', filename, req.file.buffer);

    if (projectId) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('projects')
          .update({ image_url: uploadedUrl, updated_at: new Date().toISOString() })
          .eq('id', projectId);
      } catch (dbErr) {
        console.warn('[Upload] DB sync local project cover error:', dbErr.message);
      }
    }

    return res.json({
      url: uploadedUrl,
      public_id: `local_${filename}`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi lưu ảnh dự án: ' + err.message });
  }
});

/**
 * POST /api/upload/image (Backward compatibility)
 * Body: multipart/form-data với field "image"
 * Query: ?type=avatar|project|portfolio
 * Auth: Required
 * Response: { url: string, public_id: string }
 */
router.post('/image', requireAuth, singleUpload(['image']), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Không có file được upload.' });
  }

  const type = ['avatar', 'project', 'portfolio'].includes(req.query.type)
    ? req.query.type
    : 'general';
  const bucket = type === 'avatar' ? 'avatars' : 'projects';
  const ext = path.extname(req.file.originalname || '.png').toLowerCase() || '.png';
  const filename = `${type}-${req.user.id}-${Date.now()}${ext}`;

  // 1. Thử Supabase Storage (Ưu tiên)
  try {
    const uploadedUrl = await uploadToSupabaseStorage(bucket, filename, req.file.buffer, req.file.mimetype);
    return res.json({
      url: uploadedUrl,
      public_id: `supabase_${bucket}_${filename}`,
    });
  } catch (supabaseErr) {
    console.warn('[Upload] Supabase image upload thất bại:', supabaseErr.message);
  }

  // 2. Thử Cloudinary
  if (cloudinaryService.isConfigured()) {
    try {
      const result = await cloudinaryService.uploadImage(req.file.buffer, {
        folder: `projecthub/${type}`,
        userId: req.user.id,
      });

      return res.json({
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (uploadErr) {
      console.warn('[Upload] Cloudinary image failed, fallback local:', uploadErr.message);
    }
  }

  // 3. Local fallback
  try {
    const uploadedUrl = await saveLocalUpload(type, filename, req.file.buffer);
    return res.json({
      url: uploadedUrl,
      public_id: `local_${filename}`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi lưu ảnh: ' + err.message });
  }
});

/**
 * DELETE /api/upload/image
 * Body: { public_id: string }
 * Xóa ảnh
 */
router.delete('/image', requireAuth, async (req, res) => {
  try {
    const public_id = req.body?.public_id;
    if (!public_id || typeof public_id !== 'string') {
      return res.status(400).json({ error: 'Thiếu public_id.' });
    }

    if (public_id.startsWith('supabase_')) {
      const parts = public_id.split('_');
      const bucket = parts[1] || 'projects';
      const filename = parts.slice(2).join('_');
      try {
        const supabase = getSupabaseAdmin();
        await supabase.storage.from(bucket).remove([filename]);
      } catch (delErr) {
        console.warn('[Upload] Supabase storage delete warning:', delErr.message);
      }
      return res.json({ success: true });
    }

    if (public_id.startsWith('local_')) {
      return res.json({ success: true });
    }

    if (!public_id.startsWith('projecthub/')) {
      return res.status(403).json({ error: 'Không có quyền xóa ảnh này.' });
    }

    if (cloudinaryService.isConfigured()) {
      await cloudinaryService.deleteImage(public_id);
    }
    res.json({ success: true });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Lỗi khi xóa ảnh.'
    });
  }
});

module.exports = router;
