import React, { useState, useRef, useEffect, useMemo } from 'react';
import { videoUrl } from './consts';

type FilterType = 'none' | 'grayscale' | 'sepia' | 'hot_pink' | 'rio';

const App: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('none');
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const filters = useMemo(() => [
    { value: 'none' as FilterType, label: 'No Filter', description: 'Original background' },
    { value: 'grayscale' as FilterType, label: 'Grayscale', description: 'Black & white background' },
    { value: 'sepia' as FilterType, label: 'Sepia', description: 'Vintage brown tone' },
    { value: 'hot_pink' as FilterType, label: 'Hot Pink', description: 'Vibrant pink overlay' },
    { value: 'rio' as FilterType, label: 'Rio de Janeiro', description: 'Instagram filter' },
  ], []);

  // Start all videos playing together on mount
  useEffect(() => {
    const playAllVideos = async () => {
      const promises = filters.map(filter => {
        const video = videoRefs.current[filter.value];
        if (video) {
          return video.play().catch(err => {
            // Silently handle autoplay errors
            console.log(`Video ${filter.value} play error:`, err);
          });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    };

    // Wait a bit for videos to load
    const timer = setTimeout(playAllVideos, 500);
    return () => clearTimeout(timer);
  }, [filters]);

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
          
          // Sync time if drift is more than 0.2 seconds
          if (timeDiff > 0.2) {
            video.currentTime = currentTime;
          }
          
          // Sync play/pause state with error handling
          if (isPaused && !video.paused) {
            video.pause();
          } else if (!isPaused && video.paused) {
            video.play().catch(err => {
              // Silently handle play errors during sync
              console.log(`Sync play error for ${filter.value}:`, err);
            });
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

      {/* Floating Toolbar with 3 Icons */}
      <div className="floating-toolbar" style={{
        position: 'fixed',
        left: '40px',
        top: '150px',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Filter Icon */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            onMouseEnter={() => setHoveredButton('filter')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              backgroundColor: 'white',
              color: isFilterMenuOpen ? 'rgba(255, 61, 0, 1)' : '#E74C3C',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              boxShadow: isFilterMenuOpen ? '0 6px 16px rgba(255, 61, 0, 0.3)' : '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.3s ease',
              width: '70px',
              height: '70px',
              transform: isFilterMenuOpen || hoveredButton === 'filter' ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <svg width="36" height="36" viewBox="0 0 512 512" fill={isFilterMenuOpen ? 'rgba(255, 61, 0, 1)' : '#E74C3C'}>
              <path d="M3.9 54.9C10.5 40.9 24.5 32 40 32H472c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9V448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6V320.9L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z"/>
            </svg>
          </button>
          {hoveredButton === 'filter' && (
            <div style={{
              position: 'absolute',
              left: '85px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              fontSize: '14px',
              fontWeight: 500,
              pointerEvents: 'none',
              zIndex: 1000
            }}>
              Choose your filter
            </div>
          )}
        </div>

        {/* Upload Icon */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => setHoveredButton('upload')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              backgroundColor: 'white',
              color: '#4A90E2',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.3s ease',
              width: '70px',
              height: '70px',
              transform: hoveredButton === 'upload' ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <svg width="36" height="36" viewBox="0 0 512 512" fill="#4A90E2">
              <path d="M403.002,217.001C388.998,148.002,328.998,96,256,96c-57.998,0-107.998,32.998-132.998,81.001C63.002,183.002,16,233.998,16,296c0,65.996,53.999,120,120,120h260c55,0,100-45,100-100C496,263.002,455.004,219.000,403.002,217.001z M288,276v76h-64v-76h-68l100-100l100,100H288z"/>
            </svg>
          </button>
          {hoveredButton === 'upload' && (
            <div style={{
              position: 'absolute',
              left: '85px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              fontSize: '14px',
              fontWeight: 500,
              pointerEvents: 'none',
              zIndex: 1000
            }}>
              Upload a video
            </div>
          )}
        </div>

        {/* Scissors Icon */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseEnter={() => setHoveredButton('scissors')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              backgroundColor: 'white',
              color: '#9B59B6',
              border: 'none',
              borderRadius: '16px',
              padding: '20px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.3s ease',
              width: '70px',
              height: '70px',
              transform: hoveredButton === 'scissors' ? 'scale(1.1)' : 'scale(1)'
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9B59B6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3"/>
              <circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/>
              <line x1="14.47" y1="14.48" x2="20" y2="20"/>
              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
          </button>
          {hoveredButton === 'scissors' && (
            <div style={{
              position: 'absolute',
              left: '85px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              fontSize: '14px',
              fontWeight: 500,
              pointerEvents: 'none',
              zIndex: 1000
            }}>
              Editing Sandbox
            </div>
          )}
        </div>
      </div>

      {/* Filter Buttons - Appear on left side when filter icon is clicked */}
      
      <div className="main-content-wrapper" style={{ marginLeft: '130px', transition: 'margin 0.4s ease' }}>
        <div className="inner-content" style={{ textAlign: 'center' }}>
          {/* Video and Filter Buttons Container */}
          <div className="video-filter-container" style={{
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            alignItems: 'flex-start',
            flexDirection: 'row-reverse',
            flexWrap: 'wrap',
            margin: '0 auto',
            transition: 'all 0.4s ease'
          }}>
            {/* Filter Buttons - Float next to video */}
            <div className="filter-buttons-container" style={{
              padding: isFilterMenuOpen ? '20px' : '0',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: isFilterMenuOpen ? '0 4px 16px rgba(0,0,0,0.15)' : '0 0 0 rgba(0,0,0,0)',
              width: isFilterMenuOpen ? '220px' : '0px',
              maxWidth: isFilterMenuOpen ? '220px' : '0px',
              opacity: isFilterMenuOpen ? 1 : 0,
              overflow: 'hidden',
              flexShrink: 0,
              order: 2,
              transition: 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: isFilterMenuOpen ? 'auto' : 'none'
            }}>
              <h3 className="filter-title" style={{ marginTop: 0, marginBottom: '15px', color: '#333', fontSize: '16px', whiteSpace: 'nowrap' }}>Background Filter</h3>
              <div className="filter-buttons-wrapper" style={{
                display: 'flex',
                gap: '10px',
                flexDirection: 'column'
              }}>
                  {filters.map(filter => (
                    <button
                      key={filter.value}
                      onClick={() => handleFilterChange(filter.value)}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: selectedFilter === filter.value ? '#007bff' : 'white',
                        color: selectedFilter === filter.value ? 'white' : '#333',
                        border: selectedFilter === filter.value ? '2px solid #007bff' : '2px solid #ddd',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: selectedFilter === filter.value ? 600 : 400,
                        transition: 'all 0.2s',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedFilter !== filter.value) {
                          e.currentTarget.style.backgroundColor = '#f8f8f8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedFilter !== filter.value) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <div>{filter.label}</div>
                      <div style={{
                        fontSize: '10px',
                        marginTop: '4px',
                        opacity: 0.7
                      }}>
                        {filter.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            {/* Video Container */}
            <div className="video-wrapper" style={{
              maxWidth: isFilterMenuOpen ? '1100px' : '1400px',
              minWidth: '300px',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              position: 'relative',
              order: 1,
              transition: 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'flex-start'
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
                    display: selectedFilter === filter.value ? 'block' : 'none',
                    transition: 'width 0.6s ease'
                  }}
                  src={`http://127.0.0.1:8080/get-processed-video?video_url=${encodeURIComponent(videoUrl)}&filter=${filter.value}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default App; 