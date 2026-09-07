/**
 * XR Attention Analytics — Summer Research Training (Modules 0–10 + capstone).
 * Full title: AI-Assisted Analysis of Student Attention in VR Learning Environments
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { XR_ATTENTION_MODULE_1 } from "./xr-attention-module-1"
import { XR_ATTENTION_MODULE_2 } from "./xr-attention-module-2"
import { XR_ATTENTION_MODULE_3 } from "./xr-attention-module-3"
import { XR_ATTENTION_MODULE_4 } from "./xr-attention-module-4"
import { XR_ATTENTION_MODULE_5 } from "./xr-attention-module-5"
import { XR_ATTENTION_MODULE_6 } from "./xr-attention-module-6"
import { XR_ATTENTION_MODULE_7 } from "./xr-attention-module-7"
import { XR_ATTENTION_MODULE_8 } from "./xr-attention-module-8"
import { XR_ATTENTION_MODULE_9 } from "./xr-attention-module-9"
import { XR_ATTENTION_MODULE_10 } from "./xr-attention-module-10"
import { XR_ATTENTION_2026_CAPSTONE } from "./xr-attention-capstone"

export type { CapstoneProjectDef } from "./xr-attention-capstone"
export { XR_ATTENTION_2026_CAPSTONE }

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
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      maxSizeMb: 25,
      facultyApproval: true,
    },
  }
}

function reflect(prompt: string, sort: number): CurriculumBlock {
  return { block_type: "reflection", sort_order: sort, content: { prompt } }
}

export const XR_ATTENTION_TRAINING = {
  slug: "xr-attention-analytics",
  title: "XR, Eye Tracking, and AI Research Training",
  description:
    "Summer Research Training — AI-assisted analysis of student attention in virtual reality learning environments. XR, eye tracking, Unity, Python analytics, and machine learning with the HTC Vive Pro Eye.",
  sort_order: 1,
} as const

export const XR_ATTENTION_2026_MODULES: CurriculumModule[] = [
  {
    title: "Module 0 — Program Welcome & Overview",
    description:
      "Summer Research Training Program · Prairie View A&M · Electrical & Computer Engineering.",
    sort_order: 0,
    blocks: [
      {
        block_type: "hero",
        sort_order: 0,
        content: {
          title: "XR, Eye Tracking, and AI Research Training",
          subtitle: "AI-Assisted Analysis of Student Attention in VR Learning Environments",
          imageUrl: "/summer-camp/xr-attention/xr-program-hero.png",
        },
      },
      callout(
        "Prairie View A&M University · Department of Electrical & Computer Engineering · Summer Research Training Program",
        1,
      ),
      md(
        `## Program overview

This training introduces **Extended Reality (XR)**, **Virtual Reality (VR)**, **eye tracking**, **human-computer interaction (HCI)**, **artificial intelligence (AI)**, and **educational analytics** through hands-on experimentation with the **HTC Vive Pro Eye** platform.

### What you will be able to do

- Explain XR, AR, VR, and MR technologies
- Configure and operate the HTC Vive Pro Eye headset
- Collect multimodal behavioral data
- Develop Unity-based virtual environments
- Analyze eye-tracking datasets
- Apply AI techniques to attention analysis
- Design and conduct user studies
- Produce research-quality results and visualizations`,
        2,
      ),
      md(
        `## Recommended software stack

| Category | Tools |
| --- | --- |
| XR development | Unity LTS, SteamVR, OpenXR |
| Eye tracking | Tobii XR SDK, Vive Pro Eye SDK |
| Data analytics | Python, JupyterLab, Pandas, NumPy, Matplotlib |
| Machine learning | Scikit-Learn, XGBoost |
| Version control & docs | Git, GitHub, Overleaf, Zotero |`,
        3,
      ),
      reflect("What research question about attention in VR learning interests you most?", 4),
    ],
  },
  XR_ATTENTION_MODULE_1,
  XR_ATTENTION_MODULE_2,
  XR_ATTENTION_MODULE_3,
  XR_ATTENTION_MODULE_4,
  XR_ATTENTION_MODULE_5,
  XR_ATTENTION_MODULE_6,
  XR_ATTENTION_MODULE_7,
  XR_ATTENTION_MODULE_8,
  XR_ATTENTION_MODULE_9,
  XR_ATTENTION_MODULE_10,
]
