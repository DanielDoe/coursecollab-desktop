/**
 * AI Bootcamp Module 6 — AI Learning Accelerator parts.
 */

import type { CurriculumBlock } from "./ai-edge-2026"

function text(markdown: string, sort: number): CurriculumBlock {
  return { block_type: "text", content: { markdown }, sort_order: sort }
}

function callout(textContent: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", content: { variant, text: textContent }, sort_order: sort }
}

function reflect(prompt: string, sort: number): CurriculumBlock {
  return { block_type: "reflection", content: { prompt }, sort_order: sort }
}

function interactive(content: Record<string, unknown>, sort: number): CurriculumBlock {
  return { block_type: "interactive", content, sort_order: sort }
}

function activity(content: Record<string, unknown>, sort: number): CurriculumBlock {
  return { block_type: "activity", content, sort_order: sort }
}

const TUTOR = (file: string) => `/summer-camp/ai-bootcamp/tutorials/module-6-free-ai/${file}.png`
const M6 = "/summer-camp/ai-bootcamp/assets/module-6"

function gallery(
  sort: number,
  caption: string,
  cards: Array<{ title: string; description: string; imageUrl?: string; bullets?: string[] }>,
): CurriculumBlock {
  return {
    block_type: "image_gallery",
    sort_order: sort,
    content: { caption, cards },
  }
}

function columnGrid(
  sort: number,
  columns: Array<{
    widthFraction: number
    cells: Array<{
      type: "text" | "image"
      markdown?: string
      imageUrl?: string
      caption?: string
      alt?: string
      imageWidthPercent?: number
    }>
  }>,
  gap = 20,
): CurriculumBlock {
  return {
    block_type: "column_grid",
    sort_order: sort,
    content: {
      gap,
      rowGap: 24,
      rows: [
        {
          id: `m6-row-${sort}`,
          columns: columns.map((col, i) => ({
            id: `m6-col-${sort}-${i}`,
            widthFraction: col.widthFraction,
            cells: col.cells.map((cell, j) => ({
              id: `m6-cell-${sort}-${i}-${j}`,
              ...cell,
            })),
          })),
        },
      ],
    },
  }
}

function stepTutorial(
  caption: string,
  cards: Array<{ title: string; description?: string; imageUrl: string; bullets?: string[] }>,
  sort: number,
): CurriculumBlock {
  return { block_type: "image_gallery", content: { caption, cards }, sort_order: sort }
}

