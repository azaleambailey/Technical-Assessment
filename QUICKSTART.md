# Quick Start Guide - MediaPipe Selfie Segmentation

## Overview
This system uses MediaPipe's Image Segmentation to detect people in video and apply a grayscale filter to the background while keeping the person in color.

## Setup Instructions

### 1. Backend Setup

```bash
# Navigate to project root
cd /Users/azalea.mbailey/Desktop/Technical-Assessment

# Activate virtual environment (if not already active)
source venv/bin/activate

# Install dependencies (should already be installed)
pip install -r requirements.txt

# Start the backend server
cd backend
python main.py
```

The backend will start on `http://127.0.0.1:8080`

### 2. Frontend Setup

Open a new terminal:

```bash
# Navigate to frontend directory
cd /Users/azalea.mbailey/Desktop/Technical-Assessment/frontend

# Install dependencies (if not already done)
npm install

# Start the React app
npm start
```

The frontend will open automatically at `http://localhost:3000`

## Usage

1. **View Original Video**: The original video appears on the left side
2. **Click "Start Processing"**: Begins the MediaPipe segmentation processing
3. **View Processed Video**: The processed video (with grayscale background) appears on the right
4. **Click "Stop Processing"**: Stops the video stream

## How It Works

### Backend Processing Flow:
1. Frontend sends video URL to `/process-video` endpoint
2. Backend downloads the video to a temporary file
3. For each frame:
   - Converts BGR to RGB for MediaPipe
   - Creates MediaPipe Image object
   - Runs segmentation to identify person vs background
   - Applies grayscale filter to background pixels only
   - Encodes frame as JPEG
   - Streams frame to frontend
4. Cleans up temporary files

### MediaPipe Selfie Segmentation:
- **Model**: `selfie_multiclass_256x256.tflite`
- **Auto-download**: Downloads on first use (~1MB)
- **Classes**: Background (0), Person parts (1+)
- **Threshold**: 0.5 (adjustable in helpers.py)

## Key Files

### Backend:
- **[backend/main.py](backend/main.py)**: Flask server with `/process-video` endpoint
- **[backend/helpers.py](backend/helpers.py)**: `apply_grayscale_background()` function
- **[requirements.txt](requirements.txt)**: Python dependencies

### Frontend:
- **[frontend/src/App.tsx](frontend/src/App.tsx)**: React component with video players and controls
- **[frontend/src/consts.ts](frontend/src/consts.ts)**: Video URL configuration

## Troubleshooting

### Backend won't start:
- Make sure virtual environment is activated
- Check all dependencies are installed: `pip list | grep -E "(mediapipe|opencv|numpy)"`

### Video doesn't process:
- Check browser console for errors (F12)
- Verify backend is running on port 8080
- Check backend terminal for error messages

### Model download fails:
- Check internet connection
- Model will be saved to: `backend/selfie_multiclass_256x256.tflite`

## Next Steps

The grayscale background filter is complete! Next features to implement:

1. **Face Detection Overlay**: Add bounding boxes around detected faces
2. **Detection Statistics**: Count faces, track confidence scores
3. **Additional Filters**: Blur background, color replacement, etc.
4. **Real-time Controls**: Adjust threshold, toggle effects

## Performance Notes

- **Processing Speed**: ~10-30 FPS depending on video resolution and hardware
- **Model Load Time**: ~1-2 seconds on first frame
- **Video Download**: Depends on video size and internet speed
- **Memory Usage**: ~200-500MB for typical video processing

## API Reference

### GET `/process-video`

**Query Parameters:**
- `video_url` (required): URL of the video to process

**Response:**
- Content-Type: `multipart/x-mixed-replace; boundary=frame`
- Streams JPEG frames continuously

**Example:**
```
http://127.0.0.1:8080/process-video?video_url=https://example.com/video.mp4
```
