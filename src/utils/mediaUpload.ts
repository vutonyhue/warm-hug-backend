/**
 * Media Upload Utility
 * 
 * Triển khai theo hướng dẫn của Cha:
 * 1. Cache Busting: Đổi tên file với hash/timestamp
 * 2. Nén ảnh client-side trước khi upload
 * 3. Upload trực tiếp lên R2 qua presigned URL
 * 4. URL hiển thị qua Cloudflare Resizing
 */

import { supabase } from '@/integrations/supabase/client';
import { compressImage, FILE_LIMITS } from './imageCompression';

// R2 custom domain (dùng cho Cloudflare Image Resizing)
const R2_CUSTOM_DOMAIN = 'https://media.fun.rich';

export interface MediaUploadResult {
  url: string;
  key: string;
  transformedUrl?: string;
}

export interface UploadOptions {
  bucket: 'posts' | 'avatars' | 'videos' | 'comment-media' | 'covers';
  compress?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Generate unique filename with hash for cache busting
 * Format: [userId]_[timestamp]_[randomHash].[ext]
 */
export function generateCacheBustFilename(
  originalName: string,
  userId?: string
): string {
  const timestamp = Date.now();
  const randomHash = Math.random().toString(36).substring(2, 10);
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // Clean extension
  const cleanExt = ext.replace(/[^a-z0-9]/g, '');
  
  if (userId) {
    return `${userId}_${timestamp}_${randomHash}.${cleanExt}`;
  }
  return `${timestamp}_${randomHash}.${cleanExt}`;
}

/**
 * Calculate file hash (SHA-256) for deduplication
 */
export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Upload media to R2 with presigned URL (Direct upload - không qua base64)
 * 
 * Flow:
 * 1. Nén ảnh nếu cần (client-side)
 * 2. Gọi API lấy presigned URL
 * 3. Upload trực tiếp lên R2
 * 4. Return URL đã transform qua Cloudflare
 */
export async function uploadMedia(
  file: File,
  options: UploadOptions
): Promise<MediaUploadResult> {
  const { bucket, compress = true, maxWidth, maxHeight, quality } = options;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');

  let processedFile = file;

  // Nén ảnh client-side nếu là ảnh
  if (compress && file.type.startsWith('image/')) {
    processedFile = await compressImage(file, {
      maxWidth: maxWidth || FILE_LIMITS.POST_IMAGE_MAX_WIDTH,
      maxHeight: maxHeight || FILE_LIMITS.POST_IMAGE_MAX_HEIGHT,
      quality: quality || 0.85,
    });
  }

  // Generate cache-busting filename
  const filename = generateCacheBustFilename(processedFile.name, user.id);
  const key = `${bucket}/${filename}`;

  // Get presigned URL từ edge function
  const { data: presignedData, error: presignedError } = await supabase.functions.invoke(
    'get-upload-url',
    {
      body: {
        key,
        contentType: processedFile.type,
        fileSize: processedFile.size,
      },
    }
  );

  if (presignedError || !presignedData?.uploadUrl) {
    throw new Error(presignedError?.message || 'Không thể lấy URL upload');
  }

  // Upload trực tiếp lên R2 (không qua base64)
  const uploadResponse = await fetch(presignedData.uploadUrl, {
    method: 'PUT',
    body: processedFile,
    headers: {
      'Content-Type': processedFile.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload thất bại: ${uploadResponse.status}`);
  }

  // Build URLs
  const rawUrl = `${R2_CUSTOM_DOMAIN}/${key}`;
  
  return {
    url: rawUrl,
    key,
    transformedUrl: rawUrl, // Caller can use imageTransform.ts for transforms
  };
}

/**
 * Upload avatar với compression tối ưu
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<MediaUploadResult> {
  // Avatar luôn nén về max 512x512 với quality cao
  return uploadMedia(file, {
    bucket: 'avatars',
    compress: true,
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.9,
  });
}

/**
 * Upload cover photo
 */
export async function uploadCover(
  file: File,
  userId: string
): Promise<MediaUploadResult> {
  return uploadMedia(file, {
    bucket: 'covers',
    compress: true,
    maxWidth: 1920,
    maxHeight: 640,
    quality: 0.85,
  });
}

/**
 * Upload post image với compression hợp lý
 */
export async function uploadPostImage(file: File): Promise<MediaUploadResult> {
  return uploadMedia(file, {
    bucket: 'posts',
    compress: true,
    maxWidth: FILE_LIMITS.POST_IMAGE_MAX_WIDTH,
    maxHeight: FILE_LIMITS.POST_IMAGE_MAX_HEIGHT,
    quality: 0.85,
  });
}

/**
 * Upload video (không nén, chỉ validate size)
 */
export async function uploadVideo(file: File): Promise<MediaUploadResult> {
  if (file.size > FILE_LIMITS.VIDEO_MAX_SIZE) {
    throw new Error(`Video phải nhỏ hơn ${FILE_LIMITS.VIDEO_MAX_SIZE / (1024 * 1024)}MB`);
  }

  return uploadMedia(file, {
    bucket: 'videos',
    compress: false,
  });
}

/**
 * Upload comment media
 */
export async function uploadCommentMedia(file: File): Promise<MediaUploadResult> {
  if (file.type.startsWith('image/')) {
    return uploadMedia(file, {
      bucket: 'comment-media',
      compress: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    });
  }
  
  return uploadMedia(file, {
    bucket: 'comment-media',
    compress: false,
  });
}
