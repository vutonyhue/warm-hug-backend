import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Video, X, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { deleteVideoByKey } from '@/utils/streamHelpers';
import { getMediaUrl } from '@/config/media';

interface VideoUploaderUppyProps {
  onUploadComplete: (result: { key: string; url: string; thumbnailUrl: string; localThumbnail?: string }) => void;
  onUploadError?: (error: Error) => void;
  onUploadStart?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  selectedFile?: File | null;
}

interface UploadState {
  status: 'idle' | 'preparing' | 'uploading' | 'processing' | 'ready' | 'error';
  progress: number;
  bytesUploaded: number;
  bytesTotal: number;
  uploadSpeed: number;
  videoKey?: string;
  error?: string;
  localThumbnail?: string;
}

// Debug timeline for troubleshooting
interface DebugTimeline {
  fileSelected?: number;
  preparingStarted?: number;
  invokeStarted?: number;
  invokeFinished?: number;
  invokeError?: string;
  uploadStarted?: number;
  firstProgress?: number;
  lastStep: string;
}

const BACKEND_TIMEOUT_MS = 45000; // 45 seconds timeout for getting presigned URL

/**
 * Generate a thumbnail from video file using canvas
 */
const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    const cleanup = () => {
      URL.revokeObjectURL(video.src);
    };
    
    video.onloadeddata = () => {
      // Seek to 1 second or 25% of video, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.25);
    };
    
    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);
      const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
      cleanup();
      resolve(thumbnailUrl);
    };
    
    video.onerror = () => {
      cleanup();
      reject(new Error('Cannot generate thumbnail from video'));
    };
    
    // Timeout fallback
    setTimeout(() => {
      if (!canvas.width) {
        cleanup();
        reject(new Error('Thumbnail generation timeout'));
      }
    }, 10000);
    
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Get presigned URL from edge function
 */
