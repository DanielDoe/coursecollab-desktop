/**
 * Module 3 — Eye Tracking Systems and HTC Vive Pro Eye Hardware
 * XR Attention Analytics · Summer Research Training 2026
 *
 * Instructor note (not shown to students): add Vive Pro Eye teardown image, Tobii architecture
 * diagram, Lighthouse tracking animation, base station placement diagram, calibration screenshots,
 * Unity gaze-ray visualization, and a short screen recording of live gaze tracking.
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

function reflect(prompt: string, sort: number, extra?: Record<string, unknown>): CurriculumBlock {
  return { block_type: "reflection", sort_order: sort, content: { prompt, ...extra } }
}

function callout(text: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", sort_order: sort, content: { variant, text } }
}

function step(title: string, description: string, sort: number): CurriculumBlock {
  return {
    block_type: "step",
    sort_order: sort,
    content: { title, description, checkable: true },
  }
}

function checkpoint(title: string, description: string, sort: number): CurriculumBlock {
  return {
    block_type: "checkpoint",
    sort_order: sort,
    content: {
      title,
      description,
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg"],
      maxSizeMb: 25,
      facultyApproval: true,
    },
  }
}

export const XR_ATTENTION_MODULE_3: CurriculumModule = {
  title: "Module 3 — Eye Tracking Systems and HTC Vive Pro Eye Hardware",
  description:
    "HTC Vive Pro Eye architecture, Tobii eye tracking, SteamVR setup, lab safety, calibration, and hands-on headset operation.",
  sort_order: 3,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 90–120 minutes · Difficulty: Beginner to Intermediate · XP reward: 150 XP · Badge: HTC Vive Pro Eye Operator",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "HTC Vive Pro Eye",
        subtitle: "Research-Grade Eye Tracking for Virtual Reality",
        tags: ["Vive Pro Eye", "Tobii", "SteamVR", "Lab Setup", "Eye Tracking"],
        imageUrl: "/summer-camp/xr-attention/xr-module-3-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The platform powering our XR attention research, from headset hardware to gaze-driven analytics.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand the HTC Vive Pro Eye hardware architecture
- Understand how Tobii eye tracking works
- Learn how VR tracking systems operate
- Successfully assemble and configure the HTC Vive Pro Eye system
- Understand calibration procedures
- Verify eye-tracking functionality
- Learn laboratory safety procedures
- Become comfortable operating the headset independently`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Welcome to the Research Platform

### Opening story

In Module 2, you learned how humans see, how attention works, and what eye tracking measures.

Today we answer a new question: **How do we actually measure where people are looking?**

The answer lies in one of the most advanced VR research platforms available: **the HTC Vive Pro Eye**.

This headset combines immersive VR, precision tracking, integrated eye tracking, and research data collection — used in HCI research, medical training, pilot simulators, educational technology studies, and cognitive science experiments.

**This is the platform we will use throughout the summer.**`,
      },
    },
    {
      block_type: "reflection",
      sort_order: 5,
      content: {
        prompt: "Before today, have you ever used a VR headset?",
        options: ["Never", "Once or twice", "Occasionally", "Frequently"],
        saveToProfile: true,
        profileKey: "vrHeadsetExperience",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — Meet the HTC Vive Pro Eye

### Device overview

![HTC Vive Pro Eye hardware reference](/summer-camp/xr-attention/vive-pro-eye-hardware.png)

### What makes this headset special?

Most VR headsets know **where your head is**. Some know **where your hands are**.

The HTC Vive Pro Eye knows **where your eyes are looking** — enabling attention analysis, cognitive workload estimation, user behavior research, and HCI studies.

### Technical specifications

| Spec | Value |
| --- | --- |
| Display | Dual AMOLED |
| Resolution | 1440 × 1600 per eye |
| Refresh rate | 90 Hz |
| Field of view | ~110° |
| Eye tracking | Tobii integrated |
| Tracking frequency | Up to 120 Hz |
| Tracking method | Infrared eye tracking |`,
      },
    },
    {
      block_type: "image_gallery",
      sort_order: 7,
      content: {
        cards: [
          { title: "Headset", description: "Displays, Tobii sensors, IMU, audio", imageUrl: "/summer-camp/xr-attention/vive-pro-eye-hardware.png" },
          { title: "Controllers", description: "Position, rotation, button input", imageUrl: "/summer-camp/xr-attention/steamvr-tracking-chain.png" },
          { title: "Base Stations", description: "Lighthouse tracking in physical space", imageUrl: "/summer-camp/xr-attention/steamvr-tracking-chain.png" },
          { title: "Link Box", description: "Connects headset to research workstation", imageUrl: "/summer-camp/xr-attention/link-box-card.png" },
        ],
      },
    },
    {
      block_type: "activity",
      sort_order: 9,
      content: {
        title: "Why is eye tracking important?",
        prompt: "Select one:",
        options: [
          "Makes headset lighter",
          "Tracks attention and behavior",
          "Improves Wi-Fi",
          "Increases battery life",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Tracks attention and behavior",
        revealMessage:
          "Integrated eye tracking lets researchers measure gaze, fixations, and attention patterns — the core of our summer project.",
      },
    },
    {
      block_type: "text",
      sort_order: 10,
      content: {
        markdown: `## Section 3 — How Eye Tracking Works

### Behind the scenes

![Tobii gaze estimation pipeline](/summer-camp/xr-attention/tobii-gaze-pipeline.png)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 11,
      content: {
        variant: "vertical_pipeline",
        title: "Tobii gaze estimation pipeline",
        steps: [
          "Infrared light (invisible to user)",
          "Eye cameras capture pupil & corneal reflections",
          "Gaze calculation in 3D space",
          "Data: origin, direction, openness, pupil, confidence",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 12,
      content: {
        markdown: `**Step 1 — Infrared light:** The headset emits invisible IR light.

**Step 2 — Eye cameras:** Specialized cameras observe pupil center, corneal reflections, and eye movement.

**Step 3 — Gaze calculation:** Algorithms estimate where the user is looking in 3D space.

**Step 4 — Data generation:** The system outputs gaze origin, gaze direction, eye openness, pupil information, and tracking confidence.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 13,
      content: {
        title: "Does the system know what you are thinking?",
        prompt: "Select one:",
        options: ["Yes", "No"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: No",
        revealMessage:
          "Eye tracking estimates visual attention and gaze behavior — not thoughts. Discussion: gaze reveals where you look, not what you understand.",
      },
    },
    {
      block_type: "text",
      sort_order: 14,
      content: {
        markdown: `## Section 4 — Understanding VR Tracking

### Tracking components

![SteamVR tracking chain](/summer-camp/xr-attention/steamvr-tracking-chain.png)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 15,
      content: {
        variant: "vertical_pipeline",
        title: "SteamVR tracking chain",
        steps: ["User", "Headset", "Base Stations", "SteamVR Tracking", "Virtual Environment"],
      },
    },
    {
      block_type: "text",
      sort_order: 16,
      content: {
        markdown: `### Lighthouse tracking system

The Vive Pro Eye uses **SteamVR Lighthouse tracking** with base stations, headset sensors, and controller sensors.

**Why two base stations?** One base station creates blind spots. Two provide better coverage, accuracy, and reliability.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 17,
      content: {
        variant: "step_order",
        title: "Arrange the correct VR setup order",
        correctOrder: [
          "Clear play area and remove obstacles",
          "Mount Base Station 1 (elevated corner)",
          "Mount Base Station 2 (opposite corner)",
          "Connect Link Box to PC",
          "Connect headset to Link Box",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 18,
      content: {
        markdown: `## Section 5 — Hardware Components

### Component reference

**Headset** — Immersive VR experience; contains displays, eye trackers, and IMU sensors.

**Controllers** — User interaction; tracks position, rotation, and button presses.

**Base stations** — Track devices in physical space via Lighthouse.

**Link box** — Connects the headset to the PC.

**Research workstation** — Recommended: Intel i7 / Ryzen 7 CPU · RTX 3070+ GPU · 32 GB RAM · 1 TB SSD`,
      },
    },
    {
      block_type: "text",
      sort_order: 19,
      content: {
        markdown: `## Section 6 — Laboratory Safety

### Why safety matters

VR can cause motion sickness, disorientation, and physical collisions. **Safety is critical.**

### Safety rules

| Rule | Action |
| --- | --- |
| Clear the room | Remove furniture and trip hazards from the play area |
| Remove obstacles | Keep cables, bags, and equipment out of the tracking zone |
| Stay inside play area | Respect SteamVR guardian boundaries at all times |
| Use wrist straps | Secure controllers to prevent drops and collisions |
| Sit down if dizzy | Stop the session and rest before continuing |
| Report discomfort | Tell your lab instructor immediately |

### Do NOT

| Avoid | Reason |
| --- | --- |
| Run | High collision risk while headset blocks vision |
| Jump aggressively | Can cause falls or tracking loss |
| Ignore guardian boundaries | Boundaries exist to prevent real-world injury |
| Use damaged equipment | Faulty cables or headsets are unsafe — report to staff |`,
      },
    },
    {
      block_type: "callout",
      sort_order: 20,
      content: {
        variant: "warning",
        text: "If you feel dizzy or disoriented: remove the headset immediately, sit down, and rest. Report symptoms to your lab instructor.",
      },
    },
    {
      block_type: "activity",
      sort_order: 21,
      content: {
        title: "What should you do if you feel dizzy?",
        prompt: "Select one:",
        options: ["Continue", "Remove headset and rest", "Ignore symptoms", "Close one eye"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Remove headset and rest",
        revealMessage: "Never push through motion sickness. Take a break, hydrate, and notify lab staff.",
      },
    },
    {
      block_type: "text",
      sort_order: 22,
      content: {
        markdown: `## Section 7 — Physical Setup Procedure

Compare your lab setup to these **official HTC VIVE Pro Eye reference images**.

### Step 1 — Prepare tracking space

Clear area · stable lighting · minimal reflective surfaces

![Complete VIVE Pro Eye kit — headset, base stations, controllers, and link box (Tobii / HTC)](/summer-camp/xr-attention/vive-docs/vive-pro-eye-full-kit.jpg)

### Step 2 — Mount base stations

Opposite corners · elevated position (about 2–2.5 m) · angled downward toward the play area · **two base stations** for reliable coverage.

### Step 3 — Connect link box

Connect **USB 3.0**, **DisplayPort**, and **power** to the link box, then to your research workstation (DisplayPort must go to the **GPU**, not the motherboard).

![Link box cable connections (HTC VIVE support)](/summer-camp/xr-attention/vive-docs/vive-linkbox-cables.png)

### Step 4 — Connect headset

Plug the headset cable into the link box port marked with the **triangle** symbol.

![Headset connected to link box (HTC VIVE support)](/summer-camp/xr-attention/vive-docs/vive-headset-to-linkbox.png)

### Step 5 — Power on devices

1. Base stations → 2. PC → 3. SteamVR → 4. Headset

*Reference: [HTC VIVE Pro Eye — Connecting the headset](https://www.vive.com/us/support/vive-pro-eye/category_howto/connecting-the-headset-to-your-computer.html)*`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 23,
      content: {
        variant: "step_order",
        title: "Arrange the power-on sequence",
        correctOrder: ["Base Stations", "PC", "SteamVR", "Headset"],
      },
    },
    {
      block_type: "text",
      sort_order: 24,
      content: {
        markdown: `## Section 8 — Software Installation

Install and verify each layer of the research stack. Match your screens to the references below.

### Required software stack

| Software | Purpose |
| --- | --- |
| Steam | Game platform and launcher for SteamVR |
| SteamVR | VR runtime, tracking, and device services |
| Vive Console / SRanipal runtime | Device communication, eye-tracking services, firmware |
| Tobii XR SDK | Eye tracking APIs, gaze data access, Unity integration |
| Unity Hub | Unity editor installation and project management |

### Steam & SteamVR

1. Download and install [Steam](https://store.steampowered.com/about/)
2. In Steam **Library → Tools**, install **SteamVR**
3. Launch SteamVR and confirm the status window opens

![SteamVR on Steam — install from Library → Tools](/summer-camp/xr-attention/vive-docs/steamvr-store-header.jpg)

![SteamVR status window — green icons mean devices are ready (Valve Developer Community)](/summer-camp/xr-attention/vive-docs/steamvr-status-green.png)

### Vive eye-tracking runtime (SRanipal)

The VIVE Pro Eye eye-tracking runtime installs with VIVE / SRanipal software. After launch, look for the **SRanipal** icon in the Windows system tray — the eyes turn **orange** when tracking is active.

![SRanipal runtime in the system tray (VIVE Pro Eye setup guide)](/summer-camp/xr-attention/vive-docs/vive-sranipal-runtime-tray.png)

Download reference: [VIVE SRanipal runtime installer](https://dl.vive.com/SRSDK/runtime/VIVE_SRanipalInstaller.msi) · [VIVE Eye and Facial Tracking SDK](https://developer.vive.com/us/support/sdk/category_howto/where-can-i-download-the-vive-eye-and-facial-tracking-sdk-and-runtime.html)

### Tobii XR SDK

Download the lab-provided Tobii XR SDK package for Unity integration (Module 5 covers import into your project).`,
      },
    },
    step("Verify Steam is installed", "Download and install Steam. Sign in with your camp account.", 25),
    step("Verify SteamVR is installed", "Install SteamVR from Steam and confirm it launches without errors.", 26),
    step("Verify Vive Console is installed", "Install Vive Console for firmware and device management.", 27),
    step("Download Tobii XR SDK", "Download the Tobii XR SDK and note the install path for Unity integration.", 28),
    {
      block_type: "text",
      sort_order: 29,
      content: {
        markdown: `## Section 9 — Eye Tracker Calibration

### Why calibration matters

Every eye is different. Calibration improves gaze accuracy and must be repeated **for each new user** (and after IPD or headset position changes).

### Calibration process (SteamVR dashboard)

1. Put on the headset and press the **System** button on a controller
2. Open the SteamVR dashboard → select **VIVE Pro Eye**
3. Enable **Use eye tracking** → select **Calibrate**
4. Adjust IPD / headset fit, then **follow the blue dot with your eyes** (keep your head still)

![SteamVR dashboard — open VIVE Pro Eye menu (VIVE Pro Eye setup)](/summer-camp/xr-attention/vive-docs/vive-steamvr-dashboard-menu.png)

![Adjust headset position and IPD before gaze calibration](/summer-camp/xr-attention/vive-docs/vive-eye-calibration-ipd.png)

![Follow the calibration dot with your eyes only](/summer-camp/xr-attention/vive-docs/vive-eye-calibration-follow-dot.png)

![SRanipal calibration — map eye geometry to gaze (SRanipal SDK walkthrough)](/summer-camp/xr-attention/vive-docs/sranipal-calibration-dots.png)

### Best practices

✓ Sit comfortably · ✓ Keep head stable · ✓ Follow dots naturally · ✓ Avoid squinting · ✓ Point controllers downward so they do not block your view

### Validation

After calibration, test the gaze cursor in SteamVR or run the **EyeSample** scene in Unity and confirm gaze rays track your look direction.

*Reference: [HTC VIVE — How do I calibrate eye tracking?](https://developer.vive.com/us/support/sdk/category_howto/how-to-calibrate-eye-tracking.html)*`,
      },
    },
    checkpoint(
      "Eye Calibration Screenshot",
      "Complete eye calibration successfully and upload a screenshot showing successful calibration or gaze cursor validation.",
      30,
    ),
    {
      block_type: "text",
      sort_order: 31,
      content: {
        markdown: `## Section 10 — Your First Eye Tracking Demo

### Live demonstration

Watch the short clip below — a **VIVE Pro Eye eye-tracking demo** showing gaze-driven interaction in VR. Then compare what you see to the still frame from the SRanipal **EyeSample** scene.

![SRanipal EyeSample — gaze visualization in Unity (SRanipal SDK walkthrough)](/summer-camp/xr-attention/vive-docs/sranipal-gaze-demo.png)

### What you are seeing

- Left eye gaze
- Right eye gaze
- Combined gaze
- Fixation estimates

### Research connection

This data becomes the foundation for attention analytics, human behavior analysis, and AI prediction models later in the summer.

*Video: [\"VIVE Pro Eye\" Eye Tracking Demo](https://www.youtube.com/watch?v=OupCnBUE860) on YouTube (~1 min).*`,
      },
    },
    {
      block_type: "video",
      sort_order: 32,
      content: {
        title: "VIVE Pro Eye — Eye Tracking Demo (~1 min)",
        url: "https://www.youtube.com/embed/OupCnBUE860",
      },
    },
    {
      block_type: "text",
      sort_order: 33,
      content: {
        markdown: `## Section 11 — Lab Assignment

### Mission

Set up the HTC Vive Pro Eye system and complete:

✓ Hardware assembly · ✓ Software installation · ✓ SteamVR configuration · ✓ Eye calibration · ✓ Tracking validation

### Deliverables

1. Setup screenshot
2. Calibration screenshot
3. Short reflection (see below)`,
      },
    },
    checkpoint(
      "Vive Pro Eye Setup Screenshot",
      "Upload a photo or screenshot showing your complete hardware setup — base stations, link box, and headset ready for use.",
      34,
    ),
    reflect(
      "Lab reflection — What surprised you most? What challenges did you encounter? What applications could benefit from eye tracking?",
      35,
    ),
    {
      block_type: "activity",
      sort_order: 36,
      content: {
        title: "Discussion — Beyond gaze direction",
        prompt:
          "If eye tracking tells us where a person is looking, what additional information would we need to determine attention, engagement, and learning? Think beyond eye tracking alone.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 37,
      content: {
        markdown: `*Possible answers: head movement, controller interactions, quiz scores, physiological signals, facial expressions, task completion times.*

### Preview of Module 4

In **Module 4 — Multimodal Tracking and Data Collection**, we will combine eye tracking, head tracking, controller tracking, and user events to build complete behavioral datasets for XR research.`,
      },
    },
    kc("Knowledge Check — Vive Pro Eye & Eye Tracking Systems", [
      {
        id: "q1",
        prompt: "What company provides the eye-tracking technology inside the Vive Pro Eye?",
        options: ["NVIDIA", "Tobii", "Apple", "Intel"],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "What is the primary purpose of calibration?",
        options: [
          "Improve gaze accuracy",
          "Improve internet speed",
          "Improve battery life",
          "Improve graphics",
        ],
        correctIndex: 0,
      },
      {
        id: "q3",
        prompt: "How many base stations are recommended?",
        options: ["One", "Two", "Three", "Four"],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "Which software provides VR tracking and runtime services?",
        options: ["Unity", "SteamVR", "Word", "Chrome"],
        correctIndex: 1,
      },
      {
        id: "q5",
        prompt: "What should you do if you experience motion sickness?",
        options: [
          "Continue",
          "Take a break immediately",
          "Close one eye",
          "Ignore symptoms",
        ],
        correctIndex: 1,
      },
    ], 38),
    {
      block_type: "feedback",
      sort_order: 39,
      content: {
        kind: "module_reflection",
        interestingPrompt: "What was the most challenging part of setting up or understanding the Vive Pro Eye system?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 40,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 3 — Eye Tracking Systems and HTC Vive Pro Eye Hardware.",
        rewards: {
          xp: 150,
          badges: ["htc-vive-pro-eye-operator", "xr-lab-technician"],
          nextModule: "Module 4 — Multimodal Tracking and Data Collection in XR",
        },
      },
    },
  ],
}
