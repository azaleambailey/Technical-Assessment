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

# Available filters
FILTERS = {
    'none': None,
    'grayscale': apply_grayscale_background,
    'sepia': apply_sepia_background,
    'inverted': apply_inverted_background,
    'rio': apply_rio_background
}

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
    Returns processed video with specified filter.
    Processes and caches all filter variations if not already done.
    """
    try:
        video_url = request.args.get('video_url')
        filter_type = request.args.get('filter', 'none')
        
        if not video_url:
            return jsonify({"error": "video_url parameter is required"}), 400
        
        if filter_type not in FILTERS:
            return jsonify({"error": f"Invalid filter. Choose from: {list(FILTERS.keys())}"}), 400
        
        # Generate cache key from video URL
        cache_key = hashlib.md5(video_url.encode()).hexdigest()
        cached_video_path = os.path.join(CACHE_DIR, f"{cache_key}_{filter_type}.mp4")
        
        # Check if this specific filter version is cached
        if os.path.exists(cached_video_path):
            logger.info(f"Serving cached video: {cache_key}_{filter_type}")
            return send_file(cached_video_path, mimetype='video/mp4', as_attachment=False)
        
        # Not cached - process all filter variations at once
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

def process_all_filters(video_url, cache_key):
    """Process video with all filters and save separate versions."""
    temp_input_path = None
    temp_audio_path = None
    
    try:
        # Download video
        temp_input_path = get_temp_path() + ".mp4"
        logger.info("Downloading video...")
        response = requests.get(video_url, stream=True)
        with open(temp_input_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Extract audio
        temp_audio_path = get_temp_path() + "_audio.aac"
        logger.info("Extracting audio...")
        import subprocess
        try:
            subprocess.run([
                'ffmpeg', '-i', temp_input_path,
                '-vn', '-acodec', 'aac', '-b:a', '128k', '-y',
                temp_audio_path
            ], check=True, capture_output=True, text=True)
            has_audio = True
            logger.info("Audio extracted successfully")
        except subprocess.CalledProcessError:
            logger.warning("No audio track found")
            has_audio = False
        
        # Open video
        cap = cv2.VideoCapture(temp_input_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Video: {frame_width}x{frame_height} @ {fps}fps, {total_frames} frames")
        
        # Download MediaPipe model if needed
        model_path = os.path.join(os.path.dirname(__file__), "selfie_multiclass_256x256.tflite")
        if not os.path.exists(model_path):
            import urllib.request
            model_url = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
            logger.info("Downloading segmentation model...")
            urllib.request.urlretrieve(model_url, model_path)
        
        # Initialize MediaPipe
        base_options = mp.tasks.BaseOptions(model_asset_path=model_path)
        options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=base_options,
            output_category_mask=True)
        
        # Create temporary output files for each filter
        temp_outputs = {}
        writers = {}
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        
        for filter_name in FILTERS.keys():
            temp_path = get_temp_path() + f"_{filter_name}.mp4"
            temp_outputs[filter_name] = temp_path
            writers[filter_name] = cv2.VideoWriter(temp_path, fourcc, fps, (frame_width, frame_height))
        
        # Process all frames
        frame_count = 0
        logger.info("Processing frames with all filters...")
        
        with mp.tasks.vision.ImageSegmenter.create_from_options(options) as segmenter:
            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break
                
                # Get segmentation mask
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                segmentation_result = segmenter.segment(mp_image)
                
                if segmentation_result.category_mask is not None:
                    category_mask = segmentation_result.category_mask.numpy_view()
                    person_mask = (category_mask > 0).astype(np.float32)
                    
                    # Apply each filter and write to respective output
                    for filter_name, filter_func in FILTERS.items():
                        if filter_func is None:
                            # No filter - use original frame
                            processed_frame = frame
                        else:
                            processed_frame = filter_func(frame, person_mask, threshold=0.5)
                        
                        writers[filter_name].write(processed_frame)
                else:
                    # No mask - write original frame to all outputs
                    for writer in writers.values():
                        writer.write(frame)
                
                frame_count += 1
                if frame_count % 50 == 0:
                    progress = int((frame_count / total_frames) * 100)
                    logger.info(f"Progress: {frame_count}/{total_frames} ({progress}%)")
        
        # Release resources
        cap.release()
        for writer in writers.values():
            writer.release()
        
        logger.info("Re-encoding all filter variations with H.264...")
        
        # Re-encode each version with H.264 and audio
        for filter_name, temp_path in temp_outputs.items():
            final_path = os.path.join(CACHE_DIR, f"{cache_key}_{filter_name}.mp4")
            
            if has_audio:
                subprocess.run([
                    'ffmpeg', '-i', temp_path, '-i', temp_audio_path,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
                    '-shortest', '-y', final_path
                ], check=True, capture_output=True)
            else:
                subprocess.run([
                    'ffmpeg', '-i', temp_path,
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                    '-pix_fmt', 'yuv420p', '-y', final_path
                ], check=True, capture_output=True)
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            logger.info(f"Completed: {filter_name}")
        
        logger.info("All filter variations processed and cached!")
        
        # Clean up
        if temp_input_path and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if has_audio and temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
    
    except Exception as e:
        logger.error(f"Error processing filters: {e}")
        # Clean up on error
        if temp_input_path and os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
        raise


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080, debug=True, use_reloader=False)
