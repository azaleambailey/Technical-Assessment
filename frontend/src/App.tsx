/**
 * Main Application Component
 * 
 * This is the core UI component that provides:
 * 1. Video playback with background filters (grayscale, sepia, rio)
 * 2. Real-time filter switching with synchronized playback
 * 3. Video upload (file or YouTube URL)
 * 4. Smooth UI transitions and animations
 * 
 * Key Technical Features:
 * - Multiple video elements (one per filter) loaded simultaneously
 * - Perfect synchronization: all videos play in sync, switching displays the desired filter instantly
 * - Smart caching: backend processes all filters at once, frontend caches all video elements
 * - Smooth transitions with CSS animations
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { videoUrl as defaultVideoUrl } from './consts';

// Type definitions for better type safety
type FilterType = 'none' | 'grayscale' | 'sepia' | 'rio';
type UploadTab = 'url' | 'file';

const App: React.FC = () => {
  // ========== STATE MANAGEMENT ==========
  
  // Currently selected filter determines which video element is displayed
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('none');
  
  // videoRefs stores references to all video elements (one per filter)
  // This allows us to control playback programmatically
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  
  // UI state for filter menu visibility
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  
  // Track which button is being hovered for tooltip display
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  
  // Current video URL - can be changed via upload modal
  const [videoUrl, setVideoUrl] = useState<string>(defaultVideoUrl);
  
  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeUploadTab, setActiveUploadTab] = useState<UploadTab>('url');
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter definitions with metadata
  // useMemo prevents recreation on every render
  const filters = useMemo(() => [
    { value: 'none' as FilterType, label: 'No Filter', description: 'Original background' },
    { value: 'grayscale' as FilterType, label: 'Grayscale', description: 'Black & white background' },
    { value: 'sepia' as FilterType, label: 'Sepia', description: 'Vintage brown tone' },
    { value: 'rio' as FilterType, label: 'Rio de Janeiro', description: 'Instagram filter' },
  ], []);

  // ========== EFFECT: AUTO-PLAY ALL VIDEOS ON MOUNT ==========
  // Start all videos playing together on mount
  // This ensures smooth filter switching - all videos are already playing,
  // we just toggle which one is visible
  useEffect(() => {
    const playAllVideos = async () => {
      const promises = filters.map(filter => {
        const video = videoRefs.current[filter.value];
        if (video) {
          // Attempt to play, catching autoplay errors (some browsers block autoplay)
          return video.play().catch(err => {
            // Silently handle autoplay errors - user can click play button
            console.log(`Video ${filter.value} play error:`, err);
          });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    };

    // Wait a bit for videos to load before attempting playback
    const timer = setTimeout(playAllVideos, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  // ========== EFFECT: KEEP ALL VIDEOS SYNCHRONIZED ==========
  // Keep all videos perfectly synced to the active video
  // This is crucial for seamless filter switching - when user switches filters,
  // the new video appears at exactly the same timestamp
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
          // Small drift is acceptable and constant micro-adjustments would be expensive
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
    
    // Listen to multiple events to ensure perfect sync
    if (activeVideo) {
      activeVideo.addEventListener('timeupdate', syncVideos);  // Fires during playback
      activeVideo.addEventListener('play', syncVideos);        // User clicks play
      activeVideo.addEventListener('pause', syncVideos);       // User clicks pause
      activeVideo.addEventListener('seeked', syncVideos);      // User seeks to new position
      
      return () => {
        // Cleanup event listeners to prevent memory leaks
        activeVideo.removeEventListener('timeupdate', syncVideos);
        activeVideo.removeEventListener('play', syncVideos);
        activeVideo.removeEventListener('pause', syncVideos);
        activeVideo.removeEventListener('seeked', syncVideos);
      };
    }
  }, [selectedFilter, filters]);

  // ========== EVENT HANDLERS ==========
  
  /**
   * Handle filter selection change
   * Simply switches which video element is displayed
   */
  const handleFilterChange = (newFilter: FilterType) => {
    if (newFilter === selectedFilter) return;
    setSelectedFilter(newFilter);
  };

  /**
   * Handle YouTube URL submission
   * Validates input and updates the video URL
   */
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setUploadError('Please enter a valid URL');
      return;
    }
    setVideoUrl(urlInput.trim());
    setIsUploadModalOpen(false);
    setUrlInput('');
    setUploadError(null);
  };

  /**
   * Handle file upload to backend
   * Uploads video file, receives URL, and updates video source
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setUploadError('Please select a valid video file');
      return;
    }

    // Validate file size (max 100MB to prevent server overload)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File size must be less than 100MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Create FormData to send file to backend
      const formData = new FormData();
      formData.append('video', file);

      // POST to backend upload endpoint
      const response = await fetch('http://127.0.0.1:8080/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      // Update video URL with the uploaded video's URL
      setVideoUrl(data.video_url);
      setIsUploadModalOpen(false);
      
      // Reset file input for future uploads
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadError('Failed to upload video. Please try again.');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
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
            onClick={() => setIsUploadModalOpen(true)}
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
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setIsUploadModalOpen(false)}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 600 }}>Upload Video</h2>
            
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
              <button
                onClick={() => setActiveUploadTab('url')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: activeUploadTab === 'url' ? 600 : 400,
                  borderBottom: activeUploadTab === 'url' ? '3px solid #007bff' : '3px solid transparent',
                  color: activeUploadTab === 'url' ? '#007bff' : '#666',
                  marginBottom: '-2px'
                }}
              >
                Paste URL
              </button>
              <button
                onClick={() => setActiveUploadTab('file')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: activeUploadTab === 'file' ? 600 : 400,
                  borderBottom: activeUploadTab === 'file' ? '3px solid #007bff' : '3px solid transparent',
                  color: activeUploadTab === 'file' ? '#007bff' : '#666',
                  marginBottom: '-2px'
                }}
              >
                Upload File
              </button>
            </div>

            {/* URL Tab Content */}
            {activeUploadTab === 'url' && (
              <div>
                <p style={{ color: '#666', marginBottom: '15px' }}>
                  Paste a YouTube video URL
                </p>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    boxSizing: 'border-box'
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
                />
                {uploadError && (
                  <div style={{ color: '#E74C3C', marginBottom: '15px', fontSize: '14px' }}>
                    {uploadError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setUrlInput('');
                      setUploadError(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      border: '2px solid #ddd',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUrlSubmit}
                    style={{
                      padding: '10px 20px',
                      border: 'none',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Load Video
                  </button>
                </div>
              </div>
            )}

            {/* File Upload Tab Content */}
            {activeUploadTab === 'file' && (
              <div>
                <p style={{ color: '#666', marginBottom: '15px' }}>
                  Upload a video file from your computer (max 100MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #ddd',
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#f8f8f8',
                    marginBottom: '15px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#007bff';
                    e.currentTarget.style.backgroundColor = '#f0f7ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#ddd';
                    e.currentTarget.style.backgroundColor = '#f8f8f8';
                  }}
                >
                  <svg width="48" height="48" viewBox="0 0 512 512" fill="#007bff" style={{ marginBottom: '10px' }}>
                    <path d="M403.002,217.001C388.998,148.002,328.998,96,256,96c-57.998,0-107.998,32.998-132.998,81.001C63.002,183.002,16,233.998,16,296c0,65.996,53.999,120,120,120h260c55,0,100-45,100-100C496,263.002,455.004,219.000,403.002,217.001z M288,276v76h-64v-76h-68l100-100l100,100H288z"/>
                  </svg>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#333' }}>
                    {isUploading ? 'Uploading...' : 'Click to select a video file'}
                  </p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                    MP4, WebM, MOV, AVI
                  </p>
                </div>
                {uploadError && (
                  <div style={{ color: '#E74C3C', marginBottom: '15px', fontSize: '14px' }}>
                    {uploadError}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setUploadError(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      border: '2px solid #ddd',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 
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