export const AI_BOOTCAMP_MODULE_6_PART_BLOCKS: CurriculumBlock[] = [
  // ── Part I — The AI-Powered Student (~10 min) ─────────────────────────────
  text(
    `## Part I — The AI-Powered Student

**Estimated time:** ~10 minutes

> **What takes the most time in your school week?** Reading · notes · studying · homework · research · writing · planning · exam review

> **Which tasks could AI make more efficient without doing the learning for you?**`,
    10,
  ),
  columnGrid(
    11,
    [
      {
        widthFraction: 0.45,
        cells: [
          {
            type: "text",
            markdown: `### The AI-Powered Student

AI can make reading, notes, studying, research, writing, and planning more efficient — **without doing the learning for you.**

> **Core question:** Which tasks could AI support while you still think, practice, and verify?`,
          },
        ],
      },
      {
        widthFraction: 0.55,
        cells: [
          {
            type: "image",
            imageUrl: `${M6}/m6-ai-powered-student.png`,
            alt: "Student using notes, textbook, flashcards, planner, and AI assistant while actively thinking",
            caption: "You stay in charge — AI expands your study toolbox.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Two Workflows",
      subtitle: "Spend less time on repetitive work and more time understanding, practicing, creating, and thinking.",
      columns: 2,
      cards: [
        {
          icon: "book",
          title: "Traditional Workflow",
          body: "Lecture → Notes → Textbook → Homework → Study → Exam",
        },
        {
          icon: "sparkles",
          title: "AI-Accelerated Workflow",
          body: "Lecture → Smart Notes → AI Explanation → Practice → Feedback → Flashcards → Active Recall → Weakness Analysis → Targeted Review → Exam Prep",
        },
      ],
    },
    12,
  ),
  gallery(
    13,
    "Traditional study vs AI-accelerated workflow — organized and efficient, not easier or less demanding.",
    [
      {
        title: "Traditional vs AI-Accelerated Study",
        description:
          "Same student: textbook-and-notes workflow on one side; smart notes, AI tutor, flashcards, practice quiz, and planner on the other.",
        imageUrl: `${M6}/m6-traditional-vs-accelerated.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "concept_cards",
      title: "Core Philosophy",
      subtitle: "AI should support thinking — not replace it.",
      cards: [
        {
          icon: "brain",
          title: "Support Thinking",
          body: "AI accelerates learning, provides feedback, assists planning, and expands capability — not create dependence.",
        },
        {
          icon: "target",
          title: "You Stay in Charge",
          body: "Use AI to understand faster and practice smarter. You still attempt problems, explain concepts, and verify important facts.",
        },
      ],
    },
    14,
  ),

  // ── Lab 1 — Personal AI Tutor (~25 min) ─────────────────────────────────
  gallery(
    17,
    "Lab 1 — Configure a tutor that asks questions and gives hints, not instant final answers.",
    [
      {
        title: "Build Your Personal AI Tutor",
        description:
          "Students work through calculus and biology problems on paper while AI tutors provide guidance on laptops.",
        imageUrl: `${M6}/m6-personal-ai-tutor.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "topic_deck",
      title: "Free Tools + Privacy Rules (read first)",
      subtitle: "Use free ChatGPT, Gemini, or Perplexity — do NOT upload private documents to the web.",
      columns: 3,
      sections: [
        {
          title: "ChatGPT Free",
          icon: "message",
          body: "chatgpt.com — sign in → New chat → paste tutor prompt. Free tier is enough for Labs 1–2.",
          accent: "violet",
        },
        {
          title: "Gemini Free",
          icon: "sparkles",
          body: "gemini.google.com — Google account → chat interface. Good for notes + explanations.",
          accent: "sky",
        },
        {
          title: "Perplexity Free",
          icon: "book",
          body: "perplexity.ai — research with citations. Use for finding sources, not pasting full essays.",
          accent: "emerald",
        },
        {
          title: "Do NOT upload",
          icon: "shield",
          body: "No PDF uploads of graded work, IDs, IEPs, or full textbooks. No photos of answer keys.",
          accent: "amber",
        },
        {
          title: "DO type instead",
          icon: "target",
          body: "Your own rewritten bullet notes (5–15 lines), anonymized: no name, school, or teacher identifiers.",
          accent: "violet",
        },
        {
          title: "Where work lives",
          icon: "cpu",
          body: "Drafts stay in your chat. Portfolio screenshots go to CourseCollab only — instructor-controlled, not public web.",
          accent: "sky",
        },
      ],
      footer:
        "Green zone: typed summaries, practice questions, tutor hints. Red zone: upload entire document and ask AI to complete assignment.",
    },
    18,
  ),
  callout(
    "**Login:** Free ChatGPT, Gemini, or Perplexity each require a sign-in (Google or email). Use a personal or school-approved account — instructor confirms which platform your cohort uses.",
    19,
    "info",
  ),
  stepTutorial(
    "Walkthrough — Lab 1: Personal AI Tutor (free ChatGPT, Gemini, or Perplexity). Same prompts on any platform.",
    [
      {
        title: "Step 1 — Pick your free tool & sign in",
        description:
          "Choose ONE: **ChatGPT Free** (chatgpt.com) · **Gemini Free** (gemini.google.com) · **Perplexity** (perplexity.ai, tutor mode in chat). Sign in — no paid plan required for this lab.",
        imageUrl: TUTOR("gemini-home"),
        bullets: [
          "ChatGPT: Continue with Google or email.",
          "Gemini: Use your Google account — common for schools already on Google.",
          "Do not upload files — type prompts only (privacy).",
        ],
      },
      {
        title: "Step 2 — Paste tutor rules (typed prompt only)",
        description:
          "New chat. Paste your Personal AI Tutor prompt — subject, level, rules: hints not answers, ask what you think first.",
        imageUrl: TUTOR("02-tutor-setup-prompt"),
        bullets: [
          "Example: You are my Grade 10 biology tutor. I confuse photosynthesis and respiration. Do NOT give final answers — ask questions, give hints, one practice problem after each concept.",
          "Save prompt to CourseCollab Prompt Library — not on public social media.",
        ],
      },
      {
        title: "Step 3 — Ask a study question (no homework dump)",
        description: "Ask about a concept you are learning — not 'do question 7 for me.'",
        imageUrl: TUTOR("03-tutor-conversation"),
        bullets: [
          "Example: Help me understand photosynthesis vs cellular respiration — I keep mixing up chloroplasts and mitochondria.",
          "Good reply: tutor asks what YOU think first, then guides.",
        ],
      },
      {
        title: "Step 4 — Verify you learned (deliverable)",
        description: "Answer tutor questions in your own words. Attempt practice problems before viewing solutions.",
        imageUrl: TUTOR("perplexity-home"),
        bullets: [
          "Screenshot 3-message exchange (blur any personal info).",
          "Write: What did I figure out vs what AI told me?",
          "Submit to CourseCollab — not to public forums.",
        ],
      },
    ],
    20,
  ),
  interactive(
    {
      variant: "hands_on_missions",
      title: "Lab 1 — Build Your Personal AI Tutor",
      subtitle: "~25 minutes · Bad tutoring gives answers; great tutoring builds understanding.",
      activities: [
        {
          id: "bad-vs-better",
          label: "1",
          title: "Bad vs Better Tutoring",
          icon: "target",
          accent: "violet",
          compare: {
            weak: "Solve question 7 → AI gives answer → little learning.",
            strong:
              "Student attempts → AI asks questions → identifies misunderstanding → hint → student tries again → explains → similar practice problem.",
          },
        },
        {
          id: "framework",
          label: "2",
          title: "CourseCollab AI Tutor Framework",
          icon: "book",
          accent: "sky",
          summary: "Define: Subject · Level · Goal · Teaching style · Interaction rule · Assessment",
          steps: [
            "Choose a subject you are studying now",
            "Set level and what you already understand",
            "Write interaction rules (hints, not final answers)",
            "Add practice rules and difficulty progression",
          ],
        },
        {
          id: "example-prompt",
          label: "3",
          title: "Example Tutor Prompt",
          icon: "wand",
          accent: "emerald",
          wide: true,
          summary:
            "You are my high-school calculus tutor. I understand algebra but am new to calculus. Teach step by step with simple examples. Do not immediately give final answers — ask questions, provide hints, help me find mistakes. After each concept, give one practice problem and increase difficulty gradually.",
          footer: "Deliverable: Save My Personal AI Tutor to your CourseCollab Prompt Library. Test with three questions.",
        },
      ],
    },
    21,
  ),
  reflect(
    "My Personal AI Tutor — Paste your tutor prompt (subject, level, teaching rules, and one test question).",
    22,
  ),
  gallery(
    23,
    "Bad tutoring copies answers · Better tutoring builds understanding through hints and practice.",
    [
      {
        title: "Bad AI Tutoring vs Better AI Tutoring",
        description:
          "Split scene: passive copying on the left; active problem-solving with hints and revision on the right.",
        imageUrl: `${M6}/m6-bad-vs-better-tutoring.png`,
      },
    ],
  ),

  // ── Lab 2 — Smart Note System (~30 min) ─────────────────────────────────
  gallery(
    28,
    "Lab 2 — Turn lecture materials into summary, flashcards, quiz, and concept map — then verify against the source.",
    [
      {
        title: "Smart Note System",
        description:
          "Students convert slides, notes, and textbooks into active study resources across laptop and tablet.",
        imageUrl: `${M6}/m6-smart-note-system.png`,
      },
    ],
  ),
  stepTutorial(
    "Walkthrough — Lab 2: Smart Notes (free tier). **Type** 5–15 lines of YOUR notes — do not upload PDFs or photos of handouts.",
    [
      {
        title: "Step 1 — Type anonymized notes into chat",
        description:
          "Copy only bullets you wrote yourself. Remove your name, school, and teacher. Works in ChatGPT Free or Gemini Free.",
        imageUrl: TUTOR("04-smart-notes-output"),
        bullets: [
          "Prompt: You are my study assistant. Do NOT add facts not in the notes below.",
          "Ask for: 5-bullet summary · comparison table · 5 flashcards · 3 practice Qs (answers at end).",
        ],
      },
      {
        title: "Step 2 — Critical review before studying",
        description: "Check omissions and invented facts. Export flashcards locally — Anki, Quizlet, or print.",
        imageUrl: TUTOR("gemini-home"),
        bullets: [
          "Perplexity Free: use later for research lab — find sources, do not paste your whole essay.",
          "CourseCollab stores your deliverables; external AI chats are separate unless you choose to share screenshots.",
        ],
      },
    ],
    29,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Lab 2 — The Smart Note Pipeline",
      subtitle: "~30 minutes · Input sources: lecture notes · slides · PDFs · handouts · articles · transcripts (where permitted).",
      steps: [
        { label: "Raw Material", detail: "Lecture notes, slides, PDFs, handouts, articles" },
        { label: "Clean Notes", detail: "Organize and clarify the source material" },
        { label: "Summary", detail: "Five key concepts with definitions and relationships" },
        { label: "Study Guide", detail: "Topics, formulas, examples, common mistakes" },
        { label: "Flashcards", detail: "One concept per card — understanding over trivia" },
        { label: "Practice Questions", detail: "MC, short answer, application — answers hidden until finished" },
        { label: "Exam Review", detail: "Concept map linking main ideas, causes, and effects" },
      ],
    },
    30,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Prompt Upgrades for Smart Notes",
      columns: 2,
      cards: [
        {
          icon: "book",
          title: "Summary",
          body: "Summarize for Grade 10 biology — five key concepts, definitions, relationships, likely confusion points. Do not add information not in the notes.",
        },
        {
          icon: "target",
          title: "Study Guide",
          body: "Organize by topic with concepts, formulas, examples, common mistakes.",
        },
        {
          icon: "brain",
          title: "Flashcards",
          body: "20 cards — one concept per card; prioritize understanding over trivia.",
        },
        {
          icon: "zap",
          title: "Quiz",
          body: "15 questions (MC, short answer, application) — hide answers until I finish.",
        },
        {
          icon: "wand",
          title: "Concept Map",
          body: "Identify main concepts, subconcepts, causes, effects, and relationships.",
        },
        {
          icon: "shield",
          title: "Critical Check",
          body: "Did AI omit anything important? Introduce anything not in the source? Which artifact was most useful?",
        },
      ],
      footer: "Activity: Generate summary, study guide, flashcards, quiz, and concept map from one document.",
    },
    32,
  ),
  activity(
    {
      title: "Smart Note Pipeline",
      prompt: "Which step turns raw notes into active study resources?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Copy-paste notes into AI and submit the output unchanged",
        "Summary → study guide → flashcards → quiz → concept map",
        "Delete original notes immediately",
        "Skip practice questions",
      ],
      revealMessage: "One source becomes many learning resources — always verify against the original.",
    },
    31,
  ),
  gallery(
    33,
    "One source document → five study tools — summary, guide, flashcards, quiz, and concept map.",
    [
      {
        title: "One Document, Five Study Tools",
        description:
          "Central source with derived summary, study guide, flashcard deck, quiz, and concept map on a student desk.",
        imageUrl: `${M6}/m6-one-doc-five-tools.png`,
      },
    ],
  ),

  // ── Lab 3 — Learn Difficult Subjects (~30 min) ──────────────────────────
  interactive(
    {
      variant: "numbered_steps",
      title: "Lab 3 — The Explanation Ladder",
      intro: "~30 minutes · Climb from simple to formal until the concept clicks — then test yourself.",
      layout: "horizontal",
      imageUrl: `${M6}/m6-explanation-ladder.png`,
      imageCaption: "Seven levels from simple explanation through formal academic explanation to comprehension check.",
      steps: [
        { icon: "sparkles", title: "Explain Simply", body: "Plain language, no jargon." },
        { icon: "message", title: "Use an Analogy", body: "Connect to something familiar." },
        { icon: "target", title: "Visual Description", body: "Paint a mental picture." },
        { icon: "book", title: "Example", body: "Concrete instance of the concept." },
        { icon: "brain", title: "Compare to What I Know", body: "Link to prior knowledge." },
        { icon: "wand", title: "Formal Explanation", body: "Precise terminology and structure." },
        { icon: "zap", title: "Test My Understanding", body: "Explain back without looking at AI." },
      ],
    },
    40,
  ),
  callout(
    "Feynman-style workflow: Learn → explain in your own words → AI finds gaps → study gaps → explain again. Pick a topic you don't understand and use AI as tutor for 15 minutes.",
    42,
    "info",
  ),
  gallery(
    43,
    "Feynman-style: explain in your own words → AI finds gaps → study gaps → explain again.",
    [
      {
        title: "Feynman-Style AI Learning",
        description:
          "Student explains a concept at the whiteboard while peer and AI assistant provide feedback before revising notes.",
        imageUrl: `${M6}/m6-feynman-learning.png`,
      },
    ],
  ),
  reflect(
    "Difficult Concept Challenge — Topic you studied and your explanation in your own words (3–5 sentences).",
    41,
  ),

  // ── Lab 4 — AI-Powered Exam Preparation (~30 min) ───────────────────────
  interactive(
    {
      variant: "comparison_table",
      title: "Lab 4 — Active Recall vs Passive Review",
      leftHeader: "Approach",
      rightHeader: "What It Looks Like",
      rows: [
        { left: "Passive review", right: "Endless rereading of notes and highlights" },
        { left: "Active recall", right: "Without looking at notes, define photosynthesis" },
        { left: "Spaced review", right: "Day 1 · Day 3 · Day 7 · Pre-exam" },
        { left: "Weakness analysis", right: "Identify three weakest areas from missed questions; two practice questions per weakness" },
      ],
    },
    50,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Lab 4 — AI-Powered Exam Preparation",
      subtitle: "~30 minutes · Prepare for concepts — not predictions. AI cannot reliably predict exact exam questions.",
      columns: 2,
      cards: [
        {
          icon: "target",
          title: "Exam Prep System",
          body: "Define exam → Diagnose knowledge → Identify gaps → Targeted practice → Active recall → Review errors → Retest weak areas",
        },
        {
          icon: "book",
          title: "Practice Exam Lab",
          body: "Create a 30-question practice exam: 15 MC · 5 T/F · 5 short answer · 5 application — with answer explanations, difficulty ratings, and topic labels.",
        },
        {
          icon: "wand",
          title: "Weakness Analysis Prompt",
          body: "Based on questions I missed, identify three weakest areas, explain each misconception, and create two practice questions per weakness.",
        },
        {
          icon: "shield",
          title: "Verification Rule",
          body: "Always check AI-generated questions against your syllabus and class materials.",
        },
      ],
    },
    51,
  ),
  gallery(
    52,
    "Diagnose gaps → targeted practice → active recall → spaced review before exam day.",
    [
      {
        title: "AI-Powered Exam Preparation",
        description:
          "Student reviews diagnostic quiz, weakness report, flashcards, and exam calendar across laptop, tablet, and notebook.",
        imageUrl: `${M6}/m6-exam-prep.png`,
      },
      {
        title: "Active Recall vs Passive Review",
        description:
          "Split scene: rereading highlighted notes vs closing notes and retrieving from memory with flashcards and blank paper.",
        imageUrl: `${M6}/m6-active-recall.png`,
      },
      {
        title: "Spaced Practice",
        description:
          "Review sessions distributed across several days with planner, flashcards, and practice blocks — not one cram night.",
        imageUrl: `${M6}/m6-spaced-practice.png`,
      },
    ],
  ),

  // ── Lab 5 — AI Productivity System (~30 min) ────────────────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Lab 5 — AI Productivity System",
      subtitle: "~30 minutes · A good schedule is one you can actually follow.",
      activities: [
        {
          id: "systems",
          label: "1",
          title: "Build Your Systems",
          icon: "target",
          accent: "violet",
          summary: "Daily plan · Weekly plan · Assignment tracker · Study plan · Exam calendar · Goal tracker",
        },
        {
          id: "priority",
          label: "2",
          title: "Priority Matrix",
          icon: "book",
          accent: "sky",
          summary:
            "Urgent + Important → do first · Important + not urgent → schedule · Urgent + less important → handle efficiently · Low value → reduce",
        },
        {
          id: "planner",
          label: "3",
          title: "Planner Prompt",
          icon: "wand",
          accent: "emerald",
          compare: {
            weak: "Study chemistry.",
            strong: "Complete 10 stoichiometry problems and review every error.",
          },
          footer:
            "Create a realistic weekly study plan: prioritize exams and assignments, at least 8 hours sleep, breaks and buffer time — then explain why you allocated time this way.",
        },
      ],
    },
    60,
  ),
  gallery(
    61,
    "Lab 5 — Build a weekly system you can actually follow: priorities, study blocks, sleep, and buffer time.",
    [
      {
        title: "AI Productivity System",
        description:
          "Student plans a busy academic week with laptop planner, paper calendar, assignment tracker, and task list.",
        imageUrl: `${M6}/m6-productivity-system.png`,
      },
    ],
  ),
  reflect(
    "Weekly Productivity System — List your commitments, deadlines, and one realistic focus block for tomorrow.",
    62,
  ),

  // ── Lab 6 — AI Research Assistant (~30 min) ─────────────────────────────
  interactive(
    {
      variant: "numbered_steps",
      title: "Lab 6 — AI Research Assistant",
      intro: "~30 minutes · Never cite a source you have not confirmed exists and supports your claim.",
      layout: "horizontal",
      steps: [
        { icon: "target", title: "Question", body: "Narrow from broad topic to focused research question." },
        { icon: "search", title: "Discover", body: "Find candidate sources with research tools." },
        { icon: "shield", title: "Evaluate Credibility", body: "Peer-reviewed · government · university · professional org vs blog or anonymous post." },
        { icon: "book", title: "Read & Compare", body: "Compare findings across multiple credible sources." },
        { icon: "wand", title: "Synthesize & Cite", body: "Build your argument with verified references." },
        { icon: "zap", title: "Verify", body: "Confirm every citation supports your claim." },
      ],
    },
    70,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Research Question Upgrade",
      columns: 2,
      cards: [
        {
          icon: "message",
          title: "Weak Question",
          body: "Tell me about healthcare AI.",
        },
        {
          icon: "target",
          title: "Better Question",
          body: "How is AI used in medical-image analysis, and what benefits and limitations have researchers identified?",
        },
        {
          icon: "book",
          title: "Research Tools",
          body: "Perplexity · NotebookLM · Google Scholar · Semantic Scholar · Consensus · Elicit (instructor-configurable).",
        },
        {
          icon: "sparkles",
          title: "Mini Project",
          body: "How can AI improve healthcare? → research question · five credible sources · summary · comparison · findings · limitations · references · five-slide outline.",
        },
      ],
    },
    71,
  ),
  gallery(
    72,
    "Question → discover → evaluate → read → compare → synthesize → cite → verify.",
    [
      {
        title: "AI Research Assistant",
        description:
          "Diverse students search scholarly sources, compare papers, review citations, and synthesize findings in a university library.",
        imageUrl: `${M6}/m6-research-assistant.png`,
      },
      {
        title: "Research Workflow",
        description:
          "Top-down desk showing research stages from question formulation through discovery, evaluation, synthesis, and verification.",
        imageUrl: `${M6}/m6-research-workflow.png`,
      },
    ],
  ),

  // ── Lab 7 — AI Writing & Communication (~30 min) ────────────────────────
  interactive(
    {
      variant: "numbered_steps",
      title: "Lab 7 — AI Writing & Communication Studio",
      intro: "~30 minutes · AI helps structure, clarity, grammar, tone, and feedback — not generating work you don't understand.",
      layout: "horizontal",
      steps: [
        { icon: "sparkles", title: "Idea", body: "Brainstorm topics and angles." },
        { icon: "book", title: "Outline", body: "Structure before drafting." },
        { icon: "target", title: "Student Draft", body: "You write the first version." },
        { icon: "wand", title: "AI Feedback", body: "Get suggestions on clarity and organization." },
        { icon: "brain", title: "Student Revision", body: "You revise — understanding every change." },
        { icon: "shield", title: "Final Human Review", body: "Proofread and verify before submitting." },
      ],
    },
    80,
  ),
  gallery(
    82,
    "Lab 7 — You write the draft; AI provides feedback on structure and clarity; you revise and approve every change.",
    [
      {
        title: "AI Writing & Communication Studio",
        description:
          "Student reviews essay draft with AI feedback on laptop while peer or writing tutor discusses revisions.",
        imageUrl: `${M6}/m6-writing-studio.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Writing Upgrades & Lab",
      columns: 2,
      cards: [
        {
          icon: "message",
          title: "Email Upgrade",
          body: "Hey prof send me what I missed → professional greeting, context, specific request, thank you.",
        },
        {
          icon: "shield",
          title: "Scholarship Rule",
          body: "Experiences must be real — AI may improve presentation, not invent achievements.",
        },
        {
          icon: "book",
          title: "Writing Lab",
          body: "Improve: poor email · weak paragraph · discussion post · short bio — and explain every major change.",
        },
        {
          icon: "target",
          title: "Human Effort Stays Central",
          body: "You must be able to explain and defend everything you submit.",
        },
      ],
    },
    81,
  ),

  // ── Lab 8 — Responsible AI in School (~20 min) ──────────────────────────
  gallery(
    89,
    "Lab 8 — Green · Yellow · Red zones — when in doubt, ask your instructor before using AI.",
    [
      {
        title: "Academic Integrity Zones",
        description:
          "Top-down workspace with green, yellow, and red zones for tutoring, rewriting, and prohibited uses like exam completion or fake citations.",
        imageUrl: `${M6}/m6-integrity-zones.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "topic_deck",
      title: "Lab 8 — Three Academic Integrity Zones",
      subtitle: "~20 minutes · When in doubt, ask your instructor before using AI.",
      columns: 3,
      sections: [
        {
          title: "GREEN — Usually OK",
          icon: "sparkles",
          body: "Explain concept · practice questions · quiz me · grammar · brainstorm · study plan (with policy).",
          accent: "emerald",
        },
        {
          title: "YELLOW — Check Instructor",
          icon: "target",
          body: "Rewriting paragraphs · outlines · summarizing reading · coding help · research synthesis.",
          accent: "amber",
        },
        {
          title: "RED — Misconduct",
          icon: "shield",
          body: "Complete exams · submit AI unchanged · fake citations · fake lab data · impersonation.",
          accent: "violet",
        },
      ],
    },
    90,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Before Using AI — 5 Questions",
      intro: "Run this checklist every time you consider AI for schoolwork.",
      layout: "horizontal",
      steps: [
        { icon: "book", title: "Is AI allowed?", body: "Check course and school policy first." },
        { icon: "brain", title: "Am I still learning?", body: "You should understand the work you submit." },
        { icon: "target", title: "Can I explain the work?", body: "If not, you are not ready to submit." },
        { icon: "shield", title: "Verified important facts?", body: "Cross-check claims and citations." },
        { icon: "wand", title: "Need disclosure?", body: "Disclose AI assistance when required." },
      ],
      footer: "PAUSE: Privacy → Accuracy → Understand → Safety & Fairness → Explain & Evaluate",
    },
    92,
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Which Zone? — Sort Each Scenario",
      tasks: ["GREEN", "YELLOW", "RED"],
      examples: [
        { text: "Ask AI to explain a concept step by step", task: "GREEN" },
        { text: "Generate practice quiz questions from your notes", task: "GREEN" },
        { text: "Use AI to brainstorm essay topics you will develop yourself", task: "GREEN" },
        { text: "Ask AI to rewrite a paragraph of your draft", task: "YELLOW" },
        { text: "Use AI for coding help on an assignment", task: "YELLOW" },
        { text: "Submit an AI-written essay unchanged as your own", task: "RED" },
        { text: "Paste exam questions and submit AI answers", task: "RED" },
        { text: "Invent fake citations for a research paper", task: "RED" },
      ],
    },
    93,
  ),
  activity(
    {
      title: "Academic integrity zones",
      prompt: "Which is most likely RED zone?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Generate practice quiz questions from your notes",
        "Submit an AI-written essay unchanged as your own",
        "Ask AI to explain a concept step by step",
        "Use AI to brainstorm essay topics you will develop yourself",
      ],
      revealMessage: "Submitting unchanged AI work as your own is academic misconduct in most policies.",
    },
    91,
  ),

  // ── Part IX–X — Tool Ecosystem & Learning Stack (~10 min) ───────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part IX — AI Learning Tool Ecosystem",
      subtitle: "The best system uses several tools — not one tool for everything.",
      columns: 3,
      cards: [
        {
          icon: "sparkles",
          title: "General Assistants",
          body: "ChatGPT · Claude · Gemini · Copilot — tutoring, writing, planning.",
        },
        {
          icon: "book",
          title: "Source-Grounded Study",
          body: "NotebookLM — PDFs, notes, grounded Q&A.",
        },
        {
          icon: "search",
          title: "Research",
          body: "Perplexity · Consensus · Scholar tools.",
        },
        {
          icon: "message",
          title: "Writing",
          body: "Grammarly · productivity-suite AI.",
        },
        {
          icon: "target",
          title: "Organization",
          body: "Notion AI · Microsoft/Google productivity tools.",
        },
        {
          icon: "wand",
          title: "Transcription & Presentations",
          body: "Otter.ai (where permitted) · Canva · Gamma.",
        },
      ],
    },
    100,
  ),
  gallery(
    101,
    "The best learning system uses several tools — tutor, notes, research, writing, planning, and verification.",
    [
      {
        title: "AI Learning Tool Ecosystem",
        description:
          "Diverse students use different AI learning stations across a modern HBCU learning lab.",
        imageUrl: `${M6}/m6-tool-ecosystem.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Part X — Build Your AI Learning Stack",
      columns: 2,
      cards: [
        {
          icon: "book",
          title: "Document Your Stack",
          body: "AI Tutor · Smart Notes · Research · Writing · Planning · Presentations · Verification method.",
        },
        {
          icon: "target",
          title: "One Tool Per Role",
          body: "Pick one tool or method for each role — then test it on real schoolwork this week.",
        },
      ],
    },
    102,
  ),
  gallery(
    104,
    "Document one tool or method for tutor, notes, research, writing, planning, and verification.",
    [
      {
        title: "Build Your AI Learning Stack",
        description:
          "Top-down workspace with separate areas for tutor, smart notes, research, writing, planning, and verification.",
        imageUrl: `${M6}/m6-learning-stack.png`,
      },
    ],
  ),
  reflect(
    "My Learning Stack — List one tool (or method) for tutor, notes, research, writing, and planning.",
    103,
  ),

  // ── Part XI — AI Study Workflow Playbook (~10 min) ──────────────────────
  interactive(
    {
      variant: "numbered_steps",
      title: "Part XI — AI Study Workflow Playbook",
      intro: "Integrate AI at each phase of your week — without letting it replace attention or effort.",
      layout: "horizontal",
      steps: [
        {
          icon: "book",
          title: "Before Class",
          body: "Preview terms · background questions · learning objectives.",
        },
        {
          icon: "target",
          title: "During Class",
          body: "Pay attention · meaningful notes · ask questions — AI is not a distraction.",
        },
        {
          icon: "wand",
          title: "After Class (24h)",
          body: "Review notes → summary → clarify concepts → recall questions → practice.",
        },
        {
          icon: "brain",
          title: "End of Week",
          body: "Combine notes → weak topics → update flashcards → retrieval practice → plan next week.",
        },
        {
          icon: "zap",
          title: "Before Exam",
          body: "Diagnostic quiz → weakness analysis → targeted practice → mock exam → error review → final review.",
        },
      ],
    },
    110,
  ),

  // ── Premium Workshops (~20 min) ─────────────────────────────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Premium Workshops",
      subtitle: "~20 minutes · Four extended workflows to practice with instructor support.",
      activities: [
        {
          id: "notes-exam",
          label: "1",
          title: "Notes → Exam System",
          icon: "book",
          accent: "violet",
          summary:
            "Lecture → clean notes → summary → flashcards → quiz → study guide → practice exam → weakness report.",
        },
        {
          id: "research-pres",
          label: "2",
          title: "Research → Presentation",
          icon: "target",
          accent: "sky",
          summary: "Question → sources → evidence → comparison → summary → slides → verified references.",
        },
        {
          id: "semester",
          label: "3",
          title: "Plan My Semester",
          icon: "wand",
          accent: "emerald",
          summary:
            "Classes · assignments · exams · activities · job → semester overview · tracker · weekly system · exam milestones · buffer time — then critique the plan.",
        },
        {
          id: "tutor",
          label: "4",
          title: "Build My AI Tutor",
          icon: "brain",
          accent: "amber",
          wide: true,
          summary:
            "Customize name · personality · subject · teaching method · quiz style · feedback rules — then test with real questions.",
        },
      ],
    },
    120,
  ),
  activity(
    {
      title: "Premium workshops completed",
      prompt: "Select workshops you completed (or reviewed with instructor).",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Notes → Exam System",
        "Research → Presentation",
        "Plan My Semester",
        "Build My AI Tutor",
      ],
    },
    121,
  ),
  gallery(
    122,
    "Premium Workshop 1 — One lecture becomes a complete exam-preparation system.",
    [
      {
        title: "Notes → Exam System",
        description:
          "Lecture document progressing into cleaned notes, summary, flashcards, quiz, study guide, practice exam, and weakness report.",
        imageUrl: `${M6}/m6-notes-to-exam.png`,
      },
    ],
  ),

  // ── Part XVI–XX — Study Battle · Metacognition · Masterclass (~15 min) ───
  interactive(
    {
      variant: "feature_cards",
      title: "Part XVI — AI Study Battle (Optional)",
      subtitle: "Judge: accuracy · usefulness · clarity · learning value · responsible use — not speed alone.",
      columns: 3,
      cards: [
        { icon: "book", title: "Best Explanation", body: "Who teaches the concept most clearly?" },
        { icon: "target", title: "Study Guide & Quiz", body: "Most useful practice resources from one source." },
        { icon: "wand", title: "Personalized Tutor", body: "Best hint-and-question tutoring style." },
        { icon: "brain", title: "Schedule", body: "Most realistic and followable study plan." },
        { icon: "shield", title: "Source-Grounded Summary", body: "Most accurate summary verified against originals." },
        { icon: "sparkles", title: "Learning Value", body: "Which approach made you more capable — not just faster?" },
      ],
    },
    130,
  ),
  gallery(
    133,
    "Optional competition — judge accuracy, clarity, learning value, and responsible use.",
    [
      {
        title: "AI Study Battle",
        description:
          "Diverse student teams compare explanations, study guides, quizzes, and source-grounded summaries in an innovation classroom.",
        imageUrl: `${M6}/m6-study-battle.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "concept_cards",
      title: "Part XVII–XIX — Metacognition & Dependence vs Augmentation",
      subtitle: "Strong learners capture → organize → understand → connect → retrieve → apply.",
      cards: [
        {
          icon: "brain",
          title: "Metacognition",
          body: "What do I know? What don't I know? Why did I miss this? What should I change?",
        },
        {
          icon: "zap",
          title: "Dependence Path",
          body: "AI answers everything → less practice → struggles without AI.",
        },
        {
          icon: "sparkles",
          title: "Augmentation Path",
          body: "Student attempts → AI supports → student practices → capability grows.",
        },
        {
          icon: "target",
          title: "The Key Question",
          body: "Am I becoming more capable because of AI — or more dependent on AI?",
        },
      ],
    },
    131,
  ),
  gallery(
    134,
    "Strong learners reflect on what they know, what they missed, and whether AI made them more capable.",
    [
      {
        title: "Metacognition — Learning How to Learn",
        description:
          "Student reviews exam results and reflects on mistakes, confidence, study methods, and next steps.",
        imageUrl: `${M6}/m6-metacognition.png`,
      },
      {
        title: "Dependence vs Augmentation",
        description:
          "Split pathways: relying entirely on AI answers vs attempting problems, checking feedback, and improving over time.",
        imageUrl: `${M6}/m6-dependence-vs-augmentation.png`,
      },
      {
        title: "Personal Knowledge System",
        description:
          "Notes, flashcards, research papers, and prompt library connected through a knowledge dashboard on a laptop.",
        imageUrl: `${M6}/m6-personal-knowledge-system.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Part XX — Future-Proof Student Masterclass",
      intro: "30-day learning challenge: Pick one skill → goal · baseline · roadmap · daily practice · weekly assessment · AI support · human practice.",
      layout: "horizontal",
      steps: [
        { icon: "book", title: "Learn Faster, Not Shallower", body: "Depth beats shortcuts." },
        { icon: "target", title: "Ask Better Questions", body: "Precision improves AI output." },
        { icon: "wand", title: "Build Systems, Not Hacks", body: "Reusable workflows beat one-off prompts." },
        { icon: "brain", title: "Practice Retrieval", body: "Test yourself from memory regularly." },
        { icon: "zap", title: "Attack Weaknesses", body: "Target gaps with deliberate practice." },
        { icon: "shield", title: "Maintain Human Judgment", body: "Verify, explain, and decide." },
        { icon: "sparkles", title: "Stay Adaptable", body: "Tools change — learning habits endure." },
      ],
    },
    132,
  ),
  gallery(
    135,
    "Build systems, not hacks — depth, retrieval practice, and human judgment outlast any tool.",
    [
      {
        title: "Future-Proof Student Masterclass",
        description:
          "Faculty speaker addresses ambitious HBCU students in a modern lecture hall about learning, AI, and adaptability.",
        imageUrl: `${M6}/m6-future-proof-masterclass.png`,
      },
    ],
  ),

  // ── Part XXI–XXII — Study Toolkit & Capstone (~30 min) ──────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XXI–XXII — Study Toolkit & Learning Accelerator Capstone",
      subtitle: "~30 minutes · Build reusable assets and apply them to a real learning challenge.",
      activities: [
        {
          id: "toolkit",
          label: "A",
          title: "AI Study Toolkit",
          icon: "book",
          accent: "violet",
          summary: "Include reusable prompts/templates for:",
          steps: [
            "Personal AI Tutor · Smart Note template · Flashcard generator · Quiz generator",
            "Exam prep system · Weekly planner · Assignment tracker · Research library",
            "Writing feedback library · Productivity dashboard · Responsible AI checklist (PAUSE) · Personal learning strategy",
          ],
        },
        {
          id: "capstone",
          label: "B",
          title: "Learning Accelerator Capstone",
          icon: "target",
          accent: "sky",
          wide: true,
          summary:
            "Choose a real challenge: difficult subject · exam · research · project · schedule · writing.",
          steps: [
            "Define problem → design AI workflow → build prompts → test → evaluate → improve",
            "Present: challenge · tools · workflow · prompts · resources · safeguards · what still requires human effort · reflection",
          ],
          footer: "Complete your capstone reflection below after building your workflow.",
        },
      ],
    },
    140,
  ),
  reflect(
    "Learning Accelerator Capstone — Your learning challenge and the AI workflow you designed (5–8 sentences).",
    141,
  ),
  gallery(
    142,
    "Build reusable prompts and templates — then apply them to a real learning challenge.",
    [
      {
        title: "AI Study Toolkit",
        description:
          "Complete toolkit flat-lay: tutor dashboard, smart notes, flashcards, quiz generator, planner, research cards, and PAUSE checklist.",
        imageUrl: `${M6}/m6-study-toolkit.png`,
      },
      {
        title: "Learning Accelerator Capstone",
        description:
          "Students present personalized study workflows with verification and responsible AI safeguards to instructors and peers.",
        imageUrl: `${M6}/m6-capstone.png`,
      },
      {
        title: "Capstone Workflow",
        description:
          "Six project stages from problem definition through workflow design, building, testing, evaluation, and improvement.",
        imageUrl: `${M6}/m6-capstone-workflow.png`,
      },
    ],
  ),

  // ── Flashcards + Summary ──────────────────────────────────────────────────
  interactive(
    {
      variant: "flashcard_carousel",
      title: "Module 6 — Flashcard Review",
      cards: [
        { id: "learn", front: "L-E-A-R-N", back: "Learn · Engage · Assess · Reflect · Next step." },
        { id: "tutor", front: "AI Tutor", back: "Hints and questions — not instant final answers." },
        { id: "notes", front: "Smart Notes", back: "One source → summary, guide, cards, quiz, map." },
        { id: "recall", front: "Active Recall", back: "Retrieve from memory — don't only reread." },
        { id: "exam", front: "Exam Prep", back: "Diagnose gaps → targeted practice → retest." },
        { id: "zones", front: "Three Zones", back: "Green · Yellow (ask) · Red (misconduct)." },
        { id: "pause", front: "PAUSE", back: "Privacy · Accuracy · Understand · Safety · Explain." },
        { id: "aug", front: "Augmentation", back: "AI supports your effort — capability should grow." },
      ],
    },
    150,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Summary — L-E-A-R-N",
      subtitle: "AI Study Cycle: Learn → Practice → Retrieve → Feedback → Identify gaps → Review → Apply → Repeat",
      columns: 3,
      cards: [
        { icon: "book", title: "L — Learn with AI", body: "Smart notes, explanations, and tutor workflows accelerate understanding." },
        { icon: "target", title: "E — Engage", body: "Attempt problems yourself before accepting AI answers." },
        { icon: "brain", title: "A — Assess", body: "Quizzes, weakness analysis, and active recall reveal real gaps." },
        { icon: "wand", title: "R — Reflect", body: "Ask whether AI made you more capable — not just faster." },
        { icon: "zap", title: "N — Next Step", body: "Target weak areas with deliberate practice from evidence." },
        {
          icon: "sparkles",
          title: "Bridge to Module 7 — AI Career Accelerator",
          body: "You can learn smarter with AI. Next: How can AI help you become a stronger candidate and future-ready professional?",
        },
      ],
    },
    160,
  ),
  gallery(
    159,
    "L-E-A-R-N — Learn · Engage · Assess · Reflect · Next step for every study session.",
    [
      {
        title: "L-E-A-R-N Mental Model",
        description:
          "Five workspace zones for learning materials, active practice, quiz results, reflection journal, and next-step planner.",
        imageUrl: `${M6}/m6-learn-model.png`,
      },
    ],
  ),
  gallery(
    161,
    "AI helps you become a better learner — not a dependent one.",
    [
      {
        title: "AI-Powered Learner — Module Closing",
        description:
          "Diverse HBCU students confidently studying with notebooks, laptops, flashcards, planners, and AI-assisted tools.",
        imageUrl: `${M6}/m6-closing-hero.png`,
      },
    ],
  ),

  // ── Reflections + completion ──────────────────────────────────────────────
  reflect("Reflection 1 — Which AI workflow could save you the most time each week?", 400),
  reflect("Reflection 2 — Which technique helped you understand something better, not just finish faster?", 401),
  reflect("Reflection 3 — What school task should you never completely delegate to AI?", 402),
  reflect("Reflection 4 — How will you know if you are becoming too dependent on AI?", 403),
  reflect("Reflection 5 — Which three components will you include in your personal AI learning system?", 404),
  reflect("Reflection 6 — What will you start doing differently next week?", 405),
  {
    block_type: "checkpoint",
    sort_order: 406,
    content: {
      title: "Upload AI Study Toolkit artifact",
      description: "PDF or screenshot of tutor prompt, study guide, flashcards, or planner template.",
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      maxSizeMb: 10,
    },
  },
  {
    block_type: "module_completion",
    sort_order: 407,
    content: {
      title: "Congratulations!",
      message:
        "You completed Module 6: AI Learning Accelerator. You can build tutor workflows, smart notes, exam prep, research, writing feedback, productivity systems, and responsible academic AI habits.",
      rewards: {
        xp: 300,
        badges: ["ai-powered-learner"],
        nextModule: "Module 7: AI Career Accelerator",
        comingNext:
          "Build your resume, brand, interview skills, portfolio, and AI Career Toolkit for the future of work.",
      },
    },
  },
]