async function getPresignedUrl(
  key: string,
  contentType: string,
  fileSize: number,
  timeoutMs: number = BACKEND_TIMEOUT_MS
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    
    if (!accessToken) {
      throw new Error('Chưa đăng nhập');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/get-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ key, contentType, fileSize }),
      signal: controller.signal,
    });

    if (!response.ok) {
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
 * Upload video directly to R2 with progress tracking
 */
async function uploadToR2WithProgress(
  file: File,
  uploadUrl: string,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed - network error'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });
    
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

export const VideoUploaderUppy = ({
  onUploadComplete,
  onUploadError,
  onUploadStart,
  onRemove,
  disabled = false,
  selectedFile,
}: VideoUploaderUppyProps) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    bytesUploaded: 0,
    bytesTotal: 0,
    uploadSpeed: 0,
  });

  const [debugTimeline, setDebugTimeline] = useState<DebugTimeline>({ lastStep: 'idle' });
  const [showDebug, setShowDebug] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const isUploadingRef = useRef(false);
  const localThumbnailRef = useRef<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track the file being uploaded to prevent duplicate uploads
  const currentFileRef = useRef<string | null>(null);
  const uploadStartedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Update elapsed time every second during preparing/uploading
  useEffect(() => {
    if (uploadState.status !== 'preparing' && uploadState.status !== 'uploading') {
      return;
    }

    const interval = setInterval(() => {
      if (startTimeRef.current > 0) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [uploadState.status]);

  // Show debug panel automatically if stuck for 5+ seconds
  useEffect(() => {
    if (uploadState.status === 'preparing' && elapsedSeconds >= 5) {
      setShowDebug(true);
    }
    
    if (uploadState.status !== 'preparing') {
      setShowDebug(false);
    }
  }, [uploadState.status, elapsedSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      currentFileRef.current = null;
      uploadStartedRef.current = false;
    };
  }, []);

  // Warn user before leaving page during upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploadingRef.current) {
        e.preventDefault();
        e.returnValue = 'Video đang được tải lên. Bạn có chắc muốn rời đi?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Test backend health
  const testBackendHealth = useCallback(async () => {
    setBackendHealthy(null);
    console.log('[VideoUploader] Testing backend health...');
    
    try {
      const startTime = Date.now();
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session) {
        setBackendHealthy(false);
        toast.error('Chưa đăng nhập');
        return;
      }
      
      const elapsed = Date.now() - startTime;
      console.log('[VideoUploader] Auth check OK:', elapsed, 'ms');
      setBackendHealthy(true);
      toast.success(`Auth OK (${elapsed}ms)`);
    } catch (err) {
      console.error('[VideoUploader] Health check failed:', err);
      setBackendHealthy(false);
      toast.error('Backend không phản hồi');
    }
  }, []);

  // Retry upload
  const handleRetry = useCallback(() => {
    if (!selectedFile) return;
    
    uploadStartedRef.current = false;
    currentFileRef.current = null;
    setDebugTimeline({ lastStep: 'retrying' });
    setElapsedSeconds(0);
    setUploadState({
      status: 'idle',
      progress: 0,
      bytesUploaded: 0,
      bytesTotal: 0,
      uploadSpeed: 0,
    });
    
    setTimeout(() => {
      setUploadState(prev => ({ ...prev }));
    }, 100);
  }, [selectedFile]);

  // Start upload when file is selected
  useEffect(() => {
    if (!selectedFile) return;

    const fileId = `${selectedFile.name}_${selectedFile.size}_${selectedFile.lastModified}`;
    
    if (currentFileRef.current === fileId && uploadStartedRef.current) {
      console.log('[VideoUploader] Upload already started for this file, skipping');
      return;
    }
    
    if (xhrRef.current && currentFileRef.current !== fileId) {
      console.log('[VideoUploader] Aborting previous upload');
      xhrRef.current.abort();
      xhrRef.current = null;
      isUploadingRef.current = false;
    }

    const startUpload = async () => {
      if (uploadStartedRef.current && currentFileRef.current === fileId) {
        return;
      }
      
      currentFileRef.current = fileId;
      uploadStartedRef.current = true;
      startTimeRef.current = Date.now();
      abortControllerRef.current = new AbortController();
      
      try {
        isUploadingRef.current = true;
        
        setDebugTimeline({
          fileSelected: Date.now(),
          preparingStarted: Date.now(),
          lastStep: 'preparing',
        });
        
        setUploadState({
          status: 'preparing',
          progress: 0,
          bytesUploaded: 0,
          bytesTotal: selectedFile.size,
          uploadSpeed: 0,
        });

        onUploadStart?.();

        console.log('[VideoUploader] Starting R2 upload, file:', fileId);

        // Generate local thumbnail in parallel
        generateVideoThumbnail(selectedFile)
          .then(thumb => {
            localThumbnailRef.current = thumb;
            setUploadState(prev => ({ ...prev, localThumbnail: thumb }));
            console.log('[VideoUploader] Local thumbnail generated');
          })
          .catch(err => {
            console.warn('[VideoUploader] Failed to generate local thumbnail:', err);
          });

        // Generate unique key for R2
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const extension = selectedFile.name.split('.').pop() || 'mp4';
        const key = `videos/${timestamp}-${randomString}.${extension}`;
        
        console.log('[VideoUploader] Requesting presigned URL for key:', key);
        
        setDebugTimeline(prev => ({
          ...prev,
          invokeStarted: Date.now(),
          lastStep: 'getting presigned URL',
        }));

        const { uploadUrl, publicUrl } = await getPresignedUrl(
          key,
          selectedFile.type,
          selectedFile.size,
          BACKEND_TIMEOUT_MS
        );

        const invokeTime = Date.now();
        
        setDebugTimeline(prev => ({
          ...prev,
          invokeFinished: invokeTime,
          lastStep: 'got presigned URL',
        }));

        console.log('[VideoUploader] Got presigned URL, starting upload');

        setUploadState(prev => ({
          ...prev,
          videoKey: key,
          status: 'uploading',
        }));

        setDebugTimeline(prev => ({
          ...prev,
          uploadStarted: Date.now(),
          lastStep: 'uploading to R2',
        }));

        // Upload directly to R2 with progress
        await uploadToR2WithProgress(
          selectedFile,
          uploadUrl,
          (loaded, total) => {
            const now = Date.now();
            const timeDiff = (now - lastTimeRef.current) / 1000;
            const bytesDiff = loaded - lastBytesRef.current;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

            lastBytesRef.current = loaded;
            lastTimeRef.current = now;

            const progress = Math.round((loaded / total) * 100);

            if (!debugTimeline.firstProgress) {
              console.log('[VideoUploader] First progress tick:', progress + '%');
              setDebugTimeline(prev => ({
                ...prev,
                firstProgress: Date.now(),
                lastStep: 'uploading',
              }));
            }

            setUploadState(prev => ({
              ...prev,
              progress,
              bytesUploaded: loaded,
              bytesTotal: total,
              uploadSpeed: speed > 0 ? speed : prev.uploadSpeed,
            }));
          }
        );

        console.log('[VideoUploader] Upload complete! Key:', key);

        // Build final URL
        const finalUrl = getMediaUrl(key);
        
        setUploadState(prev => ({
          ...prev,
          status: 'ready',
          progress: 100,
        }));

        setDebugTimeline(prev => ({
          ...prev,
          lastStep: 'ready',
        }));

        isUploadingRef.current = false;
        toast.success('Video đã tải lên thành công!');
        
        onUploadComplete({ 
          key, 
          url: finalUrl, 
          thumbnailUrl: localThumbnailRef.current || '',
          localThumbnail: localThumbnailRef.current 
        });

      } catch (error) {
        console.error('[VideoUploader] Error:', error);
        isUploadingRef.current = false;
        uploadStartedRef.current = false;
        currentFileRef.current = null;

        const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
        
        setDebugTimeline(prev => ({
          ...prev,
          invokeError: errorMessage,
          lastStep: `error: ${errorMessage}`,
        }));
        
        setUploadState(prev => ({
          ...prev,
          status: 'error',
          error: errorMessage,
        }));

        onUploadError?.(error instanceof Error ? error : new Error(errorMessage));
        toast.error(`Lỗi: ${errorMessage}`);
      }
    };

    startUpload();
  }, [selectedFile, onUploadComplete, onUploadError, onUploadStart, debugTimeline.firstProgress]);

  const handleCancel = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    
    isUploadingRef.current = false;
    uploadStartedRef.current = false;
    currentFileRef.current = null;
    
    // Clean up any partially uploaded video from R2
    const keyToDelete = uploadState.videoKey;
    if (keyToDelete) {
      console.log('[VideoUploader] Cleaning up cancelled upload:', keyToDelete);
      deleteVideoByKey(keyToDelete);
    }

    setUploadState({
      status: 'idle',
      progress: 0,
      bytesUploaded: 0,
      bytesTotal: 0,
      uploadSpeed: 0,
    });
    setDebugTimeline({ lastStep: 'cancelled' });
    setElapsedSeconds(0);
    onRemove?.();
  }, [onRemove, uploadState.videoKey]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getETA = (): string => {
    if (uploadState.uploadSpeed <= 0) return '--:--';
    const remaining = uploadState.bytesTotal - uploadState.bytesUploaded;
    const seconds = remaining / uploadState.uploadSpeed;
    return formatTime(seconds);
  };

  if (uploadState.status === 'idle' && !selectedFile) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-video-key={uploadState.videoKey}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          <span className="font-medium text-sm">Tải video lên</span>
          {elapsedSeconds > 0 && uploadState.status !== 'ready' && (
            <span className="text-xs text-muted-foreground">({elapsedSeconds}s)</span>
          )}
        </div>
        
        {uploadState.status !== 'ready' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={disabled}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Preparing state */}
      {uploadState.status === 'preparing' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang chuẩn bị... ({debugTimeline.lastStep})</span>
          </div>
          
          {showDebug && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Debug Timeline</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testBackendHealth}
                  className="h-6 text-xs gap-1"
                >
                  {backendHealthy === null ? (
                    <Wifi className="w-3 h-3" />
                  ) : backendHealthy ? (
                    <Wifi className="w-3 h-3 text-green-500" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-red-500" />
                  )}
                  Test Auth
                </Button>
              </div>
              
              <div className="space-y-1 font-mono">
                {debugTimeline.preparingStarted && (
                  <div>T0: Preparing started</div>
                )}
                {debugTimeline.invokeStarted && (
                  <div>T1: Getting presigned URL (+{debugTimeline.invokeStarted - (debugTimeline.preparingStarted || 0)}ms)</div>
                )}
                {debugTimeline.invokeFinished && (
                  <div className={debugTimeline.invokeError ? 'text-red-500' : 'text-green-500'}>
                    T2: Got URL (+{debugTimeline.invokeFinished - (debugTimeline.invokeStarted || 0)}ms)
                    {debugTimeline.invokeError && ` - ${debugTimeline.invokeError}`}
                  </div>
                )}
                <div className="text-muted-foreground">
                  Current: {debugTimeline.lastStep} ({elapsedSeconds}s elapsed)
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="h-7 text-xs gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Thử lại
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7 text-xs"
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress display */}
      {uploadState.status === 'uploading' && (
        <div className="space-y-3">
          <Progress value={uploadState.progress} className="h-3" />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(uploadState.bytesUploaded)} / {formatBytes(uploadState.bytesTotal)}
            </span>
            <span className="font-medium text-primary">{Math.round(uploadState.progress)}%</span>
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            {uploadState.uploadSpeed > 0 && (
              <span>Tốc độ: {formatSpeed(uploadState.uploadSpeed)}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Còn lại: {getETA()}
            </span>
          </div>

          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Vui lòng không đóng trình duyệt khi đang tải lên!
          </div>
        </div>
      )}

      {/* Processing state - quick for R2 */}
      {uploadState.status === 'processing' && uploadState.videoKey && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-muted h-32">
            {uploadState.localThumbnail ? (
              <img 
                src={uploadState.localThumbnail}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
              <span className="text-white text-sm ml-2">Đang hoàn tất...</span>
            </div>
          </div>
        </div>
      )}

      {/* Success state */}
      {uploadState.status === 'ready' && uploadState.videoKey && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-muted h-32">
            {uploadState.localThumbnail ? (
              <img 
                src={uploadState.localThumbnail}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Video đã sẵn sàng
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-6 text-xs text-destructive hover:text-destructive"
            >
              Xóa
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {uploadState.status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{uploadState.error || 'Tải lên thất bại'}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="h-8 text-xs gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Thử lại
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoUploaderUppy;
