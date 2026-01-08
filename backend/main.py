from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from helpers import *
import cv2
import requests
import os
import hashlib

app = Flask(__name__)
cors = CORS(app)

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache directory for processed videos
CACHE_DIR = os.path.join(os.path.dirname(__file__), "processed_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

@app.route("/hello-world", methods=["GET"])
def hello_world():
    try:
        return jsonify({"Hello": "World"}), 200
    except Exception as e:
        logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get-processed-video", methods=["GET"])
def get_processed_video():
    """
    Returns the processed video with grayscale background.
    Processes and caches it if not already done.
    Expects 'video_url' as a query parameter.
    """
    try:
        video_url = request.args.get('video_url')
        if not video_url:
            return jsonify({"error": "video_url parameter is required"}), 400
        
        # Generate cache key from video URL
        cache_key = hashlib.md5(video_url.encode()).hexdigest()
        cached_video_path = os.path.join(CACHE_DIR, f"{cache_key}.mp4")
        
        # Check if already processed and cached
        if os.path.exists(cached_video_path):
            logger.info(f"Serving cached processed video: {cache_key}")
            return send_file(
                cached_video_path,
                mimetype='video/mp4',
                as_attachment=False
            )
        
        # Not cached - process the video
        logger.info(f"Processing new video: {video_url}")
        
        # Download video to temporary file
        temp_input_path = get_temp_path() + ".mp4"
        logger.info("Downloading video...")
        response = requests.get(video_url, stream=True)
        with open(temp_input_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Extract audio from original video
        temp_audio_path = get_temp_path() + "_audio.aac"
        logger.info("Extracting audio track...")
        import subprocess
        try:
            result = subprocess.run([
                'ffmpeg', '-i', temp_input_path,
                '-vn',  # No video
                '-acodec', 'aac',  # Re-encode to AAC instead of copy
                '-b:a', '128k',
                '-y',
                temp_audio_path
            ], check=True, capture_output=True, text=True)
            has_audio = True
            logger.info("Audio track extracted successfully")
        except subprocess.CalledProcessError as e:
            logger.warning(f"No audio track found in video: {e.stderr}")
            has_audio = False
        
        # Open video
        cap = cv2.VideoCapture(temp_input_path)
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Video: {frame_width}x{frame_height} @ {fps}fps, {total_frames} frames")
        
        # Create output video writer (write to temp file first)
        temp_output_path = get_temp_path() + "_output.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_output_path, fourcc, fps, (frame_width, frame_height))
        
        # Download model if not exists
        model_path = os.path.join(os.path.dirname(__file__), "selfie_multiclass_256x256.tflite")
        if not os.path.exists(model_path):
            import urllib.request
            model_url = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
            logger.info("Downloading segmentation model...")
            urllib.request.urlretrieve(model_url, model_path)
        
        # Initialize MediaPipe segmenter
        base_options = mp.tasks.BaseOptions(model_asset_path=model_path)
        options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=base_options,
            output_category_mask=True)
        
        frame_count = 0
        
        logger.info("Processing video frames...")
        with mp.tasks.vision.ImageSegmenter.create_from_options(options) as segmenter:
            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break
                
                # Convert BGR to RGB for MediaPipe
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Create MediaPipe Image
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                
                # Process frame with MediaPipe
                segmentation_result = segmenter.segment(mp_image)
                
                # Get the segmentation mask and apply filter
                if segmentation_result.category_mask is not None:
                    category_mask = segmentation_result.category_mask.numpy_view()
                    person_mask = (category_mask > 0).astype(np.float32)
                    processed_frame = apply_grayscale_background(frame, person_mask, threshold=0.5)
                else:
                    processed_frame = frame
                
                # Write processed frame
                out.write(processed_frame)
                
                frame_count += 1
                if frame_count % 50 == 0:
                    progress = int((frame_count / total_frames) * 100)
                    logger.info(f"Progress: {frame_count}/{total_frames} ({progress}%)")
        
        # Release resources
        cap.release()
        out.release()
        
        # Re-encode with H.264 for browser compatibility using ffmpeg
        logger.info("Re-encoding video with H.264 codec for browser compatibility...")
        import subprocess
        
        if has_audio:
            # Merge processed video with original audio
            logger.info("Merging processed video with audio track...")
            result = subprocess.run([
                'ffmpeg', '-i', temp_output_path,
                '-i', temp_audio_path,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-shortest',  # Match shortest stream
                '-y',
                cached_video_path
            ], capture_output=True, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                raise Exception("Failed to merge audio")
            logger.info("Audio merged successfully")
        else:
            # No audio, just re-encode video
            logger.info("No audio track - encoding video only")
            subprocess.run([
                'ffmpeg', '-i', temp_output_path,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-y',
                cached_video_path
            ], check=True, capture_output=True)
        
        logger.info("Video processing completed and cached!")
        
        # Clean up temporary files
        if os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if os.path.exists(temp_output_path):
            os.remove(temp_output_path)
        if has_audio and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        
        # Serve the processed video
        return send_file(
            cached_video_path,
            mimetype='video/mp4',
            as_attachment=False
        )
    
    except Exception as e:
        logger.error(f"Error processing video: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True, use_reloader=False)
