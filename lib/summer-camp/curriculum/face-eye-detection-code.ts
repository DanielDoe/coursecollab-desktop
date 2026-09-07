/** Default Face & Eye Detection demo for Module 10 code lab. */
export const FACE_EYE_DETECTION_DEMO = `"""
=============================================================
  FACE & EYE DETECTION - Summer Camp Demo
  Hardware: Raspberry Pi 5 + Arducam 5MP (CSI ribbon)
  Library:  OpenCV (cv2)
  Camera:   rpicam-vid pipe (works on Pi 5 natively)
=============================================================

WHAT THIS SCRIPT DOES:
  - Captures live video from your Arducam via rpicam-vid
  - Detects human faces using a Haar Cascade classifier
  - Detects eyes inside each detected face
  - Draws colored rectangles: green=face, blue=eye
  - Shows live FPS
  - Press 'q' to quit, 's' to save a snapshot

HOW IT WORKS:
  rpicam-vid streams raw YUV frames into this script via a pipe.
  OpenCV converts each frame to BGR and runs Haar Cascade detection.
=============================================================
"""

import cv2
import time
import sys
import os
import subprocess
import numpy as np

# ─────────────────────────────────────────────
#  CAMERA SETTINGS
# ─────────────────────────────────────────────
WIDTH      = 640
HEIGHT     = 480
FRAMERATE  = 30

# ─────────────────────────────────────────────
#  STEP 1: Load Haar Cascade classifiers
# ─────────────────────────────────────────────
cascade_base = cv2.data.haarcascades

face_cascade = cv2.CascadeClassifier(cascade_base + "haarcascade_frontalface_default.xml")
eye_cascade  = cv2.CascadeClassifier(cascade_base + "haarcascade_eye.xml")

if face_cascade.empty() or eye_cascade.empty():
    print("[ERROR] Could not load Haar Cascade XML files.")
    print("        Make sure OpenCV is properly installed.")
    sys.exit(1)

print("[OK] Classifiers loaded.")

# ─────────────────────────────────────────────
#  STEP 2: Start rpicam-vid pipe
# ─────────────────────────────────────────────
def open_camera():
    """Launch rpicam-vid and pipe raw YUV420 frames into Python."""
    cmd = [
        "rpicam-vid",
        "--width",     str(WIDTH),
        "--height",    str(HEIGHT),
        "--framerate", str(FRAMERATE),
        "--codec",     "yuv420",
        "--timeout",   "0",       # run until we kill it
        "--nopreview",
        "-o", "-"                 # output to stdout
    ]
    print("[INFO] Starting rpicam-vid ...")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    time.sleep(1)  # give the camera a moment to warm up
    print("[OK]  rpicam-vid is running.")
    return proc


def read_frame(proc):
    """Read one YUV420 frame and convert to BGR for OpenCV."""
    frame_size = WIDTH * HEIGHT * 3 // 2   # YUV420 = 1.5 bytes per pixel
    raw = proc.stdout.read(frame_size)

    if len(raw) != frame_size:
        return False, None        # pipe closed or partial read

    yuv = np.frombuffer(raw, dtype=np.uint8).reshape((HEIGHT * 3 // 2, WIDTH))
    bgr = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR_I420)
    return True, bgr


# ─────────────────────────────────────────────
#  STEP 3: Detection settings
# ─────────────────────────────────────────────
FACE_SCALE_FACTOR  = 1.1
FACE_MIN_NEIGHBORS = 5
FACE_MIN_SIZE      = (80, 80)

EYE_SCALE_FACTOR   = 1.1
EYE_MIN_NEIGHBORS  = 10
EYE_MIN_SIZE       = (20, 20)

COLOR_FACE = (0, 255, 0)      # Green
COLOR_EYE  = (255, 100, 0)    # Blue
COLOR_TEXT = (255, 255, 255)  # White
COLOR_FPS  = (0, 200, 255)    # Yellow

SNAPSHOT_DIR = "snapshots"
os.makedirs(SNAPSHOT_DIR, exist_ok=True)
snapshot_count = 0

# ─────────────────────────────────────────────
#  STEP 4: Main loop
# ─────────────────────────────────────────────
proc = open_camera()

print("\\n[RUNNING] Face & Eye Detection started!")
print("  Press 'q' to quit")
print("  Press 's' to save a snapshot\\n")

prev_time = time.time()

while True:

    ret, frame = read_frame(proc)

    if not ret:
        print("[WARNING] Failed to read frame. Exiting.")
        break

    # Convert to grayscale for detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)  # improve detection in uneven lighting

    # ── Face Detection ───────────────────────
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor  = FACE_SCALE_FACTOR,
        minNeighbors = FACE_MIN_NEIGHBORS,
        minSize      = FACE_MIN_SIZE,
        flags        = cv2.CASCADE_SCALE_IMAGE
    )

    face_count = len(faces) if not isinstance(faces, tuple) else 0

    for (fx, fy, fw, fh) in faces:
        cv2.rectangle(frame, (fx, fy), (fx + fw, fy + fh), COLOR_FACE, 2)
        cv2.putText(frame, "Face", (fx, fy - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_FACE, 2)

        # ── Eye Detection (inside face only) ─
        roi_gray  = gray [fy:fy+fh, fx:fx+fw]
        roi_color = frame[fy:fy+fh, fx:fx+fw]

        eyes = eye_cascade.detectMultiScale(
            roi_gray,
            scaleFactor  = EYE_SCALE_FACTOR,
            minNeighbors = EYE_MIN_NEIGHBORS,
            minSize      = EYE_MIN_SIZE
        )

        for (ex, ey, ew, eh) in eyes:
            cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), COLOR_EYE, 2)
            cv2.putText(roi_color, "Eye", (ex, ey - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, COLOR_EYE, 1)

    # ── FPS ──────────────────────────────────
    curr_time = time.time()
    fps = 1.0 / (curr_time - prev_time + 1e-6)
    prev_time = curr_time

    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_FPS, 2)
    cv2.putText(frame, f"Faces: {face_count}", (10, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_TEXT, 2)

    h, w = frame.shape[:2]
    cv2.putText(frame, "Q = Quit  |  S = Snapshot", (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_TEXT, 1)

    cv2.imshow("Face & Eye Detection - Summer Camp Demo", frame)

    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        print("[INFO] Quitting...")
        break
    elif key == ord('s'):
        snapshot_count += 1
        filename = os.path.join(SNAPSHOT_DIR, f"snapshot_{snapshot_count:03d}.jpg")
        cv2.imwrite(filename, frame)
        print(f"[SNAPSHOT] Saved → {filename}")

# ─────────────────────────────────────────────
#  STEP 5: Clean up
# ─────────────────────────────────────────────
proc.terminate()
proc.wait()
cv2.destroyAllWindows()
print("[DONE] Goodbye!")
`
