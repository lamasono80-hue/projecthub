/**
 * services/cloudinaryService.js — Cloudinary Image Upload
 * API key chỉ đọc từ process.env — KHÔNG hardcode
 */
'use strict';

let cloudinaryConfigured = false;

function isConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return false;
  if (
    cloudName.trim().length === 0 ||
    apiKey.trim().length === 0 ||
    apiSecret.trim().length === 0 ||
    cloudName.includes('your-cloud-name') ||
    apiKey.includes('your-cloudinary-api-key') ||
    apiSecret.includes('your-cloudinary-api-secret')
  ) {
    return false;
  }
  return true;
}

function ensureConfigured() {
  if (!cloudinaryConfigured) {
    if (!isConfigured()) {
      const err = new Error('Dịch vụ Cloudinary chưa được cấu hình đầy đủ trong .env. Cần có CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET hợp lệ.');
      err.code = 'CLOUDINARY_NOT_CONFIGURED';
      err.status = 503;
      throw err;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME.trim();
    const apiKey    = process.env.CLOUDINARY_API_KEY.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET.trim();

    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    cloudinaryConfigured = true;
  }
}

/**
 * Upload buffer lên Cloudinary
 * @param {Buffer} buffer - File buffer từ multer memoryStorage
 * @param {{ folder: string, userId: string, transformation?: Array }} options
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
async function uploadImage(buffer, { folder, userId, transformation } = {}) {
  ensureConfigured();
  const cloudinary = require('cloudinary').v2;

  const defaultTransformation = [
    { width: 1200, height: 1200, crop: 'limit' },
    { quality: 'auto:good' },
    { fetch_format: 'auto' },
  ];

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder || 'projecthub/general',
        public_id: `${userId || 'anon'}_${Date.now()}`,
        overwrite: true,
        transformation: transformation || defaultTransformation,
      },
      (error, result) => {
        if (error) {
          const err = new Error('Lỗi khi tải ảnh lên Cloudinary: ' + (error.message || 'Unknown error'));
          err.status = 502;
          return reject(err);
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload Avatar (tối ưu hóa 400x400, crop fill với trọng tâm khuôn mặt, auto format)
 */
async function uploadAvatar(buffer, userId) {
  return uploadImage(buffer, {
    folder: `projecthub/avatars/${userId}`,
    userId,
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
  });
}

/**
 * Upload Project Cover Image (1200x630 crop limit, auto format)
 */
async function uploadProjectCover(buffer, { projectId, userId }) {
  return uploadImage(buffer, {
    folder: `projecthub/projects/${projectId || userId}`,
    userId,
    transformation: [
      { width: 1200, height: 630, crop: 'limit' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
  });
}

/**
 * Xóa ảnh khỏi Cloudinary
 * @param {string} publicId
 */
async function deleteImage(publicId) {
  ensureConfigured();
  const cloudinary = require('cloudinary').v2;
  return cloudinary.uploader.destroy(publicId);
}

module.exports = {
  uploadImage,
  uploadAvatar,
  uploadProjectCover,
  deleteImage,
  isConfigured,
};
