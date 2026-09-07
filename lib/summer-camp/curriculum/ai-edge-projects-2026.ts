/**
 * AI & Edge Computing — 3 hands-on capstone projects.
 * Seeded via scripts/seed-ai-edge-projects.ts
 *
 * Structure follows a computer-vision engineer workflow:
 *   Phase 1 — Pre-flight (hardware + environment)
 *   Phase 2 — Code lab (instructor script)
 *   Phase 3 — Baseline run (first successful detection)
 *   Phase 4 — Experiments (tuning + edge cases)
 *   Phase 5 — Demo + reflection
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import {
  CAPSTONE_DEFAULT_RUN,
  CAMPUS_SAFETY_ASSISTANT_PLACEHOLDER,
  RECYCLING_ASSISTANT_PLACEHOLDER,
  SMART_OBJECT_DETECTION_PLACEHOLDER,
} from "./ai-edge-project-code"

export type CapstoneProjectDef = {
  slug: string
  title: string
  shortDescription: string
  sort_order: number
  difficulty: "easy" | "medium" | "hard"
  required: boolean
  estimated_hours: string
  badge: string
  xp_reward: number
  overview: string
  learning_outcomes: string[]
  hardware?: string[]
  module: CurriculumModule
}

function step(title: string, description: string, sort: number): CurriculumBlock {
  return {
    block_type: "step",
    sort_order: sort,
    content: { title, description, checkable: true },
  }
}

function checkpoint(
  title: string,
  description: string,
  sort: number,
  opts?: { video?: boolean; faculty?: boolean },
): CurriculumBlock {
  return {
    block_type: "checkpoint",
    sort_order: sort,
    content: {
      title,
      description,
      acceptedTypes: opts?.video
        ? ["video/mp4", "video/webm", "video/quicktime"]
        : ["image/png", "image/jpeg", "image/webp", "application/pdf"],
      maxSizeMb: opts?.video ? 100 : 10,
      facultyApproval: opts?.faculty !== false,
    },
  }
}

function md(text: string, sort: number): CurriculumBlock {
  return { block_type: "text", sort_order: sort, content: { markdown: text } }
}

function activity(title: string, description: string, sort: number): CurriculumBlock {
  return { block_type: "activity", sort_order: sort, content: { title, description, variant: "discussion" } }
}

function reflection(prompt: string, sort: number): CurriculumBlock {
  return { block_type: "reflection", sort_order: sort, content: { prompt } }
}

function callout(text: string, sort: number, variant: "tip" | "warning" = "tip"): CurriculumBlock {
  return { block_type: "callout", sort_order: sort, content: { variant, text } }
}

function codeLab(
  sort: number,
  opts: {
    title: string
    description: string
    filename: string
    code: string
    runInstructions?: string
  },
): CurriculumBlock {
  return {
    block_type: "code",
    sort_order: sort,
    content: {
      contentType: "code_lab",
      language: "python",
      title: opts.title,
      description: opts.description,
      filename: opts.filename,
      downloadFilename: opts.filename,
      allowCopy: true,
      allowDownload: true,
      studentCopyEnabled: true,
      studentDownloadEnabled: true,
      allowExpand: true,
      allowFullscreen: true,
      allowLineNumbers: true,
      showFilename: true,
      showDescription: true,
      showRunInstructions: true,
      runInstructions: opts.runInstructions ?? CAPSTONE_DEFAULT_RUN(opts.filename),
      code: opts.code,
    },
  }
}

function phase(title: string, sort: number): CurriculumBlock {
  return md(`---\n\n## ${title}`, sort)
}

const VENV_REMINDER =
  "Always activate your virtual environment first:\n\n```bash\nsource ~/creditcenter/pvamu/bin/activate\n```"

export const AI_EDGE_2026_CAPSTONE_PROJECTS: CapstoneProjectDef[] = [
  {
    slug: "smart-object-detection-camera",
    title: "Smart Object Detection Camera",
    shortDescription:
      "Build your first Edge AI system with Raspberry Pi, camera, and TensorFlow Lite object detection.",
    sort_order: 10,
    difficulty: "easy",
    required: true,
    estimated_hours: "4–6",
    badge: "Object Detection Explorer",
    xp_reward: 400,
    overview:
      "Students will build their first Edge AI system using a Raspberry Pi, camera module, and TensorFlow Lite to identify common objects in real time (person, bottle, backpack, laptop, chair, cell phone).",
    learning_outcomes: [
      "Edge AI fundamentals",
      "Computer vision basics",
      "Object detection with TensorFlow Lite",
      "Raspberry Pi deployment",
    ],
    hardware: ["Raspberry Pi 5", "Arducam 5MP (CSI)", "Monitor", "Keyboard", "Mouse"],
    module: {
      title: "Project 1 — Smart Object Detection Camera",
      description:
        "Phased Edge AI object detection capstone — pre-flight, code lab, baseline run, experiments, and demo.",
      sort_order: 0,
      blocks: [
        callout(
          "Difficulty: Easy · Recommended first capstone · 4–6 hours · Badge: Object Detection Explorer · 400 XP",
          0,
        ),
        md(
          "### Mission\n\nYou are the **Computer Vision Engineer** on this project. Your job is to take a live camera feed, run a TensorFlow Lite detection model on the Raspberry Pi, and prove the system works with labeled bounding boxes in real time.\n\n**Target detections:** person, bottle, backpack, laptop, chair, cell phone",
          1,
        ),
        md(
          "### Learning outcomes\n\n- Edge AI fundamentals\n- TensorFlow Lite inference on device\n- Object detection pipeline design\n- Raspberry Pi camera integration\n- Detection validation experiments",
          2,
        ),
        md("### Hardware checklist\n\n- [ ] Raspberry Pi 5 powered on\n- [ ] Arducam CSI ribbon connected (blue side toward Ethernet)\n- [ ] Monitor, keyboard, mouse attached\n- [ ] Module 9 virtual environment ready (`~/creditcenter/pvamu`)", 3),

        phase("Phase 1 — Pre-flight: Hardware & Environment", 4),
        step(
          "Step 1.1 — Verify Pi + camera hardware",
          "Power on the Pi. Confirm the camera ribbon is seated correctly. Take a photo of your complete kit setup.",
          5,
        ),
        checkpoint(
          "Checkpoint 1.1 — Hardware photo",
          "Upload a photo showing Raspberry Pi 5, camera module, and connected peripherals.",
          6,
          { faculty: false },
        ),
        step(
          "Step 1.2 — Confirm camera stream",
          "Run `rpicam-hello -t 5000` or your Module 8 verification command. Confirm you see a live preview.",
          7,
        ),
        checkpoint(
          "Checkpoint 1.2 — Camera verification",
          "Upload a screenshot of successful camera verification (rpicam-hello or live preview).",
          8,
          { faculty: false },
        ),
        step(
          "Step 1.3 — Activate environment & install TFLite deps",
          `${VENV_REMINDER}\n\nInstall TensorFlow Lite runtime if not already present:\n\n\`\`\`bash\npip install tflite-runtime numpy\n\`\`\`\n\nConfirm OpenCV still works: \`python -c "import cv2; print(cv2.__version__)"\``,
          9,
        ),

        phase("Phase 2 — Code Lab: Object Detection Script", 10),
        md(
          "### Download the project script\n\n1. Review the code below\n2. **Copy** or **Download** the instructor-provided script\n3. Save as `smart_object_detection.py` in `~/creditcenter`\n4. If you see `[PLACEHOLDER]`, ask your instructor — they may still be uploading the final code",
          11,
        ),
        codeLab(12, {
          title: "Smart Object Detection Camera — Main Script",
          description:
            "TensorFlow Lite object detection on live Pi camera feed. Detects common COCO classes with labeled bounding boxes.",
          filename: "smart_object_detection.py",
          code: SMART_OBJECT_DETECTION_PLACEHOLDER,
        }),
        md(
          "### Engineer notes — what to focus on\n\nYou do **not** need every line on day one. Focus on these blocks in order:\n\n1. **Load model** — TFLite interpreter + label map\n2. **Open camera** — rpicam-vid pipe (same pattern as Module 10)\n3. **Inference loop** — preprocess frame → run model → parse outputs\n4. **Draw results** — boxes, labels, confidence scores\n5. **Display** — `cv2.imshow` + quit on `q`",
          13,
        ),

        phase("Phase 3 — Baseline Run: First Detection", 14),
        step(
          "Step 3.1 — Place model files",
          "Copy the `.tflite` model and `labels.txt` into `~/creditcenter/models/` (paths must match the script).",
          15,
        ),
        step(
          "Step 3.2 — Run the detection script",
          "Open Geany or Terminal. Run the script. Confirm the camera window opens without errors.",
          16,
        ),
        step(
          "Step 3.3 — Capture one successful detection",
          "Hold one object (bottle, phone, or cup) in frame until a labeled bounding box appears. Press `s` to save a snapshot if supported.",
          17,
        ),
        checkpoint(
          "Checkpoint 3.1 — First detection screenshot",
          "Upload a screenshot showing at least one labeled bounding box on a detected object.",
          18,
        ),

        phase("Phase 4 — Experiments: Validate the System", 19),
        callout(
          "Think like an engineer: a demo that works once is luck. A demo that works under varied conditions is engineering.",
          20,
        ),
        step(
          "Experiment 4.1 — Three-class validation",
          "Detect **three different object classes** (e.g. person + bottle + phone). Record confidence scores you observe.",
          21,
        ),
        checkpoint(
          "Checkpoint 4.1 — Three-object detection",
          "Upload a screenshot showing three different object classes detected (can be separate runs).",
          22,
        ),
        step(
          "Experiment 4.2 — Distance test",
          "Try close (30 cm), medium (1 m), and far (2 m). Note when labels disappear or confidence drops.",
          23,
        ),
        step(
          "Experiment 4.3 — Lighting test",
          "Test bright room, dim room, and side lighting. Document which condition works best.",
          24,
        ),
        activity(
          "Experiment 4.4 — Share findings",
          "Post your distance/lighting results in the discussion. What surprised you?",
          25,
        ),

        phase("Phase 5 — Demo & Wrap-up", 26),
        step(
          "Step 5.1 — Record demo video",
          "Record a 1–3 minute video: show hardware, run live detection on 3+ objects, explain the pipeline briefly.",
          27,
        ),
        checkpoint(
          "Checkpoint 5.1 — Demo video",
          "Upload your live object detection demo video (MP4, max 100 MB).",
          28,
          { video: true },
        ),
        reflection("What was the hardest part of getting object detection running on the Pi?", 29),
        {
          block_type: "module_completion",
          sort_order: 30,
          content: {
            title: "Project 1 complete!",
            message: "You deployed TensorFlow Lite object detection on Raspberry Pi. Project 2 builds on this pipeline.",
            rewards: { xp: 400, badges: ["object-detection-explorer"] },
          },
        },
      ],
    },
  },
  {
    slug: "smart-campus-safety-assistant",
    title: "Smart Campus Safety Assistant",
    shortDescription:
      "Extend object detection into a campus monitoring solution with alerts, counts, and event logging.",
    sort_order: 20,
    difficulty: "medium",
    required: false,
    estimated_hours: "6–8",
    badge: "Edge AI Security Engineer",
    xp_reward: 600,
    overview:
      "Extend your object detection system into a smart campus monitoring solution that detects people, counts occupancy, monitors room activity, generates alerts, and logs detection events.",
    learning_outcomes: [
      "Event logging",
      "Automation workflows",
      "Monitoring systems",
      "Security applications",
      "AI pipeline design",
    ],
    module: {
      title: "Project 2 — Smart Campus Safety Assistant",
      description:
        "Phased campus safety capstone — person detection, occupancy counting, alerts, and event logging.",
      sort_order: 0,
      blocks: [
        callout("Difficulty: Medium · Optional · Requires Project 1 · 6–8 hours · Badge: Edge AI Security Engineer · 600 XP", 0),
        md(
          "### Mission\n\nYou are building a **campus space monitor**. Extend Project 1's detector to answer: *How many people are in this room? When did someone enter? Should we alert staff?*\n\n**Pipeline:** Camera → Detection → Person Filter → Count → Alert → Event Log → Display",
          1,
        ),
        md(
          "### Prerequisites\n\n- [ ] Project 1 object detection running\n- [ ] Same Pi hardware + venv from Module 9\n- [ ] Understanding of confidence thresholds and class labels",
          2,
        ),

        phase("Phase 1 — Architecture Review", 3),
        step(
          "Step 1.1 — Study the safety pipeline",
          "Draw or review: Camera → TFLite → filter `person` class → count → alert if count > 0 → append to log file.",
          4,
        ),
        step(
          "Step 1.2 — Define your campus scenario",
          "Pick a use case: lab entrance, study room, hallway. Write one sentence describing who would use this monitor.",
          5,
        ),
        md(
          "### Design decisions (engineer's notebook)\n\n| Parameter | Suggested starting value | Why |\n|-----------|-------------------------|-----|\n| Person confidence threshold | 0.5 | Reduce false positives |\n| Alert trigger | count ≥ 1 | Simple entry detection |\n| Log format | CSV with timestamp | Easy to review later |",
          6,
        ),

        phase("Phase 2 — Code Lab: Campus Safety Script", 7),
        md(
          "### Download the project script\n\n1. Copy or download the code below\n2. Save as `campus_safety_assistant.py` in `~/creditcenter`\n3. Ensure Project 1 model files are in place",
          8,
        ),
        codeLab(9, {
          title: "Smart Campus Safety Assistant — Main Script",
          description:
            "Extends object detection with person filtering, live occupancy count, on-screen alerts, and CSV event logging.",
          filename: "campus_safety_assistant.py",
          code: CAMPUS_SAFETY_ASSISTANT_PLACEHOLDER,
        }),
        md(
          "### Engineer notes — build order\n\n1. **Reuse detector** from Project 1\n2. **Filter persons** — keep only `person` class above threshold\n3. **Count** — display `People in frame: N`\n4. **Alert** — flash banner or console message on detection\n5. **Log** — append `{timestamp, count}` to CSV",
          10,
        ),

        phase("Phase 3 — Baseline: Person Detection", 11),
        step(
          "Step 3.1 — Run the safety script",
          "Activate venv and run `campus_safety_assistant.py`. Confirm the camera window opens.",
          12,
        ),
        step(
          "Step 3.2 — Tune person threshold",
          "If you see false detections, raise confidence to 0.6–0.7. If misses occur, lower to 0.4.",
          13,
        ),
        checkpoint(
          "Checkpoint 3.1 — Person detection screenshot",
          "Upload a screenshot showing person detection with bounding box and confidence score.",
          14,
        ),

        phase("Phase 4 — Features: Count, Alert, Log", 15),
        step(
          "Step 4.1 — Verify live count",
          "Stand in frame alone → count should show 1. Add a second person → count should update.",
          16,
        ),
        checkpoint(
          "Checkpoint 4.1 — Occupancy count display",
          "Upload a screenshot showing the on-screen people counter (preferably with 2+ people).",
          17,
        ),
        step(
          "Step 4.2 — Trigger alert",
          "Confirm alert appears when a person enters frame (banner, border flash, or console message).",
          18,
        ),
        checkpoint(
          "Checkpoint 4.2 — Alert screenshot",
          "Upload a screenshot of your alert UI or terminal output when a person is detected.",
          19,
        ),
        step(
          "Step 4.3 — Verify event log",
          "Run for 30 seconds with people entering/leaving. Open the log file and confirm timestamped entries.",
          20,
        ),
        checkpoint(
          "Checkpoint 4.3 — Detection log",
          "Upload a screenshot of your log file entries (CSV, JSON, or terminal log).",
          21,
        ),

        phase("Phase 5 — Scenario Tests & Demo", 22),
        step(
          "Scenario 5.1 — Empty room",
          "No people in frame for 10 s. Count should be 0. No alert.",
          23,
        ),
        step(
          "Scenario 5.2 — Single entry",
          "One person walks in. Count → 1. Alert fires. Log entry created.",
          24,
        ),
        step(
          "Scenario 5.3 — Multiple people",
          "Two or more people in frame. Count updates. Log reflects peak occupancy.",
          25,
        ),
        activity(
          "Scenario 5.4 — Document results",
          "Post your three scenario results in the discussion. Any false alarms?",
          26,
        ),
        checkpoint(
          "Checkpoint 5.1 — Final demo video",
          "Upload a video showing detection, counting, alerts, and logging in one continuous demo.",
          27,
          { video: true },
        ),
        reflection("How would you deploy this system responsibly on a real campus?", 28),
        {
          block_type: "module_completion",
          sort_order: 29,
          content: {
            title: "Project 2 complete!",
            message: "You built an Edge AI monitoring system with alerts and logging.",
            rewards: { xp: 600, badges: ["edge-ai-security-engineer"] },
          },
        },
      ],
    },
  },
  {
    slug: "smart-recycling-assistant",
    title: "Smart Recycling Assistant",
    shortDescription:
      "Build an Edge AI recycling assistant that identifies items and recommends recycle, trash, or compost.",
    sort_order: 30,
    difficulty: "hard",
    required: false,
    estimated_hours: "8–12",
    badge: "Edge AI Sustainability Engineer",
    xp_reward: 800,
    overview:
      "Build a smart recycling assistant using Edge AI. The system identifies recyclable items and provides disposal recommendations (recycle, trash, compost).",
    learning_outcomes: [
      "AI decision systems",
      "Sustainability applications",
      "Edge AI automation",
      "Environmental engineering concepts",
    ],
    module: {
      title: "Project 3 — Smart Recycling Assistant",
      description:
        "Phased sustainability capstone — detection, disposal rules, recommendation UI, and multi-item validation.",
      sort_order: 0,
      blocks: [
        callout("Difficulty: Hard · Optional · Requires Project 1 · 8–12 hours · Badge: Edge AI Sustainability Engineer · 800 XP", 0),
        md(
          "### Mission\n\nYou are building a **recycling decision assistant**. The camera sees an item; your system recommends **Recycle**, **Trash**, or **Compost**.\n\n**Pipeline:** Camera → Detection → Label Lookup → Disposal Rule → UI Banner → Log",
          1,
        ),
        md(
          "### Prerequisites\n\n- [ ] Project 1 object detection running\n- [ ] Familiarity with COCO label names your model outputs\n- [ ] Basic understanding of local recycling rules (we provide a starter rules table)",
          2,
        ),

        phase("Phase 1 — Rules Design (before coding)", 3),
        step(
          "Step 1.1 — Review disposal categories",
          "Understand three bins: **Recycle** (clean paper, plastic bottles, cans), **Trash** (food-contaminated items, styrofoam), **Compost** (food scraps, banana peels).",
          4,
        ),
        md(
          "### Starter rules table (customize for your campus)\n\n| Detected label | Bin | Notes |\n|----------------|-----|-------|\n| bottle | RECYCLE | Empty and rinse |\n| cup | TRASH | Often wax-coated |\n| banana | COMPOST | Food waste |\n| book | RECYCLE | Paper |\n| cell phone | TRASH | E-waste — special drop-off |\n| unknown | ASK | Prompt user to decide |",
          5,
        ),
        step(
          "Step 1.2 — Draft your rules map",
          "Create a Python dict or JSON file mapping at least 8 labels to Recycle / Trash / Compost. Save as `recycling_rules.json`.",
          6,
        ),
        checkpoint(
          "Checkpoint 1.1 — Rules documentation",
          "Upload a screenshot or PDF of your disposal rules table (minimum 8 items).",
          7,
          { faculty: false },
        ),

        phase("Phase 2 — Code Lab: Recycling Assistant Script", 8),
        md(
          "### Download the project script\n\n1. Copy or download the code below\n2. Save as `recycling_assistant.py` in `~/creditcenter`\n3. Place your `recycling_rules.json` alongside the script",
          9,
        ),
        codeLab(10, {
          title: "Smart Recycling Assistant — Main Script",
          description:
            "Object detection plus disposal rules engine. Shows a large Recycle / Trash / Compost recommendation banner on screen.",
          filename: "recycling_assistant.py",
          code: RECYCLING_ASSISTANT_PLACEHOLDER,
        }),
        md(
          "### Engineer notes — build order\n\n1. **Reuse detector** from Project 1\n2. **Load rules** — JSON/dict lookup by label\n3. **Classify disposal** — return bin type + color code\n4. **UI banner** — large text: `→ RECYCLE` (green), `→ TRASH` (red), `→ COMPOST` (brown)\n5. **Log decisions** — timestamp, label, confidence, recommendation",
          11,
        ),

        phase("Phase 3 — Baseline: Item Detection", 12),
        step(
          "Step 3.1 — Run the recycling script",
          "Activate venv and run `recycling_assistant.py`. Hold a plastic bottle in frame.",
          13,
        ),
        checkpoint(
          "Checkpoint 3.1 — First item detected",
          "Upload a screenshot showing a detected item with bounding box.",
          14,
        ),
        step(
          "Step 3.2 — First recommendation",
          "Confirm the recommendation banner appears (e.g. bottle → RECYCLE).",
          15,
        ),
        checkpoint(
          "Checkpoint 3.2 — Recommendation UI",
          "Upload a screenshot showing the on-screen Recycle / Trash / Compost recommendation.",
          16,
        ),

        phase("Phase 4 — Multi-item Validation", 17),
        callout(
          "Test at least 5 different physical items. A rules engine that only works for bottles is not a recycling assistant.",
          18,
        ),
        step(
          "Experiment 4.1 — Five-item test matrix",
          "Run these items: plastic bottle, paper/cardboard, banana or food scrap, cup, can. Record detection label and recommendation.",
          19,
        ),
        md(
          "### Test matrix (fill in during experiments)\n\n| Item | Detected label | Confidence | Recommendation | Correct? |\n|------|----------------|------------|----------------|----------|\n| Plastic bottle | | | | |\n| Paper | | | | |\n| Food scrap | | | | |\n| Cup | | | | |\n| Can | | | | |",
          20,
        ),
        checkpoint(
          "Checkpoint 4.1 — Multi-item screenshot",
          "Upload a screenshot showing at least two different items with different recommendations.",
          21,
        ),
        step(
          "Experiment 4.2 — Unknown item handling",
          "Show an item not in your rules table. Confirm the system shows ASK or UNKNOWN gracefully.",
          22,
        ),
        activity(
          "Experiment 4.3 — Sustainability pitch",
          "Draft a 30-second pitch: how would this assistant help your school reduce waste?",
          23,
        ),

        phase("Phase 5 — Demo & Wrap-up", 24),
        step(
          "Step 5.1 — Record sustainability demo",
          "Record a 2–3 minute video: introduce the problem, demo 3+ items, explain one rule decision.",
          25,
        ),
        checkpoint(
          "Checkpoint 5.1 — Final demo video",
          "Upload your recycling assistant demo video (MP4). Include at least three different item recommendations.",
          26,
          { video: true },
        ),
        reflection("What environmental impact could Edge AI recycling assistants have at scale?", 27),
        {
          block_type: "module_completion",
          sort_order: 28,
          content: {
            title: "Project 3 complete!",
            message: "You built an AI decision system for sustainability on the Edge.",
            rewards: { xp: 800, badges: ["edge-ai-sustainability-engineer"] },
          },
        },
      ],
    },
  },
]
