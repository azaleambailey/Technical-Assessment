# Background Video Filter System

A full-stack web application that applies visual filters to video backgrounds while keeping the subject in full color. Built as a technical assessment demonstrating person segmentation, real-time video processing, and modern web development practices.

## Project Objective

Create a system that distinguishes between a person (foreground) and the background in a video, applying different visual effects to each region:
- **Background**: Apply video effects (black & white, sepia, Instagram-style filters, etc.)
- **Speaker/Person**: Keep in full color, unaffected by filters

## Features

![Background Video Filter Demo](frontend/webapp.jpeg)

### Core Functionality
1. **Person Detection**: Uses MediaPipe's selfie segmentation model to identify people in video frames
2. **Background Segmentation**: Separates the person from the background
3. **Selective Filtering**: Applies visual filters only to the background while preserving the person in color
4. **Real-time Display**: Streams processed video with smooth playback

### Available Filters
- **None**: Original video without any processing
- **Grayscale**: Black and white background with color person
- **Sepia**: Vintage brown-toned background
- **Rio de Janeiro**: Instagram-style purple/magenta filter

### User Interface Features
- **Instant Filter Switching**: Toggle between filters in real-time without reprocessing
- **Video Upload**: Support for both file uploads and YouTube URLs
- **Synchronized Playback**: All filter variations stay perfectly in sync
- **Responsive Design**: Clean, modern interface with smooth animations

## Architecture

### Project Structure

```
Technical-Assessment/
├── backend/                    # Python Flask server
│   ├── main.py                # API endpoints and video processing
│   ├── helpers.py             # Filter functions and utilities
│   ├── requirements.txt       # Python dependencies
│   ├── processed_cache/       # Cached processed videos
│   ├── uploaded_videos/       # User-uploaded video files
│   └── temp/                  # Temporary files during processing
│
└── frontend/                  # React TypeScript app
    ├── src/
    │   ├── App.tsx           # Main application component
    │   ├── consts.ts         # Configuration constants
    │   ├── components/
    │   │   └── VideoPlayer.tsx  # Reusable video player
    │   └── index.tsx         # Application entry point
    ├── package.json          # Node.js dependencies
    └── public/               # Static assets
```

### Technology Stack

#### Backend
- **Flask**: Lightweight Python web framework for REST API
- **MediaPipe**: Google's ML solution for person segmentation
- **OpenCV**: Computer vision library for video processing
- **FFmpeg**: Video encoding and audio processing
- **yt-dlp**: YouTube video downloading

#### Frontend
- **React 18**: Modern UI framework with hooks
- **TypeScript**: Type-safe JavaScript
- **CSS-in-JS**: Inline styles for component encapsulation

## Getting Started

### Prerequisites

- **Python 3.8+**: For backend processing
- **Node.js 16+**: For frontend development
- **FFmpeg**: For video encoding
  ```bash
  # macOS
  brew install ffmpeg
  
  # Ubuntu/Debian
  sudo apt-get install ffmpeg
  
  # Windows
  # Download from https://ffmpeg.org/download.html
  ```
- **pip**: Python package manager (comes with Python)
- **npm or yarn**: Node.js package manager (comes with Node.js)

### Quick Start

#### 1. Backend Setup

```bash
# Navigate to project root
cd Technical-Assessment

# Create and activate virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start the backend server
cd backend
python main.py
```

**Backend is ready!** You should see: `Running on http://127.0.0.1:8080`

#### 2. Frontend Setup

**Open a new terminal window:**

```bash
# Navigate to frontend directory
cd Technical-Assessment/frontend

# Install Node.js dependencies
npm install

# Start the React development server
npm start
```

**Frontend is ready!** Browser will automatically open at `http://localhost:3000`

### Troubleshooting

**Backend won't start:**
- Ensure virtual environment is activated: `source venv/bin/activate`
- Check dependencies: `pip list | grep -E "(mediapipe|opencv|flask)"`
- Verify FFmpeg is installed: `ffmpeg -version`

