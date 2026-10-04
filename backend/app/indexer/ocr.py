"""
Optical Character Recognition (OCR) Engine for Images.
Integrates Pillow and Tesseract with auto-discovery and graceful fallbacks.
"""
import io
import os
from typing import Optional, Dict, Any
from PIL import Image

from app.config import get_settings

settings = get_settings()

# Auto-detect Tesseract binary path on Windows if not explicitly set
TESSERACT_AVAILABLE = False
try:
    import pytesseract
    possible_paths = [
        settings.TESSERACT_CMD,
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\Users\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
    ]
    for p in possible_paths:
        if p and os.path.exists(p):
            pytesseract.pytesseract.tesseract_cmd = p
            TESSERACT_AVAILABLE = True
            break
    if not TESSERACT_AVAILABLE:
        # Check if tesseract is on PATH
        try:
            pytesseract.get_tesseract_version()
            TESSERACT_AVAILABLE = True
        except Exception:
            TESSERACT_AVAILABLE = False
except ImportError:
    pytesseract = None
    TESSERACT_AVAILABLE = False


def extract_ocr_from_image(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extract text and metadata from image bytes.
    If Tesseract is not available, returns image metadata cleanly without error.
    """
    result = {
        "text": "",
        "width": 0,
        "height": 0,
        "format": "",
        "ocr_available": TESSERACT_AVAILABLE,
        "error": None,
    }

    try:
        image = Image.open(io.BytesIO(image_bytes))
        result["width"] = image.width
        result["height"] = image.height
        result["format"] = image.format or "UNKNOWN"

        if TESSERACT_AVAILABLE and pytesseract and settings.ENABLE_OCR:
            # Convert RGBA/Palette to RGB for OCR processing
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            text = pytesseract.image_to_string(image)
            result["text"] = text.strip()
        else:
            result["text"] = f"[Image: {result['format']} {result['width']}x{result['height']} - OCR not configured on server]"
    except Exception as e:
        result["error"] = f"Image processing error: {str(e)}"

    return result
