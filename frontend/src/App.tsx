import React, { useState, useRef } from 'react';
import { videoUrl } from './consts';

type FilterType = 'none' | 'grayscale' | 'sepia' | 'inverted' | 'rio';

const App: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('none');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFilterChange = (newFilter: FilterType) => {
    const currentTime = videoRef.current?.currentTime || 0;
    const isPaused = videoRef.current?.paused ?? true;
    
    setSelectedFilter(newFilter);
    
    // Restore playback state after video loads
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        if (!isPaused) {
          videoRef.current.play();
        }
      }
    }, 50);
  };
  
  const filters: { value: FilterType; label: string; description: string }[] = [
    { value: 'none', label: 'No Filter', description: 'Original background' },
    { value: 'grayscale', label: 'Grayscale', description: 'Black & white background' },
    { value: 'sepia', label: 'Sepia', description: 'Vintage brown tone' },
    { value: 'inverted', label: 'Inverted', description: 'Negative colors' },
    { value: 'rio', label: 'Rio de Janeiro', description: 'Warm, desaturated tone' },
  ];

  return (
    <div className="container">
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h1>Video Segmentation with MediaPipe</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Instant background filters with person segmentation
        </p>
        
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginTop: 0 }}>Background Filter</h3>
          <div style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {filters.map(filter => (
              <button
                key={filter.value}
                onClick={() => handleFilterChange(filter.value)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: selectedFilter === filter.value ? '#007bff' : 'white',
                  color: selectedFilter === filter.value ? 'white' : '#333',
                  border: '2px solid #007bff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: selectedFilter === filter.value ? 'bold' : 'normal',
                  transition: 'all 0.2s',
                  minWidth: '140px'
                }}
              >
                <div>{filter.label}</div>
                <div style={{
                  fontSize: '11px',
                  marginTop: '4px',
                  opacity: 0.8
                }}>
                  {filter.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <video 
            ref={videoRef}
            controls 
            autoPlay
            style={{ width: '100%', display: 'block' }}
            src={`http://127.0.0.1:8080/get-processed-video?video_url=${encodeURIComponent(videoUrl)}&filter=${selectedFilter}`}
          />
        </div>

        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <p style={{ margin: '5px 0' }}>
            ✓ Pre-processed with 5 filter variations
          </p>
          <p style={{ margin: '5px 0' }}>
            ✓ Switch filters instantly at any point in the video
          </p>
          <p style={{ margin: '5px 0' }}>
            ✓ Full audio and video sync maintained
          </p>
        </div>
      </div>
    </div>
  );
};

export default App; 