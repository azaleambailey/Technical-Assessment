import React, { useState, useRef, useEffect } from 'react';
import { videoUrl } from './consts';

type FilterType = 'none' | 'grayscale' | 'sepia' | 'inverted' | 'rio';

const App: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('none');
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [videosReady, setVideosReady] = useState(false);

  const filters: { value: FilterType; label: string; description: string }[] = [
    { value: 'none', label: 'No Filter', description: 'Original background' },
    { value: 'grayscale', label: 'Grayscale', description: 'Black & white background' },
    { value: 'sepia', label: 'Sepia', description: 'Vintage brown tone' },
    { value: 'inverted', label: 'Inverted', description: 'Negative colors' },
    { value: 'rio', label: 'Rio de Janeiro', description: 'Cool blue-gray tone' },
  ];

  // Start all videos playing together on mount
  useEffect(() => {
    const playAllVideos = async () => {
      const promises = filters.map(filter => {
        const video = videoRefs.current[filter.value];
        if (video) {
          return video.play().catch(err => console.log(`Video ${filter.value} play error:`, err));
        }
      });
      await Promise.all(promises);
      setVideosReady(true);
    };

    // Wait a bit for videos to load
    const timer = setTimeout(playAllVideos, 500);
    return () => clearTimeout(timer);
  }, []);

  // Keep all videos perfectly synced to the active video
  useEffect(() => {
    const activeVideo = videoRefs.current[selectedFilter];
    
    const syncVideos = () => {
      if (!activeVideo) return;
      const currentTime = activeVideo.currentTime;
      const isPaused = activeVideo.paused;
      
      // Sync all other videos to active video's time and play state
      filters.forEach(filter => {
        const video = videoRefs.current[filter.value];
        if (video && filter.value !== selectedFilter) {
          const timeDiff = Math.abs(video.currentTime - currentTime);
          
          // Sync time if drift is more than 0.1 seconds
          if (timeDiff > 0.1) {
            video.currentTime = currentTime;
          }
          
          // Sync play/pause state
          if (isPaused && !video.paused) {
            video.pause();
          } else if (!isPaused && video.paused) {
            video.play();
          }
        }
      });
    };
    
    if (activeVideo) {
      activeVideo.addEventListener('timeupdate', syncVideos);
      activeVideo.addEventListener('play', syncVideos);
      activeVideo.addEventListener('pause', syncVideos);
      activeVideo.addEventListener('seeked', syncVideos);
      
      return () => {
        activeVideo.removeEventListener('timeupdate', syncVideos);
        activeVideo.removeEventListener('play', syncVideos);
        activeVideo.removeEventListener('pause', syncVideos);
        activeVideo.removeEventListener('seeked', syncVideos);
      };
    }
  }, [selectedFilter, filters]);

  const handleFilterChange = (newFilter: FilterType) => {
    if (newFilter === selectedFilter) return;
    setSelectedFilter(newFilter);
  };
  
  // Keep all videos in sync by listening to the active video's timeupdate
  useEffect(() => {
    const activeVideo = videoRefs.current[selectedFilter];
    
    const syncVideos = () => {
      if (!activeVideo) return;
      const currentTime = activeVideo.currentTime;
      
      // Sync all other videos to the active video's time
      filters.forEach(filter => {
        const video = videoRefs.current[filter.value];
        if (video && filter.value !== selectedFilter) {
          const timeDiff = Math.abs(video.currentTime - currentTime);
          // Only sync if videos drift apart by more than 0.3 seconds
          if (timeDiff > 0.3) {
            video.currentTime = currentTime;
          }
        }
      });
    };
    
    if (activeVideo) {
      activeVideo.addEventListener('timeupdate', syncVideos);
      return () => activeVideo.removeEventListener('timeupdate', syncVideos);
    }
  }, [selectedFilter, filters]);
  
  return (
    <>
      <div className="banner-header" style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'rgba(255, 61, 0, 1)',
        color: 'white',
        padding: '20px 20px 20px 40px',
        textAlign: 'left',
        zIndex: 1000,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        borderRadius: '20px',
        margin: '20px 20px 20px 20px'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '36px', 
          fontWeight: 800,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '-0.02em'
        }}>
          Background Video Filter
        </h1>
      </div>
      
      <div style={{ padding: '0 20px' }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
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
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            position: 'relative',
            width: '100%'
          }}>
            {filters.map(filter => (
              <video
                key={filter.value}
                ref={el => videoRefs.current[filter.value] = el}
                controls={selectedFilter === filter.value}
                preload="auto"
                muted={selectedFilter !== filter.value}
                style={{
                  width: '100%',
                  display: selectedFilter === filter.value ? 'block' : 'none'
                }}
                src={`http://127.0.0.1:8080/get-processed-video?video_url=${encodeURIComponent(videoUrl)}&filter=${filter.value}`}
              />
            ))}
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
    </>
  );
};

export default App; 