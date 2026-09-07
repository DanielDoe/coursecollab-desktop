/**
 * Module 4 — Multimodal Tracking and Data Collection in XR
 * XR Attention Analytics · Summer Research Training 2026
 *
 * Instructor note (not shown to students): add multimodal architecture diagram, Vive Pro Eye
 * data pipeline, heatmaps, head trajectory plots, controller interaction viz, dashboard mockups,
 * and hands-on labs for CSV export, event logging, timestamp sync, and Python visualization.
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
      acceptedTypes: [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "text/csv",
        "application/json",
        "application/zip",
      ],
      maxSizeMb: 25,
      facultyApproval: true,
    },
  }
}

export const XR_ATTENTION_MODULE_4: CurriculumModule = {
  title: "Module 4 — Multimodal Tracking and Data Collection in XR",
  description:
    "Multimodal sensing, XR data streams, timestamp synchronization, logging architecture, data quality, and research-grade collection pipelines.",
  sort_order: 4,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 120–150 minutes · Difficulty: Intermediate · XP reward: 200 XP · Badge: XR Data Scientist",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Multimodal XR Analytics",
        subtitle: "Combining Multiple Signals to Understand Human Behavior",
        tags: ["Multimodal", "Eye Tracking", "Data Logging", "Timestamps", "Research"],
        imageUrl: "/summer-camp/xr-attention/xr-module-4-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The hero above frames multimodal XR analytics as synchronized gaze, head, controller, and task data.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand what multimodal sensing means
- Understand the different data streams available in XR systems
- Learn how to collect synchronized eye, head, hand, and interaction data
- Understand timestamps and event logging
- Design a research-grade data collection pipeline
- Learn data quality assessment techniques
- Build a complete multimodal recording framework for future experiments`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Why Eye Tracking Alone Is Not Enough

### Opening story

Imagine a student in a virtual classroom. The eye tracker shows they are **looking at the lecture slide**.

Does that automatically mean they are **paying attention**? Not necessarily.

The student might be distracted, daydreaming, confused, or multitasking. Eye tracking alone tells only part of the story.

To better understand human behavior we need multiple signals. Researchers call this **multimodal sensing**.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 5,
      content: {
        title: "Which signals might help determine whether a student is engaged?",
        prompt: "Select all that apply:",
        options: [
          "Eye Movement",
          "Head Movement",
          "Controller Interactions",
          "Quiz Scores",
          "Speech Activity",
          "Physiological Signals",
        ],
        activityType: "poll",
        multiSelect: true,
        revealTitle: "Multimodal engagement",
        revealMessage:
          "Researchers often combine many signals to better estimate attention and learning — not gaze alone.",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — What Is Multimodal Data?

### Definition

**Multimodal data** refers to information collected from multiple sensors and interaction channels simultaneously.

Examples: eye tracking · head tracking · controller tracking · hand gestures · object interactions · speech · physiological sensors

### Why researchers use it

Single signals can be misleading. Multiple signals provide better context, better prediction accuracy, and a richer understanding of behavior.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "Multimodal sensing chain",
        steps: ["Student", "Eyes", "Head", "Hands", "Environment", "AI Analysis"],
      },
    },
    {
      block_type: "activity",
      sort_order: 8,
      content: {
        title: "Would a student staring at the teacher while sleeping appear attentive using eye tracking alone?",
        prompt: "Select one:",
        options: ["Yes", "No"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Potentially yes",
        revealMessage:
          "Gaze direction alone can look attentive even when cognition is offline. Additional signals (head pose, responses, physiology) help resolve ambiguity.",
      },
    },
    {
      block_type: "text",
      sort_order: 9,
      content: {
        markdown: `## Section 3 — Understanding XR Data Streams

![XR multimodal data streams](/summer-camp/xr-attention/xr-data-streams.png)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 10,
      content: {
        variant: "vertical_pipeline",
        title: "XR data streams from Vive Pro Eye",
        steps: [
          "Eye tracking (gaze origin, direction, pupil, confidence)",
          "Head tracking (position, rotation, velocity)",
          "Controller tracking (position, triggers, grips)",
          "Interaction events (selections, quiz, navigation)",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 11,
      content: {
        markdown: `### XR data streams at a glance

| Stream | Data captured |
| --- | --- |
| Eye tracking | Gaze origin, gaze direction, left/right/combined gaze, eye openness, pupil information, tracking confidence |
| Head tracking | Head position (x, y, z), head rotation, velocity, angular velocity |
| Controller tracking | Controller position, rotation, trigger presses, grip events, menu events |
| Interaction events | Object selection, button clicks, quiz responses, navigation events, task completion`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 12,
      content: {
        variant: "matching",
        title: "Match the data source",
        prompt: "Tap each row to reveal the match.",
        pairs: [
          { task: "Eye Tracker", capability: "Gaze Position" },
          { task: "Controller", capability: "Trigger Press" },
          { task: "Headset", capability: "Head Rotation" },
          { task: "Virtual Environment", capability: "Object Interaction" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 13,
      content: {
        markdown: `## Section 4 — Research Architecture

### How data flows through a study

![Research data pipeline](/summer-camp/xr-attention/research-data-pipeline.png)

### Example

Student views a virtual lecture. The system records at **10:15:05** — looking at slide, head orientation, controller movement, quiz response — all linked together.

### Key insight

**Behavior only becomes meaningful when events are connected through time.**`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 14,
      content: {
        variant: "vertical_pipeline",
        title: "Research data flow",
        steps: [
          "Participant",
          "Virtual Environment",
          "Sensors",
          "Data Collection Layer",
          "Data Storage",
          "Analysis",
          "Research Findings",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 15,
      content: {
        markdown: `## Section 5 — Time Synchronization

### Why timing matters

If eye tracking, controller, and quiz files use different clocks or start times, researchers **cannot reconstruct behavior**.

Every event needs a **timestamp** — e.g. \`2026-06-01 14:05:22.315\`

### Synchronized data example

| Time | Event |
| --- | --- |
| 14:05:01 | Slide viewed |
| 14:05:03 | Fixation |
| 14:05:05 | Controller click |
| 14:05:08 | Quiz response |`,
      },
    },
    {
      block_type: "activity",
      sort_order: 16,
      content: {
        title: "Why are timestamps important?",
        prompt: "Select one:",
        options: [
          "Improve graphics",
          "Synchronize behavior data",
          "Improve internet speed",
          "Reduce storage",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Synchronize behavior data",
        revealMessage:
          "Timestamps let you align gaze, head, controller, and task events on a single timeline.",
      },
    },
    {
      block_type: "text",
      sort_order: 17,
      content: {
        markdown: `## Section 6 — Building a Data Logging System

### What is a logger?

A **logger** records events occurring during an experiment — gaze samples, interactions, task milestones, and session metadata.

### Research logger architecture

![XR logger flow](/summer-camp/xr-attention/logger-flow.png)

### Example log entry

\`\`\`
Timestamp: 14:05:03.421
User ID: Participant 01
Event: Fixation
Object: Lecture Slide
Duration: 1.3 seconds
\`\`\`

### What we will log

✓ Eye tracking · ✓ Head tracking · ✓ Controller events · ✓ Quiz events · ✓ Task events · ✓ Session information`,
      },
    },
    {
      block_type: "text",
      sort_order: 18,
      content: {
        markdown: `## Section 7 — Data Storage Formats

**CSV** — Simple, easy to analyze in Python/R/Excel. Example header: \`timestamp,x,y,z,event\`

**JSON** — Flexible, hierarchical, good for nested event payloads.

**Database** — Efficient retrieval for large studies and multi-session cohorts.`,
      },
    },
    {
      block_type: "code",
      sort_order: 19,
      content: {
        language: "csv",
        title: "Sample multimodal log (CSV)",
        code: `timestamp,user_id,stream,event,x,y,z,confidence
2026-06-01T14:05:01.102,P01,interaction,slide_viewed,,,,
2026-06-01T14:05:03.421,P01,gaze,fixation,0.12,-0.04,2.1,0.94
2026-06-01T14:05:05.887,P01,controller,trigger_click,,,,
2026-06-01T14:05:08.015,P01,quiz,response_correct,,,,`,
      },
    },
    reflect(
      "Inspect the sample log above. Identify the timestamp, event type, and user ID for the fixation row.",
      20,
    ),
    {
      block_type: "text",
      sort_order: 21,
      content: {
        markdown: `## Section 8 — Data Quality Assessment

### Why data quality matters

**Bad data produces bad research.**

### Common problems

Missing samples · calibration drift · lost tracking · sensor occlusion

### Quality metrics

**Eye tracking:** sampling rate · tracking confidence · missing data %

**Head tracking:** position stability · tracking continuity`,
      },
    },
    {
      block_type: "activity",
      sort_order: 22,
      content: {
        title: "Data quality challenge — which dataset has problems?",
        prompt: "Dataset A: 120 Hz gaze, 2% missing, confidence > 0.9. Dataset B: 30 Hz gaze, 35% missing, frequent tracking loss.",
        options: ["Dataset A is problematic", "Dataset B is problematic", "Both are equally good"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Dataset B is problematic",
        revealMessage:
          "High missing-data rate and tracking loss make Dataset B unreliable for fixation analysis or ML training.",
      },
    },
    {
      block_type: "text",
      sort_order: 23,
      content: {
        markdown: `## Section 9 — Designing an XR Experiment

### Research scenario

**Question:** Can we detect student engagement during VR learning?

### What data should we collect?

Eye tracking · head tracking · quiz scores · interaction events — each adds context gaze alone cannot provide.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 24,
      content: {
        title: "What data should we collect for an engagement study?",
        prompt: "Select all that apply:",
        options: ["Eye Tracking", "Head Tracking", "Quiz Scores", "Interaction Events"],
        activityType: "poll",
        multiSelect: true,
        revealMessage: "Discuss in your team why each variable matters for detecting engagement vs. mere looking.",
      },
    },
    reflect(
      "Mini design exercise — State your research question, participants, sensors, data collected, and expected findings.",
      25,
    ),
    {
      block_type: "text",
      sort_order: 26,
      content: {
        markdown: `## Section 10 — Multimodal Analytics Dashboard

### Future vision

![Multimodal analytics dashboard mockup](/summer-camp/xr-attention/multimodal-dashboard.png)

Collecting data is not the goal — building a **synchronized behavioral dataset** that answers research questions is the goal.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 27,
      content: {
        title: "Discussion — What additional visualizations would help researchers?",
        prompt: "Share ideas: scanpath overlays, AOI dwell charts, session comparison views, ML feature importance, etc.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 28,
      content: {
        markdown: `## Section 11 — Summer Project Connection

### What we will collect (HTC Vive Pro Eye)

Eye tracking · head tracking · controller interactions · learning outcomes

### What we will build

Research dataset → analytics dashboard → attention metrics → machine learning models → research paper

### Team responsibilities

| Focus | Lead |
| --- | --- |
| Eye tracking analytics | Nader |
| Data logging and AI | Aisosa |
| Experimental design and human factors | Kevin |`,
      },
    },
    step(
      "Export gaze data to CSV",
      "Run a short VR session and export at least 30 seconds of gaze samples with timestamps.",
      29,
    ),
    step(
      "Record controller events",
      "Log trigger presses and grip events alongside gaze in the same session.",
      30,
    ),
    step(
      "Verify timestamp synchronization",
      "Confirm gaze, head, and interaction events share a common clock (UTC or session-relative ms).",
      31,
    ),
    checkpoint(
      "Multimodal Data Sample",
      "Upload a sample dataset export (CSV or JSON) plus a brief protocol note describing synchronization and data streams logged.",
      32,
    ),
    kc("Knowledge Check — Multimodal XR Data Collection", [
      {
        id: "q1",
        prompt: "What does multimodal mean?",
        options: [
          "Multiple displays",
          "Multiple sensors/data sources",
          "Multiple users",
          "Multiple monitors",
        ],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "Why combine multiple signals?",
        options: [
          "Better behavioral understanding",
          "Faster internet",
          "Better graphics",
          "Better battery life",
        ],
        correctIndex: 0,
      },
      {
        id: "q3",
        prompt: "What connects different data streams together?",
        options: ["GPU", "Timestamp", "Controller", "Lens"],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "Which of the following is an interaction event?",
        options: ["Fixation", "Head Rotation", "Button Press", "Pupil Diameter"],
        correctIndex: 2,
      },
      {
        id: "q5",
        prompt: "Why is data quality important?",
        options: [
          "Better research results",
          "Better graphics",
          "Better headset comfort",
          "Better battery life",
        ],
        correctIndex: 0,
      },
    ], 33),
    {
      block_type: "activity",
      sort_order: 34,
      content: {
        title: "Discussion — Identical eye-tracking patterns, different understanding?",
        prompt:
          "Suppose two students have identical eye-tracking patterns. Could they still have different levels of understanding? Why? What additional signals would help distinguish them?",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 35,
      content: {
        markdown: `### Research thinking questions

1. What behavioral signals best indicate engagement?
2. Can multimodal data improve attention prediction?
3. What are the limitations of eye tracking alone?
4. How can AI fuse multiple data sources?
5. What ethical concerns arise when collecting multimodal data?

### Preview of Module 5

**Unity XR Development Environment** — Unity fundamentals, OpenXR, HTC Vive integration, Tobii XR SDK, your first virtual environment, and real-time eye tracking data access.`,
      },
    },
    {
      block_type: "feedback",
      sort_order: 36,
      content: {
        kind: "module_reflection",
        interestingPrompt: "What was the most important insight about combining multiple data streams?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 37,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 4 — Multimodal Tracking and Data Collection in XR.",
        rewards: {
          xp: 200,
          badges: ["xr-data-scientist", "multimodal-researcher"],
          nextModule: "Module 5 — Unity XR Development Environment",
        },
      },
    },
  ],
}
