import { useState, useEffect, useCallback, useRef } from 'react';
import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Video, X, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { deleteStreamVideoByUid } from '@/utils/streamHelpers';

interface VideoUploaderUppyProps {
  onUploadComplete: (result: { uid: string; url: string; thumbnailUrl: string; localThumbnail?: string }) => void;
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
  videoUid?: string;
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
  tusStarted?: number;
  firstProgress?: number;
  lastStep: string;
}

const CHUNK_SIZE = 50 * 1024 * 1024;
const BACKEND_TIMEOUT_MS = 20000; // 20 seconds timeout for backend calls

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
 * Call edge function using native fetch with proper AbortController support
 * This fixes the timeout issue where supabase.functions.invoke doesn't properly abort
 */
async function callEdgeFunctionWithTimeout<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number = BACKEND_TIMEOUT_MS,
  externalAbortController?: AbortController | null
): Promise<{ data: T | null; error: Error | null; statusCode?: number; responseText?: string }> {
  const controller = externalAbortController || new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[callEdgeFunctionWithTimeout] Timeout reached (${timeoutMs}ms), aborting...`);
    controller.abort();
  }, timeoutMs);

  try {
    // Get session for auth token
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    // Build URL to edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

    console.log(`[callEdgeFunctionWithTimeout] Calling ${functionName}...`);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    
    console.log(`[callEdgeFunctionWithTimeout] Response status: ${response.status}`);

    if (!response.ok) {
      // Try to parse error from JSON
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(responseText);
        errorMessage = errJson.error || errJson.message || errorMessage;
        if (errJson.details) {
          errorMessage += `: ${errJson.details}`;
        }
      } catch {
        errorMessage = responseText.slice(0, 200) || errorMessage;
      }
      
      return { 
        data: null, 
        error: new Error(errorMessage), 
        statusCode: response.status,
        responseText: responseText.slice(0, 500),
      };
    }

    // Parse successful response
    let data: T;
    try {
      data = JSON.parse(responseText);
    } catch {
      return { 
        data: null, 
        error: new Error('Invalid JSON response from backend'),
        statusCode: response.status,
        responseText: responseText.slice(0, 500),
      };
    }

    return { data, error: null, statusCode: response.status };
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        console.log('[callEdgeFunctionWithTimeout] Request aborted');
        return { 
          data: null, 
          error: new Error(`Backend timeout (${timeoutMs / 1000}s) - vui lòng thử lại`),
          statusCode: 0,
        };
      }
      
      // Network errors (CORS, blocked, offline)
      if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
        return { 
          data: null, 
          error: new Error('Không kết nối được tới server. Có thể bị chặn bởi AdBlock/Firewall hoặc mạng không ổn định.'),
          statusCode: 0,
        };
      }
    }
    
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error('Unknown error'),
      statusCode: 0,
    };
  }
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
  
  const tusUploadRef = useRef<tus.Upload | null>(null);
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

  // Track if we've done auto health check
  const autoHealthCheckDoneRef = useRef(false);

  // Test backend health - define before useEffect that uses it
  const testBackendHealth = useCallback(async () => {
    setBackendHealthy(null);
    console.log('[VideoUploader] Testing backend health...');
    
    const startTime = Date.now();
    const { data, error, statusCode } = await callEdgeFunctionWithTimeout<{ 
      ok: boolean; 
      userId?: string; 
      ts?: string;
      authenticated?: boolean;
      cloudflareConfigured?: boolean;
    }>(
      'stream-video',
      { action: 'health' },
      10000 // 10s timeout for health check
    );

    const elapsed = Date.now() - startTime;
    
    if (error) {
      console.error('[VideoUploader] Backend health check failed:', error.message, 'status:', statusCode);
      setBackendHealthy(false);
      toast.error(`Backend không phản hồi: ${error.message}`);
      
      setDebugTimeline(prev => ({
        ...prev,
        lastStep: `health check failed: ${error.message} (${statusCode || 'no status'})`,
      }));
    } else if (data?.ok) {
      console.log('[VideoUploader] Backend healthy:', data, `(${elapsed}ms)`);
      setBackendHealthy(true);
      const authInfo = data.authenticated ? `✓ Auth (${data.userId?.slice(0, 8)}...)` : '✗ No auth';
      toast.success(`Backend OK (${elapsed}ms) - ${authInfo}`);
      
      setDebugTimeline(prev => ({
        ...prev,
        lastStep: `health OK: ${elapsed}ms, auth=${data.authenticated}`,
      }));
    } else {
      console.warn('[VideoUploader] Backend returned unexpected response:', data);
      setBackendHealthy(false);
      toast.error('Backend trả về dữ liệu không hợp lệ');
    }
  }, []);

  // Show debug panel automatically if stuck for 5+ seconds, and run auto health check
  useEffect(() => {
    if (uploadState.status === 'preparing' && elapsedSeconds >= 5) {
      setShowDebug(true);
      
      // Auto health check once when stuck for 8+ seconds
      if (elapsedSeconds >= 8 && !autoHealthCheckDoneRef.current && backendHealthy === null) {
        autoHealthCheckDoneRef.current = true;
        console.log('[VideoUploader] Auto health check triggered (stuck 8s+)');
        testBackendHealth();
      }
    }
    
    // Reset auto health check flag when status changes
    if (uploadState.status !== 'preparing') {
      autoHealthCheckDoneRef.current = false;
    }
  }, [uploadState.status, elapsedSeconds, backendHealthy, testBackendHealth]);

  // Cleanup on unmount - delete orphan video if upload wasn't completed
  useEffect(() => {
    return () => {
      if (tusUploadRef.current) {
        tusUploadRef.current.abort();
        tusUploadRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Reset refs on unmount
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

  // Retry upload
  const handleRetry = useCallback(() => {
    if (!selectedFile) return;
    
    // Reset state to trigger re-upload
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
    
    // Force effect to re-run by setting a small delay
    setTimeout(() => {
      // The useEffect will pick up selectedFile again
      setUploadState(prev => ({ ...prev }));
    }, 100);
  }, [selectedFile]);

  // Start upload when file is selected
  useEffect(() => {
    if (!selectedFile) return;

    // Generate a unique file identifier to prevent duplicate uploads
    const fileId = `${selectedFile.name}_${selectedFile.size}_${selectedFile.lastModified}`;
    
    // Prevent duplicate upload for the same file
    if (currentFileRef.current === fileId && uploadStartedRef.current) {
      console.log('[VideoUploader] Upload already started for this file, skipping duplicate');
      return;
    }
    
    // If already uploading a different file, abort first
    if (tusUploadRef.current && currentFileRef.current !== fileId) {
      console.log('[VideoUploader] Aborting previous upload to start new one');
      tusUploadRef.current.abort();
      tusUploadRef.current = null;
      isUploadingRef.current = false;
    }

    const startUpload = async () => {
      // Double-check to prevent race conditions
      if (uploadStartedRef.current && currentFileRef.current === fileId) {
        console.log('[VideoUploader] Upload already in progress for this file');
        return;
      }
      
      // Mark this file as being uploaded
      currentFileRef.current = fileId;
      uploadStartedRef.current = true;
      startTimeRef.current = Date.now();
      
      // Create new abort controller
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

        console.log('[VideoUploader] Starting upload, file:', fileId);

        // Generate local thumbnail immediately (don't await - run in parallel)
        generateVideoThumbnail(selectedFile)
          .then(thumb => {
            localThumbnailRef.current = thumb;
            setUploadState(prev => ({ ...prev, localThumbnail: thumb }));
            console.log('[VideoUploader] Local thumbnail generated');
          })
          .catch(err => {
            console.warn('[VideoUploader] Failed to generate local thumbnail:', err);
          });

        // Step 1: Get Direct Upload URL from our backend (with timeout)
        console.log('[VideoUploader] Requesting upload URL from backend...');
        
        setDebugTimeline(prev => ({
          ...prev,
          invokeStarted: Date.now(),
          lastStep: 'calling backend',
        }));

        const { data, error, statusCode, responseText } = await callEdgeFunctionWithTimeout<{ uploadUrl: string; uid: string }>(
          'stream-video',
          {
            action: 'get-tus-upload-url',
            fileSize: selectedFile.size,
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileId, // Send file identifier for deduplication tracking
          },
          BACKEND_TIMEOUT_MS,
          abortControllerRef.current // Pass abort controller for cancel support
        );

        const invokeTime = Date.now();
        const invokeElapsed = invokeTime - (debugTimeline.invokeStarted || invokeTime);
        
        setDebugTimeline(prev => ({
          ...prev,
          invokeFinished: invokeTime,
          invokeError: error?.message,
          lastStep: error 
            ? `backend error (${statusCode || 'timeout'}): ${error.message.slice(0, 100)}` 
            : `got upload URL (${invokeElapsed}ms)`,
        }));

        if (error) {
          console.error('[VideoUploader] Failed to get upload URL:', {
            error: error.message,
            statusCode,
            responseText: responseText?.slice(0, 200),
          });
          throw error;
        }

        if (!data) {
          throw new Error('Backend trả về dữ liệu rỗng');
        }

        const { uploadUrl, uid } = data;

        if (!uploadUrl || !uid) {
          console.error('[VideoUploader] Invalid response:', data);
          throw new Error(`Không nhận được URL/UID từ server (uploadUrl: ${!!uploadUrl}, uid: ${!!uid})`);
        }

        console.log('[VideoUploader] Got Direct Upload URL:', {
          uploadUrl: uploadUrl.substring(0, 80),
          uid,
        });

        // Save UID to state
        setUploadState(prev => ({
          ...prev,
          videoUid: uid,
          status: 'uploading',
        }));

        setDebugTimeline(prev => ({
          ...prev,
          tusStarted: Date.now(),
          lastStep: 'starting TUS upload',
        }));

        // Step 2: Upload directly to Cloudflare using tus-js-client
        // NO AUTH HEADERS NEEDED - this is a Direct Creator Upload URL
        const upload = new tus.Upload(selectedFile, {
          uploadUrl, // Use the pre-signed URL directly
          chunkSize: CHUNK_SIZE,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          removeFingerprintOnSuccess: true,
          // No headers needed for Direct Creator Upload!
          headers: {},
          metadata: {
            filename: selectedFile.name,
            filetype: selectedFile.type,
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const now = Date.now();
            const timeDiff = (now - lastTimeRef.current) / 1000;
            const bytesDiff = bytesUploaded - lastBytesRef.current;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

            lastBytesRef.current = bytesUploaded;
            lastTimeRef.current = now;

            const progress = Math.round((bytesUploaded / bytesTotal) * 100);

            // Log first progress
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
              bytesUploaded,
              bytesTotal,
              uploadSpeed: speed > 0 ? speed : prev.uploadSpeed,
            }));
          },
          onSuccess: async () => {
            console.log('[VideoUploader] Upload complete! UID:', uid);

            setDebugTimeline(prev => ({
              ...prev,
              lastStep: 'upload complete, processing',
            }));

            setUploadState(prev => ({
              ...prev,
              status: 'processing',
              progress: 100,
            }));

            // Update video settings to make it public
            try {
              await supabase.functions.invoke('stream-video', {
                body: {
                  action: 'update-video-settings',
                  uid,
                  requireSignedURLs: false,
                  allowedOrigins: ['*'],
                },
              });
              console.log('[VideoUploader] Video settings updated');
            } catch (err) {
              console.warn('[VideoUploader] Failed to update settings:', err);
            }

            // Success!
            const streamUrl = `https://iframe.videodelivery.net/${uid}`;
            const cloudflareThumb = `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=1s`;
            
            setUploadState(prev => ({
              ...prev,
              status: 'ready',
            }));

            setDebugTimeline(prev => ({
              ...prev,
              lastStep: 'ready',
            }));

            isUploadingRef.current = false;
            toast.success('Video đã tải lên thành công!');
            
            // Pass both local and cloudflare thumbnails (read from ref to get latest value)
            onUploadComplete({ 
              uid, 
              url: streamUrl, 
              thumbnailUrl: cloudflareThumb,
              localThumbnail: localThumbnailRef.current 
            });
          },
          onError: (error) => {
            console.error('[VideoUploader] TUS upload error:', error);
            isUploadingRef.current = false;

            const errorMsg = error?.message || 'Tải lên thất bại';
            
            setDebugTimeline(prev => ({
              ...prev,
              lastStep: `TUS error: ${errorMsg}`,
            }));

            setUploadState(prev => ({
              ...prev,
              status: 'error',
              error: errorMsg,
            }));

            onUploadError?.(error || new Error('Upload failed'));
            toast.error(`Tải lên thất bại: ${errorMsg}`);
          },
        });

        tusUploadRef.current = upload;

        // Start the upload
        console.log('[VideoUploader] Starting TUS upload to Cloudflare...');
        upload.start();

      } catch (error) {
        console.error('[VideoUploader] Error:', error);
        isUploadingRef.current = false;
        uploadStartedRef.current = false; // Allow retry
        currentFileRef.current = null;

        const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
        
        setDebugTimeline(prev => ({
          ...prev,
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
    // Abort any pending backend request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Abort any in-progress upload
    if (tusUploadRef.current) {
      tusUploadRef.current.abort();
      tusUploadRef.current = null;
    }
    isUploadingRef.current = false;
    uploadStartedRef.current = false; // Allow new upload
    currentFileRef.current = null;
    
    // Clean up any partially uploaded video from Cloudflare Stream
    const uidToDelete = uploadState.videoUid;
    if (uidToDelete) {
      console.log('[VideoUploaderUppy] Cleaning up cancelled upload:', uidToDelete);
      // Don't await - cleanup in background
      deleteStreamVideoByUid(uidToDelete);
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
  }, [onRemove, uploadState.videoUid]);

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

  // Don't render anything if idle and no file
  if (uploadState.status === 'idle' && !selectedFile) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-video-uid={uploadState.videoUid}>
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

      {/* Preparing state with debug info */}
      {uploadState.status === 'preparing' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang chuẩn bị... ({debugTimeline.lastStep})</span>
          </div>
          
          {/* Show debug panel if stuck */}
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
                  Test Backend
                </Button>
              </div>
              
              <div className="space-y-1 font-mono">
                {debugTimeline.preparingStarted && (
                  <div>T0: Preparing started</div>
                )}
                {debugTimeline.invokeStarted && (
                  <div>T1: Backend call started (+{debugTimeline.invokeStarted - (debugTimeline.preparingStarted || 0)}ms)</div>
                )}
                {debugTimeline.invokeFinished && (
                  <div className={debugTimeline.invokeError ? 'text-red-500' : 'text-green-500'}>
                    T2: Backend responded (+{debugTimeline.invokeFinished - (debugTimeline.invokeStarted || 0)}ms)
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

      {/* Processing state with thumbnail preview */}
      {uploadState.status === 'processing' && uploadState.videoUid && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-muted h-32">
            {/* Use local thumbnail first, fallback to Cloudflare */}
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
              <span className="text-white text-sm ml-2">Đang xử lý...</span>
            </div>
          </div>
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-600 dark:text-blue-400">
            🎬 Bé chờ một chút để có thể xem video nhé!
          </div>
        </div>
      )}

      {/* Success state with thumbnail preview */}
      {uploadState.status === 'ready' && uploadState.videoUid && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-muted h-32">
            {/* Use local thumbnail first, fallback to Video icon */}
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
              className="h-6 text-xs text-muted-foreground hover:text-destructive"
            >
              Xóa
            </Button>
          </div>
        </div>
      )}

      {/* Error state */}
      {uploadState.status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{uploadState.error || 'Đã xảy ra lỗi'}</span>
          </div>
          
          {/* Debug info for errors */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-2">
            <div className="font-mono text-muted-foreground">
              Last step: {debugTimeline.lastStep}
            </div>
            {debugTimeline.invokeError && (
              <div className="font-mono text-red-500">
                Backend: {debugTimeline.invokeError}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Thử lại
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={testBackendHealth}
              className="gap-1"
            >
              <Wifi className="w-3 h-3" />
              Test Backend
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              Hủy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
