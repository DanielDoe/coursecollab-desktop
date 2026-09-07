/**
 * AI Bootcamp Module 4 — AI Ethics & Responsible AI (shared across pathways).
 * Presentation-style module (~2.5–3 hours) focused on real decision-making.
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_4_PART_BLOCKS } from "./ai-bootcamp-module-4-parts"
import { AI_BOOTCAMP_MODULE_4_QUIZ } from "./ai-bootcamp-module-4-quiz"

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
      title: "AI Ethics & Responsible AI",
      subtitle: "Module 4 · Using Artificial Intelligence Safely, Fairly, and Responsibly",
      tags: ["Ethics", "PAUSE", "Fairness", "Privacy", "Integrity"],
      variant: "cover",
      imageUrl: "/summer-camp/ai-bootcamp/assets/module-4/m4-hero.png",
    },
  },
  callout(
    "**Duration:** 2.5–3 hours · **Level:** High School (Grades 9–12) & Freshman beginners · **Pathway:** Shared · **XP:** 200 · **Badge:** 🛡️ Responsible AI Citizen",
    1,
    "info",
  ),
  text(
    `## Module Overview

This module shifts from *"ethics = bias + privacy + misinformation"* to **responsible decision-making in real situations**.

You should leave knowing how to decide:

> **Can I use AI here? What could go wrong? Who could be affected? What should I verify? What should remain a human decision?**

Signature frameworks: **8 Responsible AI Principles**, **risk-based thinking**, **PAUSE before you use**, the **Responsible AI Decision Tree**, and the **AI Review Board Challenge**.`,
    2,
  ),
  text(
    `## Module Outcomes

By the end of Module 4, you will be able to:

- Explain AI ethics and Responsible AI in accessible language
- Recognize benefits **and** risks; understand bias, privacy, misinformation, deepfakes, copyright, and academic integrity
- Use **PAUSE** and risk-based thinking before important AI use
- Evaluate ethical scenarios and develop a personal **Responsible AI Code**
- Know when human oversight — not more prompting — is required`,
    3,
  ),
  {
    block_type: "mission_objectives",
    sort_order: 4,
    content: {
      title: "Your Learning Journey",
      missions: [
        { title: "Explore why ethics matters through real scenarios", xp: 25 },
        { title: "Master 8 Responsible AI principles + bias & fairness", xp: 30 },
        { title: "Study privacy, reliability, media literacy & scams", xp: 30 },
        { title: "Apply academic integrity, oversight & accountability", xp: 25 },
        { title: "Use PAUSE, decision tree & Ethical Scenario Lab", xp: 30 },
        { title: "AI Review Board Challenge + code + quiz (18 Q)", xp: 60 },
      ],
    },
  },
  {
    block_type: "interactive",
    sort_order: 5,
    content: { variant: "start_journey", title: "Begin Module 4: AI Ethics & Responsible AI" },
  },
  callout(
    "Tip: Enable **Fullscreen** (top right) for a distraction-free presentation experience.",
    6,
    "tip",
  ),
]

const CLOSING = AI_BOOTCAMP_MODULE_4_PART_BLOCKS.filter(
  (block) =>
    block.block_type === "reflection" ||
    block.block_type === "module_completion" ||
    block.sort_order >= 290,
)

const PARTS = AI_BOOTCAMP_MODULE_4_PART_BLOCKS.filter(
  (block) =>
    block.block_type !== "reflection" &&
    block.block_type !== "module_completion" &&
    block.sort_order < 290,
)

export const AI_BOOTCAMP_MODULE_4: CurriculumModule & { pathway: "shared" } = {
  title: "Module 4: AI Ethics & Responsible AI",
  description:
    "Responsible decision-making: PAUSE framework, bias & fairness, privacy & consent, deepfakes & scams, academic integrity, human oversight, risk ladder, ethical scenario lab, and AI Review Board Challenge.",
  sort_order: 5,
  pathway: "shared",
  blocks: [
    ...PREAMBLE,
    ...PARTS,
    kc("Module 4 Knowledge Check — Responsible AI Citizen (18 questions)", AI_BOOTCAMP_MODULE_4_QUIZ, 285),
    ...CLOSING,
  ],
}
