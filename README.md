# Face Detection Technical Assessment

A full-stack application for implementing face detection and video segmentation on video content, designed as a technical assessment platform.

## Project Structure

This repository contains two main components:

### Backend (`/backend`)
- **Technology**: Python Flask with MediaPipe
- **Purpose**: Provides API endpoints for video processing with selfie segmentation
- **Key Files**:
  - `main.py` - Main application entry point with video processing endpoint
  - `helpers.py` - Utility functions including MediaPipe segmentation
  - `requirements.txt` - Python dependencies

### Frontend (`/frontend`)
- **Technology**: React with TypeScript
- **Purpose**: User interface for video playback and processed video visualization
- **Key Files**:
  - `src/App.tsx` - Main React component
  - `src/components/` - Reusable UI components
  - `src/consts.ts` - Configuration constants (video URL)

## Features

### ✅ Implemented: Grayscale Background Filter
- **Person Detection**: Uses MediaPipe Selfie Segmentation to identify people in video
- **Background Segmentation**: Separates the person from the background
- **Selective Filtering**: Applies grayscale filter to background only while keeping person in color
- **Real-time Display**: Streams processed video frames to the frontend

### 🚧 Coming Soon
- Face detection overlay
- Detection statistics
- Additional visual effects

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the project root directory
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
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