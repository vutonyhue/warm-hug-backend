import { supabase } from '@/integrations/supabase/client';

export interface R2UploadResult {
  url: string;
  key: string;
}

/**
 * Get presigned URL from edge function with timeout and retry on 401
 */
async function getPresignedUrl(
  key: string,
  contentType: string,
  fileSize: number,
  accessToken?: string,
  timeoutMs: number = 30000,
  retryCount = 0
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use provided token or get fresh one
    let token = accessToken;
    if (!token) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Chưa đăng nhập');
      }
      token = session.access_token;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/get-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ key, contentType, fileSize }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // If 401 Unauthorized and haven't retried yet, try refreshing token
      if (response.status === 401 && retryCount === 0) {
        console.log('[R2Upload] Token expired (401), refreshing and retrying...');
        clearTimeout(timeoutId);
        
        const { data: { session: newSession } } = await supabase.auth.refreshSession();
        if (newSession) {
          return getPresignedUrl(key, contentType, fileSize, newSession.access_token, timeoutMs, 1);
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.uploadUrl || !data.publicUrl) {
      throw new Error('Invalid response from server');
    }

    return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Upload file directly to R2 using presigned URL
 */
async function uploadWithPresignedUrl(
  file: File,
  uploadUrl: string,
  timeoutMs: number = 120000
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Upload file directly to Cloudflare R2 via presigned URL
 * Much more efficient than base64 - supports large files
 * @param accessToken Optional access token to avoid multiple getSession calls
 */
export async function uploadToR2(
  file: File,
  bucket: 'posts' | 'avatars' | 'videos' | 'comment-media',
  customPath?: string,
  accessToken?: string
): Promise<R2UploadResult> {
  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = file.name.split('.').pop();
  const filename = customPath || `${timestamp}-${randomString}.${extension}`;
  const key = `${bucket}/${filename}`;

  // Step 1: Get presigned URL from edge function
  const { uploadUrl, publicUrl } = await getPresignedUrl(
    key,
    file.type,
    file.size,
    accessToken,
    45000 // 45s timeout for getting URL (increased)
  );

  // Step 2: Upload directly to R2 using presigned URL
  await uploadWithPresignedUrl(
    file,
    uploadUrl,
    180000 // 3 min timeout for upload (large files)
  );

  return {
    url: publicUrl,
    key: key,
  };
}

/**
 * Delete file from Cloudflare R2 via edge function
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-from-r2', {
      body: { key },
    });

    if (error) throw error;
  } catch (error) {
    throw error;
  }
}
