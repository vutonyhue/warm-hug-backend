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
 * Check if a URL is a legacy Cloudflare Stream video URL
 * Stream videos use videodelivery.net or cloudflarestream.com domains
 * These are kept for backward compatibility with old posts
 */
export function isCloudflareStreamUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('videodelivery.net') || url.includes('cloudflarestream.com');
}

/**
 * Build full URL từ media key
 * Backward compatible: nếu đã là full URL, trả về nguyên vẹn
 * Stream URLs: trả về nguyên vẹn (legacy support)
 */
export function getMediaUrl(key: string | null | undefined): string {
  if (!key) return '/placeholder.svg';
  
  // Nếu là Cloudflare Stream URL (legacy), trả về nguyên vẹn
  if (isCloudflareStreamUrl(key)) {
    return key;
  }
  
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
  
  // Skip legacy Stream URLs - they don't have extractable keys for R2
  if (isCloudflareStreamUrl(url)) {
    return '';
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