**Frontend won't start:**
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node version: `node --version` (should be 16+)

**Video processing is slow:**
- First-time processing takes longer (downloads MediaPipe model)
- Processing happens once, then results are cached
- Subsequent filter switches are instant

## How to Use

### Basic Workflow

1. **Start Both Servers** (backend on :8080, frontend on :3000)
2. **View Default Video**: The app automatically loads a demo video
3. **Try Different Filters**: 
   - Click the **filter icon** on the left sidebar to open the filter menu
   - Select any filter (None, Grayscale, Sepia, Rio de Janeiro)
   - Watch the background change instantly!
4. **Watch Processing** (first time only - takes ~30 seconds per minute of video)
5. **Switch Filters** instantly after initial processing - all variations stay perfectly synchronized

### Uploading Videos

#### Option 1: YouTube URL
1. Click the upload icon
2. Select "Paste URL" tab
3. Enter YouTube URL (e.g., `https://youtube.com/watch?v=xxx`)
4. Click "Load Video"

#### Option 2: File Upload
1. Click the upload icon
2. Select "Upload File" tab
3. Drag and drop or click to select video file
4. Supported formats: MP4, MOV, AVI, WebM, MKV
5. Max size: 100MB

### Understanding the Processing

**First Request (Takes Time)**:
- Downloads video (if URL) or reads file
- Extracts audio track
- Processes every frame with MediaPipe
- Applies ALL filters at once (efficient!)
- Encodes 4 separate videos (one per filter)
- Caches all versions

**Subsequent Requests (Instant)**:
- Serves from cache
- No reprocessing needed
- Switching filters is seamless

### API Endpoints

**Health Check**:
```bash
curl http://127.0.0.1:8080/hello-world
```

**Process Video**:
```bash
curl "http://127.0.0.1:8080/get-processed-video?video_url=<URL>&filter=grayscale"
```

Parameters:
- `video_url`: Video source (YouTube or direct link)
- `filter`: `none`, `grayscale`, `sepia`, or `rio`

**Upload Video**:
```bash
curl -X POST -F "video=@/path/to/video.mp4" http://127.0.0.1:8080/upload-video
```

## How It Works

### Technical Approach

#### Why MediaPipe Selfie Segmentation?

We chose MediaPipe's selfie segmentation model because:
1. **Lightweight**: Runs efficiently on CPU without GPU requirements
2. **Accurate**: Pre-trained on millions of images for robust person detection
3. **Fast**: Real-time performance suitable for video processing
4. **Free**: Open-source with permissive licensing

#### Processing Pipeline

1. **Video Download**
   - Accepts YouTube URLs (via yt-dlp) or direct video links
   - Saves to temporary location for processing

2. **Audio Extraction**
   - Uses FFmpeg to extract audio track separately
   - Preserves audio for final output

3. **Frame-by-Frame Processing**
   - Opens video with OpenCV
   - For each frame:
     - Convert BGR → RGB for MediaPipe
     - Run segmentation to get person mask
     - Apply all filters simultaneously (efficient batch processing)
     - Write to separate output files

4. **Video Encoding**
   - Re-encode with H.264 codec (universal browser support)
   - Merge audio back into video
   - Save to cache directory

5. **Caching Strategy**
   - Uses MD5 hash of video URL as cache key
   - Stores all filter variations: `{hash}_none.mp4`, `{hash}_grayscale.mp4`, etc.
   - On first request: process all filters at once
   - Subsequent requests: serve from cache instantly

#### Why Process All Filters at Once?

**Performance Optimization**: Processing all filters simultaneously is ~4x faster than processing each separately because:
- Reading video frames is the most expensive operation
- MediaPipe segmentation is the second most expensive
- Applying color filters is relatively cheap
- By processing frames once and applying all filters, we minimize I/O and ML inference

#### Frontend Architecture

**Synchronized Multi-Video Approach**: The frontend loads all filter variations as separate `<video>` elements:
- All videos load simultaneously in the background
- All videos play in perfect sync
- Only the selected filter is visible (others are `display: none`)
- Switching filters is instant - just toggle visibility

