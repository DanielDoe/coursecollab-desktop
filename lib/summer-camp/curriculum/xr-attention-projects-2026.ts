/**
 * XR, Eye Tracking, and AI Research — 3 connected research projects.
 * Seeded via scripts/seed-xr-attention-projects.ts
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import type { CapstoneProjectDef } from "./xr-attention-capstone"

export type XrResearchStudentDef = {
  email: string
  fullName: string
  university: string
  major: string
  gpa?: string
  programRole: "summer_student" | "summer_camper"
  projectSlug: string
  studentIdPrefix: string
}

export const XR_RESEARCH_THEME =
  "Understanding Student Attention in Virtual Reality Learning Environments"

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
        "image/webp",
        "text/plain",
        "application/zip",
      ],
      maxSizeMb: 50,
      facultyApproval: true,
    },
  }
}

function md(text: string, sort: number): CurriculumBlock {
  return { block_type: "text", sort_order: sort, content: { markdown: text } }
}

function callout(text: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", sort_order: sort, content: { variant, text } }
}

function reflect(prompt: string, sort: number): CurriculumBlock {
  return { block_type: "reflection", sort_order: sort, content: { prompt } }
}

const SHARED_INTRO = `## Research theme

**${XR_RESEARCH_THEME}**

All projects contribute to a common research objective: investigating how students learn, interact, and maintain attention in immersive XR learning environments.

Each student owns an independent project while collaborating through shared datasets, weekly meetings, and final publications.`

const SHARED_ACTIVITIES = `## Shared research activities

All students participate in:

- Weekly research meetings
- Progress updates
- Project integration discussions
- Poster development
- Presentation practice
- Final showcase`

export const XR_ATTENTION_RESEARCH_STUDENTS: XrResearchStudentDef[] = [
  {
    email: "nader.ghenaim@my.utsa.edu",
    fullName: "Nader Ghenaim",
    university: "University of Texas at San Antonio",
    major: "Electrical Engineering",
    gpa: "4.0",
    programRole: "summer_student",
    projectSlug: "visual-attention-analytics-vr",
    studentIdPrefix: "CAMP-XR-NADER",
  },
  {
    email: "J01005318@students.jsums.edu",
    fullName: "Aisosa Ereyimwen",
    university: "Jackson State University",
    major: "Computer Science",
    gpa: "3.39",
    programRole: "summer_student",
    projectSlug: "ai-attention-prediction-vr",
    studentIdPrefix: "CAMP-XR-AISOSA",
  },
  {
    email: "kevinwang5678@gmail.com",
    fullName: "Kevin Wang",
    university: "Texas A&M University",
    major: "History · Psychology",
    programRole: "summer_student",
    projectSlug: "human-factors-vr-learning",
    studentIdPrefix: "CAMP-XR-KEVIN",
  },
]

export const XR_ATTENTION_2026_RESEARCH_PROJECTS: CapstoneProjectDef[] = [
  {
    slug: "visual-attention-analytics-vr",
    title: "Visual Attention Analytics in Virtual Reality Learning Environments",
    shortDescription:
      "Transform raw eye-tracking data into heatmaps, scanpaths, AOI analysis, and attention visualizations.",
    sort_order: 10,
    difficulty: "medium",
    required: true,
    estimated_hours: "8 weeks",
    badge: "eye-tracking-analytics-researcher",
    xp_reward: 600,
    overview:
      "Students often look at different parts of a virtual learning environment. This project investigates where students look, how long they look, what attracts attention, and how gaze behavior changes during learning.",
    learning_outcomes: [
      "Eye tracking fundamentals",
      "Behavior analytics",
      "Research visualization",
      "Python analytics",
      "Human attention analysis",
    ],
    module: {
      title: "Project 1 — Visual Attention Analytics in VR",
      description: "Eye-tracking visualization and behavioral analytics research workspace.",
      sort_order: 0,
      blocks: [
        callout(
          "Assigned to: Nader Ghenaim · Difficulty: Medium · Required · 8 weeks · Badge: Eye Tracking Analytics Researcher",
          0,
        ),
        md(SHARED_INTRO, 1),
        md(
          `## Research question

**What visual patterns emerge when students interact with educational content in VR?**

### Topics

Heatmaps · Scanpaths · Areas of Interest (AOIs) · Fixation analysis · Dwell time · Attention mapping

### Integration

Project 1 produces **eye tracking analytics** that feed Project 2 (AI attention prediction).`,
          2,
        ),
        step("Task 1 — Review eye tracking fundamentals", "Complete Module 2–4 review and summarize key gaze metrics for your study.", 3),
        step("Task 2 — Import eye tracking dataset", "Load multimodal VR session data from the team collection pipeline.", 4),
        checkpoint("Dataset verification", "Upload confirmation of imported dataset structure (PDF or screenshot).", 5),
        step("Task 3 — Generate gaze heatmaps", "Produce spatial heatmaps for educational content AOIs in the VR scene.", 6),
        checkpoint("Heatmap submission", "Upload heatmap figures (PDF or PNG).", 7),
        step("Task 4 — Generate scanpaths", "Visualize gaze sequences and transitions between regions of interest.", 8),
        checkpoint("Scanpath submission", "Upload scanpath visualizations (PDF or PNG).", 9),
        step("Task 5 — Perform AOI analysis", "Compute dwell time, fixation counts, and attention metrics per AOI.", 10),
        checkpoint("AOI report", "Upload AOI statistics report (PDF).", 11),
        step("Task 6 — Create attention dashboard", "Build a summary dashboard linking heatmaps, scanpaths, and AOI stats.", 12),
        checkpoint("Dashboard screenshot", "Upload dashboard screenshot or export (PNG/PDF).", 13),
        step("Task 7 — Final visualization package", "Compile research figures for poster and team publication.", 14),
        checkpoint("Research visualizations", "Upload final visualization package (PDF or ZIP).", 15),
        md(SHARED_ACTIVITIES, 16),
        reflect("What gaze patterns surprised you most when analyzing VR learning sessions?", 17),
        {
          block_type: "module_completion",
          sort_order: 18,
          content: {
            title: "Project 1 complete!",
            message: "Eye tracking analytics deliverables submitted for team integration.",
            rewards: { xp: 600, badges: ["eye-tracking-analytics-researcher"] },
          },
        },
      ],
    },
  },
  {
    slug: "ai-attention-prediction-vr",
    title: "AI-Based Attention Prediction Using Eye Tracking Features",
    shortDescription:
      "Train and compare ML models to predict student attention from eye-tracking and interaction features.",
    sort_order: 20,
    difficulty: "hard",
    required: true,
    estimated_hours: "8 weeks",
    badge: "ai-attention-modeling-researcher",
    xp_reward: 700,
    overview:
      "This project investigates whether machine learning models can predict student attention using behavioral data collected from VR environments. It extends the analytics produced in Project 1.",
    learning_outcomes: [
      "Machine learning",
      "Feature engineering",
      "Behavior prediction",
      "Python data science",
      "Model evaluation",
    ],
    module: {
      title: "Project 2 — AI-Based Attention Prediction",
      description: "Machine learning attention modeling research workspace.",
      sort_order: 0,
      blocks: [
        callout(
          "Assigned to: Aisosa Ereyimwen · Difficulty: Hard · Required · 8 weeks · Badge: AI Attention Modeling Researcher",
          0,
        ),
        md(SHARED_INTRO, 1),
        md(
          `## Research question

**Can AI models predict student attention levels using eye-tracking and interaction features?**

### Topics

Feature engineering · Fixation duration · Dwell time · Blink frequency · Classification · Model evaluation · Explainable AI

### Integration

Project 1 → **Eye tracking analytics** → Project 2 → **AI attention models** → Project 3`,
          2,
        ),
        step("Task 1 — Review machine learning fundamentals", "Review Module 9 content on classification, evaluation, and feature design.", 3),
        step("Task 2 — Prepare dataset from Project 1 analytics", "Merge gaze features and interaction logs into a modeling dataset.", 4),
        checkpoint("Dataset verification", "Upload dataset schema and sample rows documentation (PDF).", 5),
        step("Task 3 — Extract behavioral features", "Engineer fixation, dwell, blink, and interaction features.", 6),
        checkpoint("Feature report", "Upload feature engineering report (PDF).", 7),
        step("Task 4 — Train logistic regression model", "Baseline classifier for attention level prediction.", 8),
        checkpoint("Logistic regression results", "Upload model metrics and confusion matrix (PDF).", 9),
        step("Task 5 — Train random forest model", "Ensemble model with hyperparameter notes.", 10),
        checkpoint("Random forest results", "Upload evaluation results (PDF).", 11),
        step("Task 6 — Train XGBoost model", "Gradient boosting model for attention prediction.", 12),
        checkpoint("XGBoost results", "Upload evaluation results (PDF).", 13),
        step("Task 7 — Compare models", "Compare accuracy, F1, and generalization across all three models.", 14),
        checkpoint("Evaluation report", "Upload model comparison report (PDF).", 15),
        step("Task 8 — Feature importance analysis", "Interpret which gaze and interaction features drive predictions.", 16),
        checkpoint("AI analytics report", "Upload final AI research report with feature importance (PDF).", 17),
        md(SHARED_ACTIVITIES, 18),
        reflect("Which model best balanced accuracy and interpretability for your team’s data?", 19),
        {
          block_type: "module_completion",
          sort_order: 20,
          content: {
            title: "Project 2 complete!",
            message: "AI attention models ready for human factors interpretation in Project 3.",
            rewards: { xp: 700, badges: ["ai-attention-modeling-researcher"] },
          },
        },
      ],
    },
  },
  {
    slug: "human-factors-vr-learning",
    title: "Human Factors Analysis of Learning and Engagement in Virtual Reality",
    shortDescription:
      "Literature review, user study design, surveys, and interpretation of attention research from Projects 1–2.",
    sort_order: 30,
    difficulty: "medium",
    required: true,
    estimated_hours: "8 weeks",
    badge: "human-factors-researcher",
    xp_reward: 600,
    overview:
      "Understanding attention requires more than data. This project investigates student engagement, learning experiences, perceived usefulness, cognitive workload, and user satisfaction in XR learning.",
    learning_outcomes: [
      "Human factors",
      "Educational technology",
      "Research methods",
      "Survey design",
      "Scientific writing",
    ],
    module: {
      title: "Project 3 — Human Factors Analysis of VR Learning",
      description: "Human factors and educational research workspace.",
      sort_order: 0,
      blocks: [
        callout(
          "Assigned to: Kevin Wang · Difficulty: Medium · Required · 8 weeks · Badge: Human Factors Researcher",
          0,
        ),
        md(SHARED_INTRO, 1),
        md(
          `## Research question

**How do students perceive and experience learning in virtual reality environments?**

### Topics

Literature review · User studies · Survey design · Experimental design · Educational psychology · Technology acceptance

### Integration

Project 2 → **AI attention models** → Project 3 → **Human factors interpretation** → Final publication`,
          2,
        ),
        step("Task 1 — Review educational XR literature", "Survey foundational papers on VR learning and attention.", 3),
        checkpoint("Literature summary", "Upload literature review summary (PDF).", 4),
        step("Task 2 — Review eye tracking research", "Compile annotated sources on gaze and learning in immersive environments.", 5),
        checkpoint("Annotated bibliography", "Upload annotated bibliography (PDF).", 6),
        step("Task 3 — Design user study protocol", "Define participants, tasks, consent, and data collection procedures.", 7),
        checkpoint("Protocol submission", "Upload user study protocol (PDF).", 8),
        step("Task 4 — Develop engagement survey", "Create validated or adapted survey items for engagement and workload.", 9),
        checkpoint("Survey submission", "Upload survey instrument (PDF).", 10),
        step("Task 5 — Analyze participant feedback", "Analyze survey and qualitative feedback from study sessions.", 11),
        checkpoint("Analysis report", "Upload survey analysis report (PDF).", 12),
        step("Task 6 — Interpret results from Projects 1 and 2", "Draft discussion connecting analytics and AI findings to human experience.", 13),
        checkpoint("Discussion section draft", "Upload discussion draft (PDF).", 14),
        step("Task 7 — Prepare human factors research report", "Integrate literature, protocol, surveys, and team analytics into final report.", 15),
        checkpoint("Research report", "Upload human factors research report (PDF).", 16),
        md(SHARED_ACTIVITIES, 17),
        md(
          `## Final showcase

Present **Project 3 — Human Factors Analysis** alongside Projects 1 and 2 for the combined outcome:

*Understanding Student Attention in Virtual Reality Learning Environments*`,
          18,
        ),
        reflect("How did qualitative findings complement the eye-tracking and AI results from your teammates?", 19),
        {
          block_type: "module_completion",
          sort_order: 20,
          content: {
            title: "Project 3 complete!",
            message: "Human factors report supports the team’s final publication and showcase.",
            rewards: { xp: 600, badges: ["human-factors-researcher"] },
          },
        },
      ],
    },
  },
]

export const XR_RESEARCH_INTEGRATION = {
  combinedDeliverables: [
    "Research poster",
    "Technical report",
    "GitHub repository",
    "Research presentation",
    "Conference paper draft",
    "Video demonstration",
    "Final reflection",
  ],
  awards: [
    "Best Analytics Project",
    "Best AI Research Project",
    "Best Human Factors Research Project",
    "Best Research Presentation",
    "Innovation Award",
    "Faculty Choice Award",
  ],
} as const
