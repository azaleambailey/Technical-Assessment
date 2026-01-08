"""
Flask backend server for video processing with background filters.

This application provides REST API endpoints for:
- Video upload (file or URL)
- Person segmentation using MediaPipe
- Applying selective background filters (grayscale, sepia, rio)
- Caching processed videos for performance

The core functionality uses MediaPipe's selfie segmentation model to detect people
in videos and apply filters only to the background while keeping the person in full color.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from helpers import *
import cv2
import requests
import os
import hashlib
import uuid

app = Flask(__name__)
cors = CORS(app)  # Enable CORS for all routes (allows frontend access)

load_dotenv()

# Configure logging to track processing steps and errors
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache directory for processed videos
# Storing processed videos prevents re-processing the same video multiple times
CACHE_DIR = os.path.join(os.path.dirname(__file__), "processed_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Uploaded videos directory for user-uploaded files
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploaded_videos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Available filters - maps filter names to their processing functions
# 'none' means no filter, just the original video
FILTERS = {
    'none': None,
    'grayscale': apply_grayscale_background,
    'sepia': apply_sepia_background,
    'rio': apply_rio_background
}

@app.route("/hello-world", methods=["GET"])
def hello_world():
    """
    Simple health check endpoint to verify the server is running.
    
    Returns:
        JSON: {"Hello": "World"} with 200 status code
    """
    try:
        return jsonify({"Hello": "World"}), 200
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/upload-video", methods=["POST"])
def upload_video():
    """
    Handle video file uploads from the frontend.
    
    Validates the uploaded file, saves it with a unique filename, and returns
    a URL that can be used to access the video for processing.
    
    Expected request:
        - multipart/form-data with 'video' file field
    
    Returns:
        JSON: {
            "success": True,
            "video_url": "http://127.0.0.1:8080/uploaded-videos/<filename>",
            "filename": "<unique_filename>"
        }
    
    Validation:
        - Checks for file presence
        - Validates file extension (.mp4, .mov, .avi, .webm, .mkv)
        - Generates UUID-based filename to prevent conflicts
    """
    try:
        # Validate file is present in request
        if 'video' not in request.files:
            return jsonify({"error": "No video file provided"}), 400
        
        file = request.files['video']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Validate file extension to prevent non-video uploads
        allowed_extensions = {'.mp4', '.mov', '.avi', '.webm', '.mkv'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            return jsonify({"error": f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"}), 400
        
        # Generate unique filename using UUID to prevent overwrites
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file to uploaded_videos directory
        file.save(file_path)
        logger.info(f"Video uploaded: {unique_filename}")
        
        # Return URL that points to the uploaded file
        video_url = f"http://127.0.0.1:8080/uploaded-videos/{unique_filename}"
        
        return jsonify({
            "success": True,
            "video_url": video_url,
            "filename": unique_filename
        }), 200
    
    except Exception as e:
        logger.error(f"Upload error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/uploaded-videos/<filename>", methods=["GET"])
def serve_uploaded_video(filename):
    """
    Serve uploaded video files to the frontend.
    
    This endpoint allows the frontend to access user-uploaded videos
    that have been saved in the uploaded_videos directory.
    
    Args:
        filename: The unique filename of the uploaded video
    
    Returns:
        The video file with appropriate mimetype, or 404 if not found
    """
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404
        return send_file(file_path, mimetype='video/mp4', as_attachment=False)
    except Exception as e:
        logger.error(f"Error serving file: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get-processed-video", methods=["GET"])
def get_processed_video():
    """
    Returns processed video with specified filter applied to the background.
    
    This is the main endpoint for video processing. It implements smart caching:
    when a new video is requested, it processes ALL filter variations at once
    and caches them. Subsequent requests for different filters return immediately
    from cache without reprocessing.
    
    Query Parameters:
        video_url (required): URL of the video to process (YouTube or direct link)
        filter (optional): Filter type - 'none', 'grayscale', 'sepia', or 'rio' (default: 'none')
    
    Returns:
        The processed video file as MP4 stream
    
    Caching Strategy:
        - Uses MD5 hash of video_url as cache key
        - Stores separate cache files for each filter: {cache_key}_{filter}.mp4
        - On first request, processes all filters at once (efficient batch processing)
        - Subsequent requests return cached files instantly
    
    Example:
        GET /get-processed-video?video_url=https://youtube.com/watch?v=xxx&filter=grayscale
    """
    try:
        video_url = request.args.get('video_url')
        filter_type = request.args.get('filter', 'none')
        
        if not video_url:
            return jsonify({"error": "video_url parameter is required"}), 400
        
        if filter_type not in FILTERS:
            return jsonify({"error": f"Invalid filter. Choose from: {list(FILTERS.keys())}"}), 400
        
        # Generate cache key from video URL using MD5 hash for consistent naming
        cache_key = hashlib.md5(video_url.encode()).hexdigest()
        cached_video_path = os.path.join(CACHE_DIR, f"{cache_key}_{filter_type}.mp4")
        
        # Check if this specific filter version is cached
        if os.path.exists(cached_video_path):
            logger.info(f"Serving cached video: {cache_key}_{filter_type}")
            return send_file(cached_video_path, mimetype='video/mp4', as_attachment=False)
        
        # Not cached - process all filter variations at once for efficiency
        logger.info(f"Processing all filter variations for: {video_url}")
        process_all_filters(video_url, cache_key)
        
        # Serve the requested filter
        if os.path.exists(cached_video_path):
            return send_file(cached_video_path, mimetype='video/mp4', as_attachment=False)
        else:
            return jsonify({"error": "Failed to process video"}), 500
    
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def download_video(video_url, output_path):
    """
    Download video from URL, supporting both YouTube and direct video links.
    
    This function intelligently handles two types of video sources:
    1. YouTube videos - uses yt-dlp to download with proper format selection
    2. Direct video URLs - uses requests library to stream download
    
    Args:
        video_url: URL of the video (YouTube or direct link)
        output_path: Where to save the downloaded video
    
    Why yt-dlp:
        YouTube videos require special handling because they don't provide direct
        video file URLs. yt-dlp handles authentication, format selection, and
        merging of video/audio streams automatically.
    """
    import yt_dlp
    
    # Check if it's a YouTube URL by looking for characteristic URL patterns
    if 'youtube.com' in video_url or 'youtu.be' in video_url:
        logger.info("Detected YouTube URL, using yt-dlp...")
        # Configure yt-dlp to download best quality MP4 format
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': output_path,  # Output template for filename
            'quiet': False,
            'no_warnings': False,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])
            logger.info("YouTube video downloaded successfully")
        except Exception as e:
            logger.error(f"yt-dlp error: {e}")
            raise
    else:
        # Direct URL download using requests library
        logger.info("Downloading from direct URL...")
        response = requests.get(video_url, stream=True)
        response.raise_for_status()  # Raise error for bad status codes
        
        # Stream download in chunks to handle large files efficiently
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info("Video downloaded successfully")

def process_all_filters(video_url, cache_key):
    """
    Process video with all available filters and save separate cached versions.
    
    This is the core video processing function. It implements an efficient batch
    processing strategy: instead of processing the video separately for each filter,
    it processes all frames once and applies all filters simultaneously. This approach
    was chosen because:
    
    1. Reading video frames is the most expensive operation
    2. MediaPipe segmentation is the second most expensive
    3. Applying different color filters to the same frame is cheap
    4. Processing all filters at once is ~4x faster than processing separately
    
    Processing Pipeline:
        1. Download video from URL
        2. Extract audio track (if present)
        3. Initialize MediaPipe selfie segmentation model
        4. For each frame:
           a. Run MediaPipe segmentation to get person mask
           b. Apply all filters to the frame using the same mask
           c. Write frame to separate output files (one per filter)
        5. Re-encode all outputs with H.264 codec
        6. Merge audio back into each video
        7. Cache all versions
    
    Args:
        video_url: URL of the video to process
        cache_key: MD5 hash of video_url used for cache filenames
    
    Technical Choices:
        - MediaPipe Selfie Segmentation: Lightweight, accurate, runs on CPU
        - H.264 codec: Universal browser support
        - Batch processing: Process all filters at once for efficiency
        - FFmpeg for encoding: Industry standard, excellent compression
    """
    temp_input_path = None
    temp_audio_path = None
    
    try:
        # Download video to temporary location
        temp_input_path = get_temp_path() + ".mp4"
        logger.info("Downloading video...")
        download_video(video_url, temp_input_path)
        
        # Extract audio track using FFmpeg
        temp_audio_path = get_temp_path() + "_audio.aac"
        logger.info("Extracting audio...")
        import subprocess
        try:
            # Use FFmpeg to extract audio stream
            subprocess.run([
                'ffmpeg', '-i', temp_input_path,
                '-vn',  # No video
                '-acodec', 'aac',  # AAC codec for compatibility
                '-b:a', '128k',  # Audio bitrate
                '-y',  # Overwrite output
                temp_audio_path
            ], check=True, capture_output=True, text=True)
            has_audio = True
            logger.info("Audio extracted successfully")
        except subprocess.CalledProcessError:
            # Some videos don't have audio tracks
            logger.warning("No audio track found")
            has_audio = False
        
        # Open video with OpenCV to read frames and get video properties
        cap = cv2.VideoCapture(temp_input_path)
        fps = cap.get(cv2.CAP_PROP_FPS)  # Frames per second
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Video: {frame_width}x{frame_height} @ {fps}fps, {total_frames} frames")
        
        # Download MediaPipe segmentation model if not already present
        # This is a pre-trained model specifically for person segmentation
        model_path = os.path.join(os.path.dirname(__file__), "selfie_multiclass_256x256.tflite")
        if not os.path.exists(model_path):
            import urllib.request
            model_url = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
            logger.info("Downloading segmentation model...")
            urllib.request.urlretrieve(model_url, model_path)
        
        # Initialize MediaPipe Image Segmenter with category mask output
        # Category mask: each pixel gets a category (0=background, 1+=person parts)
        base_options = mp.tasks.BaseOptions(model_asset_path=model_path)
        options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=base_options,
            output_category_mask=True)  # Output mask for person detection
        
        # Create temporary output files for each filter
        # We'll write to these simultaneously as we process frames
        temp_outputs = {}
        writers = {}
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # MP4V codec for initial write
        
        for filter_name in FILTERS.keys():
            temp_path = get_temp_path() + f"_{filter_name}.mp4"
            temp_outputs[filter_name] = temp_path
            # Create VideoWriter for each filter output
            writers[filter_name] = cv2.VideoWriter(temp_path, fourcc, fps, (frame_width, frame_height))
        
        # Process all frames - this is the main processing loop
        frame_count = 0
        logger.info("Processing frames with all filters...")
        
        with mp.tasks.vision.ImageSegmenter.create_from_options(options) as segmenter:
            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break  # End of video
                
                # Get segmentation mask from MediaPipe
                # Convert BGR (OpenCV) to RGB (MediaPipe expects RGB)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                segmentation_result = segmenter.segment(mp_image)
                
                # Process the segmentation result
                if segmentation_result.category_mask is not None:
                    # Extract person mask (category > 0 means person/body parts)
                    category_mask = segmentation_result.category_mask.numpy_view()
                    person_mask = (category_mask > 0).astype(np.float32)
                    
                    # Apply each filter and write to respective output file
                    for filter_name, filter_func in FILTERS.items():
                        if filter_func is None:
                            # No filter - use original frame
                            processed_frame = frame
                        else:
                            # Apply filter function to background only
                            processed_frame = filter_func(frame, person_mask, threshold=0.5)
                        
                        writers[filter_name].write(processed_frame)
                else:
                    # No segmentation mask - write original frame to all outputs
                    # This can happen if no person is detected in the frame
                    for writer in writers.values():
                        writer.write(frame)
                
                # Log progress every 50 frames to avoid console spam
                frame_count += 1
                if frame_count % 50 == 0:
                    progress = int((frame_count / total_frames) * 100)
                    logger.info(f"Progress: {frame_count}/{total_frames} ({progress}%)")
        
        # Release video resources
        cap.release()
        for writer in writers.values():
            writer.release()
        
        logger.info("Re-encoding all filter variations with H.264...")
        
        # Re-encode each version with H.264 codec and merge audio
        # Why re-encode?
        # - MP4V codec from OpenCV isn't web-compatible
        # - H.264 (libx264) has universal browser support
        # - FFmpeg provides better compression and quality
        for filter_name, temp_path in temp_outputs.items():
            final_path = os.path.join(CACHE_DIR, f"{cache_key}_{filter_name}.mp4")
            
            if has_audio:
                # Merge video and audio streams
                subprocess.run([
                    'ffmpeg', '-i', temp_path, '-i', temp_audio_path,
                    '-c:v', 'libx264',  # H.264 video codec
                    '-preset', 'fast',  # Encoding speed preset
                    '-crf', '23',  # Constant Rate Factor (quality: 0=best, 51=worst)
                    '-pix_fmt', 'yuv420p',  # Pixel format for compatibility
                    '-c:a', 'aac',  # AAC audio codec
                    '-b:a', '128k',  # Audio bitrate
                    '-shortest',  # Match shortest stream duration
                    '-y',  # Overwrite output
                    final_path
                ], check=True, capture_output=True)
            else:
                # Video only, no audio to merge
                subprocess.run([
                    'ffmpeg', '-i', temp_path,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    final_path
                ], check=True, capture_output=True)
            
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            logger.info(f"Completed: {filter_name}")
        
        logger.info("All filter variations processed and cached!")
        
        # Clean up temporary download and audio files
        if temp_input_path and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if has_audio and temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
    
    except Exception as e:
        logger.error(f"Error processing filters: {e}")
        # Clean up on error to prevent orphaned files
        if temp_input_path and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        raise


if __name__ == "__main__":
    # Run Flask development server
    # host='0.0.0.0' allows access from other machines on the network
    # port=8080 is the server port
    # debug=True enables auto-reload and better error messages
    # use_reloader=False prevents double initialization (important for MediaPipe)
    app.run(host='0.0.0.0', port=8080, debug=True, use_reloader=False)
