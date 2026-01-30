/**
 * Media Configuration Constants
 * Tập trung quản lý URLs để dễ thay đổi
 */

// R2 custom domain for Cloudflare Image Resizing
export const MEDIA_BASE_URL = 'https://media-funprofile.funecosystem.org';

// Các bucket paths
export const MEDIA_PATHS = {
  posts: 'posts',
  avatars: 'avatars',
  covers: 'covers',
  videos: 'videos',
  commentMedia: 'comment-media',
} as const;

/**
 * Build full URL từ media key
 * Backward compatible: nếu đã là full URL, trả về nguyên vẹn
 */
export function getMediaUrl(key: string | null | undefined): string {
  if (!key) return '/placeholder.svg';
  
  // Nếu đã là full URL, trả về nguyên vẹn (backward compatible với bài viết cũ)
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  
  // Build full URL từ key
  return `${MEDIA_BASE_URL}/${key}`;
}

/**
 * Extract key từ URL (nếu cần migrate hoặc normalize)
 */
export function extractMediaKey(url: string | null | undefined): string {
  if (!url) return '';
  
  // Nếu đã là key (không phải URL), trả về nguyên vẹn
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  
  try {
    const u = new URL(url);
    // Loại bỏ leading slash
    return u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
  } catch {
    return url; // Nếu không parse được, giả sử đã là key
  }
}

/**
 * Check if a string is a media key (not a full URL)
 */
export function isMediaKey(value: string | null | undefined): boolean {
  if (!value) return false;
  return !value.startsWith('http://') && !value.startsWith('https://');
}
