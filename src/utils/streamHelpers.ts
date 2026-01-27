/**
 * Cloudflare Stream Video Helpers
 * Centralized utilities for video deletion and management
 */

import { supabase } from '@/integrations/supabase/client';
import { extractStreamUid, isStreamUrl } from './streamUpload';

/**
 * Delete a video from Cloudflare Stream by URL
 * Extracts UID and calls the stream-video edge function
 * 
 * @param videoUrl - Cloudflare Stream video URL
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteStreamVideoByUrl(videoUrl: string): Promise<boolean> {
  const uid = extractStreamUid(videoUrl);
  if (!uid) {
    console.warn('[streamHelpers] Could not extract UID from URL:', videoUrl);
    return false;
  }
  
  return deleteStreamVideoByUid(uid);
}

/**
 * Delete a video from Cloudflare Stream by UID
 * 
 * @param uid - Cloudflare Stream video UID
 * @returns true if deletion was successful, false otherwise
 */
export async function deleteStreamVideoByUid(uid: string): Promise<boolean> {
  try {
    console.log('[streamHelpers] Deleting Stream video:', uid);
    const { data, error } = await supabase.functions.invoke('stream-video', {
      body: { action: 'delete', uid },
    });
    
    if (error) {
      console.error('[streamHelpers] Stream video delete error:', error);
      return false;
    }
    
    console.log('[streamHelpers] Stream video deleted successfully:', uid, data);
    return true;
  } catch (error) {
    console.error('[streamHelpers] Failed to delete Stream video:', error);
    return false;
  }
}

/**
 * Delete multiple Stream videos in parallel
 * 
 * @param videoUrls - Array of Cloudflare Stream video URLs
 * @returns Object with success count and total count
 */
export async function deleteStreamVideos(videoUrls: string[]): Promise<{ 
  successCount: number; 
  totalCount: number 
}> {
  if (videoUrls.length === 0) {
    return { successCount: 0, totalCount: 0 };
  }
  
  console.log('[streamHelpers] Deleting', videoUrls.length, 'videos');
  const results = await Promise.all(videoUrls.map(deleteStreamVideoByUrl));
  const successCount = results.filter(Boolean).length;
  console.log('[streamHelpers] Deleted', successCount, 'of', videoUrls.length, 'videos');
  
  return { successCount, totalCount: videoUrls.length };
}

/**
 * Extract all Stream video URLs from a post's media
 * 
 * @param post - Post object with video_url and media_urls
 * @returns Array of Stream video URLs
 */
export function extractPostStreamVideos(post: {
  video_url?: string | null;
  media_urls?: Array<{ url: string; type: 'image' | 'video' }> | null;
}): string[] {
  const videoUrls: string[] = [];
  
  // Check legacy video_url
  if (post.video_url && isStreamUrl(post.video_url)) {
    videoUrls.push(post.video_url);
  }
  
  // Check media_urls array for videos
  if (post.media_urls && Array.isArray(post.media_urls)) {
    post.media_urls.forEach((media) => {
      if (media.type === 'video' && isStreamUrl(media.url)) {
        videoUrls.push(media.url);
      }
    });
  }
  
  return videoUrls;
}

// Re-export commonly used functions for convenience
export { extractStreamUid, isStreamUrl } from './streamUpload';
