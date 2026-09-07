/**
 * Capstone — AI-Assisted Analysis of Student Attention in Virtual Reality Learning Environments
 * XR Attention Analytics · Summer Research Training 2026
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"

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

function md(text: string, sort: number): CurriculumBlock {
  return { block_type: "text", sort_order: sort, content: { markdown: text } }
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
        "video/mp4",
        "text/plain",
        "application/zip",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ],
      maxSizeMb: 100,
      facultyApproval: true,
    },
  }
}

function reflect(prompt: string, sort: number, extra?: Record<string, unknown>): CurriculumBlock {
  return { block_type: "reflection", sort_order: sort, content: { prompt, ...extra } }
}

export const XR_ATTENTION_2026_CAPSTONE: CapstoneProjectDef = {
  slug: "vr-attention-research-capstone",
  title: "AI-Assisted Analysis of Student Attention in VR Learning Environments",
  shortDescription:
    "Team capstone — VR classroom, eye-tracking analytics, attention modeling, machine learning, and research communication.",
  sort_order: 40,
  difficulty: "hard",
  required: true,
  estimated_hours: "2–3 weeks",
  badge: "xr-research-capstone-scholar",
  xp_reward: 1000,
  overview:
    "Apply program skills to design, implement, analyze, and present a complete XR research project on student attention in virtual reality learning environments using the HTC Vive Pro Eye.",
  learning_outcomes: [
    "Virtual reality learning environment development",
    "Multimodal behavioral data collection",
    "Eye-tracking visualization and AOI analysis",
    "Machine learning for attention prediction",
    "Research poster, report, and conference paper draft",
  ],
  hardware: ["HTC Vive Pro Eye", "Research workstation (Unity + Python)"],
  module: {
    title: "Capstone — AI-Assisted Analysis of Student Attention in VR Learning Environments",
    description:
      "Team research capstone — 8-week timeline, multimodal data, AI analytics, and professional research deliverables.",
    sort_order: 0,
    blocks: [
      {
        block_type: "callout",
        sort_order: 0,
        content: {
          variant: "warning",
          text: "Required capstone · Unlock after completing Modules 0–10 · Estimated duration: 2–3 weeks · Difficulty: Advanced",
        },
      },
      {
        block_type: "hero",
        sort_order: 1,
        content: {
          title: "Capstone Project",
          subtitle: "AI-Assisted Analysis of Student Attention in Virtual Reality Learning Environments",
          tags: ["Capstone", "Eye Tracking", "Machine Learning", "Team Research", "Publication"],
          imageUrl: "/summer-camp/xr-attention/xr-program-hero.png",
        },
      },
      md(
        `## Project goal

Apply knowledge and skills from the program to design, implement, analyze, and present a complete XR research project involving:

- Virtual reality learning environments
- Eye tracking analytics
- Attention modeling
- Machine learning
- Research communication

This capstone simulates a real-world undergraduate research experience and serves as the culmination of the summer program.`,
        2,
      ),
      md(
        `## Project overview

Students work as a collaborative research team to investigate:

### Research question

**Can eye-tracking behavior and interaction data be used to understand and predict student attention in virtual reality learning environments?**

Using the **HTC Vive Pro Eye** platform, teams will:

- Build a VR learning environment
- Collect multimodal behavioral data
- Analyze gaze behavior
- Develop AI-based attention models
- Interpret research findings
- Communicate results professionally`,
        3,
      ),
      md(
        `## Team structure

### Nader — Eye Tracking Analytics Lead

**Responsibilities:** eye-tracking data collection · data cleaning · heatmaps · scanpaths · AOI analysis · behavioral analytics

**Deliverables:** heatmaps · scanpaths · attention visualizations · eye-tracking analytics report

---

### Aisosa — AI and Data Processing Lead

**Responsibilities:** feature engineering · dataset preparation · ML implementation · model training · evaluation · attention prediction analytics

**Deliverables:** logistic regression · random forest · XGBoost · model comparison report

---

### Kevin — Human Factors and Research Lead

**Responsibilities:** literature review · user study design · surveys · human-subject analysis · experimental interpretation · research writing support

**Deliverables:** literature review summary · user study documentation · survey analysis · discussion and conclusions

---

### Faculty mentor

Guidance on XR development · research methodology · experimental design · data analytics · AI models · scientific writing · publication preparation`,
        4,
      ),
      {
        block_type: "interactive",
        sort_order: 5,
        content: {
          variant: "vertical_pipeline",
          title: "8-week project timeline",
          steps: [
            "Week 1 — Research planning (literature, questions, design)",
            "Week 2 — XR environment (classroom, content, logging)",
            "Week 3 — Pilot testing (calibration, validation)",
            "Week 4 — Data collection (gaze, interaction, surveys)",
            "Week 5 — Data analytics (heatmaps, scanpaths, AOIs, stats)",
            "Week 6 — Machine learning (models, evaluation, features)",
            "Week 7 — Research communication (poster, report, slides)",
            "Week 8 — Final showcase (presentation, demo, paper draft)",
          ],
        },
      },
      step(
        "Week 1 — Research planning",
        "Submit literature review outline, research questions, and experimental design document.",
        6,
      ),
      step(
        "Week 2 — XR environment development",
        "Deliver virtual classroom, educational content, and data logging system.",
        7,
      ),
      step(
        "Week 3 — Pilot testing",
        "Complete calibration procedures, pilot data collection, and system validation notes.",
        8,
      ),
      step(
        "Week 4 — Data collection",
        "Collect eye-tracking datasets, user interaction logs, and survey responses.",
        9,
      ),
      step(
        "Week 5 — Data analytics",
        "Produce heatmaps, scanpaths, AOI analysis, and statistical summaries.",
        10,
      ),
      step(
        "Week 6 — Machine learning",
        "Train and evaluate attention prediction models; report feature importance.",
        11,
      ),
      step(
        "Week 7 — Research communication",
        "Draft poster, technical report sections, and presentation slides.",
        12,
      ),
      step(
        "Week 8 — Final showcase prep",
        "Rehearse presentation, finalize demo video, and polish paper draft.",
        13,
      ),
      md(
        `## Recommended software stack

**XR development:** Unity LTS · SteamVR · OpenXR

**Eye tracking:** Tobii XR SDK · HTC Vive Pro Eye SDK

**Data analytics:** Python · JupyterLab · Pandas · NumPy · Matplotlib

**Machine learning:** Scikit-Learn · XGBoost

**Version control:** Git · GitHub

**Research documentation:** Overleaf · Zotero`,
        14,
      ),
      md(
        `## Final deliverables

1. **Research poster** — motivation, methodology, results, conclusions
2. **Technical report** — architecture, experimental design, data collection, analysis, findings
3. **GitHub repository** — source code, documentation, datasets, reproducibility instructions
4. **Research presentation** — 10–15 minute talk covering problem, methods, results, future work
5. **Preliminary conference paper draft** — abstract through references`,
        15,
      ),
      checkpoint(
        "Research Poster",
        "Upload your capstone research poster (PDF).",
        16,
      ),
      checkpoint(
        "Technical Report",
        "Upload the full technical report (PDF).",
        17,
      ),
      checkpoint(
        "GitHub Repository",
        "Submit repository URL and README summary (PDF or text file with link and setup instructions).",
        18,
      ),
      checkpoint(
        "Research Presentation",
        "Upload presentation slides (PDF/PPTX) or recorded talk (MP4).",
        19,
      ),
      checkpoint(
        "Conference Paper Draft",
        "Upload preliminary conference paper draft (PDF) with abstract, methods, results, and references.",
        20,
      ),
      md(
        `## Final project showcase

Submit evidence of your integrated research pipeline.`,
        21,
      ),
      checkpoint(
        "Video Demonstration",
        "Upload a video demo showing XR environment, eye tracking, data collection, and analytics dashboard (MP4 or link in PDF).",
        22,
      ),
      checkpoint(
        "Results Screenshots",
        "Upload a PDF or ZIP with heatmaps, scanpaths, model outputs, and statistical results.",
        23,
      ),
      checkpoint(
        "Reflection Report",
        "Upload reflection addressing: what you learned, challenges, skills developed, team collaboration, and improvements.",
        24,
      ),
      reflect(
        "Final reflection — (1) Favorite activity? (2) Most difficult concept? (3) How did this project change your understanding of XR and AI? (4) Would you recommend this program? (5) Interest in future research?",
        25,
      ),
      md(
        `## Certificate requirements

Students must:

✓ Complete all modules · ✓ Pass module quizzes · ✓ Complete laboratory activities · ✓ Complete project checkpoints · ✓ Participate in team meetings · ✓ Submit all final deliverables · ✓ Present at the final showcase

### Award

**Certificate in AI, Virtual Reality, Eye Tracking, and Behavioral Analytics Research**

Issued by the Department of Electrical and Computer Engineering · Prairie View A&M University`,
        26,
      ),
      callout(
        "🎉 Upon faculty approval of all capstone deliverables, you earn the XR Research Capstone Scholar badge and full program recognition.",
        27,
      ),
      {
        block_type: "interactive",
        sort_order: 28,
        content: { variant: "graduation" },
      },
      {
        block_type: "module_completion",
        sort_order: 29,
        content: {
          title: "🎉 Capstone Complete!",
          message:
            "You have completed the Summer Research Program in AI, Virtual Reality, Eye Tracking Analytics, Human-Computer Interaction, and Behavioral Data Science.",
          rewards: {
            xp: 1000,
            badges: ["xr-research-capstone-scholar", "xr-attention-certificate-2026"],
            comingNext:
              "You are prepared to contribute to undergraduate research, graduate studies, XR development, AI analytics, and scientific publications.",
          },
        },
      },
    ],
  },
}
