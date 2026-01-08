/**
 * VideoPlayer Component
 * 
 * A simple, reusable video player component that wraps the HTML5 video element.
 * Uses forwardRef to allow parent components to access the underlying video element
 * for direct control (play, pause, seek, etc.).
 * 
 * Props:
 *   - src: The video source URL
 *   - onLoadedMetadata: Callback when video metadata is loaded
 * 
 * The ref allows parent components to access video element methods:
 *   - play(), pause(), seek(), currentTime, etc.
 */

import React, { forwardRef } from 'react';

interface VideoPlayerProps {
  src: string;
  onLoadedMetadata?: () => void;
}

const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onLoadedMetadata }, ref) => {
    return (
      <video
        ref={ref}
        src={src}
        className="video-player"
        controls  // Show browser's native video controls
        onLoadedMetadata={onLoadedMetadata}  // Trigger callback when video loads
        crossOrigin="anonymous"  // Allow CORS for videos from different origins
      />
    );
  }
);

// Display name helps with debugging in React DevTools
VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer; 