**Why Not Process Client-Side?**: While WebGL/Canvas could apply filters client-side, server-side processing was chosen because:
- MediaPipe's JavaScript implementation is less mature
- Server can cache results for all users
- Offloads processing from user's device
- Consistent results across all browsers/devices

## Filter Implementation Details

### Grayscale Filter
- Converts background to black and white using OpenCV's `cvtColor`
- Standard luminance formula: `Y = 0.299R + 0.587G + 0.114B`
- Person mask keeps RGB values unchanged

### Sepia Filter
- Applies warm brown-tone transformation matrix
- Creates vintage photograph appearance
- Matrix coefficients chosen for aesthetic appeal

### Rio de Janeiro Filter
- Instagram-style purple/magenta nostalgic tone
- Combines desaturation with color channel shifts
- Boosts blue and red channels while reducing green

## Code Structure Explained

### Backend ([backend/main.py](backend/main.py))

#### Key Endpoints

**`GET /hello-world`**: Health check endpoint

**`POST /upload-video`**: Handle video file uploads
- Validates file type and size
- Saves with UUID filename to prevent conflicts
- Returns URL for accessing uploaded video

**`GET /uploaded-videos/<filename>`**: Serve uploaded videos

**`GET /get-processed-video`**: Main processing endpoint
- Parameters: `video_url` (required), `filter` (optional)
- Checks cache for existing processed version
- If not cached, triggers `process_all_filters()`
- Returns processed video as MP4 stream

#### Key Functions

**`download_video()`**: Downloads video from YouTube or direct URL
- Auto-detects YouTube URLs
- Uses yt-dlp for YouTube (handles auth, format selection, audio merging)
- Uses requests for direct URLs

**`process_all_filters()`**: Main video processing pipeline
- Downloads video
- Extracts audio with FFmpeg
- Initializes MediaPipe segmentation model
- Processes all frames with all filters simultaneously
- Re-encodes with H.264
- Merges audio back
- Caches all versions

### Backend ([backend/helpers.py](backend/helpers.py))

**`get_temp_path()`**: Generates unique temporary file paths

**`apply_grayscale_background()`**: Implements grayscale filter
- Uses segmentation mask to composite color person with B&W background

**`apply_sepia_background()`**: Implements sepia filter
- Applies sepia transformation matrix

**`apply_rio_background()`**: Implements Rio de Janeiro filter
- Complex color grading for Instagram-style effect

### Frontend ([frontend/src/App.tsx](frontend/src/App.tsx))

#### State Management
- `selectedFilter`: Currently active filter
- `videoRefs`: References to all video elements
- `videoUrl`: Current video source URL
- UI state: modals, tooltips, upload status

#### Key Effects

**Auto-play Effect**: Starts all videos playing on mount
**Sync Effect**: Keeps all videos synchronized to active video
- Listens to `timeupdate`, `play`, `pause`, `seeked` events
- Syncs timestamp and play state across all video elements

#### Event Handlers
- `handleFilterChange()`: Switch visible filter
- `handleUrlSubmit()`: Load YouTube video
- `handleFileUpload()`: Upload video file to backend

## Data Flow

```
User Action (Select Filter)
    ↓
Frontend (App.tsx)
    ↓
Check if video element exists
    ↓
    ├─ YES → Show cached video (instant)
    └─ NO  → Request: GET /get-processed-video?video_url=...&filter=grayscale
                ↓
            Backend (main.py)
                ↓
            Check cache directory
                ↓
                ├─ CACHED → Return file
                └─ NOT CACHED →
                    ↓
                Download video
                    ↓
                Extract audio
                    ↓
                Process all frames with MediaPipe
                    ↓
                Apply all filters
                    ↓
                Encode with H.264 + merge audio
                    ↓
                Cache all versions
                    ↓
                Return requested filter
```

## Design Decisions

