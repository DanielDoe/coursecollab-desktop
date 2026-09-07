/**
 * AI Bootcamp 2026 — Capstone projects (Projects hub).
 * Students choose ONE. Seeded via scripts/seed-ai-bootcamp-curriculum.ts
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import type { CapstoneProjectDef } from "./xr-attention-capstone"

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
        "image/webp",
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

function reflect(prompt: string, sort: number): CurriculumBlock {
  return { block_type: "reflection", sort_order: sort, content: { prompt } }
}

const SHARED_RULES = `## Shared requirements

- Use **at least three** different AI platforms
- Include research, AI-generated content, images, a presentation, a demonstration, and reflection
- Work solo or in teams of **2–4**
- Return to **Module 8** for Expo prep, final survey, and graduation`

function projectModule(
  title: string,
  description: string,
  blocks: CurriculumBlock[],
): CurriculumModule {
  return { title, description, sort_order: 0, blocks }
}

export const AI_BOOTCAMP_CAPSTONE_PROJECTS: CapstoneProjectDef[] = [
  {
    slug: "ai-bootcamp-smart-student-toolkit",
    title: "Smart Student Success Toolkit",
    shortDescription:
      "Education capstone — AI study assistant, flashcards, planner, quizzes, and tutor in one toolkit.",
    sort_order: 20,
    difficulty: "medium",
    required: false,
    estimated_hours: "3–5 hours",
    badge: "ai-innovator",
    xp_reward: 200,
    overview:
      "Design an AI-powered toolkit that helps students stay organized, prepare for exams, and manage homework. Must include Study Assistant, Flashcard Generator, Weekly Study Planner, Practice Quiz Generator, and AI Chat Tutor.",
    learning_outcomes: [
      "Build an AI study website (or prototype)",
      "Generate a full subject study guide",
      "Create a 5-slide presentation",
      "Produce a 3–5 minute demo video",
      "Use ≥3 AI tools responsibly",
    ],
    module: projectModule(
      "Capstone — Smart Student Success Toolkit",
      "Education theme: AI toolkit for student success with website, study guide, presentation, and demo.",
      [
        callout(
          "Capstone choice · Unlock after Modules 0–8 · Theme: Education · Use ≥3 AI tools",
          0,
          "warning",
        ),
        {
          block_type: "hero",
          sort_order: 1,
          content: {
            title: "Smart Student Success Toolkit",
            subtitle: "Help learners organize, study, and succeed with AI",
          },
        },
        md(
          `## Scenario\n\nMany students struggle with staying organized, preparing for exams, and managing homework. Design an AI-powered toolkit that helps them become more successful learners.\n\n### Your toolkit must include\n\n- AI Study Assistant\n- Flashcard Generator\n- Weekly Study Planner\n- Practice Quiz Generator\n- AI Chat Tutor\n\n### Suggested tools\n\nChatGPT · NotebookLM · Perplexity · Canva · Gamma · Lovable · Bolt\n\n${SHARED_RULES}`,
          2,
        ),
        step("Form your team (or go solo) and pick one school subject for the study guide", "Write names + subject in reflection.", 3),
        reflect("Team members + subject focus:", 4),
        step("List ≥3 AI tools you will use and assign roles", "Each tool should map to a deliverable.", 5),
        reflect("AI tools + how each will be used:", 6),
        md(
          `## Deliverable 1 — AI Study Website\n\nSimple site introducing the toolkit: Home · Features · How It Works · Contact (optional).\n\nBuild with Lovable, Bolt, Cursor, or similar.`,
          7,
        ),
        checkpoint("Upload website screenshots or shareable URL (PDF with link OK)", "Home + Features pages minimum.", 8),
        md(
          `## Deliverable 2 — Study Guide\n\nFor one subject, generate: Summary · Flashcards · Practice Quiz · Concept Map · Study Schedule.`,
          9,
        ),
        checkpoint("Upload compiled study guide (PDF or ZIP)", "Include all five study-guide parts.", 10),
        md(
          `## Deliverable 3 — Presentation (5 slides)\n\nProblem · Solution · AI tools used · Benefits · Future improvements`,
          11,
        ),
        checkpoint("Upload 5-slide presentation", "PDF or PPTX.", 12),
        md(
          `## Deliverable 4 — Video demo (3–5 minutes)\n\nShow website, study guide, AI tools, and explain how everything works.`,
          13,
        ),
        checkpoint("Upload demo video or PDF with video link", "3–5 minutes.", 14),
        callout("Stretch goal: a working web app that generates study guides.", 15),
        reflect("What worked best in your toolkit? What would you improve next?", 16),
        {
          block_type: "module_completion",
          sort_order: 17,
          content: {
            title: "Toolkit project complete!",
            message:
              "Return to Module 8 to finish Expo prep, the Final Reflection Survey, and graduation as an AI Innovator.",
            rewards: {
              xp: 200,
              badges: ["ai-innovator"],
              nextModule: "Module 8: AI Innovation Challenge & Graduation Showcase",
            },
          },
        },
      ],
    ),
  },
  {
    slug: "ai-bootcamp-startup-challenge",
    title: "AI Startup Challenge",
    shortDescription:
      "Entrepreneurship capstone — invent an AI startup with branding, website, marketing, and Shark Tank pitch.",
    sort_order: 21,
    difficulty: "medium",
    required: false,
    estimated_hours: "3–5 hours",
    badge: "ai-innovator",
    xp_reward: 200,
    overview:
      "Imagine $1,000,000 to launch an AI startup. Design company name, logo, mission, website, business card, pitch deck, marketing poster, and AI product concept.",
    learning_outcomes: [
      "Create full company branding",
      "Build a multi-page business website",
      "Produce marketing materials",
      "Deliver a 5-minute investor pitch",
      "Use ≥3 AI tools responsibly",
    ],
    module: projectModule(
      "Capstone — AI Startup Challenge",
      "Entrepreneurship theme: branding, website, marketing, and investor pitch for an AI startup.",
      [
        callout(
          "Capstone choice · Unlock after Modules 0–8 · Theme: Entrepreneurship · Use ≥3 AI tools",
          0,
          "warning",
        ),
        {
          block_type: "hero",
          sort_order: 1,
          content: {
            title: "AI Startup Challenge",
            subtitle: "You have $1,000,000 — launch an AI company",
          },
        },
        md(
          `## Scenario\n\nDesign a complete AI business: Company Name · Logo · Mission · Website · Business Card · Pitch Deck · Marketing Poster · AI Product.\n\n### Suggested tools\n\nChatGPT · Canva · Gamma · Higgsfield · Firefly · Lovable · Bolt · Cursor\n\n${SHARED_RULES}`,
          2,
        ),
        step("Name the company and write a one-sentence mission + tagline", "Keep it memorable.", 3),
        reflect("Company name, mission, tagline:", 4),
        md(
          `## Deliverable 1 — Company Branding\n\nLogo · Color palette · Mission · Tagline · Business card`,
          5,
        ),
        checkpoint("Upload branding pack (logo + business card + palette notes)", "PDF or image ZIP.", 6),
        md(
          `## Deliverable 2 — Business Website\n\nPages: Home · About · Services · Pricing · Contact`,
          7,
        ),
        checkpoint("Upload website screenshots or URL document", "All five pages represented.", 8),
        md(
          `## Deliverable 3 — Marketing Materials\n\nPoster · Social post · Flyer · Optional 30-second ad`,
          9,
        ),
        checkpoint("Upload marketing materials", "At least poster + one social/flyer asset.", 10),
        md(
          `## Deliverable 4 — Investor Pitch (Shark Tank, ~5 minutes)\n\nProblem · Solution · Customers · Business Model · Future Vision`,
          11,
        ),
        checkpoint("Upload pitch deck + optional pitch video link", "PDF/PPTX (+ PDF with video URL).", 12),
        callout("Stretch goal: prototype web app for your startup product.", 13),
        reflect("Would an investor fund you? Why or why not—be honest.", 14),
        {
          block_type: "module_completion",
          sort_order: 15,
          content: {
            title: "Startup challenge complete!",
            message:
              "Return to Module 8 for Expo prep, survey, and graduation.",
            rewards: {
              xp: 200,
              badges: ["ai-innovator"],
              nextModule: "Module 8: AI Innovation Challenge & Graduation Showcase",
            },
          },
        },
      ],
    ),
  },
  {
    slug: "ai-bootcamp-social-good",
    title: "AI for Social Good",
    shortDescription:
      "Community-impact capstone — research a real problem, design an AI solution, campaign, and prototype.",
    sort_order: 22,
    difficulty: "medium",
    required: false,
    estimated_hours: "3–5 hours",
    badge: "ai-innovator",
    xp_reward: 200,
    overview:
      "Choose one community challenge (environment, health, education, disaster response, accessibility, and more). Research it, design an AI solution, create awareness materials, and ship a prototype.",
    learning_outcomes: [
      "Write a 1–2 page research report",
      "Design an awareness campaign",
      "Build a prototype (site, app, chatbot, or dashboard)",
      "Present problem → solution → impact",
      "Use ≥3 AI tools responsibly",
    ],
    module: projectModule(
      "Capstone — AI for Social Good",
      "Community impact theme: research, awareness campaign, prototype, and presentation.",
      [
        callout(
          "Capstone choice · Unlock after Modules 0–8 · Theme: Community Impact · Use ≥3 AI tools",
          0,
          "warning",
        ),
        {
          block_type: "hero",
          sort_order: 1,
          content: {
            title: "AI for Social Good",
            subtitle: "Solve one real community problem with AI",
          },
        },
        md(
          `## Scenario\n\nChoose **ONE** problem area, for example: Environmental Protection · Healthcare · Mental Health · Education · Disaster Response · Transportation · Food Waste · Animal Conservation · Public Safety · Accessibility.\n\n### Must include\n\nProblem description · Research · AI solution · Educational materials · Prototype · Future improvements\n\n### Suggested tools\n\nPerplexity · ChatGPT · Canva · Gamma · Firefly · Higgsfield · NotebookLM · Lovable\n\n${SHARED_RULES}`,
          2,
        ),
        step("Pick your problem topic and write a 2–3 sentence problem statement", "Be specific and local if possible.", 3),
        reflect("Problem topic + statement:", 4),
        md(
          `## Deliverable 1 — Research Report (1–2 pages)\n\nProblem · Statistics · Current solutions · Your AI solution`,
          5,
        ),
        checkpoint("Upload research report PDF", "1–2 pages.", 6),
        md(
          `## Deliverable 2 — Awareness Campaign\n\nPoster · Brochure · Social graphic · Short video`,
          7,
        ),
        checkpoint("Upload campaign assets", "At least two visuals + optional video link.", 8),
        md(
          `## Deliverable 3 — Prototype\n\nWebsite, app, chatbot, dashboard, or interactive demo.`,
          9,
        ),
        checkpoint("Upload prototype screenshots / URL / demo notes", "Show the AI solution clearly.", 10),
        md(
          `## Deliverable 4 — Presentation\n\nProblem · Research · Solution · Benefits · Challenges · Future work`,
          11,
        ),
        checkpoint("Upload presentation deck", "PDF or PPTX.", 12),
        callout("Stretch goal: interactive chatbot for your social-good project.", 13),
        reflect("Who benefits most from your solution, and how will you measure impact?", 14),
        {
          block_type: "module_completion",
          sort_order: 15,
          content: {
            title: "Social good project complete!",
            message:
              "Return to Module 8 for Expo prep, survey, and graduation.",
            rewards: {
              xp: 200,
              badges: ["ai-innovator"],
              nextModule: "Module 8: AI Innovation Challenge & Graduation Showcase",
            },
          },
        },
      ],
    ),
  },
]
