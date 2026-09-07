/**
 * AI Bootcamp Module 5 — AI Creator Studio (merged image + multi-format creation).
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_5_PART_BLOCKS } from "./ai-bootcamp-module-5-parts"
import { AI_BOOTCAMP_MODULE_5_QUIZ } from "./ai-bootcamp-module-5-quiz"

function callout(textContent: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", content: { variant, text: textContent }, sort_order: sort }
}

function interactive(content: Record<string, unknown>, sort: number): CurriculumBlock {
  return { block_type: "interactive", content, sort_order: sort }
}

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

const PREAMBLE: CurriculumBlock[] = [
  {
    block_type: "hero",
    sort_order: 0,
    content: {
      title: "AI Creator Studio",
      subtitle: "Module 5 · Create, Design, Build, and Publish with Generative AI",
      tags: ["Create", "C-R-E-A-T-E", "Images", "Video", "Brand"],
      variant: "cover",
      imageUrl: "/summer-camp/ai-bootcamp/assets/module-5/m5-hero.png",
    },
  },
  callout(
    "**Duration:** 3–4 hours · **Level:** High School & Freshman · **Difficulty:** Beginner → Intermediate · **XP:** 250 · **Badge:** 🎨 AI Creator",
    1,
    "info",
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Overview",
      subtitle: "Generative AI helps create images, presentations, video, voice, music, websites, apps, stories, and campaigns.",
      columns: 2,
      cards: [
        {
          icon: "wand",
          title: "AI Creator Workflow",
          body: "Idea → Brief → Prompt → Generate → Evaluate → Refine → Combine → Human Edit → Publish",
        },
        {
          icon: "target",
          title: "Signature frameworks",
          body: "C-R-E-A-T-E workflow and C-R-E-A-T-O-R quality control — image generation is one capability inside this studio.",
        },
      ],
    },
    2,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Outcomes",
      columns: 2,
      cards: [
        { icon: "book", title: "Plan & prompt", body: "Creative briefs, image prompts, and iterative refinement." },
        { icon: "sparkles", title: "Multi-format media", body: "Presentations, video, audio, brand, social, web/app concepts." },
        { icon: "shield", title: "Responsible publish", body: "Copyright, consent, disclosure, and human final approval." },
        { icon: "target", title: "Creator Studio project", body: "Multi-format portfolio with documented prompts and disclosure." },
      ],
    },
    3,
  ),
  {
    block_type: "mission_objectives",
    sort_order: 4,
    content: {
      title: "Your Creator Journey",
      missions: [
        { title: "Learn C-R-E-A-T-E + creative briefs", xp: 30 },
        { title: "Tool spotlights + Labs 1–2 (images, Canva, Gamma)", xp: 50 },
        { title: "Video walkthroughs (Higgsfield, Grok, Nano Banana) + Labs 3–4", xp: 50 },
        { title: "Web app builders (Lovable, v0, Bolt) + Lab 5", xp: 40 },
        { title: "Social campaign + web/app prototyping", xp: 35 },
        { title: "Creator Studio project + commercial challenge", xp: 55 },
        { title: "Portfolio + knowledge check (20 Q)", xp: 50 },
      ],
    },
  },
  {
    block_type: "interactive",
    sort_order: 5,
    content: { variant: "start_journey", title: "Enter the AI Creator Studio" },
  },
  callout(
    "Use instructor-approved tools (ChatGPT images, Higgsfield, Grok Imagine, Nano Banana/Bananai, Canva, Gamma, Lovable, v0, Bolt, ElevenLabs, Suno, etc.). Follow screenshot walkthroughs — save prompts + outputs in CourseCollab.",
    6,
    "tip",
  ),
]

const CLOSING = AI_BOOTCAMP_MODULE_5_PART_BLOCKS.filter(
  (b) => b.block_type === "reflection" || b.block_type === "module_completion" || b.sort_order >= 400,
)
const PARTS = AI_BOOTCAMP_MODULE_5_PART_BLOCKS.filter(
  (b) => b.block_type !== "reflection" && b.block_type !== "module_completion" && b.sort_order < 400,
)

export const AI_BOOTCAMP_MODULE_5: CurriculumModule & { pathway: "shared" } = {
  title: "Module 5: AI Creator Studio",
  description:
    "Multi-format generative creation: C-R-E-A-T-E workflow, images, design, brand, presentations, video, audio, campaigns, web/app prototypes, and a Creator Studio portfolio.",
  sort_order: 6,
  pathway: "shared",
  blocks: [
    ...PREAMBLE,
    ...PARTS,
    kc("Module 5 Knowledge Check — AI Creator (20 questions)", AI_BOOTCAMP_MODULE_5_QUIZ, 395),
    ...CLOSING,
  ],
}
