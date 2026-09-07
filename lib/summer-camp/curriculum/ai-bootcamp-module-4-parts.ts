/**
 * AI Bootcamp Module 4 — Part blocks (I–XXVIII + closing).
 * Preamble and knowledge check composed in ai-bootcamp-module-4.ts.
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

const M4 = "/summer-camp/ai-bootcamp/assets/module-4"

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
          id: `m4-row-${sort}`,
          columns: columns.map((col, i) => ({
            id: `m4-col-${sort}-${i}`,
            widthFraction: col.widthFraction,
            cells: col.cells.map((cell, j) => ({
              id: `m4-cell-${sort}-${i}-${j}`,
              ...cell,
            })),
          })),
        },
      ],
    },
  }
}

export const AI_BOOTCAMP_MODULE_4_PART_BLOCKS: CurriculumBlock[] = [
  // ── Part I — Why AI Ethics Matters (~10 min) ────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part I — Why AI Ethics Matters",
      subtitle: "~10 minutes · AI systems affect people, opportunities, information, decisions, and society.",
      columns: 2,
      cards: [
        {
          icon: "target",
          title: "Opening Scenario",
          body: "A school uses AI to recommend students for a competitive scholarship — analyzing grades, attendance, activities, essays, and previous scholarship decisions. Should AI make the final call? What if past decisions hid bias? What if nobody can explain a rejection?",
        },
        {
          icon: "shield",
          title: "Core Idea",
          body: "The fact that AI can do something does not automatically mean AI should do it. High-stakes decisions need human oversight, fairness checks, and meaningful explanation.",
        },
      ],
    },
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
            markdown: `### The Ethical Question

> **Should AI choose who receives the scholarship?**

A school uses AI to recommend students for a competitive scholarship — analyzing grades, attendance, activities, essays, and previous decisions.

What if past decisions hid bias? What if nobody can explain a rejection?`,
          },
        ],
      },
      {
        widthFraction: 0.55,
        cells: [
          {
            type: "image",
            imageUrl: `${M4}/m4-scholarship.png`,
            alt: "Student and administrators reviewing an AI scholarship recommendation",
            caption: "Algorithms can influence life-changing opportunities — human judgment still matters.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  activity(
    {
      title: "Scholarship Scenario",
      prompt: "In the opening scenario, who should make the final scholarship decision?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "AI alone — it is objective",
        "Humans with AI as a recommendation only, with oversight and explanation",
        "Whoever has the fastest computer",
        "No one — cancel scholarships",
      ],
      revealMessage: "High-stakes decisions need human oversight, fairness checks, and meaningful explanation.",
    },
    12,
  ),
  gallery(
    13,
    "FAST ≠ FAIR — efficiency alone does not guarantee responsible outcomes.",
    [
      {
        title: "Efficiency vs. Human Consequences",
        description:
          "An administrator processes hundreds of applications quickly while real student folders in the foreground remind us that efficiency and fairness are not the same thing.",
        imageUrl: `${M4}/m4-fast-not-fair.png`,
      },
    ],
  ),

  // ── Part II — What Is AI Ethics? (~10 min) ────────────────────────────────
  interactive(
    {
      variant: "concept_cards",
      title: "Part II — What Is AI Ethics?",
      subtitle: "~10 minutes · You need both principles and practical habits.",
      cards: [
        {
          icon: "book",
          title: "AI Ethics",
          body: "Examines how artificial intelligence should be designed, developed, deployed, and used in ways that respect people, society, rights, safety, and human values. Asks: What is right, fair, safe, and acceptable?",
        },
        {
          icon: "shield",
          title: "Responsible AI",
          body: "The practices that help teams and users build and use AI thoughtfully — privacy habits, verification, transparency, oversight, and accountability. Asks: What should we actually do day to day?",
        },
      ],
    },
    20,
  ),
  gallery(
    21,
    "AI ethics asks what should be done; Responsible AI asks what we should do day to day.",
    [
      {
        title: "AI Ethics — Philosophical Questioning",
        description:
          "Students and faculty debate fairness, harm, and acceptable use around a seminar table — ethics is about values and consequences.",
        imageUrl: `${M4}/m4-ai-ethics-discussion.png`,
      },
      {
        title: "Responsible AI — Operational Practice",
        description:
          "A multidisciplinary team reviews risk checklists and system diagrams before deployment — responsible AI is about oversight and action.",
        imageUrl: `${M4}/m4-responsible-ai-ops.png`,
      },
    ],
  ),

  // ── Part III — Responsible AI Principles (~15 min) ──────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part III — The Responsible AI Principles",
      subtitle: "~15 minutes · Use these 8 principles throughout the module — not just once.",
      imageUrl: `${M4}/m4-principles.png`,
      imageCaption: "Responsible AI is multidisciplinary — fairness, privacy, security, transparency, and human oversight work together.",
      columns: 4,
      sections: [
        { title: "1 · Fairness", icon: "target", body: "AI should not systematically disadvantage people unfairly.", accent: "violet" },
        { title: "2 · Reliability & Safety", icon: "zap", body: "AI should operate appropriately for its intended purpose.", accent: "sky" },
        { title: "3 · Privacy", icon: "shield", body: "Personal information should be protected.", accent: "emerald" },
        { title: "4 · Security", icon: "brain", body: "AI systems and data should be protected from misuse.", accent: "amber" },
        { title: "5 · Transparency", icon: "message", body: "People should know when AI is used and how it influences outcomes.", accent: "violet" },
        { title: "6 · Accountability", icon: "book", body: "Someone remains responsible for decisions and consequences.", accent: "sky" },
        { title: "7 · Human Oversight", icon: "wand", body: "Humans supervise AI where consequences matter.", accent: "emerald" },
        { title: "8 · Inclusiveness", icon: "sparkles", body: "AI should work for diverse needs, abilities, and backgrounds.", accent: "amber" },
      ],
    },
    30,
  ),
  interactive(
    {
      variant: "matching",
      title: "Principle → Scenario — Tap to Reveal",
      prompt: "Match each situation to the most relevant principle.",
      pairs: [
        { task: "School hides that AI graded essays", capability: "Transparency" },
        { task: "Voice tool fails for certain accents", capability: "Inclusiveness / Fairness" },
        { task: "No one accountable after AI error harms a patient", capability: "Accountability" },
        { task: "Student passwords leaked via AI chatbot", capability: "Security & Privacy" },
      ],
    },
    31,
  ),
  gallery(
    32,
    "Eight principles — one interconnected framework for responsible AI.",
    [
      {
        title: "Responsible AI Principles Wheel",
        description:
          "Fairness, safety, privacy, security, transparency, accountability, human oversight, and inclusiveness work together as a system.",
        imageUrl: `${M4}/m4-principles-wheel.png`,
      },
    ],
  ),
  gallery(
    33,
    "Responsible AI is a lifecycle — not a one-time checklist.",
    [
      {
        title: "The Responsible AI Lifecycle",
        description:
          "From problem identification through design, data review, testing, deployment, monitoring, and retirement — responsible AI requires ongoing human judgment.",
        imageUrl: `${M4}/m4-lifecycle.png`,
      },
    ],
  ),

  // ── Part IV — AI Bias & Fairness (~15 min) ──────────────────────────────
  text(
    `## Part IV — AI Bias & Fairness

**Estimated time:** ~15 minutes

> **Can a computer be unfair?** Computers do not have feelings — yet unfair outcomes can emerge from data, design, and deployment. Explore the chain below, then test your understanding.`,
    40,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "How Bias Enters AI Systems",
      subtitle: "Unfair patterns can travel from history into real-world harm — often without anyone intending to discriminate.",
      steps: [
        { label: "Historical Data", detail: "Past decisions and records that may embed old inequities" },
        { label: "Data Collection", detail: "Who was included, measured, or left out" },
        { label: "Human Decisions", detail: "Labels, rules, and assumptions during setup" },
        { label: "Model Training", detail: "The system learns statistical patterns from examples" },
        { label: "AI Predictions", detail: "Scores, rankings, or recommendations at scale" },
        { label: "Real-World Outcomes", detail: "Scholarships denied, jobs missed, resources misallocated" },
      ],
    },
    41,
  ),
  gallery(
    42,
    "Can a computer be unfair? Automated hiring can rank real people — often without anyone intending to discriminate.",
    [
      {
        title: "AI Bias in Hiring",
        description:
          "Diverse applicants wait while an AI system ranks candidate profiles on a nearby monitor. The question is not whether the computer has feelings — it is whether the outcome is fair.",
        imageUrl: `${M4}/m4-bias-hiring.png`,
      },
    ],
  ),
  callout(
    "Example: An AI hiring system trained on ten years of past hiring may learn who was hired before — not who should be hired next.",
    43,
    "info",
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Sources of Bias (Accessible)",
      columns: 2,
      cards: [
        { icon: "book", title: "Biased historical data", body: "Past inequities reproduced in training sets." },
        { icon: "target", title: "Unrepresentative datasets", body: "Some groups under-sampled or missing." },
        { icon: "zap", title: "Measurement bias", body: "What you measure skews what the model optimizes." },
        { icon: "brain", title: "Sampling bias", body: "Convenient data ≠ population reality." },
        { icon: "message", title: "Human assumptions", body: "Design choices smuggle in hidden values." },
        { icon: "shield", title: "Proxy variables", body: "Zip codes or names standing in for protected traits." },
        { icon: "wand", title: "Deployment context", body: "A model fine in one setting fails in another." },
        { icon: "sparkles", title: "Feedback loops", body: "Bad outputs create worse data for the next round." },
      ],
    },
    44,
  ),
  activity(
    {
      title: "Bias Without Intent",
      prompt: "True or False: An AI system can produce unfair outcomes without anyone programming it to discriminate.",
      activityType: "poll",
      multiSelect: false,
      options: ["True", "False"],
      revealMessage: "True — patterns in data and design can reproduce unfair outcomes.",
    },
    45,
  ),
  gallery(
    46,
    "Patterns from past human decisions can travel through data into future AI recommendations.",
    [
      {
        title: "Historical Bias Entering AI",
        description:
          "Past hiring records, model training, and automated rankings show how yesterday's decisions can shape tomorrow's recommendations.",
        imageUrl: `${M4}/m4-historical-bias.png`,
      },
      {
        title: "Where Bias Can Enter",
        description:
          "Incomplete datasets, subjective labeling, deployment mismatch, and feedback loops — bias has many entry points across the AI pipeline.",
        imageUrl: `${M4}/m4-where-bias-enters.png`,
      },
    ],
  ),

  // ── Part V — Fairness Isn't Always Simple (~10 min) ─────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part V — Fairness Isn't Always Simple",
      subtitle: "~10 minutes · Ten laptops to distribute — which is \"fairest\"? Different definitions of fair produce different outcomes.",
      columns: 2,
      cards: [
        { icon: "sparkles", title: "Equal random chance", body: "Everyone has the same lottery odds — fair in one sense, ignores need." },
        { icon: "book", title: "Highest grades first", body: "Rewards merit — but may overlook students without home resources." },
        { icon: "target", title: "Students without home computers", body: "Prioritizes access — but other students may feel overlooked." },
        { icon: "shield", title: "Greatest financial need", body: "Equity-focused — requires trustworthy data and transparent criteria." },
      ],
      footer: "Responsible AI often involves tradeoffs, not one obvious answer.",
    },
    50,
  ),
  gallery(
    51,
    "Ten laptops, twenty students — fairness is not always simple.",
    [
      {
        title: "Competing Ideas of Fairness",
        description:
          "A professor considers how to distribute limited laptops among students with different needs, resources, and circumstances. There is rarely one obvious \"fair\" answer.",
        imageUrl: `${M4}/m4-ten-laptops.png`,
      },
    ],
  ),

  // ── Part VI — Privacy and Personal Data (~15 min) ───────────────────────
  interactive(
    {
      variant: "comparison_table",
      title: "Part VI — Privacy and Personal Data (~15 min)",
      leftHeader: "Category",
      rightHeader: "Examples",
      rows: [
        { left: "Personal", right: "Name, email, phone, address" },
        { left: "Sensitive", right: "Medical, financial, passwords, ID numbers" },
        { left: "Sensitive", right: "Private school records, biometrics, confidential conversations" },
      ],
    },
    60,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Before You Prompt — 5 Questions",
      intro: "Before you prompt, minimize what you share.",
      layout: "horizontal",
      steps: [
        { icon: "shield", title: "Is it mine to share?", body: "You may not have permission for someone else's data." },
        { icon: "target", title: "Does the AI need it?", body: "Remove anything that does not help the task." },
        { icon: "book", title: "Is the tool approved?", body: "School and platform policies matter." },
        { icon: "wand", title: "Can I de-identify?", body: "Replace names and IDs with generic labels." },
        { icon: "zap", title: "What if it leaked?", body: "If exposure would hurt someone, do not paste it." },
      ],
      footer: "Minimize the data you share.",
    },
    61,
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Safe to Share or Keep Private?",
      tasks: ["Safe to Share", "Keep Private"],
      examples: [
        { text: "Public textbook facts for a brainstorm", task: "Safe to Share" },
        { text: "Your password or MFA code", task: "Keep Private" },
        { text: "Classmate's private medical records", task: "Keep Private" },
        { text: "Generic essay structure feedback (no names)", task: "Safe to Share" },
        { text: "Student ID + home address together", task: "Keep Private" },
      ],
    },
    62,
  ),
  gallery(
    63,
    "Pause before you upload — personal data deserves careful protection.",
    [
      {
        title: "Data Privacy Awareness",
        description:
          "Before sharing documents with an AI assistant, consider what personal, medical, or financial information might be exposed.",
        imageUrl: `${M4}/m4-data-privacy.png`,
      },
    ],
  ),
  gallery(
    64,
    "Share only what is necessary — data minimization protects you and others.",
    [
      {
        title: "Too Much Information (Risky)",
        description:
          "Uploading unnecessary sensitive documents to an AI assistant increases privacy risk — pause before you share.",
        imageUrl: `${M4}/m4-data-minimization-unsafe.png`,
      },
      {
        title: "Minimal Necessary Input (Better)",
        description:
          "Ask a focused academic question while keeping private documents closed and stored safely away.",
        imageUrl: `${M4}/m4-data-minimization-safe.png`,
      },
    ],
  ),

  // ── Part VII — Data, Consent, Digital Footprints (~10 min) ────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part VII — Data, Consent, and Digital Footprints",
      subtitle: "~10 minutes · Information rarely stays in one place.",
      steps: [
        { label: "Collected", detail: "Forms, apps, cameras, uploads, clicks" },
        { label: "Stored", detail: "Servers, backups, school systems, cloud accounts" },
        { label: "Processed", detail: "Sorted, tagged, analyzed, or fed to models" },
        { label: "Shared", detail: "Partners, vendors, classmates, social feeds" },
        { label: "Reused", detail: "Training, profiling, recommendations, ads" },
        { label: "Deleted or Retained", detail: "Policies — not always under your control" },
      ],
    },
    70,
  ),
  callout(
    "If you upload your friend's photograph to an AI image generator, should your friend have a say? Discuss consent for photographs, voices, messages, schoolwork, videos, and private documents.",
    71,
    "info",
  ),
  gallery(
    72,
    "Having a photo is not the same as having permission to transform or publish it.",
    [
      {
        title: "Consent & Digital Identity",
        description:
          "A student pauses before uploading a friend's photo to an AI image tool — digital consent matters even among friends.",
        imageUrl: `${M4}/m4-consent-digital-identity.png`,
      },
    ],
  ),
  gallery(
    73,
    "Information rarely stays in one place — understand the data lifecycle before you share.",
    [
      {
        title: "The Data Lifecycle",
        description:
          "From upload to storage, processing, sharing, reuse, and eventual deletion — your data may travel further than you expect.",
        imageUrl: `${M4}/m4-data-lifecycle.png`,
      },
    ],
  ),

  // ── Part VIII — Hallucinations & Reliability (~10 min) ──────────────────
  interactive(
    {
      variant: "comparison_table",
      title: "Part VIII — AI Hallucinations & Reliability (~10 min)",
      leftHeader: "Risk level",
      rightHeader: "Example",
      rows: [
        { left: "Low consequence", right: "Wrong Pokémon release year or trivia error" },
        { left: "Higher consequence", right: "Wrong medical, legal, financial, or safety advice" },
        { left: "Higher consequence", right: "Fabricated academic citations" },
      ],
    },
    80,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Verification Ladder",
      subtitle: "Same underlying problem — very different consequences. The higher the consequence, the higher the verification requirement.",
      columns: 3,
      cards: [
        { icon: "sparkles", title: "Low Risk", body: "Basic review — skim for obvious errors." },
        { icon: "target", title: "Medium Risk", body: "Verify sources and cross-check facts." },
        { icon: "shield", title: "High Risk", body: "Qualified human expert — not more prompting." },
      ],
    },
    81,
  ),
  gallery(
    82,
    "Same underlying problem — very different consequences. Higher risk requires higher verification.",
    [
      {
        title: "The AI Risk Ladder",
        description:
          "From low-stakes trivia to fabricated citations to medical advice — the higher the consequence, the more human expertise you need.",
        imageUrl: `${M4}/m4-risk-ladder.png`,
      },
    ],
  ),

  // ── Part IX — Misinformation & Disinformation (~10 min) ─────────────────
  interactive(
    {
      variant: "concept_cards",
      title: "Part IX — Misinformation and Disinformation",
      subtitle: "~10 minutes · Generative AI can mass-produce articles, images, posts, audio, and video — making misleading content cheaper and faster.",
      cards: [
        {
          icon: "message",
          title: "Misinformation",
          body: "False or inaccurate information shared without necessarily intending harm — mistakes, rumors, or outdated claims spread quickly.",
        },
        {
          icon: "zap",
          title: "Disinformation",
          body: "False or misleading information deliberately created or spread to deceive — propaganda, scams, or coordinated manipulation.",
        },
      ],
    },
    90,
  ),
  gallery(
    91,
    "Generative AI can amplify misleading content at scale — media literacy matters more than ever.",
    [
      {
        title: "Misinformation at Scale",
        description:
          "Students in a media-literacy lab investigate duplicated posts, manipulated images, and suspicious sources spreading rapidly across screens.",
        imageUrl: `${M4}/m4-misinformation.png`,
      },
    ],
  ),

  // ── Part X — Deepfakes (~15 min) ────────────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part X — Deepfakes and Synthetic Media",
      subtitle: "~15 minutes · A deepfake is synthetic or manipulated media that makes someone appear to say or do something they did not.",
      columns: 2,
      cards: [
        { icon: "wand", title: "Face swapping", body: "One person's face mapped onto another's body." },
        { icon: "message", title: "Voice cloning", body: "Synthetic speech that mimics a real voice." },
        { icon: "target", title: "Fake interviews & endorsements", body: "Celebrity or expert appears to promote something." },
        { icon: "shield", title: "Harassment & impersonation", body: "Non-consensual or harmful synthetic media." },
      ],
      footer:
        "Visual appearance alone may no longer be sufficient evidence. The lesson is media literacy and verification — not \"I can always spot AI.\"",
    },
    100,
  ),
  activity(
    {
      title: "Media Literacy",
      prompt: "You see a viral video of a celebrity endorsing a product. Best first step?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Share immediately — it looks real",
        "Check source, context, and independent verification before trusting or sharing",
        "Assume all videos are fake",
        "Send money if the celebrity asks",
      ],
      revealMessage: "Investigate source, evidence, context, verification, and motivation — not just visual artifacts.",
    },
    101,
  ),
  gallery(
    102,
    "Visual appearance alone may no longer be sufficient evidence — investigate source, context, and verification.",
    [
      {
        title: "Deepfakes & Synthetic Media",
        description:
          "Students in a media lab compare nearly identical video frames and analyze waveforms to determine what is authentic.",
        imageUrl: `${M4}/m4-deepfakes.png`,
      },
      {
        title: "Real vs. Synthetic",
        description:
          "Side-by-side comparison reminds us that synthetic media can be nearly indistinguishable without careful investigation.",
        imageUrl: `${M4}/m4-real-vs-synthetic.png`,
      },
    ],
  ),

  // ── Part XI — AI Scams & Impersonation (~10 min) ────────────────────────
  interactive(
    {
      variant: "comparison_table",
      title: "Part XI — AI Scams, Fraud & Impersonation (~10 min)",
      leftHeader: "Scenario",
      rightHeader: "Risk",
      rows: [
        { left: "Fake emergency voice", right: "\"Mom, I'm in trouble. Send money.\"" },
        { left: "Fake teacher", right: "Message requests account credentials" },
        { left: "Fake celebrity video", right: "Promotes an investment scam" },
        { left: "Fake recruiter", right: "Requests sensitive personal information" },
      ],
    },
    110,
  ),
  gallery(
    112,
    "Stop → Verify independently → Contact through a trusted channel → Never act solely because something sounds urgent.",
    [
      {
        title: "AI Voice Impersonation",
        description:
          "An urgent call that sounds like family may be AI-generated. Pause and verify through a separate trusted channel before acting.",
        imageUrl: `${M4}/m4-ai-scams.png`,
      },
    ],
  ),
  callout(
    "Stop → Verify independently → Contact through a trusted channel → Never act solely because something sounds urgent.",
    113,
    "warning",
  ),

  // ── Part XII — Copyright (~15 min) ──────────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XII — Copyright & Intellectual Property",
      subtitle: "~15 minutes · AI-generated does not automatically mean copyright-free.",
      columns: 2,
      cards: [
        { icon: "book", title: "Where did this come from?", body: "Training data, style mimicry, and remixing raise ownership questions." },
        { icon: "shield", title: "Can I use it?", body: "Check license, attribution rules, and whether you transformed the work." },
        { icon: "target", title: "Does my school permit it?", body: "Course, club, and competition policies may differ from a tool's terms." },
        { icon: "message", title: "Platform restrictions", body: "Social posts, contests, and portfolios may ban undisclosed AI content." },
      ],
      footer: "Avoid oversimplifying — ask and follow policy instead of guessing.",
    },
    120,
  ),
  gallery(
    121,
    "AI-generated does not automatically mean copyright-free — know where content came from and how you may use it.",
    [
      {
        title: "Copyright & AI Creation",
        description:
          "Student creators work with AI-generated assets alongside original sketches, licensing notes, and design materials — human contribution and attribution still matter.",
        imageUrl: `${M4}/m4-copyright-creation.png`,
      },
    ],
  ),

  // ── Part XIII — Creativity, Originality & Attribution (~10 min) ─────────
  interactive(
    {
      variant: "concept_cards",
      title: "Part XIII — Creativity, Originality & Attribution",
      subtitle: "~10 minutes · If AI generates 90% of your artwork and you change the title, is it entirely your work?",
      cards: [
        { icon: "wand", title: "Human contribution", body: "Your edits, curation, and creative choices still matter — but be honest about the split." },
        { icon: "message", title: "Disclosure", body: "Be comfortable saying: \"I used AI to help me…\" rather than hiding involvement." },
        { icon: "book", title: "Attribution & originality", body: "Credit sources, follow disclosure rules, and know when work is truly yours to claim." },
      ],
    },
    130,
  ),
  gallery(
    131,
    "Human creative direction and honest disclosure define responsible AI-assisted work.",
    [
      {
        title: "Human + AI Authorship",
        description:
          "A designer actively edits AI concepts alongside handwritten sketches and revisions — authorship requires human iteration, not passive acceptance.",
        imageUrl: `${M4}/m4-human-authorship.png`,
      },
      {
        title: "Disclosure & Transparency",
        description:
          "Before submitting work, a student adds an AI-use disclosure and reviews human edits and fact-checking notes.",
        imageUrl: `${M4}/m4-disclosure.png`,
      },
    ],
  ),

  // ── Part XIV — Academic Integrity (~15 min) ─────────────────────────────
  interactive(
    {
      variant: "comparison_table",
      title: "Part XIV — Academic Integrity (~15 min)",
      leftHeader: "Generally constructive",
      rightHeader: "Potential misconduct",
      rows: [
        { left: "Explain differently · Quiz me · Check reasoning", right: "Complete exam for you" },
        { left: "Feedback on draft · Practice questions · Brainstorm", right: "Submit unchanged AI work" },
        { left: "Organize notes you wrote", right: "Fabricate references or fake lab results" },
      ],
    },
    140,
  ),
  callout(
    "Am I using AI to improve my learning — or to avoid doing the learning? Instructor and institutional policies determine what is permitted.",
    141,
    "info",
  ),
  gallery(
    142,
    "AI can support learning or replace it — the difference is how you engage with the output.",
    [
      {
        title: "AI as Learning Partner vs. Substitute",
        description:
          "On one side, a student works through a problem with AI hints. On the other, a student passively copies a complete AI-generated answer.",
        imageUrl: `${M4}/m4-academic-integrity.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Integrity Check",
      tasks: ["Generally Acceptable", "Likely Misconduct"],
      examples: [
        { text: "AI quizzes me with hints; I write my own answers", task: "Generally Acceptable" },
        { text: "AI writes my essay; I submit unchanged", task: "Likely Misconduct" },
        { text: "AI checks my reasoning on a draft I wrote", task: "Generally Acceptable" },
        { text: "AI fabricates citations for my bibliography", task: "Likely Misconduct" },
      ],
    },
    144,
  ),

  // ── Part XV — AI and Human Relationships (~10 min) ──────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XV — AI and Human Relationships",
      subtitle: "~10 minutes · AI can simulate conversation and empathy — but does not experience emotions as humans do.",
      columns: 2,
      cards: [
        { icon: "message", title: "Healthy boundaries", body: "Companions and tutors can help — but they are not replacements for real relationships." },
        { icon: "shield", title: "Emotional dependence", body: "Notice when AI becomes your only confidant for serious feelings." },
        { icon: "target", title: "Oversharing & manipulation", body: "Do not treat chatbots like therapists, lawyers, or crisis counselors." },
        { icon: "brain", title: "Social isolation", body: "Balance AI assistance with face-to-face connection and trusted adults." },
      ],
    },
    150,
  ),
  gallery(
    151,
    "AI can simulate conversation — but healthy boundaries with real relationships still matter.",
    [
      {
        title: "AI & Human Relationships",
        description:
          "A student pauses between an AI chat and messages from real friends nearby — thoughtful use means knowing the difference.",
        imageUrl: `${M4}/m4-human-relationships.png`,
      },
    ],
  ),

  // ── Part XVI — Human Oversight (~10 min) ────────────────────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part XVI — Human Oversight",
      subtitle: "~10 minutes · Human-in-the-Loop: AI helps → Human reviews → Human decides.",
      steps: [
        { label: "Medical", detail: "AI analysis → doctor reviews → doctor decides" },
        { label: "Learning", detail: "AI feedback → student reviews → student revises" },
        { label: "Hiring", detail: "AI recommendation → human evaluation → human decision" },
      ],
    },
    160,
  ),
  gallery(
    161,
    "Human-in-the-Loop: AI helps → Human reviews → Human decides.",
    [
      {
        title: "Levels of Human Oversight",
        description:
          "From medical diagnosis to automated monitoring to low-risk formatting — the higher the stakes, the more human judgment is required.",
        imageUrl: `${M4}/m4-human-oversight.png`,
      },
    ],
  ),

  // ── Part XVII — Accountability (~10 min) ────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XVII — Accountability",
      subtitle: "~10 minutes · If an autonomous vehicle makes a mistake, who might be responsible?",
      columns: 3,
      cards: [
        { icon: "brain", title: "Developer", body: "Design choices and testing gaps." },
        { icon: "target", title: "Manufacturer / operator", body: "Deployment, maintenance, and supervision." },
        { icon: "book", title: "Company & user", body: "Policies, training data, and how the tool was used." },
      ],
      footer: "You do not need the legal answer. The lesson: AI does not remove human responsibility.",
    },
    170,
  ),
  gallery(
    171,
    "When AI causes harm, humans must identify responsibility and correct the system — not blame the algorithm.",
    [
      {
        title: "Accountability After AI Harm",
        description:
          "Engineers, managers, legal, and data professionals review what went wrong and how to fix it together.",
        imageUrl: `${M4}/m4-accountability.png`,
      },
    ],
  ),

  // ── Part XVIII — Explainability & Transparency (~10 min) ────────────────
  interactive(
    {
      variant: "numbered_steps",
      title: "Part XVIII — Explainability and Transparency",
      intro: "~10 minutes · People need understandable reasons when AI affects admissions, hiring, loans, insurance, healthcare, or criminal justice.",
      layout: "split",
      imageUrl: `${M4}/m4-transparency-scholarship.png`,
      imageCaption: "A meaningless score is not transparency — students deserve understandable reasons and a path to human review.",
      steps: [
        {
          icon: "message",
          title: "AI says: REJECTED",
          body: "Scholarship Application: REJECTED. Student asks: Why?",
        },
        {
          icon: "zap",
          title: "Bad explanation",
          body: "AI: Score 0.43. That is not meaningful to a human decision-maker.",
        },
        {
          icon: "shield",
          title: "Better standard",
          body: "Explain which factors mattered, in plain language, with a path to appeal or review.",
        },
      ],
    },
    180,
  ),

  // ── Part XIX — Accessibility & Inclusive AI (~10 min) ───────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XIX — Accessibility & Inclusive AI",
      subtitle: "~10 minutes · Accessibility connects to fairness and inclusive design.",
      columns: 2,
      cards: [
        { icon: "sparkles", title: "How AI can help", body: "Speech-to-text · text-to-speech · image descriptions · translation · reading assistance · adaptive learning." },
        { icon: "target", title: "When AI fails", body: "What if speech recognition works much worse for certain accents or dialects? Failures harm real people." },
      ],
    },
    190,
  ),
  gallery(
    191,
    "Inclusive AI helps diverse students collaborate — accessibility is part of responsible design.",
    [
      {
        title: "Accessibility & Inclusive AI",
        description:
          "Speech-to-text, text-to-speech, translation, and accessible tools let every student participate — when the technology works for everyone.",
        imageUrl: `${M4}/m4-accessibility.png`,
      },
    ],
  ),

  // ── Part XX — Environmental Impact (~8 min) ─────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XX — Environmental Impact of AI",
      subtitle: "~8 minutes · Digital technology still has a physical footprint.",
      columns: 2,
      cards: [
        { icon: "zap", title: "Infrastructure", body: "Data centers, electricity, cooling, and hardware manufacturing all consume resources." },
        { icon: "shield", title: "Responsible use", body: "You do not need detailed energy math — consider whether a heavy model run is worth the task." },
      ],
    },
    200,
  ),
  gallery(
    201,
    "Digital AI depends on physical infrastructure — servers, electricity, cooling, and hardware all consume resources.",
    [
      {
        title: "AI & the Environment",
        description:
          "Modern data centers reveal the industrial scale behind cloud AI — digital systems have a real physical footprint.",
        imageUrl: `${M4}/m4-ai-environment.png`,
      },
    ],
  ),

  // ── Part XXI — Responsible AI Across Professions (~10 min) ───────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part XXI — Responsible AI Across Professions",
      subtitle: "~10 minutes · Ethics becomes concrete through scenarios — not just vocabulary.",
      imageUrl: `${M4}/m4-industries-collage.png`,
      imageCaption: "Responsible AI across healthcare, education, finance, employment, transportation, and public services — AI assists humans, it does not replace judgment.",
      comparisonLabels: { left: "Field", right: "Question to ask" },
      comparisonRows: [
        { left: "Healthcare", right: "Should AI diagnose without doctors?" },
        { left: "Education", right: "Should AI automatically determine grades?" },
        { left: "Banking", right: "Should AI alone decide loans?" },
        { left: "Employment", right: "Should AI auto-reject applicants?" },
        { left: "Transportation", right: "When must humans intervene?" },
        { left: "Law enforcement", right: "What if AI identification is wrong?" },
      ],
    },
    210,
  ),
  gallery(
    211,
    "AI advises — humans decide. Career choices require active engagement, not passive acceptance of recommendations.",
    [
      {
        title: "Human Autonomy — AI Advises, Human Decides",
        description:
          "A career counselor and student discuss options together while an AI dashboard shows possible paths — the student remains in control of the decision.",
        imageUrl: `${M4}/m4-human-autonomy.png`,
      },
    ],
  ),

  // ── Part XXII — Risk-Based Thinking (~10 min) ───────────────────────────
  interactive(
    {
      variant: "comparison_table",
      title: "Part XXII — Risk-Based Thinking (~10 min)",
      leftHeader: "Risk level",
      rightHeader: "Example",
      rows: [
        { left: "LOW", right: "Birthday party ideas" },
        { left: "MODERATE", right: "Summarize sources for a research project" },
        { left: "HIGH", right: "\"Should I stop taking medication?\"" },
      ],
    },
    220,
  ),
  callout(
    "Risk increases → verification increases → human expertise increases → AI autonomy should decrease.",
    221,
    "info",
  ),
  activity(
    {
      title: "Risk Ladder",
      prompt: "Which task is HIGHEST risk?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Brainstorm party themes",
        "Summarize a public news article for class",
        "AI advice on stopping prescription medication",
        "Generate a study schedule",
      ],
      revealMessage: "Medical decisions require qualified humans — not confident AI language.",
    },
    222,
  ),

  // ── Part XXIII — PAUSE Framework (~10 min) ──────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part XXIII — The PAUSE Framework",
      subtitle: "~10 minutes · Before using an important AI output — PAUSE before you use.",
      imageUrl: `${M4}/m4-pause-framework.png`,
      imageCaption: "Before you submit to AI — pause and consider privacy, accuracy, understanding, safety, and evaluation.",
      columns: 3,
      sections: [
        { title: "P — Privacy", icon: "shield", body: "Am I protecting personal and confidential information?", accent: "violet" },
        { title: "A — Accuracy", icon: "target", body: "Have important claims been verified?", accent: "sky" },
        { title: "U — Understand", icon: "brain", body: "Do I understand what the AI produced?", accent: "emerald" },
        { title: "S — Safety & Fairness", icon: "wand", body: "Could this harm or unfairly affect someone?", accent: "amber" },
        {
          title: "E — Explain & Evaluate",
          icon: "message",
          body: "Can I explain how AI was used, and have I evaluated the result?",
          accent: "violet",
        },
      ],
      footer: "Use PAUSE throughout the rest of the workshop.",
    },
    230,
  ),
  interactive(
    {
      variant: "step_order",
      title: "PAUSE — Put the steps in order",
      prompt: "Arrange the PAUSE framework letters correctly.",
      correctOrder: ["Privacy", "Accuracy", "Understand", "Safety & Fairness", "Explain & Evaluate"],
      successMessage: "Privacy → Accuracy → Understand → Safety & Fairness → Explain & Evaluate",
      retryMessage: "Try: Privacy, Accuracy, Understand, Safety & Fairness, Explain & Evaluate",
    },
    231,
  ),

  // ── Part XXIV — Ethical Scenario Lab (~25 min) ──────────────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XXIV — Ethical Scenario Lab",
      subtitle: "~25 minutes · Evaluate each scenario using Privacy · Accuracy · Fairness · Transparency · Safety · Human Oversight.",
      activities: [
        {
          id: "essay",
          label: "1",
          title: "AI-Generated History Essay",
          icon: "book",
          accent: "violet",
          summary: "Student uses AI to generate an entire history essay. Acceptable? Why? What should change?",
        },
        {
          id: "math",
          label: "2",
          title: "Practice Math Questions",
          icon: "target",
          accent: "sky",
          summary: "Student asks AI for practice math questions only.",
        },
        {
          id: "image",
          label: "3",
          title: "Classmate AI Image",
          icon: "shield",
          accent: "amber",
          summary: "AI image of a classmate posted without permission.",
        },
        {
          id: "medical",
          label: "4",
          title: "Private Medical Records",
          icon: "zap",
          accent: "emerald",
          summary: "Student uploads private medical records for AI advice.",
        },
        {
          id: "feedback",
          label: "5",
          title: "Teacher Feedback Assistant",
          icon: "wand",
          accent: "violet",
          summary: "Teacher uses AI for feedback suggestions but reviews each one.",
        },
        {
          id: "hiring",
          label: "6",
          title: "Auto-Reject Applicants",
          icon: "brain",
          accent: "sky",
          wide: true,
          summary: "Company auto-rejects applicants with no human review.",
          footer: "Pick one scenario in the reflection below — name your verdict and which principles guided you.",
        },
      ],
    },
    240,
  ),
  gallery(
    242,
    "Work in teams to evaluate real ethical scenarios — responsible AI is practiced, not just discussed.",
    [
      {
        title: "Ethical Scenario Lab",
        description:
          "Students debate case studies in small teams with sticky notes, laptops, and a faculty facilitator moving between groups.",
        imageUrl: `${M4}/m4-ethical-scenario-lab.png`,
      },
    ],
  ),
  reflect("Scenario Lab — Pick one scenario. What is your verdict and which principles guided you?", 241),

  // ── Part XXV — Deepfake Detective Challenge (~15 min) ───────────────────
  gallery(
    249,
    "Act like digital investigators — rigorous fact-checking beats guessing from visual artifacts alone.",
    [
      {
        title: "Deepfake Detective Challenge",
        description:
          "Students compare video frames, sources, timestamps, metadata, and audio waveforms across multiple monitors.",
        imageUrl: `${M4}/m4-deepfake-detective.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Part XXV — Deepfake Detective Challenge",
      intro: "~15 minutes · Investigate suspicious media — goal is media literacy, not merely spotting visual glitches.",
      layout: "horizontal",
      steps: [
        { icon: "book", title: "Source", body: "Who published it? Is the account credible?" },
        { icon: "target", title: "Evidence", body: "What supports the claim beyond the clip itself?" },
        { icon: "message", title: "Context", body: "Is something missing — date, location, full transcript?" },
        { icon: "shield", title: "Verification", body: "Can a reliable independent source confirm it?" },
        { icon: "zap", title: "Motivation", body: "Why might someone create or spread this?" },
      ],
    },
    250,
  ),
  reflect("Deepfake Detective — Describe one suspicious post and how you would verify it.", 251),
  gallery(
    252,
    "Verify, don't just guess — compare sources, context, and independent evidence.",
    [
      {
        title: "Fact-Checking in Action",
        description:
          "Students investigate a suspicious video by checking original sources, independent news, and publication history.",
        imageUrl: `${M4}/m4-fact-check.png`,
      },
    ],
  ),

  // ── Part XXVI — Responsible AI Decision Tree (~10 min) ──────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part XXVI — Responsible AI Decision Tree",
      subtitle: "Should I use AI for this? Walk the branches top to bottom.",
      steps: [
        { label: "Sensitive information?", detail: "Yes → Stop / use approved process only" },
        { label: "Could an error harm someone?", detail: "Yes → Require expert or human oversight" },
        { label: "Is AI permitted for this task?", detail: "No → Do not use it" },
        { label: "Can important information be verified?", detail: "No → Do not rely on it alone" },
        { label: "Can I explain how AI contributed?", detail: "Yes → Use responsibly + review final result" },
      ],
    },
    260,
  ),
  gallery(
    261,
    "Walk the decision tree before important AI use — sensitive data, harm potential, permission, and verification.",
    [
      {
        title: "Responsible AI Decision Tree",
        description:
          "A structured workspace for deciding whether AI is appropriate — privacy, risk, permission, verification, and human review.",
        imageUrl: `${M4}/m4-decision-tree.png`,
      },
    ],
  ),
  gallery(
    262,
    "AI systems can be attacked — security awareness protects you and your community.",
    [
      {
        title: "AI Security Incident Response",
        description:
          "Students in a cybersecurity lab calmly analyze suspicious emails, data flows, and security dashboards together.",
        imageUrl: `${M4}/m4-ai-security.png`,
      },
      {
        title: "Prompt Injection Awareness",
        description:
          "An external webpage may contain hidden instructions trying to redirect an AI assistant — always review with caution.",
        imageUrl: `${M4}/m4-prompt-injection.png`,
      },
    ],
  ),

  // ── Part XXVII — Personal Responsible AI Code (~15 min) ─────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XXVII — Create Your Personal Responsible AI Code",
      subtitle: "~15 minutes · Write 5–8 commitments starting with \"I will…\" then sign digitally below.",
      columns: 2,
      cards: [
        { icon: "book", title: "Support learning", body: "Use AI to improve my learning — not replace it." },
        { icon: "target", title: "Verify & protect", body: "Verify important information and protect private data." },
        { icon: "shield", title: "Respect consent", body: "Respect others' privacy, consent, and dignity." },
        { icon: "message", title: "Disclose & own", body: "Disclose AI assistance when required and accept responsibility for work I submit." },
        { icon: "wand", title: "Question bias", body: "Question biased or harmful outputs instead of blindly trusting them." },
        { icon: "zap", title: "Never deceive", body: "Never deceive, impersonate, or use AI to cheat." },
      ],
    },
    270,
  ),
  reflect("My Responsible AI Code — List your 5–8 commitments (I will…):", 271),
  reflect("My Responsible AI Code — Digital signature: Type your full name to acknowledge your commitments.", 272),
  gallery(
    273,
    "Write and sign your personal Responsible AI commitments — ethics becomes a habit when you commit to it.",
    [
      {
        title: "Personal Responsible AI Code",
        description:
          "Students sign their personal AI ethics commitments on tablets and notebooks after completing the workshop.",
        imageUrl: `${M4}/m4-personal-ai-code.png`,
      },
    ],
  ),

  // ── Part XXVIII — Responsible AI Challenge (~20 min) ────────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XXVIII — Responsible AI Challenge (AI Review Board)",
      subtitle: "~20 minutes · Your school wants an AI assistant for course selection, scholarships, study plans, and career recommendations.",
      activities: [
        {
          id: "benefits",
          label: "A",
          title: "Identify Benefits",
          icon: "sparkles",
          accent: "emerald",
          summary: "Personalized guidance, faster answers, 24/7 support, data-driven insights.",
        },
        {
          id: "risks",
          label: "B",
          title: "Map Risks",
          icon: "shield",
          accent: "amber",
          summary: "Privacy · bias · accuracy · security · transparency · oversight · data that should NOT be collected.",
        },
        {
          id: "rules",
          label: "C",
          title: "Draft Rules for Students",
          icon: "book",
          accent: "violet",
          summary: "What students may share, what requires human review, and how to appeal AI recommendations.",
        },
        {
          id: "decide",
          label: "D",
          title: "Board Decision",
          icon: "target",
          accent: "sky",
          wide: true,
          summary: "Approve · Approve with conditions · or Reject — then defend your decision in the poll and reflection below.",
        },
      ],
    },
    280,
  ),
  gallery(
    281,
    "Governance and review boards keep powerful AI systems accountable before they affect real students.",
    [
      {
        title: "Enterprise AI Governance",
        description:
          "A diverse governance committee reviews AI policy, risk assessments, testing reports, and audit dashboards before deployment.",
        imageUrl: `${M4}/m4-enterprise-governance.png`,
      },
      {
        title: "Student Responsible AI Review Board",
        description:
          "Students evaluate a campus AI system like an executive board — debating privacy, fairness, security, and human oversight.",
        imageUrl: `${M4}/m4-review-board.png`,
      },
    ],
  ),
  gallery(
    279,
    "Powerful tools require procedures, supervision, and rules — just like a science laboratory.",
    [
      {
        title: "Science Lab Governance Analogy",
        description:
          "Students follow safety procedures under instructor supervision — responsible AI governance works the same way.",
        imageUrl: `${M4}/m4-science-lab-governance.png`,
      },
    ],
  ),
  activity(
    {
      title: "Review Board Decision",
      prompt: "Your team's final decision on the school AI assistant?",
      activityType: "poll",
      multiSelect: false,
      options: ["Approve", "Approve with conditions", "Reject"],
    },
    282,
  ),
  reflect("Review Board — Defend your decision in 3–5 sentences (conditions if applicable).", 283),

  // ── Flashcards + Summary ──────────────────────────────────────────────────
  interactive(
    {
      variant: "flashcard_carousel",
      title: "Module 4 — Flashcard Review",
      cards: [
        { id: "ethics", front: "AI Ethics", back: "How AI should respect people, rights, safety, and values." },
        { id: "resp", front: "Responsible AI", back: "Practices for building and using AI thoughtfully." },
        { id: "bias", front: "AI Bias", back: "Unfair patterns from data, design, or deployment — often without intent." },
        { id: "pause", front: "PAUSE", back: "Privacy · Accuracy · Understand · Safety & Fairness · Explain & Evaluate." },
        { id: "mis", front: "Misinformation", back: "False info shared without necessarily intending harm." },
        { id: "dis", front: "Disinformation", back: "False info deliberately spread to deceive." },
        { id: "deep", front: "Deepfake", back: "Synthetic media making someone appear to say/do something they didn't." },
        { id: "hitl", front: "Human-in-the-Loop", back: "AI helps; human reviews and decides." },
        { id: "risk", front: "Risk Ladder", back: "Higher risk → more verification & human expertise; less AI autonomy." },
        { id: "integrity", front: "Academic Integrity", back: "Use AI to learn — not to avoid learning or deceive." },
      ],
    },
    284,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Summary & Bridge to Module 5",
      subtitle: "Responsible AI is not about avoiding AI. It is about using AI thoughtfully, safely, transparently, and with appropriate human judgment.",
      columns: 3,
      cards: [
        { icon: "wand", title: "Module 3 — Prompt Engineering", body: "How do I communicate with AI?" },
        { icon: "shield", title: "Module 4 — Responsible AI", body: "Should I use AI here, and how responsibly?" },
        { icon: "sparkles", title: "Module 5 — AI Creator Studio", body: "How do I create multi-format content with AI?" },
      ],
      footer:
        "PAUSE BEFORE YOU USE: Privacy → Accuracy → Understand → Safety & Fairness → Explain & Evaluate. Next up: images, video, audio, brand, presentations, and full creative workflows.",
    },
    286,
  ),
  gallery(
    287,
    "Responsible AI is human responsibility — people remain central to every important decision.",
    [
      {
        title: "Responsible AI Is Human Responsibility",
        description:
          "Diverse students and professionals stand together in an innovation lab — leadership, trust, and human judgment come first.",
        imageUrl: `${M4}/m4-final-hero.png`,
      },
    ],
  ),
  gallery(
    288,
    "Debate builds ethical reasoning — there is rarely one obvious answer in responsible AI.",
    [
      {
        title: "AI Ethics Debate",
        description:
          "Two student teams discuss a controversial AI ethics question while classmates and a faculty moderator listen thoughtfully.",
        imageUrl: `${M4}/m4-ethics-debate.png`,
      },
    ],
  ),

  // ── Part XXX — Reflection + completion ───────────────────────────────────
  reflect("Reflection 1 — What is one AI risk you had not considered before today?", 290),
  reflect(
    "Reflection 2 — Can an AI system produce an unfair outcome without intentionally discriminating? Explain briefly.",
    291,
  ),
  reflect("Reflection 3 — When should humans have the final decision?", 292),
  reflect("Reflection 4 — What information would you never provide to an unapproved AI tool?", 293),
  reflect("Reflection 5 — How will you use AI differently after completing this module?", 294),
  gallery(
    296,
    "Congratulations — you are now a Responsible AI Citizen.",
    [
      {
        title: "Responsible AI Citizen Badge",
        description:
          "Students celebrate completing the AI ethics workshop with their instructor — achievement, responsibility, and community.",
        imageUrl: `${M4}/m4-badge-completion.png`,
      },
    ],
  ),
  {
    block_type: "module_completion",
    sort_order: 295,
    content: {
      title: "Congratulations!",
      message:
        "You completed Module 4: AI Ethics & Responsible AI. You can apply PAUSE, risk-based thinking, the decision tree, and your personal Responsible AI Code to real situations.",
      rewards: {
        xp: 200,
        badges: ["responsible-ai-citizen"],
        nextModule: "Module 5: AI Creator Studio",
        comingNext:
          "In Module 5, you'll learn the AI Creator Workflow — multi-format content from brief to publish.",
      },
    },
  },
]
