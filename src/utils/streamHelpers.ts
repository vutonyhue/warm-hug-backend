/**
 * Video Helpers (R2 based)
 * Centralized utilities for video deletion and management
 */

import { supabase } from '@/integrations/supabase/client';
import { extractMediaKey, isMediaKey } from '@/config/media';

/**
 * Check if URL is a video URL (R2 or legacy Stream)
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  // R2 videos
  if (url.includes('/videos/') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')) {
    return true;
  }
  // Legacy Cloudflare Stream URLs (backward compatible)
  if (url.includes('videodelivery.net') || url.includes('cloudflarestream.com')) {
    return true;
  }
  return false;
}

/**
 * Check if URL is a legacy Cloudflare Stream URL
 */
export function isStreamUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('videodelivery.net') || url.includes('cloudflarestream.com');
}

/**
 * Extract video UID from legacy Cloudflare Stream URL (for backward compatibility)
 */
export function extractStreamUid(url: string): string | null {
  const patterns = [
    /videodelivery\.net\/([a-f0-9]{32})/i,
    /cloudflarestream\.com\/([a-f0-9]{32})/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Delete a video from R2 by URL or key
 * 
 * @param videoUrl - R2 video URL or key
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteVideoByUrl(videoUrl: string): Promise<boolean> {
  // Skip legacy Stream URLs - they can't be deleted via R2
  if (isStreamUrl(videoUrl)) {
    console.warn('[videoHelpers] Cannot delete legacy Stream URL via R2:', videoUrl);
    return false;
  }

  const key = extractMediaKey(videoUrl);
  if (!key) {
    console.warn('[videoHelpers] Could not extract key from URL:', videoUrl);
    return false;
  }
  
  return deleteVideoByKey(key);
}

/**
 * Delete a video from R2 by key
 * 
 * @param key - R2 object key (e.g., videos/timestamp-random.mp4)
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteVideoByKey(key: string): Promise<boolean> {
  try {
    console.log('[videoHelpers] Deleting R2 video:', key);
    const { error } = await supabase.functions.invoke('delete-from-r2', {
      body: { key },
    });
    
    if (error) {
      console.error('[videoHelpers] R2 video delete error:', error);
      return false;
    }
    
    console.log('[videoHelpers] R2 video deleted successfully:', key);
    return true;
  } catch (error) {
    console.error('[videoHelpers] Failed to delete R2 video:', error);
    return false;
  }
}

/**
 * Delete multiple videos in parallel
 * 
 * @param videoUrls - Array of video URLs (R2 or legacy Stream)
 * @returns Object with success count and total count
 */
export async function deleteVideos(videoUrls: string[]): Promise<{ 
  successCount: number; 
  totalCount: number 
}> {
  if (videoUrls.length === 0) {
    return { successCount: 0, totalCount: 0 };
  }
  
  // Filter out legacy Stream URLs
  const r2Videos = videoUrls.filter(url => !isStreamUrl(url));
  const streamVideos = videoUrls.filter(url => isStreamUrl(url));
  
  if (streamVideos.length > 0) {
    console.warn('[videoHelpers] Skipping', streamVideos.length, 'legacy Stream videos');
  }
  
  console.log('[videoHelpers] Deleting', r2Videos.length, 'R2 videos');
  const results = await Promise.all(r2Videos.map(deleteVideoByUrl));
  const successCount = results.filter(Boolean).length;
  console.log('[videoHelpers] Deleted', successCount, 'of', r2Videos.length, 'videos');
  
  return { successCount, totalCount: r2Videos.length };
}

/**
 * Extract all video URLs from a post's media
 * 
 * @param post - Post object with video_url and media_urls
 * @returns Array of video URLs
 */
export function extractPostVideos(post: {
  video_url?: string | null;
  media_urls?: Array<{ url: string; type: 'image' | 'video' }> | null;
}): string[] {
  const videoUrls: string[] = [];
  
  // Check legacy video_url
  if (post.video_url && isVideoUrl(post.video_url)) {
    videoUrls.push(post.video_url);
  }
  
  // Check media_urls array for videos
  if (post.media_urls && Array.isArray(post.media_urls)) {
    post.media_urls.forEach((media) => {
      if (media.type === 'video' && isVideoUrl(media.url)) {
        videoUrls.push(media.url);
      }
    });
  }
  
  return videoUrls;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
