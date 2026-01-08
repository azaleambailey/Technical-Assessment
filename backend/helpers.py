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

def apply_sepia_background(frame, segmentation_mask, threshold=0.5):
    """Apply sepia filter to background."""
    mask = np.squeeze(segmentation_mask)
    condition = mask > threshold
    
    # Sepia matrix
    sepia_frame = frame.copy().astype(np.float32)
    sepia_frame[:,:,0] = np.clip(0.272 * frame[:,:,0] + 0.534 * frame[:,:,1] + 0.131 * frame[:,:,2], 0, 255)
    sepia_frame[:,:,1] = np.clip(0.349 * frame[:,:,0] + 0.686 * frame[:,:,1] + 0.168 * frame[:,:,2], 0, 255)
    sepia_frame[:,:,2] = np.clip(0.393 * frame[:,:,0] + 0.769 * frame[:,:,1] + 0.189 * frame[:,:,2], 0, 255)
    
    condition_3d = np.stack((condition,) * 3, axis=-1)
    output_frame = np.where(condition_3d, frame, sepia_frame)
    
    return output_frame.astype(np.uint8)

def apply_inverted_background(frame, segmentation_mask, threshold=0.5):
    """Apply inverted colors to background."""
    mask = np.squeeze(segmentation_mask)
    condition = mask > threshold
    
    inverted_frame = 255 - frame
    
    condition_3d = np.stack((condition,) * 3, axis=-1)
    output_frame = np.where(condition_3d, frame, inverted_frame)
    
    return output_frame.astype(np.uint8)

def apply_rio_background(frame, segmentation_mask, threshold=0.5):
    """Apply Rio de Janeiro Instagram filter to background - blue-toned and desaturated."""
    mask = np.squeeze(segmentation_mask)
    condition = mask > threshold
    
    # Rio filter: cool blue-gray desaturated look
    rio_frame = frame.copy().astype(np.float32)
    
    # Calculate grayscale
    gray = 0.299 * rio_frame[:,:,2] + 0.587 * rio_frame[:,:,1] + 0.114 * rio_frame[:,:,0]
    
    # Apply cool desaturated look with blue tones
    rio_frame[:,:,0] = np.clip(gray * 0.7 + rio_frame[:,:,0] * 0.5, 0, 255)  # Blue (increased)
    rio_frame[:,:,1] = np.clip(gray * 0.6 + rio_frame[:,:,1] * 0.4, 0, 255)  # Green (moderate)
    rio_frame[:,:,2] = np.clip(gray * 0.5 + rio_frame[:,:,2] * 0.3, 0, 255)  # Red (reduced)
    
    # Add subtle blue tint
    rio_frame[:,:,0] = np.clip(rio_frame[:,:,0] * 1.15, 0, 255)  # Boost blue
    rio_frame[:,:,2] = np.clip(rio_frame[:,:,2] * 0.9, 0, 255)   # Reduce red
    
    condition_3d = np.stack((condition,) * 3, axis=-1)
    output_frame = np.where(condition_3d, frame, rio_frame)
    
    return output_frame.astype(np.uint8)