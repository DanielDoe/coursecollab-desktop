/**
 * Module 8 — Data Analysis and Visualization
 * XR Attention Analytics · Summer Research Training 2026
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

export const XR_ATTENTION_MODULE_8: CurriculumModule = {
  title: "Module 8 — Data Analysis and Visualization",
  description:
    "Python for XR research, eye-tracking datasets, data cleaning, heatmaps, scanpaths, AOIs, statistics, and publication-quality figures.",
  sort_order: 8,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 4–5 hours · Difficulty: Intermediate · XP reward: 300 XP · Badge: XR Analytics Explorer",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Data Analysis and Visualization",
        subtitle: "Turning Behavioral Data into Research Insights",
        tags: ["Python", "Pandas", "Heatmaps", "Statistics", "Visualization"],
        imageUrl: "/summer-camp/xr-attention/xr-module-8-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The hero above introduces the analytics workspace: gaze heatmaps, Python-style plots, and research figures.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand the role of data analytics in XR research
- Learn Python fundamentals for research
- Learn how to process eye-tracking datasets
- Analyze gaze behavior using Python
- Generate heatmaps, scanpaths, and attention maps
- Understand Areas of Interest (AOIs)
- Perform basic statistical analysis
- Create research-quality visualizations
- Prepare datasets for future AI modeling`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Welcome to XR Analytics

Congratulations! You have built XR environments, virtual classrooms, educational content, and data collection systems.

**Collecting data is only the beginning.** Researchers create value by transforming data into knowledge.

In this module you will analyze eye-tracking datasets, visualize user behavior, discover attention patterns, create research figures, and extract meaningful insights.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 5,
      content: {
        variant: "start_journey",
        title: "📊 Open Research Dashboard",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — Why Data Analysis Matters

Imagine twenty students complete a VR lesson. You collect eye tracking, head movement, interactions, and quiz scores — thousands of rows.

**Without analytics:** data remains useless.

**With analytics:** researchers discover attention patterns, learning behaviors, user preferences, and performance differences.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "From raw data to findings",
        steps: [
          "Raw Data File",
          "Data Cleaning",
          "Visualization",
          "Pattern Discovery",
          "Research Findings",
        ],
      },
    },
    {
      block_type: "reflection",
      sort_order: 8,
      content: {
        prompt: "Which part sounds most challenging?",
        options: ["Collecting Data", "Cleaning Data", "Visualizing Data", "Understanding Results"],
        saveToProfile: true,
        profileKey: "xrAnalyticsChallenge",
      },
    },
    {
      block_type: "text",
      sort_order: 9,
      content: {
        markdown: `## Section 3 — Python for Research Analytics

Python is widely used for data science, AI, machine learning, and research analytics.

### Stack

Python → NumPy → Pandas → Matplotlib → Plotly → Research Analytics`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 10,
      content: {
        variant: "vertical_pipeline",
        title: "Python research stack",
        steps: ["Python", "NumPy", "Pandas", "Matplotlib", "Plotly", "Research Analytics"],
      },
    },
    {
      block_type: "code",
      sort_order: 11,
      content: {
        language: "python",
        title: "NumPy example",
        code: `import numpy as np

scores = np.array([80, 85, 90, 95])
average = np.mean(scores)`,
      },
    },
    {
      block_type: "activity",
      sort_order: 12,
      content: {
        title: "What does NumPy primarily help with?",
        prompt: "Select one:",
        options: ["Video Editing", "Numerical Computation", "Website Design", "Networking"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Numerical Computation",
        revealMessage: "NumPy provides arrays and fast numerical operations for research analytics.",
      },
    },
    {
      block_type: "code",
      sort_order: 13,
      content: {
        language: "python",
        title: "Pandas example",
        code: `import pandas as pd

data = pd.read_csv("gaze_data.csv")`,
      },
    },
    {
      block_type: "activity",
      sort_order: 14,
      content: {
        title: "Which tool is best for reading CSV files?",
        prompt: "Select one:",
        options: ["Pandas", "Unity", "SteamVR", "OpenXR"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Pandas",
        revealMessage: "Pandas is the standard library for loading, filtering, and analyzing tabular research data.",
      },
    },
    {
      block_type: "text",
      sort_order: 15,
      content: {
        markdown: `## Section 4 — Understanding Eye Tracking Datasets

### Example columns

Timestamp · Participant ID · Gaze X · Gaze Y · Fixation Duration · AOI · Head Position

Each row is a moment in time. Together, rows describe how a user explored the environment.`,
      },
    },
    {
      block_type: "code",
      sort_order: 16,
      content: {
        language: "csv",
        title: "Sample gaze dataset",
        code: `timestamp,participant_id,gaze_x,gaze_y,fixation_duration,aoi
2026-06-01T14:05:01.102,P01,0.42,0.18,0.31,lecture_screen
2026-06-01T14:05:03.421,P01,0.45,0.20,0.28,lecture_screen
2026-06-01T14:05:05.887,P01,0.12,0.55,0.15,interactive_object`,
      },
    },
    reflect(
      "Inspect the sample dataset above. Identify the timestamp, user ID, and gaze coordinates for the third row.",
      17,
    ),
    {
      block_type: "text",
      sort_order: 18,
      content: {
        markdown: `## Section 5 — Data Cleaning

Real-world datasets are messy: missing values, tracking loss, invalid coordinates, calibration errors.

![Before and after gaze data cleaning](/summer-camp/xr-attention/data-cleaning-before-after.png)

**Research tip:** Bad data often produces bad research conclusions.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 19,
      content: {
        title: "Data quality challenge — which dataset needs cleaning?",
        prompt: "Dataset A: 2% missing, confidence > 0.9. Dataset B: 40% missing, frequent invalid coordinates.",
        options: ["Dataset A", "Dataset B", "Neither"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Dataset B needs cleaning",
        revealMessage: "High missing rates and invalid samples must be filtered or imputed before analysis.",
      },
    },
    {
      block_type: "text",
      sort_order: 20,
      content: {
        markdown: `## Section 6 — Visualization Techniques

### Heatmaps

A **heatmap** shows where users spent most visual attention.

Color scale: blue (low) → green → yellow → red (high)

Heatmaps reveal attention hotspots, content visibility, and user focus patterns.

### Scanpaths

A **scanpath** shows the sequence of visual attention: fixation 1 → fixation 2 → fixation 3 → …

Scanpaths reveal reading behavior, search strategies, and exploration patterns.

**Expert users** often show efficient scanpaths. **Novice users** may wander.

### Attention maps and areas of interest (AOIs)

**AOI = Area of Interest** — meaningful regions in the environment.

**Example classroom AOIs:** Lecture screen · Instructor · Interactive objects · Background

**Metrics per AOI:** Fixation count · dwell time · entry frequency`,
      },
    },
    {
      block_type: "activity",
      sort_order: 21,
      content: {
        title: "Heatmap interpretation",
        prompt: "On a lecture slide heatmap, the center title region is red and corners are blue. Where was attention highest?",
        options: ["Slide corners", "Center title region", "Equal everywhere"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Center title region",
        revealMessage: "Red areas indicate high dwell time — often headings, faces, or salient instructional content.",
      },
    },
    {
      block_type: "activity",
      sort_order: 23,
      content: {
        title: "Compare two scanpaths — which user appears more focused?",
        prompt: "User A: short path across key slide regions. User B: long path with many back-and-forth jumps.",
        options: ["User A", "User B", "Cannot tell"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "User A appears more focused",
        revealMessage:
          "Efficient, goal-directed scanpaths often indicate focused attention on instructional content.",
      },
    },
    step(
      "Create AOIs for your classroom design",
      "Define at least three AOIs with boundaries and which metrics you will compute for each.",
      25,
    ),
    {
      block_type: "text",
      sort_order: 26,
      content: {
        markdown: `## Section 7 — Statistical Analysis

Researchers need **evidence**, not assumptions.

### Correlation

Measures relationships between variables — e.g., does longer fixation duration correlate with higher quiz scores?

### ANOVA

Compares multiple groups — e.g., do three VR lesson designs produce different attention levels?

### Regression

Predicts outcomes — e.g., can fixation duration predict quiz performance?`,
      },
    },
    {
      block_type: "activity",
      sort_order: 27,
      content: {
        title: "When should researchers use ANOVA?",
        prompt: "Select the best answer:",
        options: [
          "When comparing means across three or more groups",
          "When plotting heatmaps only",
          "When installing Unity plugins",
          "When calibrating the headset",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Comparing three or more groups",
        revealMessage: "ANOVA tests whether group means differ significantly — common in multi-condition VR studies.",
      },
    },
    {
      block_type: "activity",
      sort_order: 28,
      content: {
        title: "Discussion — What factors might influence learning besides attention?",
        prompt: "Consider prior knowledge, motivation, task difficulty, and multimodal signals.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 29,
      content: {
        markdown: `## Section 8 — Building Research Visualizations

Most readers look at **figures first**. Good visualizations tell stories.

### Common research figures

Heatmaps · scanpaths · bar charts · scatter plots · correlation graphs · AOI statistics

### Design rules

✓ Clear labels · ✓ Minimal clutter · ✓ Meaningful colors · ✓ Proper scaling`,
      },
    },
    {
      block_type: "image_gallery",
      sort_order: 30,
      content: {
        cards: [
          { title: "Heatmaps", description: "Spatial attention distribution", imageUrl: "/summer-camp/xr-attention/heatmap-figure.png" },
          { title: "Scanpaths", description: "Fixation sequence overlays", imageUrl: "/summer-camp/xr-attention/scanpath-figure.png" },
          { title: "Bar Charts", description: "AOI dwell time comparisons", imageUrl: "/summer-camp/xr-attention/aoi-chart.png" },
          { title: "Scatter Plots", description: "Correlation between metrics", imageUrl: "/summer-camp/xr-attention/scatter-correlation.png" },
        ],
      },
    },
    {
      block_type: "activity",
      sort_order: 31,
      content: {
        title: "Figure critique — good vs. poor visualization",
        prompt: "Figure A: labeled axes, color legend, one message. Figure B: 3D effects, tiny text, no units.",
        options: ["Figure A is better for research", "Figure B is better for research"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Figure A",
        revealMessage: "Publication-quality figures prioritize clarity, labels, and honest scaling over decoration.",
      },
    },
    {
      block_type: "text",
      sort_order: 32,
      content: {
        markdown: `## Section 9 — Laboratory Exercise

### Generate your first heatmap

Using a sample eye-tracking dataset:

1. Load data with Pandas
2. Clean dataset
3. Visualize gaze coordinates
4. Generate heatmap
5. Interpret findings`,
      },
    },
    step("Load sample gaze data with Pandas", "Open lab-provided CSV in Jupyter or Python and inspect columns.", 33),
    step("Clean and filter invalid samples", "Remove rows with missing gaze or low tracking confidence.", 34),
    step("Generate heatmap", "Plot gaze X/Y density or fixation heatmap for one participant.", 35),
    checkpoint(
      "Heatmap Image",
      "Upload your heatmap figure (PNG or PDF) from the lab exercise.",
      36,
    ),
    checkpoint(
      "Analysis Summary",
      "Upload a brief analysis summary (PDF or notebook export) describing patterns you observed.",
      37,
    ),
    reflect(
      "Lab reflection — What surprised you? What patterns did you observe in the gaze data?",
      38,
    ),
    callout("📈 XR Analytics Explorer Badge — awarded for completing the heatmap lab", 39),
    kc("Knowledge Check — Data Analysis and Visualization", [
      {
        id: "q1",
        prompt: "Which library is commonly used for data analysis?",
        options: ["SteamVR", "Pandas", "OpenXR", "Tobii"],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "What does a heatmap show?",
        options: [
          "Network Traffic",
          "Visual Attention Distribution",
          "Audio Levels",
          "CPU Usage",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "What does a scanpath represent?",
        options: ["Storage Path", "Eye Movement Sequence", "File Structure", "Network Route"],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "What is an AOI?",
        options: [
          "Area of Interest",
          "Attention Observation Index",
          "Artificial Object Interaction",
          "Adaptive Observation Interface",
        ],
        correctIndex: 0,
      },
      {
        id: "q5",
        prompt: "What statistical method compares multiple groups?",
        options: ["Correlation", "ANOVA", "Regression", "Heatmap"],
        correctIndex: 1,
      },
    ], 40),
    {
      block_type: "reflection",
      sort_order: 41,
      content: {
        prompt: "How confident are you in analyzing XR datasets?",
        options: ["😀 Very Confident", "🙂 Confident", "😐 Neutral", "🙁 Need More Practice"],
        saveToProfile: true,
        profileKey: "xrDatasetConfidence",
      },
    },
    {
      block_type: "activity",
      sort_order: 42,
      content: {
        title: "If you could analyze one aspect of student behavior in VR, what would it be and why?",
        prompt: "Share in the discussion thread.",
        activityType: "first_discussion",
      },
    },
    callout("🏆 Data Analyst Badge — for thoughtful participation in module discussions", 43),
    {
      block_type: "feedback",
      sort_order: 44,
      content: {
        kind: "module_reflection",
        interestingPrompt: "Which visualization or statistic was most useful for understanding your VR data?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 45,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 8 — Data Analysis and Visualization.",
        rewards: {
          xp: 300,
          badges: ["xr-analytics-explorer", "data-visualization-specialist"],
          nextModule: "Module 9 — AI for Attention Analysis",
        },
      },
    },
  ],
}
