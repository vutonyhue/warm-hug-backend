import { useEffect, useRef, useState, memo } from 'react';
import Hls from 'hls.js';
import { cn } from '@/lib/utils';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, AlertCircle } from 'lucide-react';

interface StreamPlayerProps {
  src: string; // HLS manifest URL, Stream UID, or iframe embed URL
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  onError?: (error: Error) => void;
  onReady?: () => void;
}

/**
 * Detect video URL type and extract UID if applicable
 */
function parseVideoSource(src: string): { type: 'iframe' | 'hls' | 'direct'; url: string; uid?: string } {
  // iframe.videodelivery.net/{uid}
  if (src.includes('iframe.videodelivery.net')) {
    const match = src.match(/iframe\.videodelivery\.net\/([a-f0-9]+)/i);
    return { type: 'iframe', url: src, uid: match?.[1] };
  }
  
  // cloudflarestream.com/{uid}/manifest/video.m3u8
  if (src.includes('cloudflarestream.com') && src.includes('.m3u8')) {
    return { type: 'hls', url: src };
  }
  
  // videodelivery.net/{uid}/manifest/video.m3u8
  if (src.includes('videodelivery.net') && src.includes('.m3u8')) {
    return { type: 'hls', url: src };
  }
  
  // Just a UID - convert to iframe URL
  if (/^[a-f0-9]{32}$/i.test(src)) {
    return { type: 'iframe', url: `https://iframe.videodelivery.net/${src}`, uid: src };
  }
  
  // R2 or other direct video URLs
  if (src.includes('.r2.dev') || src.includes('.mp4') || src.includes('.webm')) {
    return { type: 'direct', url: src };
  }
  
  // Default: treat as HLS
  return { type: 'hls', url: src };
}

/**
 * HLS Video Player for Cloudflare Stream
 * - Adaptive bitrate streaming
 * - Fallback to native HLS for Safari
 * - Iframe embed support for maximum compatibility
 * - Custom controls
 */
export const StreamPlayer = memo(({
  src,
  poster,
  className,
  autoPlay = false,
  muted = true,
  loop = false,
  controls = true,
  onError,
  onReady,
}: StreamPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { type, url, uid } = parseVideoSource(src);
  
  // Generate thumbnail URL from UID
  const thumbnailUrl = uid ? `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=1s` : poster;

  // For iframe embeds, use iframe directly
  if (type === 'iframe' || useIframeFallback) {
    const iframeUrl = type === 'iframe' ? url : `https://iframe.videodelivery.net/${uid || src}`;
    
    // If video is still processing or has error, show thumbnail with processing message
    if (hasError || isProcessing) {
      return (
        <div className={cn('relative bg-black aspect-video', className)}>
          {thumbnailUrl && (
            <img 
              src={thumbnailUrl} 
              alt="Video thumbnail"
              className="w-full h-full object-cover"
              fetchPriority="high"
              decoding="async"
              onError={(e) => {
                // Hide broken thumbnail
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
            <span className="text-white text-sm">Đang xử lý video...</span>
            <span className="text-white/60 text-xs mt-1">Vui lòng đợi trong giây lát</span>
          </div>
        </div>
      );
    }
    
    return (
      <div className={cn('relative bg-black aspect-video', className)}>
        <iframe
          src={`${iframeUrl}?${autoPlay ? 'autoplay=true&' : ''}${muted ? 'muted=true&' : ''}${loop ? 'loop=true&' : ''}controls=${controls ? 'true' : 'false'}&preload=auto&poster=${encodeURIComponent(thumbnailUrl || '')}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => {
            setIsLoading(false);
            setIsProcessing(false);
            onReady?.();
          }}
          onError={() => {
            // Video might be processing, show processing state instead of error
            setIsProcessing(true);
            setHasError(true);
          }}
        />
        {isLoading && !isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // For direct videos (R2, mp4, etc.)
  if (type === 'direct') {
    return (
      <div className={cn('relative bg-black', className)}>
        <video
          src={url}
          poster={poster}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          controls={controls}
          playsInline
          className="w-full h-full object-contain"
          onLoadedData={() => {
            setIsLoading(false);
            onReady?.();
          }}
          onError={() => {
            setHasError(true);
            onError?.(new Error('Video playback error'));
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>
    );
  }

  // HLS playback with hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setHasError(false);

    // Check if HLS.js is supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1, // Auto quality selection
      });

      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        onReady?.();
        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay blocked - try muted
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[StreamPlayer] Fatal error:', data);
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Try to recover from network errors
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            // Fall back to iframe
            console.log('[StreamPlayer] Falling back to iframe embed');
            setUseIframeFallback(true);
          }
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      video.src = url;
      
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        onReady?.();
        if (autoPlay) {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      });

      video.addEventListener('error', () => {
        // Fall back to iframe
        setUseIframeFallback(true);
      });
    } else {
      // No HLS support - use iframe
      setUseIframeFallback(true);
    }
  }, [src, url, autoPlay, onError, onReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen?.();
    }
  };

  // Show processing state instead of error (video might still be encoding)
  if (hasError) {
    return (
      <div className={cn('relative bg-black aspect-video', className)}>
        {thumbnailUrl && (
          <img 
            src={thumbnailUrl} 
            alt="Video thumbnail"
            className="w-full h-full object-cover"
            fetchPriority="high"
            decoding="async"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
          <span className="text-white text-sm">Đang xử lý video...</span>
          <span className="text-white/60 text-xs mt-1">Vui lòng đợi trong giây lát</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn('relative bg-black group', className)}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        poster={poster}
        muted={muted}
        loop={loop}
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      )}

      {/* Custom controls */}
      {controls && !isLoading && (
        <div 
          className={cn(
            'absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent transition-opacity',
            showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={toggleMute}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            <div className="flex-1" />

            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-primary transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Big play button */}
      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
            <Play className="w-8 h-8 text-black ml-1" />
          </div>
        </button>
      )}
    </div>
  );
});

StreamPlayer.displayName = 'StreamPlayer';

export default StreamPlayer;
