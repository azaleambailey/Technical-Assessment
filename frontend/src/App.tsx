import React, { useRef } from 'react';
import VideoPlayer from './components/VideoPlayer';
import { videoUrl } from './consts';

export interface FaceDetection {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    label?: string;
  }

const App: React.FC = () => {
  const processedVideoRef = useRef<HTMLVideoElement>(null);
  
  // Construct the processed video URL automatically
  const encodedVideoUrl = encodeURIComponent(videoUrl);
  const processedVideoUrl = `http://127.0.0.1:8080/get-processed-video?video_url=${encodedVideoUrl}`;

  return (
    <div className="container">
      <div style={{ textAlign: 'center' }}>
        <h1>Video Segmentation with MediaPipe</h1>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Grayscale background filter is automatically applied
        </p>
        
        <div className="video-container" style={{ display: 'flex', justifyContent: 'center' }}>
          <div>
            <h3>Processed Video (Grayscale Background)</h3>
            <VideoPlayer
              ref={processedVideoRef}
              src={processedVideoUrl}
              onLoadedMetadata={() => console.log('Processed video loaded and ready')}
            />
            <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              Video is automatically processed with person segmentation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App; 