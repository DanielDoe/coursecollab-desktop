/**
 * AI Bootcamp Module 2 — Exploring AI Tools (shared across pathways).
 * Presentation-style module aligned with Module 1 depth (~2.5–3 hours).
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_2_PART_BLOCKS } from "./ai-bootcamp-module-2-parts"
import { AI_BOOTCAMP_MODULE_2_QUIZ } from "./ai-bootcamp-module-2-quiz"

function text(markdown: string, sort: number): CurriculumBlock {
  return { block_type: "text", content: { markdown }, sort_order: sort }
}

function callout(textContent: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", content: { variant, text: textContent }, sort_order: sort }
}

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

const PREAMBLE: CurriculumBlock[] = [
  {
    block_type: "hero",
    sort_order: 0,
    content: {
      title: "Exploring AI Tools",
      subtitle: "Module 2 · From Chatbots to Creative AI, Research, Coding, and Agents",
      tags: ["Tools", "Multimodal AI", "Research", "Agents", "Evaluation"],
      variant: "cover",
      imageUrl: "/summer-camp/ai-bootcamp/m2-hero.png",
    },
  },
  callout(
    "**Duration:** 2.5–3 hours · **Level:** High School (Grades 9–12) & Freshman beginners · **Difficulty:** Beginner · **XP:** 175 · **Badge:** 🧰 AI Tool Explorer",
    1,
    "info",
  ),
  text(
    `## Module Overview

Artificial Intelligence is no longer represented by a single chatbot or application. Today's ecosystem includes tools for conversation, research, documents, images, video, audio, presentations, coding, data analysis, study support, productivity, and emerging **AI agents**.

The objective is **not** to memorize dozens of product names. Instead, you will learn to answer four questions:

> **What kind of AI tool do I need?**

> **Which tool is appropriate for this task?**

> **How do I evaluate what the AI produces?**

> **When should I trust, verify, revise, or reject an AI-generated result?**

Move slide-by-slide through each **Part**, complete the lab stations and comparison challenge, build your personal toolkit, and finish with the knowledge check.

**Optional reference directories** (browse after class — tools change quickly; always check each site's terms and your school's AI policy):

- [Toolkitly Awesome AI Tools](https://github.com/ToolkitlyAI/awesome-ai-tools) — community-curated list of 650+ tools by category
- [aixplore AI Tools Directory](https://aixplore.in/tool_main) — searchable directory with filters by use case
- [Harvard University AI Tools](https://www.huit.harvard.edu/ai/tools) — institutional guide to approved and recommended tools
- [ResearchGate: Exploring AI Tools (types, applications, challenges, trends)](https://www.researchgate.net/publication/382760446_Exploring_Ai_Tools_Types_Applications_Challenges_And_Future_Trends) — academic overview of the AI tools landscape`,
    2,
  ),
  text(
    `## Module Learning Outcomes

By the end of Module 2, you will be able to:

1. Describe the major categories of modern AI tools
2. Distinguish an AI model from an AI application or tool
3. Explain multimodal AI
4. Identify leading examples of conversational, research, document, image, video, audio, presentation, coding, data, study, productivity, and agentic tools
5. Compare multiple AI tools on the same task and evaluate outputs critically
6. Select appropriate tools using the **TASK** framework and evaluate with **CLEAR**
7. Protect sensitive information and build a personal AI toolkit`,
    3,
  ),
  {
    block_type: "mission_objectives",
    sort_order: 4,
    content: {
      title: "Your Learning Journey",
      missions: [
        { title: "Map the modern AI tool ecosystem (15 categories)", xp: 20 },
        { title: "Distinguish models, apps, and multimodal AI", xp: 20 },
        { title: "Explore assistants, research, documents, and creative AI", xp: 25 },
        { title: "Practice coding, data, productivity, and agents", xp: 25 },
        { title: "Apply TASK + CLEAR to choose and evaluate tools", xp: 25 },
        { title: "Complete AI Tool Lab stations & comparison challenge", xp: 30 },
        { title: "Build your toolkit, mini project & knowledge check (18 Q)", xp: 30 },
      ],
    },
  },
  {
    block_type: "interactive",
    sort_order: 5,
    content: { variant: "start_journey", title: "Begin Module 2: Exploring AI Tools" },
  },
  callout(
    "Tip: Enable **Fullscreen** (top right) for a distraction-free presentation experience.",
    6,
    "tip",
  ),
]

const CLOSING = AI_BOOTCAMP_MODULE_2_PART_BLOCKS.filter(
  (block) =>
    block.block_type === "reflection" ||
    block.block_type === "module_completion" ||
    block.sort_order >= 250,
)

const PARTS = AI_BOOTCAMP_MODULE_2_PART_BLOCKS.filter(
  (block) =>
    block.block_type !== "reflection" &&
    block.block_type !== "module_completion" &&
    block.sort_order < 250,
)

export const AI_BOOTCAMP_MODULE_2: CurriculumModule & { pathway: "shared" } = {
  title: "Module 2: Exploring AI Tools",
  description:
    "A 2.5–3 hour map of the modern AI ecosystem: multimodal assistants, research, documents, image/video/audio, presentations, coding, data, study tools, productivity, agents, labs, and critical evaluation.",
  sort_order: 3,
  pathway: "shared",
  blocks: [
    ...PREAMBLE,
    ...PARTS,
    kc("Module 2 Knowledge Check — AI Tool Explorer (18 questions)", AI_BOOTCAMP_MODULE_2_QUIZ, 245),
    ...CLOSING,
  ],
}
