import logging
import ffmpeg
import os
import uuid
import cv2
import mediapipe as mp
import numpy as np

# A lightweight face detection model
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_temp_path():
    temp_dir = os.path.join(os.path.dirname(__file__), "temp")
    os.makedirs(temp_dir, exist_ok=True)
    random_filename = f"temp_{str(uuid.uuid4())[:8]}"
    return os.path.join(temp_dir, random_filename)

def apply_grayscale_background(frame, segmentation_mask, threshold=0.5):
    """
    Apply grayscale filter to the background while keeping the person in color.
    
    Args:
        frame: The original BGR frame from video
        segmentation_mask: The segmentation mask from MediaPipe (values 0-1)
        threshold: Threshold for segmentation (default 0.5)
    
    Returns:
        Processed frame with grayscale background
    """
    # Ensure mask is 2D by squeezing any extra dimensions
    mask = np.squeeze(segmentation_mask)
    
    # Create a binary mask (1 for person, 0 for background)
    condition = mask > threshold
    
    # Convert background to grayscale
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray_frame_bgr = cv2.cvtColor(gray_frame, cv2.COLOR_GRAY2BGR)
    
    # Expand condition to 3 channels to match frame dimensions
    condition_3d = np.stack((condition,) * 3, axis=-1)
    
    # Combine: where condition is True (person), use original frame; else use grayscale
    output_frame = np.where(condition_3d, frame, gray_frame_bgr)
    
    return output_frame.astype(np.uint8)