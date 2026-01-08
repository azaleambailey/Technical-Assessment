"""Helper functions for video processing and filter application.

This module contains utility functions for:
- Generating temporary file paths
- Applying various background filters (grayscale, sepia, rio)
- Person/background segmentation using MediaPipe
"""

import logging
import ffmpeg
import os
import uuid
import cv2
import mediapipe as mp
import numpy as np

# A lightweight face detection model using OpenCV's Haar Cascade
# This is available as a fallback, but MediaPipe is used for person segmentation
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_temp_path():
    """
    Generate a unique temporary file path.
    
    Creates a temporary directory if it doesn't exist and generates a unique
    filename using UUID to avoid conflicts during parallel processing.
    
    Returns:
        str: Absolute path to a temporary file (without extension)
    
    Example:
        >>> temp_path = get_temp_path()
        >>> temp_video = temp_path + ".mp4"
    """
    # Create temp directory in the backend folder
    temp_dir = os.path.join(os.path.dirname(__file__), "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Generate random filename using first 8 chars of UUID for uniqueness
    random_filename = f"temp_{str(uuid.uuid4())[:8]}"
    return os.path.join(temp_dir, random_filename)

def apply_grayscale_background(frame, segmentation_mask, threshold=0.5):
    """
    Apply grayscale filter to the background while keeping the person in color.
    
    This is the core function for achieving the "speaker in color, background B&W" effect.
    It uses the segmentation mask from MediaPipe to identify person vs. background pixels,
    then selectively applies grayscale conversion only to background areas.
    
    Args:
        frame: The original BGR frame from video (numpy array, shape: [H, W, 3])
        segmentation_mask: The segmentation mask from MediaPipe (values 0-1, where >0 indicates person)
        threshold: Threshold for segmentation (default 0.5). Higher values make the mask stricter.
    
    Returns:
        numpy.ndarray: Processed frame with grayscale background and color person (uint8)
    
    Technical Approach:
        1. Convert mask to binary (person vs background)
        2. Convert entire frame to grayscale
        3. Use mask to composite: keep color where person is detected, use B&W elsewhere
    """
    # Ensure mask is 2D by squeezing any extra dimensions that MediaPipe might add
    mask = np.squeeze(segmentation_mask)
    
    # Create a binary mask (1 for person, 0 for background) based on threshold
    condition = mask > threshold
    
    # Convert entire frame to grayscale for the background
    gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    # Convert back to BGR (3-channel) so it can be combined with original
    gray_frame_bgr = cv2.cvtColor(gray_frame, cv2.COLOR_GRAY2BGR)
    
    # Expand condition to 3 channels (BGR) to match frame dimensions
    condition_3d = np.stack((condition,) * 3, axis=-1)
    
    # Combine: where condition is True (person), use original frame; else use grayscale
    output_frame = np.where(condition_3d, frame, gray_frame_bgr)
    
    return output_frame.astype(np.uint8)

def apply_sepia_background(frame, segmentation_mask, threshold=0.5):
    """
    Apply sepia filter to background for a vintage, warm brown tone effect.
    
    Sepia tone gives a nostalgic, old-photograph appearance to the background
    while keeping the person in full color.
    
    Args:
        frame: The original BGR frame from video (numpy array, shape: [H, W, 3])
        segmentation_mask: The segmentation mask from MediaPipe (values 0-1)
        threshold: Threshold for person detection (default 0.5)
    
    Returns:
        numpy.ndarray: Processed frame with sepia background and color person (uint8)
    
    Technical Details:
        Uses standard sepia transformation matrix to convert RGB values
        to warm brown tones. The matrix coefficients create the vintage look.
    """
    # Create binary mask for person vs background
    mask = np.squeeze(segmentation_mask)
    condition = mask > threshold
    
    # Apply sepia transformation matrix to entire frame
    # Sepia matrix coefficients create warm brown tones
    sepia_frame = frame.copy().astype(np.float32)
    # Blue channel: weighted combination emphasizing greens
    sepia_frame[:,:,0] = np.clip(0.272 * frame[:,:,0] + 0.534 * frame[:,:,1] + 0.131 * frame[:,:,2], 0, 255)
    # Green channel: balanced weights
    sepia_frame[:,:,1] = np.clip(0.349 * frame[:,:,0] + 0.686 * frame[:,:,1] + 0.168 * frame[:,:,2], 0, 255)
    # Red channel: weighted combination emphasizing reds for warmth
    sepia_frame[:,:,2] = np.clip(0.393 * frame[:,:,0] + 0.769 * frame[:,:,1] + 0.189 * frame[:,:,2], 0, 255)
    
    # Expand mask to 3 channels
    condition_3d = np.stack((condition,) * 3, axis=-1)
    # Composite: person in color, background in sepia
    output_frame = np.where(condition_3d, frame, sepia_frame)
    
    return output_frame.astype(np.uint8)

def apply_rio_background(frame, segmentation_mask, threshold=0.5):
    """
    Apply Rio de Janeiro Instagram-style filter to background.
    
    Creates a purple/magenta nostalgic tone reminiscent of Instagram's Rio filter.
    This gives a dreamy, slightly desaturated look with purple/pink tints to the background.
    
    Args:
        frame: The original BGR frame from video (numpy array, shape: [H, W, 3])
        segmentation_mask: The segmentation mask from MediaPipe (values 0-1)
        threshold: Threshold for person detection (default 0.5)
    
    Returns:
        numpy.ndarray: Processed frame with Rio-filtered background and color person (uint8)
    
    Technical Approach:
        1. Calculate grayscale base using luminance formula
        2. Blend grayscale with original for desaturation
        3. Apply color shifts to boost blue and red (purple/magenta)
        4. Reduce green channel for vintage look
    """
    # Create binary mask for person vs background
    mask = np.squeeze(segmentation_mask)
    condition = mask > threshold
    
    # Rio filter: purple/magenta nostalgic look
    rio_frame = frame.copy().astype(np.float32)
    
    # Calculate grayscale using standard luminance formula (ITU-R BT.601)
    # Human eye is most sensitive to green, then red, then blue
    gray = 0.299 * rio_frame[:,:,2] + 0.587 * rio_frame[:,:,1] + 0.114 * rio_frame[:,:,0]
    
    # Apply desaturated look with purple/pink tones by blending grayscale with color
    rio_frame[:,:,0] = np.clip(gray * 0.5 + rio_frame[:,:,0] * 0.6, 0, 255)  # Blue (moderate boost)
    rio_frame[:,:,1] = np.clip(gray * 0.4 + rio_frame[:,:,1] * 0.5, 0, 255)  # Green (reduced for warmth)
    rio_frame[:,:,2] = np.clip(gray * 0.6 + rio_frame[:,:,2] * 0.7, 0, 255)  # Red (increased)
    
    # Add purple/magenta tint by boosting blue and red channels
    rio_frame[:,:,0] = np.clip(rio_frame[:,:,0] * 1.2, 0, 255)   # Boost blue for purple tone
    rio_frame[:,:,2] = np.clip(rio_frame[:,:,2] * 1.15, 0, 255)  # Boost red for magenta tone
    rio_frame[:,:,1] = np.clip(rio_frame[:,:,1] * 0.85, 0, 255)  # Reduce green for vintage effect
    
    # Expand mask to 3 channels
    condition_3d = np.stack((condition,) * 3, axis=-1)
    # Composite: person in color, background with Rio filter
    output_frame = np.where(condition_3d, frame, rio_frame)
    
    return output_frame.astype(np.uint8)