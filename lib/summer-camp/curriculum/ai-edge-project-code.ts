/** Capstone project code placeholders — instructors/TAs replace with full scripts. */

export const SMART_OBJECT_DETECTION_PLACEHOLDER = `"""
=============================================================
  SMART OBJECT DETECTION CAMERA — Summer Camp Capstone (Project 1)
  Hardware: Raspberry Pi 5 + Arducam 5MP (CSI ribbon)
  Library:  TensorFlow Lite + OpenCV (cv2)
  Camera:   rpicam-vid pipe (Pi 5) or cv2.VideoCapture fallback
=============================================================

WHAT THIS SCRIPT DOES:
  - Captures live video from the Pi camera
  - Runs a TensorFlow Lite object detection model on each frame
  - Draws labeled bounding boxes (person, bottle, phone, etc.)
  - Shows FPS and detection count
  - Press 'q' to quit, 's' to save a snapshot

EXPECTED PIPELINE:
  Camera → Frame Capture → TFLite Inference → NMS/Filter → Draw Labels → Display

INSTRUCTOR: Replace this placeholder with the complete project script.
STUDENTS:   Copy the instructor-provided code into smart_object_detection.py
=============================================================
"""

# ─────────────────────────────────────────────
#  INSTRUCTOR UPLOAD AREA
#  Paste the complete Smart Object Detection Camera program below.
# ─────────────────────────────────────────────

# TODO: import cv2, numpy, tflite runtime, subprocess, etc.

# TODO: MODEL_PATH = "models/detect.tflite"
# TODO: LABELS_PATH = "models/labels.txt"

# TODO: def load_model(): ...
# TODO: def open_camera(): ...       # rpicam-vid pipe (see Module 10)
# TODO: def read_frame(proc): ...
# TODO: def run_inference(interpreter, frame): ...
# TODO: def draw_detections(frame, results): ...

# TODO: main loop — capture → detect → display → handle 'q' / 's'

print("[PLACEHOLDER] Instructor has not uploaded the final project code yet.")
print("            Ask your instructor or check back in the project workspace.")
`

export const CAMPUS_SAFETY_ASSISTANT_PLACEHOLDER = `"""
=============================================================
  SMART CAMPUS SAFETY ASSISTANT — Summer Camp Capstone (Project 2)
  Hardware: Raspberry Pi 5 + Arducam 5MP
  Builds on: Project 1 object detection pipeline
=============================================================

WHAT THIS SCRIPT DOES:
  - Detects people in a campus/lab space
  - Displays a live occupancy count on screen
  - Triggers a visible alert when a person enters the frame
  - Logs timestamped detection events to a file
  - Press 'q' to quit

EXPECTED PIPELINE:
  Camera → Object Detection → Person Filter → Count → Alert → Event Log → Display

INSTRUCTOR: Replace this placeholder with the complete campus safety script.
STUDENTS:   Copy into campus_safety_assistant.py in ~/creditcenter
=============================================================
"""

# ─────────────────────────────────────────────
#  INSTRUCTOR UPLOAD AREA
# ─────────────────────────────────────────────

# TODO: import cv2, datetime, json or csv for logging

# TODO: CONFIDENCE_THRESHOLD = 0.5
# TODO: PERSON_CLASS_ID = 0          # verify against your label map
# TODO: LOG_FILE = "campus_safety_log.csv"

# TODO: def load_detector(): ...     # reuse TFLite model from Project 1
# TODO: def filter_persons(detections): ...
# TODO: def update_count(persons): ...
# TODO: def show_alert(frame, active): ...
# TODO: def log_event(count, timestamp): ...

# TODO: main loop — detect → count → alert → log → display

print("[PLACEHOLDER] Instructor has not uploaded the final project code yet.")
print("            Complete Project 1 first, then return for this script.")
`

export const RECYCLING_ASSISTANT_PLACEHOLDER = `"""
=============================================================
  SMART RECYCLING ASSISTANT — Summer Camp Capstone (Project 3)
  Hardware: Raspberry Pi 5 + Arducam 5MP
  Builds on: Project 1 detection + custom decision rules
=============================================================

WHAT THIS SCRIPT DOES:
  - Detects common items (bottle, can, cup, paper, etc.)
  - Maps each item to Recycle / Trash / Compost
  - Displays a large on-screen recommendation
  - Logs decisions for review
  - Press 'q' to quit, 'n' for next item

EXPECTED PIPELINE:
  Camera → Object Detection → Label Lookup → Disposal Rule → UI Banner → Log

INSTRUCTOR: Replace this placeholder with the complete recycling assistant script.
STUDENTS:   Copy into recycling_assistant.py in ~/creditcenter
=============================================================
"""

# ─────────────────────────────────────────────
#  INSTRUCTOR UPLOAD AREA
# ─────────────────────────────────────────────

# TODO: import cv2, json

# TODO: RECYCLING_RULES = {
# TODO:     "bottle": "RECYCLE",
# TODO:     "cup":    "TRASH",
# TODO:     "banana": "COMPOST",
# TODO:     ...
# TODO: }

# TODO: def load_detector(): ...
# TODO: def classify_disposal(label): ...
# TODO: def draw_recommendation(frame, label, bin_type): ...
# TODO: def log_decision(label, bin_type, confidence): ...

# TODO: main loop — detect → classify → recommend → display

print("[PLACEHOLDER] Instructor has not uploaded the final project code yet.")
print("            Complete Project 1 first, then return for this script.")
`

export const CAPSTONE_DEFAULT_RUN = (filename: string) =>
  `source ~/creditcenter/pvamu/bin/activate\ncd ~/creditcenter\npython ${filename}`
