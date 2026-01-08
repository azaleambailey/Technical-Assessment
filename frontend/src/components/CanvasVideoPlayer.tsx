import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

export type FilterType = 'none' | 'grayscale' | 'sepia' | 'inverted' | 'rio';

interface CanvasVideoPlayerProps {
  videoUrl: string;
  metadata: {
    cache_key: string;
    width: number;
    height: number;
    fps: number;
    total_frames: number;
    has_audio: boolean;
    audio_endpoint: string | null;
  };
  filter: FilterType;
}

export interface CanvasVideoPlayerRef {
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

const CanvasVideoPlayer = forwardRef<CanvasVideoPlayerRef, CanvasVideoPlayerProps>(
  ({ videoUrl, metadata, filter }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const animationFrameRef = useRef<number>();
    const masksCache = useRef<Map<number, ImageData>>(new Map());
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      getDuration: () => videoRef.current?.duration || 0,
    }));

    // Apply filter to background
    const applyFilter = (
      imageData: ImageData,
      mask: ImageData,
      filterType: FilterType
    ): ImageData => {
      const filtered = new ImageData(imageData.width, imageData.height);
      const data = imageData.data;
      const maskData = mask.data;
      const filteredData = filtered.data;

      for (let i = 0; i < data.length; i += 4) {
        const isPerson = maskData[i] > 128; // Mask is grayscale, check red channel

        if (isPerson) {
          // Keep person in original color
          filteredData[i] = data[i];
          filteredData[i + 1] = data[i + 1];
          filteredData[i + 2] = data[i + 2];
          filteredData[i + 3] = data[i + 3];
        } else {
          // Apply filter to background
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          switch (filterType) {
            case 'grayscale': {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = g = b = gray;
              break;
            }
            case 'sepia': {
              const tr = 0.393 * r + 0.769 * g + 0.189 * b;
              const tg = 0.349 * r + 0.686 * g + 0.168 * b;
              const tb = 0.272 * r + 0.534 * g + 0.131 * b;
              r = Math.min(255, tr);
              g = Math.min(255, tg);
              b = Math.min(255, tb);
              break;
            }
            case 'inverted': {
              r = 255 - r;
              g = 255 - g;
              b = 255 - b;
              break;
            }
            case 'rio': {
              // Rio de Janeiro filter: warm, high contrast, desaturated
              // Increase reds, decrease blues, boost contrast
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              r = Math.min(255, gray * 0.6 + r * 0.7);
              g = Math.min(255, gray * 0.4 + g * 0.6);
              b = Math.min(255, gray * 0.2 + b * 0.4);
              // Add slight orange tint
              r = Math.min(255, r * 1.1);
              g = Math.min(255, g * 1.05);
              break;
            }
            case 'none':
            default:
              // No filter
              break;
          }

          filteredData[i] = r;
          filteredData[i + 1] = g;
          filteredData[i + 2] = b;
          filteredData[i + 3] = data[i + 3];
        }
      }

      return filtered;
    };

    // Load mask for current frame
    const loadMask = async (frameNumber: number): Promise<ImageData | null> => {
      if (masksCache.current.has(frameNumber)) {
        return masksCache.current.get(frameNumber)!;
      }

      try {
        const response = await fetch(
          `http://127.0.0.1:8080/get-masks/${metadata.cache_key}/${frameNumber}`
        );
        if (!response.ok) return null;

        const blob = await response.blob();
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = metadata.width;
        tempCanvas.height = metadata.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(img, 0, 0);
        const maskData = tempCtx.getImageData(0, 0, metadata.width, metadata.height);

        // Cache the mask (limit cache size)
        if (masksCache.current.size > 60) {
          const firstKey = masksCache.current.keys().next().value;
          masksCache.current.delete(firstKey);
        }
        masksCache.current.set(frameNumber, maskData);

        return maskData;
      } catch (error) {
        console.error('Error loading mask:', error);
        return null;
      }
    };

    // Render frame
    const renderFrame = async () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (!canvas || !video || video.paused || video.ended) {
        return;
      }

      const ctx = canvas.getContext('2d')!;

      // Draw current video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get frame number
      const frameNumber = Math.floor(video.currentTime * metadata.fps);

      // Load and apply mask
      const mask = await loadMask(frameNumber);
      if (mask) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const filtered = applyFilter(imageData, mask, filter);
        ctx.putImageData(filtered, 0, 0);
      }

      setCurrentTime(video.currentTime);

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    // Video event handlers
    useEffect(() => {
      const video = videoRef.current;
      const audio = audioRef.current;

      if (!video) return;

      const handlePlay = () => {
        setIsPlaying(true);
        if (audio) audio.play();
        renderFrame();
      };

      const handlePause = () => {
        setIsPlaying(false);
        if (audio) audio.pause();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      const handleSeeked = () => {
        if (audio) audio.currentTime = video.currentTime;
        // Render single frame when seeking
        const canvas = canvasRef.current;
        if (canvas && video) {
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const frameNumber = Math.floor(video.currentTime * metadata.fps);
          loadMask(frameNumber).then(mask => {
            if (mask) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const filtered = applyFilter(imageData, mask, filter);
              ctx.putImageData(filtered, 0, 0);
            }
          });
        }
      };

      const handleLoadedMetadata = () => {
        setDuration(video.duration);
      };

      const handleTimeUpdate = () => {
        if (audio && Math.abs(audio.currentTime - video.currentTime) > 0.3) {
          audio.currentTime = video.currentTime;
        }
      };

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [metadata.fps, filter]);

    return (
      <div style={{ position: 'relative', maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          width={metadata.width}
          height={metadata.height}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            backgroundColor: '#000',
          }}
        />
        <video
          ref={videoRef}
          src={videoUrl}
          style={{ display: 'none' }}
          crossOrigin="anonymous"
        />
        {metadata.has_audio && metadata.audio_endpoint && (
          <audio
            ref={audioRef}
            src={`http://127.0.0.1:8080${metadata.audio_endpoint}`}
            style={{ display: 'none' }}
          />
        )}
        <div style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <button
            onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <input
            type="range"
            min={0}
            max={duration}
            value={currentTime}
            onChange={(e) => {
              const time = parseFloat(e.target.value);
              if (videoRef.current) videoRef.current.currentTime = time;
              setCurrentTime(time);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '14px', minWidth: '100px' }}>
            {Math.floor(currentTime)}s / {Math.floor(duration)}s
          </span>
        </div>
      </div>
    );
  }
);

CanvasVideoPlayer.displayName = 'CanvasVideoPlayer';

export default CanvasVideoPlayer;
