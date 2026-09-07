/**
 * AI Bootcamp Module 8 — Final Capstone Showcase & Graduation (shared).
 * Directs students to Capstone Projects in the Projects hub; awards AI Innovator.
 */

import type { CurriculumModule } from "./ai-edge-2026"

function text(markdown: string, sort: number) {
  return { block_type: "text" as const, content: { markdown }, sort_order: sort }
}

function callout(textContent: string, sort: number, variant = "tip") {
  return { block_type: "callout" as const, content: { variant, text: textContent }, sort_order: sort }
}

function reflect(prompt: string, sort: number) {
  return { block_type: "reflection" as const, content: { prompt }, sort_order: sort }
}

function interactive(content: Record<string, unknown>, sort: number) {
  return { block_type: "interactive" as const, content, sort_order: sort }
}

export const AI_BOOTCAMP_MODULE_9: CurriculumModule & { pathway: "shared" } = {
  title: "Module 8: AI Innovation Challenge & Graduation Showcase",
  description:
    "Choose a capstone project, build with at least three AI tools, present at the AI Innovation Expo, and graduate as an AI Innovator.",
  sort_order: 9,
  pathway: "shared",
  blocks: [
    {
      block_type: "hero",
      sort_order: 0,
      content: {
        title: "Final Capstone Showcase",
        subtitle: "AI Bootcamp 2026 · Become an AI Innovator",
        tags: ["Capstone", "Expo", "Innovate"],
      },
    },
    callout(
      "Estimated time: 3–5 hours · Difficulty: Intermediate · XP Reward: 500 XP · Badge: AI Innovator",
      1,
    ),
    interactive(
      {
        variant: "feature_cards",
        title: "Project Overview & Objective",
        subtitle: "Combine everything you learned into one final project — individually or in teams of 2–4.",
        columns: 2,
        cards: [
          {
            icon: "sparkles",
            title: "Demonstrate mastery",
            body: "Creativity, problem solving, teamwork, and responsible AI use.",
          },
          {
            icon: "target",
            title: "Minimum AI tools",
            body: "Every project must use at least three different AI tools.",
          },
        ],
      },
      2,
    ),
    {
      block_type: "interactive",
      sort_order: 3,
      content: { variant: "start_journey", title: "Start Capstone: Become an AI Innovator" },
    },
    {
      block_type: "mission_objectives",
      sort_order: 4,
      content: {
        title: "Graduation Requirements",
        missions: [
          { title: "Complete Modules 0–8", xp: 50 },
          { title: "Choose & finish one Capstone Project", xp: 150 },
          { title: "Submit reflection report (2–3 pages)", xp: 75 },
          { title: "Present at the AI Innovation Expo", xp: 100 },
          { title: "Complete the Final Reflection Survey", xp: 50 },
          { title: "Earn AI Innovator + certificate", xp: 75 },
        ],
      },
    },
    callout(
      "**Go to Projects now.** Open **Summer Camp → Projects** and choose one of the three Capstone Projects: Smart Student Success Toolkit, AI Startup Challenge, or AI for Social Good. Complete the project deliverables there, then return here for the Expo checklist, survey, and graduation.",
      5,
      "warning",
    ),
    text(
      "## Capstone Projects & Deliverables\n\nChoose **one** capstone in **Summer Camp → Projects**. Return here for Expo prep, uploads, survey, and graduation.",
      6,
    ),
    interactive(
      {
        variant: "topic_deck",
        title: "Available Capstone Projects (choose ONE)",
        subtitle: "Open Summer Camp → Projects for full briefs, steps, and upload checkpoints.",
        comparisonLabels: { left: "Project", right: "Theme & focus" },
        comparisonRows: [
          {
            left: "Smart Student Success Toolkit",
            right: "Education — study assistant, flashcards, planner, quizzes, tutor.",
          },
          {
            left: "AI Startup Challenge",
            right: "Entrepreneurship — $1M startup branding, website, pitch.",
          },
          {
            left: "AI for Social Good",
            right: "Community impact — research, campaign, prototype.",
          },
        ],
      },
      6,
    ),
    interactive(
      {
        variant: "feature_cards",
        title: "Required Across Every Project",
        columns: 2,
        cards: [
          { icon: "book", title: "Research & content", body: "Evidence-backed problem definition and AI-generated content." },
          { icon: "wand", title: "Media & demo", body: "Images · presentation · live demonstration · reflection." },
          {
            icon: "target",
            title: "≥ 3 AI platforms",
            body: "e.g. ChatGPT, Gemini, Copilot, Perplexity, NotebookLM, Canva, Gamma, Lovable, Bolt, Cursor, Firefly, Higgsfield, Suno, Runway.",
          },
        ],
      },
      6,
    ),
    interactive(
      {
        variant: "numbered_steps",
        title: "Final Video (5–7 minutes)",
        intro: "Include introduction, overview, problem, tools, demo, lessons, and future improvements.",
        layout: "horizontal",
        steps: [
          { icon: "message", title: "Introduction", body: "Team, names, and project title." },
          { icon: "target", title: "Problem & overview", body: "What you solved and why it matters." },
          { icon: "wand", title: "AI tools & demo", body: "Which tools — and show the solution working." },
          { icon: "book", title: "Lessons & next steps", body: "What you learned and what you'd improve." },
        ],
      },
      7,
    ),
    interactive(
      {
        variant: "numbered_steps",
        title: "Reflection Report (2–3 pages)",
        intro: "Answer each prompt honestly — specific examples beat generic praise.",
        layout: "horizontal",
        steps: [
          { icon: "target", title: "Problem", body: "What problem did you solve?" },
          { icon: "brain", title: "Tools", body: "Which AI tools — and why each?" },
          { icon: "shield", title: "Challenges", body: "What was hard? How did prompts help?" },
          { icon: "sparkles", title: "Growth", body: "What would you improve? What did AI teach you?" },
        ],
      },
      8,
    ),
    text("## Evaluation Rubric & AI Innovation Expo", 9),
    interactive(
      {
        variant: "comparison_table",
        title: "Evaluation Rubric (100 points)",
        leftHeader: "Criterion",
        rightHeader: "Points",
        rows: [
          { left: "Problem Definition", right: "15" },
          { left: "Creativity", right: "20" },
          { left: "Technical Quality", right: "20" },
          { left: "Professional Presentation", right: "15" },
          { left: "Demonstration", right: "15" },
          { left: "Reflection", right: "15" },
        ],
      },
      9,
    ),
    interactive(
      {
        variant: "feature_cards",
        title: "AI Innovation Expo",
        subtitle: "Each team: 8 minutes presentation + 5 minutes Q&A. Judges score every project.",
        columns: 3,
        cards: [
          { icon: "sparkles", title: "Best Overall", body: "Top project across all criteria." },
          { icon: "wand", title: "Most Innovative", body: "Novel idea or approach." },
          { icon: "target", title: "Best Technical Solution", body: "Strong execution and integration." },
          { icon: "brain", title: "Best Design", body: "Polished visuals and user experience." },
          { icon: "message", title: "Best Presentation", body: "Clear, engaging Expo delivery." },
          { icon: "shield", title: "Best Social Impact", body: "Meaningful community benefit." },
          { icon: "book", title: "People's Choice", body: "Audience favorite vote." },
          { icon: "zap", title: "Future Entrepreneur", body: "Startup-ready pitch and vision." },
        ],
      },
      10,
    ),
    {
      block_type: "checkpoint",
      sort_order: 11,
      content: {
        title: "Capstone package upload",
        description:
          "Upload your final package: presentation PDF/PPTX, reflection report PDF, and optional video link notes (PDF with URLs is fine).",
        acceptedTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "video/mp4",
          "application/zip",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        maxSizeMb: 100,
        facultyApproval: true,
      },
    },
    reflect("Expo prep — Which project did you choose, and who is on your team (or Solo)?", 12),
    reflect("List the three+ AI tools you used and one sentence each on how they helped:", 13),
    reflect("Paste a short outline of your 8-minute Expo talk (problem → solution → demo → learnings):", 14),

    text("## Final Reflection Survey\n\nShare honest feedback to help improve the next cohort.", 15),
    callout("Complete every prompt below before marking the module done.", 15, "info"),
    {
      block_type: "feedback",
      sort_order: 16,
      content: {
        question: "How confident are you using AI after this bootcamp? (1–5)",
      },
    },
    reflect("Which module helped you the most?", 17),
    reflect("Which AI tool was your favorite?", 18),
    reflect("How do you plan to use AI after this workshop?", 19),
    {
      block_type: "activity",
      sort_order: 20,
      content: {
        title: "Would you recommend this bootcamp?",
        prompt: "Select one, then explain in the reflection below.",
        activityType: "poll",
        multiSelect: false,
        options: ["Yes", "No"],
        revealMessage: "Thanks — your feedback helps improve the next cohort.",
      },
    },
    reflect("Why or why not would you recommend this bootcamp?", 21),

    text("## Graduation & Certificate", 22),
    interactive(
      {
        variant: "feature_cards",
        title: "Certificate Award",
        subtitle: "Prairie View A&M University · Department of Electrical & Computer Engineering · CREDIT Center",
        columns: 1,
        cards: [
          {
            icon: "sparkles",
            title: "Certificate of Completion",
            body: "Artificial Intelligence Summer Bootcamp — earned upon completing this module and Expo requirements.",
          },
        ],
      },
      22,
    ),
    {
      block_type: "feedback",
      sort_order: 23,
      content: {
        kind: "clarity",
        question: "Was the Capstone Showcase clear and well organized?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 24,
      content: {
        title: "Congratulations — You are an AI Innovator!",
        message:
          "You successfully completed the Prairie View A&M University AI Summer Bootcamp. You learned to think critically, prompt effectively, build with AI, study with AI, create with AI, and prepare for college and career. The future belongs to those who know how to work with AI—not just use AI. Keep learning. Keep building. Keep innovating.",
        rewards: {
          xp: 500,
          badges: ["ai-innovator"],
          nextModule: "Module 9: Summary, Showcase & Graduation Ceremony",
          comingNext:
            "Celebrate your journey, present at the Expo wrap-up, complete the final survey, and receive your Certified AI Explorer certificate.",
        },
      },
    },
  ],
}