### 1. Batch Processing All Filters
**Decision**: Process all filter variations in a single pass
**Rationale**: 
- Video I/O is expensive
- MediaPipe inference is expensive
- Filter application is cheap
- 4x performance improvement

### 2. Server-Side Processing
**Decision**: Process videos on the backend, not client-side
**Rationale**:
- Caching benefits all users
- Consistent results across platforms
- Offloads work from user's device
- Better for mobile users

### 3. Multi-Video Frontend Approach
**Decision**: Load all filter variations as separate video elements
**Rationale**:
- Instant filter switching (just toggle visibility)
- Smooth user experience
- No client-side processing needed
- Simple implementation

### 4. MediaPipe Over Other Segmentation Methods
**Decision**: Use MediaPipe selfie segmentation
**Rationale**:
- Pre-trained and highly accurate
- CPU-friendly (no GPU required)
- Well-maintained by Google
- Easy integration with Python

### 5. FFmpeg for Video Encoding
**Decision**: Use FFmpeg for final encoding
**Rationale**:
- Industry standard
- Excellent H.264 encoder (libx264)
- Handles audio merging elegantly
- Universal browser compatibility

## Next Steps & Future Improvements

### Performance Enhancements
- [ ] **GPU Acceleration**: Use CUDA/TensorFlow GPU for faster processing
- [ ] **Adaptive Quality**: Process at lower resolution, upscale for display
- [ ] **Streaming Processing**: Process and stream chunks instead of entire video
- [ ] **Worker Processes**: Parallel processing of multiple videos

### Feature Additions
- [ ] **More Filters**: Blur, edge detection, color shifts, artistic effects
- [ ] **Custom Filter Creator**: Let users adjust filter parameters
- [ ] **Video Trimming**: Allow users to process only portions of video
- [ ] **Batch Processing**: Upload multiple videos at once
- [ ] **Export Options**: Different resolutions, formats, quality levels

### ML Improvements
- [ ] **Face Detection Overlay**: Draw bounding boxes around detected faces
- [ ] **Pose Estimation**: Detect and highlight body pose
- [ ] **Multi-Person Support**: Handle multiple people in frame differently
- [ ] **Background Replacement**: Replace background with custom image/video
- [ ] **Fine-Tune Segmentation**: Adjust mask threshold based on video content

### User Experience
- [ ] **Progress Indicator**: Show processing progress for long videos
- [ ] **Preview Mode**: Quick low-quality preview before full processing
- [ ] **Shareable Links**: Generate links to processed videos
- [ ] **History**: Save recently processed videos
- [ ] **Mobile App**: Native iOS/Android versions

### Infrastructure
- [ ] **Cloud Deployment**: Deploy to AWS/GCP/Azure
- [ ] **CDN Integration**: Serve cached videos from CDN
- [ ] **Database**: Track processed videos, user preferences
- [ ] **Authentication**: User accounts and private videos
- [ ] **Rate Limiting**: Prevent abuse of processing resources

### Code Quality
- [ ] **Unit Tests**: Test filter functions, API endpoints
- [ ] **Integration Tests**: End-to-end testing
- [ ] **Error Boundaries**: Better error handling in React
- [ ] **Logging**: Structured logging for debugging
- [ ] **Monitoring**: Track performance metrics

## Development Notes

### Adding a New Filter

1. **Create filter function in [backend/helpers.py](backend/helpers.py)**:
```python
def apply_custom_filter(frame, segmentation_mask, threshold=0.5):
    """Apply custom filter to background."""
    mask = np.squeeze(segmentation_mask)
    condition = mask > threshold
    
    # Your filter logic here
    filtered_frame = apply_your_effect(frame)
    
    condition_3d = np.stack((condition,) * 3, axis=-1)
    output_frame = np.where(condition_3d, frame, filtered_frame)
    return output_frame.astype(np.uint8)
```

2. **Register filter in [backend/main.py](backend/main.py)**:
```python
FILTERS = {
    'none': None,
    'grayscale': apply_grayscale_background,
    'sepia': apply_sepia_background,
    'rio': apply_rio_background,
    'custom': apply_custom_filter  # Add your filter
}
```

3. **Add filter option in [frontend/src/App.tsx](frontend/src/App.tsx)**:
```typescript
const filters = useMemo(() => [
  { value: 'none' as FilterType, label: 'No Filter', description: 'Original background' },
  // ... existing filters ...
  { value: 'custom' as FilterType, label: 'Custom Filter', description: 'Your description' },
], []);
```

4. **Update TypeScript types**:
```typescript
type FilterType = 'none' | 'grayscale' | 'sepia' | 'rio' | 'custom';
```

### Debugging Tips

- **Backend logs**: Check terminal running `python main.py`
- **Frontend console**: Open browser DevTools
- **Video loading issues**: Check CORS headers, video codec compatibility
- **Segmentation quality**: Adjust `threshold` parameter in filter functions
- **Cache issues**: Delete contents of `backend/processed_cache/`

## Contributing

This project was created as a technical assessment. For production use, consider:
- Adding comprehensive tests
- Implementing proper error handling
- Setting up CI/CD pipelines
- Deploying to cloud infrastructure
- Adding user authentication

## License

This project is for educational and assessment purposes.

## Acknowledgments

- **MediaPipe**: Google's excellent ML solutions
- **FFmpeg**: The Swiss Army knife of video processing
- **OpenCV**: Computer vision made accessible
- **React**: Making UIs delightful

---

**Built as a technical assessment demonstrating:**
- Full-stack development (Python + React + TypeScript)
- Machine learning integration (MediaPipe)
- Video processing (OpenCV + FFmpeg)
- Modern web development practices
- System architecture and optimization
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend server:
   ```bash
   cd backend
   python main.py
   ```

The backend will run on `http://127.0.0.1:8080`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Backend Routes
- `GET /hello-world` - Test endpoint to verify backend connectivity
- `GET /process-video?video_url=<url>` - Process video with MediaPipe segmentation and grayscale background filter

## Usage

1. Start both the backend and frontend servers
2. Open your browser to `http://localhost:3000`
3. The original video will be displayed on the left
4. Click "Start Processing" to begin the MediaPipe segmentation
5. The processed video (with grayscale background) will appear on the right
6. Click "Stop Processing" to end the stream

## How It Works

### MediaPipe Selfie Segmentation
The system uses MediaPipe's Selfie Segmentation model to:
1. Analyze each video frame
2. Generate a segmentation mask identifying the person vs. background
3. Apply the grayscale filter only to background pixels
4. Stream the processed frames back to the frontend in real-time

### Technical Implementation
- **Backend**: Streams video frames using multipart/x-mixed-replace
- **Frontend**: Displays the stream using an img element
- **Processing**: Each frame is processed in real-time with MediaPipe
- **Performance**: Model selection=1 for better accuracy (can use 0 for faster processing)

## Development Notes

### For Assessment Takers
- The grayscale background filter is now implemented
- Next steps: Add face detection overlay, statistics, and other effects
- Backend: Processing logic is in `backend/helpers.py` and `backend/main.py`
- Frontend: UI controls are in `frontend/src/App.tsx`
- The video URL is configured in `frontend/src/consts.ts`

### Project Configuration
- Video source is configured in `frontend/src/consts.ts`
- Backend port is set to 8080 by default
- Frontend development server runs on port 3000
- MediaPipe segmentation threshold: 0.5 (adjustable in `helpers.py`)

## Technologies Used

- **Backend**: Python, Flask, MediaPipe, OpenCV, NumPy
- **Frontend**: React, TypeScript, HTML5
- **Computer Vision**: MediaPipe Selfie Segmentation
- **Styling**: CSS3 with modern responsive design
- **Development**: Hot reload for both frontend and backend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Test both backend and frontend
5. Submit a pull request

## License

This project is designed for technical assessment purposes.

You may use any tool you wish but you are responsible for understanding all parts of the implementation.