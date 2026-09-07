/**
 * AI Bootcamp Module 1 — Part blocks (I–XV).
 * Preamble (hero, objectives, start_journey) is composed separately.
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
          id: `m1-row-${sort}`,
          columns: columns.map((col, i) => ({
            id: `m1-col-${sort}-${i}`,
            widthFraction: col.widthFraction,
            cells: col.cells.map((cell, j) => ({
              id: `m1-cell-${sort}-${i}-${j}`,
              ...cell,
            })),
          })),
        },
      ],
    },
  }
}

export const AI_BOOTCAMP_MODULE_1_PART_BLOCKS: CurriculumBlock[] = [
  // ── Part I: Welcome to the Age of AI (~15 min) ─────────────────────────────
  text(
    `## Part I — Welcome to the Age of AI

**Estimated time:** ~15 minutes

We are living through one of the biggest technological shifts since the internet — and possibly since the Industrial Revolution. Artificial Intelligence is no longer a futuristic idea locked inside research labs. It is already shaping how you learn, communicate, shop, create, and solve problems.

Before we define any technical terms, pause and notice something important: **you are already part of the AI age.** Every time a platform recommends a video, filters spam, suggests the next word in a text message, or unlocks your phone with your face, intelligent software is working behind the scenes.

In this opening part, you will wake up your curiosity, connect AI to your daily life, and place today's revolution in historical context so the rest of Module 1 feels grounded — not overwhelming.`,
    10,
  ),
  interactive({ variant: "start_journey", title: "Begin Part I: Welcome to the Age of AI" }, 11),
  activity(
    {
      title: "Opening Question — How AI Touches Your Day",
      prompt:
        "Before we reveal examples, think honestly: **Which of these happened to you today or this week?** Select every item that applies.",
      activityType: "poll",
      multiSelect: true,
      options: [
        "A streaming service suggested something I watched",
        "My phone predicted the next word while I typed",
        "A map app rerouted me around traffic",
        "I used face unlock or fingerprint login",
        "I asked a voice assistant or AI chatbot a question",
        "A social feed showed posts tuned to my interests",
        "I saw an ad that felt oddly specific to me",
        "None of these — I avoided screens today",
      ],
      revealMessage:
        "Most students select several items. Each one is a clue that **pattern-finding software** — a form of AI — is already woven into ordinary life. The goal of this module is not to fear that change, but to understand it clearly.",
    },
    12,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Your Daily AI Chain — Reveal",
      intro: "Now let's connect the dots. Imagine a single ordinary morning — tap each step to explore how AI hides inside apps you already trust.",
      imageUrl: "/summer-camp/ai-bootcamp/m1-everyday-ai-day.png",
      imageCaption: "Visual 2 — AI in Your Day: Help students recognize AI in everyday life.",
      steps: [
        { icon: "alarm", title: "Alarm", body: "Your phone learns when you usually wake up and may adjust suggestions." },
        { icon: "message", title: "Messages", body: "Predictive text guesses your next word from patterns in how people write." },
        { icon: "sparkles", title: "Social feed", body: "The app ranks posts based on what you linger on, like, or skip." },
        { icon: "map", title: "Maps", body: "Traffic predictions combine GPS data, road sensors, and historical patterns." },
        { icon: "music", title: "Music or video", body: "Recommendations match your taste profile built from past listening and watching." },
        { icon: "search", title: "School search", body: "A search engine ranks billions of pages using learned relevance signals." },
        { icon: "brain", title: "Homework help", body: "You might ask an AI assistant to explain a concept in simpler words." },
      ],
      footer:
        "None of these steps requires a robot in your kitchen. The chain matters: once you see *data in → prediction out*, the rest of this module clicks faster. Discussion starter: Pick one link — what data might the system use? What is it trying to predict?",
    },
    13,
  ),
  interactive(
    {
      variant: "industrial_compare",
      title: "The Industrial Revolution — A Useful Comparison",
      intro:
        "History gives us a lens for big change. The Industrial Revolution transformed societies when machines replaced much manual labor. Artificial Intelligence is often called a new Industrial Revolution because it changes cognitive work — writing, analyzing, tutoring, detecting fraud — not just physical work.",
      bullets: [
        "New jobs appeared — operators, engineers, managers",
        "Old jobs changed — handcraft work scaled differently",
        "Daily life shifted — cities grew, goods got cheaper",
        "Rules lagged behind — safety took time to address",
      ],
      rows: [
        { left: "Steam engines & factories", right: "Data, models, and cloud computing" },
        { left: "Faster production", right: "Faster analysis and content creation" },
        { left: "New skills for workers", right: "New skills: prompting, verification, ethics" },
        { left: "Society adapted over decades", right: "Change is visible within years" },
      ],
      imageUrl: "/summer-camp/ai-bootcamp/m1-opening-hero.png",
      imageCaption: "Visual 3 — The AI age reshapes cognitive work the way industry once reshaped physical work.",
    },
    14,
  ),
  callout(
    "Key idea for Part I: AI is already here, mostly invisible, and changing how work and learning get done — much like past industrial shifts. Your job is to become an informed user, not a passive consumer.",
    15,
    "info",
  ),
  activity(
    {
      title: "Industrial Revolution vs AI Age",
      prompt: "Which statement best captures the comparison your instructor wants you to remember?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "AI will instantly solve every social problem without trade-offs",
        "Both industrial and AI shifts created new opportunities while requiring new skills and safeguards",
        "The Industrial Revolution proves we should avoid all new technology",
        "AI only matters for computer science majors",
      ],
      revealMessage:
        "Correct mindset: big technology shifts bring opportunity **and** responsibility. AI literacy helps you participate in that balance.",
    },
    16,
  ),

  // ── Part II: What Is Intelligence? ─────────────────────────────────────────
  columnGrid(
    17,
    [
      {
        widthFraction: 0.56,
        cells: [
          {
            type: "text",
            markdown: `## Part II — What Is Intelligence?

Before we can explain **Artificial** Intelligence, we need a working idea of **intelligence itself**. This is harder than it sounds — psychologists, philosophers, and computer scientists still debate the full definition.

For this module, we will use a practical, student-friendly lens:

> **Intelligence** is the ability to learn from experience, adapt to new situations, solve problems, and apply knowledge to achieve goals.

That definition covers more than "being good at math." Intelligence includes:

- **Learning** — A toddler learns that a hot stove hurts. A student learns that flashcards help memory.
- **Reasoning** — You figure out why your phone battery died faster today (background apps? old battery? cold weather?).
- **Perception** — You recognize a friend's face in a crowded hallway, even with a new haircut.
- **Language** — You explain an idea, persuade someone, or tell a story.
- **Planning** — You break a big project into steps and schedule time before the deadline.
- **Creativity** — You combine ideas in a new way — a meme, a song mashup, a science fair experiment.

Humans also bring **context**, **values**, and **common sense** — knowing that a glass of water on a wobbly desk might spill, even if no one said it aloud.

**Brainstorm prompt:** In one sentence, describe something you did this week that required intelligence. Was it mostly learning, reasoning, creating, or planning?`,
          },
        ],
      },
      {
        widthFraction: 0.44,
        cells: [
          {
            type: "image",
            imageUrl: "/summer-camp/ai-bootcamp/m1-intelligence-traits.png",
            alt: "Student surrounded by icons for learning, reasoning, creativity, communication, and problem-solving",
            caption: "Intelligence is multi-dimensional — AI captures slices of these abilities, not the full human package.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  activity(
    {
      title: "Intelligence Brainstorm",
      prompt: "Which human abilities feel most like 'intelligence' to you? Select all that apply.",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Learning from mistakes",
        "Understanding language and tone",
        "Recognizing faces or emotions",
        "Solving puzzles or math problems",
        "Creating art, music, or stories",
        "Planning ahead for a goal",
        "Knowing when to ask for help",
        "Moving through the physical world safely",
      ],
      revealMessage:
        "Intelligence is multi-dimensional. AI systems today capture **some** of these abilities in narrow ways — but not the full human package.",
    },
    18,
  ),
  text(
    `### A Working Definition (Classroom Version)

Here is the definition we will use throughout the bootcamp:

**Intelligence** = learning + reasoning + adapting + communicating + solving problems in context.

Examples mapped to the definition:

- **Chess club** — Reasoning ahead, learning from losses, adapting strategy mid-game.
- **Learning to drive** — Perception (mirrors, signs), planning (merges), adapting (rain, construction).
- **Group project** — Communication, dividing tasks, revising when a teammate is sick.

Notice what is **not** on the list: having feelings, being alive, or "knowing" the world the way you do after years of lived experience. Those distinctions become important when we talk about AI later.

### Why This Matters for AI

Computer scientists asked: *Can we build machines that show useful intelligent behavior — even if they don't think exactly like humans?*

That question is the bridge to **Artificial Intelligence**. We are not claiming computers are conscious. We are studying when software can **perform tasks that normally need human intelligence** — translation, recommendations, image recognition, drafting text, and more.`,
    19,
  ),
  reflect(
    "Part II — Describe one task you are good at. Which parts require human intelligence that might be hard for a machine to copy completely?",
    20,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Bridge to Artificial Intelligence",
      subtitle:
        "If intelligence is about learning, adapting, and solving problems, then AI is the engineering project of getting computers to do those jobs — or useful slices of them — at scale.",
      columns: 2,
      cards: [
        {
          icon: "zap",
          title: "Remarkably capable on specific tasks",
          body: "Humans learn from a few examples. AI systems often learn from thousands or millions, then generalize patterns to new inputs.",
        },
        {
          icon: "brain",
          title: "Not a digital copy of a human mind",
          body: "Humans understand why a joke lands in context. AI might generate one that looks funny but misses the moment — pattern, not true understanding.",
        },
      ],
      footer: "The next part gives the formal and simple definitions you will use in quizzes, projects, and conversations with classmates.",
    },
    21,
  ),
  gallery(
    22,
    "Humans and AI can perform overlapping tasks, but they rely on different mechanisms — experience and values vs data and learned patterns.",
    [
      {
        title: "Human vs Artificial Intelligence",
        description:
          "Both can answer questions, recognize images, and draft text — but they get there in fundamentally different ways. Use this diagram as a conversation starter, not a complete scientific model.",
        imageUrl: "/summer-camp/ai-bootcamp/m1-human-vs-ai.png",
        bullets: [
          "Human intelligence: creativity, empathy, common sense, learning from few examples, and understanding *why* something matters in context.",
          "Artificial intelligence: pattern recognition trained on large datasets — language, vision, recommendations, and predictions at speed and scale.",
          "Overlap: translation, image labeling, summarizing notes, suggesting next steps — tasks where pattern matching helps.",
          "Human-only (for now): moral judgment, genuine emotional connection, knowing when to distrust an answer, and adapting to brand-new situations with almost no data.",
          "Takeaway: treat AI as a powerful assistant — not a replacement for your own thinking, values, or responsibility.",
        ],
      },
    ],
  ),

  text(
    `## Part III — What Is Artificial Intelligence?

Artificial Intelligence is one of the most talked-about ideas in tech — and one of the most misunderstood. The cards below break the definition into pieces you can actually remember and explain to a friend.`,
    23,
  ),
  interactive(
    {
      variant: "concept_cards",
      title: "Core Definitions",
      cards: [
        {
          icon: "book",
          title: "Formal Definition",
          body: "Artificial Intelligence (AI) is a field of computer science focused on creating systems that perform tasks which typically require human intelligence — understanding language, recognizing objects, making predictions, planning actions, or generating content.",
        },
        {
          icon: "message",
          title: "Simple Definition (Say This to a Friend)",
          body: "AI lets computers do smart-seeming jobs by finding patterns in data and following learned models — instead of only obeying fixed step-by-step rules.",
        },
        {
          icon: "lightbulb",
          title: "Traditional Program — Recipe Model",
          body: "Follows a recipe exactly. Same ingredients → same dish every time.",
        },
        {
          icon: "sparkles",
          title: "AI System — Practice Model",
          body: "Tastes hundreds of dishes, notices patterns, then predicts what might work on a new dish. It uses information (text, images, clicks) to produce useful outputs — not consciousness.",
        },
      ],
    },
    24,
  ),
  interactive(
    {
      variant: "comparison_table",
      title: "Common AI Tasks You Will Hear About",
      leftHeader: "Task",
      rightHeader: "Everyday example",
      rows: [
        { left: "Classification", right: "Spam vs not spam" },
        { left: "Prediction", right: "Will this flight delay?" },
        { left: "Recommendation", right: "What video next?" },
        { left: "Generation", right: "Draft an email outline" },
        { left: "Recognition", right: "Face unlock, plant ID apps" },
        { left: "Planning", right: "Warehouse robot paths" },
      ],
    },
    25,
  ),
  interactive(
    {
      variant: "fill_blanks",
      title: "Build the Definition — Fill in the Blanks",
      sentenceParts: [
        "Artificial Intelligence allows a ",
        "BLANK",
        " to perform tasks that normally require ",
        "BLANK",
        " intelligence by learning ",
        "BLANK",
        " from examples or experience.",
      ],
      blanks: [
        { options: ["computer", "robot only", "internet cable"], correct: "computer" },
        { options: ["human", "plant", "mechanical"], correct: "human" },
        { options: ["patterns", "emotions", "electricity bills"], correct: "patterns" },
      ],
      successMessage:
        "Correct! AI enables computers to tackle human-intelligence-style tasks by learning patterns from data — not by magically becoming human.",
    },
    26,
  ),
  gallery(
    27,
    "AI is embedded in ordinary tools — often quietly working while you scroll, type, navigate, or create.",
    [
      {
        title: "AI in Everyday Life",
        description: "Face unlock, maps, streaming, shopping, health tracking, smart home, voice assistants, and ChatGPT",
        imageUrl: "/summer-camp/ai-bootcamp/m1-ai-all-around.png",
      },
    ],
  ),

  // ── Part IV: Evolution of AI ───────────────────────────────────────────────
  interactive(
    {
      variant: "wave_cards",
      title: "Part IV — Evolution of AI",
      subtitle: "AI did not appear overnight. It grew through breakthroughs, winters, and recent explosions in data and computing power.",
      timeline: [
        { era: "1950", milestone: "Turing asks: Can machines think?", why: "Framed intelligence as testable behavior" },
        { era: "1956", milestone: "Dartmouth — AI named", why: "Started the field officially" },
        { era: "1997", milestone: "Deep Blue beats Kasparov", why: "Specialized AI beat a world chess expert" },
        { era: "2012+", milestone: "Deep learning surge", why: "Neural nets + big data unlock vision & speech" },
        { era: "2022", milestone: "ChatGPT goes mainstream", why: "Generative AI becomes everyday" },
        { era: "Today", milestone: "Image, video, code tools", why: "Human + AI workflows everywhere" },
      ],
      waves: [
        {
          label: "1",
          title: "Symbolic AI",
          body: 'Hand-written rules and logic ("If fever AND cough, suggest rest").',
        },
        {
          label: "2",
          title: "Machine Learning",
          body: "Learn rules from data instead of typing every rule manually.",
        },
        {
          label: "3",
          title: "Generative AI",
          body: "Learn to create new text, images, audio, and code from training patterns.",
        },
      ],
      footer: "You are learning at the start of the third wave. That is why literacy — not fear — matters.",
    },
    28,
  ),
  callout(
    "History lesson, not trivia: AI progress is **uneven**. Narrow wins (chess, Go, spam filters) came long before fluent chatbots. Expecting perfection because chatbots *sound* human is a common mistake — we will fix that later in this module.",
    29,
    "warning",
  ),

  // ── Part V: AI vs Traditional Programming ──────────────────────────────────
  text(
    `## Part V — AI vs Traditional Programming

Not every program is AI. Your calculator app is brilliant at arithmetic — and **zero percent** machine learning. Compare the two models below, then use the interactives to feel the difference and sort real-world examples.`,
    30,
  ),
  interactive(
    {
      variant: "dual_model_compare",
      traditional: {
        title: "Traditional Programming — Recipe Model",
        body: "Programmer writes rules. Computer applies rules to input → output. Same input, same output, every time.",
        example: "Input: 20°C\nRule: F = C × 9/5 + 32\nOutput: 68°F",
      },
      ai: {
        title: "AI / Machine Learning — Practice Model",
        body: "Programmer prepares examples. System adjusts internal settings to reduce mistakes. Result: a model that predicts on new data.",
        example: "Training emails labeled spam / not spam\nModel learns word patterns & sender behavior\nNew email → spam probability prediction",
      },
      rows: [
        { label: "Instructions", traditional: "Fixed rules", ai: "Learned patterns" },
        { label: "Handles novelty", traditional: "Only if programmer foresaw it", ai: "Can generalize — imperfectly" },
        { label: "Best for", traditional: "Exact logic (math, timers)", ai: "Messy real-world data" },
        { label: "Wrong answers", traditional: "Deterministic bugs", ai: "Can be confident and wrong" },
      ],
    },
    31,
  ),
  interactive({ variant: "programming_traditional" }, 32),
  interactive({ variant: "programming_ml" }, 33),
  gallery(
    34,
    "Left: fixed rules produce predictable output. Right: examples train a model that makes predictions on new data.",
    [
      {
        title: "Traditional Programming vs AI",
        description: "Programmer writes rules → output vs training data → model → predictions",
        imageUrl: "/summer-camp/ai-bootcamp/m1-traditional-vs-ai.png",
      },
    ],
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Sort Each Example — Traditional Software or Artificial Intelligence?",
      tasks: ["Traditional Software", "Artificial Intelligence"],
      examples: [
        { text: "Basic calculator", task: "Traditional Software" },
        { text: "Digital clock showing current time", task: "Traditional Software" },
        { text: "Traffic light on a fixed timer", task: "Traditional Software" },
        { text: "Unit converter (miles ↔ kilometers)", task: "Traditional Software" },
        { text: "Netflix recommendation system", task: "Artificial Intelligence" },
        { text: "Face-unlock on a phone", task: "Artificial Intelligence" },
        { text: "AI chatbot assistant", task: "Artificial Intelligence" },
        { text: "Email spam filter that improves over time", task: "Artificial Intelligence" },
        { text: "Spell-check with learned language patterns", task: "Artificial Intelligence" },
      ],
    },
    35,
  ),

  // ── Part VI: Types of AI ───────────────────────────────────────────────────
  text(
    `## Part VI — Types of AI

Researchers classify AI by **capability** and **memory**. Most tools you use today are narrow specialists — not science-fiction super-minds. Expand each card, then match terms in the activity below.`,
    36,
  ),
  interactive(
    {
      variant: "ai_type_cards",
      title: "AI Capability Types",
      types: [
        {
          name: "Reactive Machines",
          badge: "No memory",
          summary: "Same input → same output. Responds to the present moment only.",
          example: "Early chess programs evaluating the current board without learning from past games.",
        },
        {
          name: "Limited Memory AI",
          badge: "Most common today",
          summary: "Uses recent or stored data to improve decisions — recommendations, chat context, self-driving sensor frames.",
          example: "Netflix suggestions based on your viewing history.",
        },
        {
          name: "Theory of Mind AI",
          badge: "Research stage",
          summary: "Would understand beliefs, intentions, and emotions of others — largely experimental.",
          example: "Not in your homework app — still a research direction.",
        },
        {
          name: "AGI",
          badge: "Hypothetical",
          summary: "Human-level flexibility across many domains — learn biology, compose music, repair a bike without being rebuilt.",
          example: "Discussed in research papers — not shipped as everyday tech.",
        },
        {
          name: "Narrow AI",
          badge: "What you use daily",
          summary: "Specialized systems for specific jobs: translate, tag faces, predict demand, generate outlines.",
          example: "A navigation app amazing at routes yet useless at writing your history essay.",
        },
      ],
    },
    37,
  ),
  interactive(
    {
      variant: "matching",
      title: "Match Each AI Type to Its Description",
      prompt: "Tap a term on the left, then tap its matching description on the right.",
      pairs: [
        { task: "Reactive AI", capability: "Responds to the present moment without learning from past interactions" },
        { task: "Limited Memory AI", capability: "Uses recent or stored data to improve predictions and recommendations" },
        { task: "Theory of Mind AI", capability: "Would model human beliefs and emotions — largely still research" },
        { task: "AGI", capability: "Hypothetical human-level flexibility across many different tasks" },
        { task: "Narrow AI", capability: "Specialized systems designed for specific jobs — what we use daily" },
      ],
    },
    38,
  ),
  gallery(
    39,
    "Today's AI landscape is a collection of specialists — each strong in a lane, none magically expert at everything.",
    [
      {
        title: "Four Stages on the AI Capability Spectrum",
        description: "Reactive machines → limited memory → AGI (research) → ASI (hypothetical future)",
        imageUrl: "/summer-camp/ai-bootcamp/m1-ai-types-spectrum.png",
      },
    ],
  ),

  // ── Part VII: Machine Learning ─────────────────────────────────────────────
  text(
    `## Part VII — Machine Learning

**Machine Learning (ML)** is how most modern AI **learns** — the system adjusts from examples instead of a programmer typing every rule. Explore the hierarchy and pipeline below, then review the three learning styles.`,
    40,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Where ML Sits in the Big Picture",
      subtitle: "Think of AI as the library, ML as a major section, and products like ChatGPT or Spotify Discover Weekly as specific books on the shelf.",
      steps: [
        { label: "Artificial Intelligence", detail: "Broad field of smart-seeming systems" },
        { label: "Machine Learning", detail: "Learns patterns from data" },
        { label: "Deep Learning & other methods", detail: "Neural networks and advanced techniques" },
        { label: "Applications", detail: "Vision, speech, recommendations, generative tools" },
      ],
    },
    41,
  ),
  interactive(
    {
      variant: "ai_hierarchy",
      title: "The Three Levels of AI",
      intro:
        "Use this diagram when someone asks 'Is ChatGPT the same as AI?' — it is one application built on deep learning, which sits inside machine learning, which sits inside the broader AI field.",
      bullets: [
        "Artificial Intelligence — the full field of systems that appear to reason, perceive, or decide.",
        "Machine Learning — learns from examples and data instead of explicit step-by-step rules for every case.",
        "Deep Learning — large neural networks that power vision, speech, translation, and generative AI tools.",
      ],
    },
    42,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Machine Learning Pipeline",
      subtitle: "The practical steps teams follow to ship a working model.",
      steps: [
        { label: "Collect Data", detail: "Gather examples relevant to the problem" },
        { label: "Clean & Label", detail: "Fix errors and add correct answers where needed" },
        { label: "Train Model", detail: "Adjust settings to reduce mistakes" },
        { label: "Test & Evaluate", detail: "Check performance on new data" },
        { label: "Deploy Predictions", detail: "Ship the model to real users" },
      ],
    },
    43,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Three Learning Styles (Plain Language)",
      columns: 3,
      cards: [
        {
          icon: "book",
          title: "Supervised Learning",
          body: "Learning with answer keys — emails tagged spam/not spam, flashcards with answers on the back.",
        },
        {
          icon: "sparkles",
          title: "Unsupervised Learning",
          body: "Finding structure without labels — grouping shoppers by behavior without predefined categories.",
        },
        {
          icon: "zap",
          title: "Reinforcement Learning",
          body: "Learning by trial and reward — game-playing AI, robots learning to walk, ad systems testing clicks.",
        },
      ],
      footer:
        'Beginner mistake to avoid: saying "the AI understands." More accurate: "the model learned statistical patterns that often produce helpful outputs."',
    },
    44,
  ),
  interactive(
    {
      variant: "comparison_table",
      title: "Match Scenario to Learning Type",
      leftHeader: "Scenario",
      rightHeader: "Learning type",
      rows: [
        { left: "Hospital scans labeled benign / malignant", right: "Supervised — known labels guide training" },
        { left: "Grocery app discovers 4 shopper types", right: "Unsupervised — no predefined categories" },
        { left: "Drone learns hovering via simulation rewards", right: "Reinforcement — success = balance score" },
      ],
    },
    45,
  ),
  interactive(
    {
      variant: "matching",
      title: "Quick Match — Learning Styles",
      prompt: "Connect each scenario to the best-fit learning style.",
      pairs: [
        { task: "Flashcards with answers provided", capability: "Supervised learning" },
        { task: "Sorting unlabeled photos into surprise groups", capability: "Unsupervised learning" },
        { task: "Robot earns points for staying upright", capability: "Reinforcement learning" },
        { task: "Spam labels on past emails", capability: "Supervised learning" },
      ],
    },
    46,
  ),

  // ── Part VIII: Generative AI ───────────────────────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part VIII — Generative AI",
      subtitle:
        "Many classic AI systems classify or predict. Generative AI creates new content — text, images, music, video, code, and slides — inspired by patterns in training data.",
      imageUrl: "/summer-camp/ai-bootcamp/m1-one-prompt-multimodal.png",
      imageCaption:
        "One prompt, many outputs — image, story, music, video, slides, and code from the same idea",
      comparisonLabels: { left: "Traditional AI (often)", right: "Generative AI" },
      comparisonRows: [
        { left: '"Is this email spam?"', right: '"Draft a polite email declining the meeting"' },
        { left: '"What rating will this user give?"', right: '"Write a product review in a friendly tone"' },
        { left: '"Which turn next?"', right: '"Generate a fantasy map image from a description"' },
      ],
      sections: [
        {
          title: "Text tools",
          icon: "message",
          accent: "violet",
          bullets: ["ChatGPT, Claude, Gemini, Copilot", "Essays, scripts, tutoring explanations"],
        },
        {
          title: "Image tools",
          icon: "sparkles",
          accent: "sky",
          bullets: ["DALL·E, Midjourney, Ideogram", "Posters, concept art, storyboards"],
        },
        {
          title: "Audio & music",
          icon: "music",
          accent: "violet",
          bullets: ["Suno, Udio", "Jingles, background tracks"],
        },
        {
          title: "Video tools",
          icon: "zap",
          accent: "sky",
          bullets: ["Runway, Pika", "Short clips from prompts"],
        },
        {
          title: "Code assistants",
          icon: "cpu",
          accent: "violet",
          bullets: ["GitHub Copilot, Replit AI", "Functions, debugging hints"],
        },
        {
          title: "Slide builders",
          icon: "book",
          accent: "sky",
          bullets: ["AI presentation tools", "Structure + visuals from an outline"],
        },
        {
          title: "Great at first drafts",
          icon: "wand",
          accent: "emerald",
          bullets: [
            "Overcome blank-page anxiety",
            "Remix explanations, translations, summaries",
            "Brainstorm lists of ideas and titles",
            "Adjust tone for different audiences",
          ],
        },
        {
          title: "Still needs you",
          icon: "target",
          accent: "amber",
          bullets: [
            "Fact-check claims",
            "Choose ethical boundaries",
            "Add personal stories only you lived",
            "Final quality control before submission",
          ],
        },
      ],
      footer: "Generative AI is a power tool, not an automatic A+ machine.",
    },
    47,
  ),
  interactive(
    {
      variant: "matching",
      title: "Traditional Task or Generative Task?",
      prompt: "Match each job to the AI style that fits best.",
      pairs: [
        { task: "Predict whether a loan should default", capability: "Traditional predictive AI" },
        { task: "Write three slogan options for a bake sale", capability: "Generative AI" },
        { task: "Detect tumors in an X-ray scan", capability: "Traditional predictive / vision AI" },
        { task: "Compose a 30-second promo script", capability: "Generative AI" },
        { task: "Recommend the next song", capability: "Traditional recommendation AI" },
        { task: "Generate storyboard sketches from a paragraph", capability: "Generative AI" },
      ],
    },
    48,
  ),
  callout(
    "Generative AI creates **plausible** content, not guaranteed **true** content. Treat every draft like a talented classmate's rough work — helpful, but verify before you stake your grade on it.",
    49,
    "warning",
  ),

  // ── Part IX: Large Language Models ───────────────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part IX — Large Language Models",
      subtitle:
        "Large Language Models (LLMs) power many text-based AI tools. Names change (GPT, Claude, Gemini, Llama), but the core ideas stay similar.",
      columns: 2,
      sections: [
        {
          title: "Tokens — bite-sized chunks",
          icon: "git",
          accent: "violet",
          body: 'LLMs break text into tokens — whole words, word parts, or punctuation. "ChatGPT is helpful" might become ["Chat", "GPT", " is", " helpful"]. More tokens = more compute.',
          bullets: ["Analogy: the model eats a pizza bite by bite, not in one swallow"],
        },
        {
          title: "Context window — desk space",
          icon: "book",
          accent: "sky",
          body: "The context window is how much recent text the model can hold — your prompt, pasted notes, and earlier chat turns.",
          bullets: [
            "Small desk → forgets the start of a long chat",
            "Large desk → holds more references and files",
            "Summarize or re-state key facts when space fills up",
          ],
        },
        {
          title: "Prompting — steering the model",
          icon: "wand",
          accent: "emerald",
          body: "Better prompts usually yield better answers. Include role, audience, format, length, and constraints when it matters.",
          bullets: [
            'Weak: "Explain photosynthesis."',
            'Stronger: "Explain photosynthesis to a 9th grader using a bakery analogy, 150 words, bullet points, one quiz question."',
          ],
        },
        {
          title: "Mistakes — confident ≠ correct",
          icon: "brain",
          accent: "rose",
          body: "LLMs predict likely text. They do not automatically verify every claim unless a tool adds search — and even then, check!",
          bullets: [
            "Hallucination — invented citations or statistics",
            "Outdated knowledge — training cutoff dates",
            "Math slips on multi-step problems",
            "Bias from patterns in training data",
          ],
        },
      ],
      imageUrl: "/summer-camp/ai-bootcamp/m1-ai-hallucinations.png",
      imageCaption:
        "When AI confidently gets it wrong — ask, verify with trusted sources, then keep the human accountable",
      footer:
        "Phone battery analogy: fluent answers can look smooth while being wrong — verify important facts independently.",
    },
    50,
  ),
  interactive(
    {
      variant: "matching",
      title: "LLM Concepts — Match Term to Meaning",
      prompt: "Tap to connect each vocabulary word to its plain-language meaning.",
      pairs: [
        { task: "Token", capability: "A small chunk of text the model reads or writes" },
        { task: "Context window", capability: "How much recent text the model can hold in working memory" },
        { task: "Prompt", capability: "Instructions that steer what the model should produce" },
        { task: "Hallucination", capability: "A fluent answer that includes false or invented details" },
        { task: "Training cutoff", capability: "The date after which the model was not automatically updated with news" },
      ],
    },
    51,
  ),
  callout(
    "Power user habit: For school assignments, ask the LLM to **show its reasoning**, then **cross-check** key facts with your textbook, teacher, or library database. Confidence is a style — not a fact-checker.",
    52,
    "tip",
  ),

  // ── Part X: AI Around Us ───────────────────────────────────────────────────
  text(
    `## Part X — AI Around Us

![AI applications across industries — healthcare, education, transportation, finance, agriculture, and more](/summer-camp/ai-bootcamp/m1-industries-grid.png)

![Global map of AI in smart cities, hospitals, factories, farms, schools, and disaster response](/summer-camp/ai-bootcamp/m1-global-ai-map.png)

AI is not one product — it is **infrastructure** appearing across industries. Explore the sectors below. For each, ask: **What data goes in? What prediction or creation comes out? Who benefits? What could go wrong?**

You will need this lens for your scavenger hunt later and for responsible use in later modules.`,
    53,
  ),
  interactive(
    {
      variant: "industry_sectors",
      sectors: [
        {
          title: "Healthcare",
          examples: ["Medical image screening support", "Patient symptom triage chatbots"],
        },
        {
          title: "Education",
          examples: ["Adaptive practice quizzes", "Automated feedback on drafts"],
        },
        {
          title: "Transportation",
          examples: ["Route ETA predictions", "Autonomous vehicle research prototypes"],
        },
        {
          title: "Entertainment",
          examples: ["Personalized streaming feeds", "AI-assisted game characters"],
        },
        {
          title: "Finance",
          examples: ["Fraud alert systems", "Credit risk scoring models"],
        },
        {
          title: "Agriculture",
          examples: ["Crop disease detection from drone photos", "Yield forecasting from weather data"],
        },
        {
          title: "Retail & E-commerce",
          examples: ["Product recommendation engines", "Inventory demand forecasting"],
        },
        {
          title: "Manufacturing",
          examples: ["Visual defect inspection on assembly lines", "Predictive maintenance alerts"],
        },
        {
          title: "Customer Service",
          examples: ["Support chatbots with handoff to humans", "Sentiment analysis on reviews"],
        },
        {
          title: "Security & Safety",
          examples: ["Airport anomaly detection", "Network intrusion monitoring"],
        },
        {
          title: "Creative Industries",
          examples: ["AI-assisted video editing", "Concept art generation for games"],
        },
        {
          title: "Science & Research",
          examples: ["Protein structure prediction", "Climate simulation acceleration"],
        },
      ],
    },
    54,
  ),
  reflect(
    "Part X — Which industry sector interests you most right now, and what is one AI application there you would like to learn to use responsibly?",
    55,
  ),

  // ── Part XI: What AI Can Do ────────────────────────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part XI — What AI Can Do",
      subtitle:
        "Move from abstract definitions to concrete capabilities you can observe this week.",
      imageUrl: "/summer-camp/ai-bootcamp/m1-ai-capabilities.png",
      imageCaption:
        "Twelve concrete AI capabilities — writing, translation, tutoring, coding, summarization, image generation, and more",
      columns: 2,
      sections: [
        {
          title: "Language & communication",
          icon: "message",
          accent: "violet",
          bullets: [
            "Summarize long articles into study-guide bullets",
            "Translate between languages with increasing fluency",
            "Draft emails, scripts, and lab reports quickly",
            "Tutor-style explanations at different reading levels",
          ],
        },
        {
          title: "Vision & audio",
          icon: "sparkles",
          accent: "sky",
          bullets: [
            "Face unlock and photo organization",
            "Auto captions and image descriptions for accessibility",
            "Medical imaging support highlighting regions for experts",
            "Music identification from short audio snippets",
          ],
        },
        {
          title: "Prediction & personalization",
          icon: "zap",
          accent: "violet",
          bullets: [
            "Weather and traffic ETA refinements",
            "Recommendation systems for videos and products",
            "Dynamic pricing in travel and retail (ethics matter)",
          ],
        },
        {
          title: "Creativity & design",
          icon: "wand",
          accent: "emerald",
          bullets: [
            "Generate posters, logos, storyboards, slide decks",
            'Remix styles — "explain this poem like a sci-fi trailer"',
            "Assist coding with boilerplate and debug hints",
          ],
        },
        {
          title: "Automation of repetitive work",
          icon: "cpu",
          accent: "sky",
          bullets: [
            "Sort invoices, tag support tickets, schedule meetings",
            "Transcribe interviews for journalists",
            "First-pass rubric checks with human review",
          ],
        },
        {
          title: "Pattern discovery at scale",
          icon: "brain",
          accent: "rose",
          bullets: [
            "Spot fraud across millions of transactions",
            "Analyze satellite imagery for floods or deforestation",
            "Search scientific papers for drug interaction candidates",
          ],
        },
      ],
      footer:
        "AI excels when tasks involve lots of data, repeatable patterns, and human oversight on high-stakes outcomes.",
    },
    56,
  ),
  activity(
    {
      title: "What AI Can Do — Personal Connection",
      prompt: "Which capability would help YOU most this month? Select up to three.",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Explaining hard topics in simpler words",
        "Drafting or editing writing faster",
        "Generating visual ideas for projects",
        "Organizing notes or summarizing readings",
        "Practicing quiz questions",
        "Translating languages for family or friends",
        "Coding help for a club or class",
        "I prefer to avoid AI for now",
      ],
      revealMessage:
        "There is no single 'best' answer — notice which choices require **verification** (facts) vs **creativity** (ideas). Both are valid uses with different safeguards.",
    },
    57,
  ),

  // ── Part XII: What AI Cannot Do ────────────────────────────────────────────
  text(
    `## Part XII — What AI Cannot Do (Reliably)

![Seven important AI limitations — emotions, common sense, accuracy, independent thinking, relationships, ethics, and human accountability](/summer-camp/ai-bootcamp/m1-ai-limitations.png)

Understanding limits protects your grades, privacy, and reputation.

### What AI Cannot Guarantee

- **Perfect accuracy** — Especially on niche facts, recent events, or multi-step logic
- **True understanding** — Fluency mimics comprehension without lived experience
- **Moral judgment** — Models do not share your values unless you instruct and enforce them
- **Accountability** — If you submit harmful or plagiarized work, **you** answer — not the AI
- **Privacy protection by default** — Anything you paste may be stored or used per vendor policy

### Hallucinations — With Examples

A **hallucination** is a confident-sounding answer that is **wrong or invented**.

| Prompt | Possible hallucination | Why it happens |
|---|---|---|
| "Cite three papers on penguin economics" | Fake journal names + authors | Model predicts citation-shaped text |
| "What did my mayor announce yesterday?" | Plausible but false summary | May lack live data or misread context |
| "Solve this multi-step integral" | Small algebra slip mid-work | Token prediction ≠ symbolic proof engine |

**Real-world harm example:** A lawyer submitted AI-generated legal citations that **did not exist** — professional sanctions followed. The tool sounded authoritative; the human skipped verification.

### Other Limitations

- **Common sense physics** — Occasionally suggests impossible machines
- **Emotional support boundaries** — Not a licensed therapist; crises need human professionals
- **Copyright clarity** — Training data includes protected works; output ownership is legally messy
- **Bias amplification** — Can over-generalize stereotypes present in data

Human roles that remain essential: **care**, **ethical choice**, **relationship trust**, **creative direction**, and **final sign-off** on anything that matters.`,
    58,
  ),
  activity(
    {
      title: "Limits Scenario — What Should You Do?",
      prompt:
        "An AI chatbot gives a confident, detailed answer to a history question — but provides no sources. You need it for a graded presentation tomorrow.",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Copy it into slides immediately — it sounds smart",
        "Verify facts using textbook, library database, or teacher-approved sources, then cite those",
        "Assume confidence means accuracy",
        "Add more adjectives so it sounds even smarter",
      ],
      revealMessage:
        "Best practice: **verify** with trusted sources, then cite **those** sources. AI can help you draft; you own the truth.",
    },
    59,
  ),

  // ── Part XIII: AI Myths vs Reality ─────────────────────────────────────────
  text(
    `## Part XIII — AI Myths vs Reality

![Myths vs reality — AI does not know everything, replace everyone, or feel emotions; humans stay in the loop](/summer-camp/ai-bootcamp/m1-myths-vs-reality.png)

Hype spreads faster than nuance. Use the carousel below — each card names a myth students hear in hallways, then states the reality to remember.`,
    60,
  ),
  interactive(
    {
      variant: "myth_fact_carousel",
      title: "Myth vs Fact — AI Foundations Edition",
      cards: [
        {
          id: "myth-correct",
          front: "Myth: AI always gives correct answers.",
          back: "Reality: AI can be fluent and wrong at the same time. Verify important facts independently.",
        },
        {
          id: "myth-human",
          front: "Myth: AI understands everything exactly like a human.",
          back: "Reality: AI detects statistical patterns in data — it does not share human lived experience or emotions.",
        },
        {
          id: "myth-jobs",
          front: "Myth: AI will replace every job overnight.",
          back: "Reality: AI changes tasks within jobs and creates new roles (prompt design, auditing, human-AI teamwork). Adaptation takes time.",
        },
        {
          id: "myth-cs-only",
          front: "Myth: Only computer science majors need AI literacy.",
          back: "Reality: Nurses, artists, teachers, entrepreneurs — every field increasingly touches AI-assisted workflows.",
        },
        {
          id: "myth-original",
          front: "Myth: AI output is automatically original and safe to submit.",
          back: "Reality: Outputs may resemble training data; plagiarism, copyright, and accuracy policies still apply. Disclose AI use when required.",
        },
        {
          id: "myth-conscious",
          front: "Myth: Chatbots are conscious beings.",
          back: "Reality: They generate likely text based on math and data — not evidence of feelings or self-awareness.",
        },
        {
          id: "myth-private",
          front: "Myth: AI tools keep your secrets automatically.",
          back: "Reality: Never enter passwords, medical records, or private photos unless your instructor and policy say it is safe.",
        },
        {
          id: "myth-agi-now",
          front: "Myth: Today's chatbots prove AGI already exists.",
          back: "Reality: Consumer tools are powerful Narrow AI + generative models — not general human-level minds in every domain.",
        },
      ],
    },
    61,
  ),

  // ── Part XIV: Responsible AI ───────────────────────────────────────────────
  text(
    `## Part XIV — Responsible AI

Power without guidelines creates problems. **Responsible AI** means using systems in ways that are **fair, transparent, safe, and respectful** of people and laws.

### Privacy

- Read tool **privacy policies** — especially for school projects
- **Never share** passwords, Social Security numbers, private addresses, medical records, or classmates' personal data
- Use **anonymized** or **fake** data in demos when possible

### Copyright & Attribution

- AI may reproduce styles or phrases similar to protected works
- Check instructor rules on **disclosure** ("I used ChatGPT to outline paragraph 2")
- Credit **human** sources you verify — not the chatbot as an authority

### Bias & Fairness

- Training data reflects real-world inequalities → models can **amplify stereotypes**
- Example risk: Hiring tool trained on past biased decisions repeats old patterns
- Ask: **Who might be harmed if this prediction is wrong?**

### Accuracy & Accountability

- You — not the model — submit the final work
- Keep **human review** in medical, legal, financial, and graded academic contexts

### Environmental & Social Impact

- Large models consume significant energy — use the **smallest tool that works**
- Consider **labor impacts** — support peers, don't use AI to cheat or harass

### Workshop Pledge Preview

Later modules ask you to pledge: **learn actively, cite honestly, protect privacy, question outputs, and respect people.** Responsible use is a skill badge, not a footnote.`,
    62,
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Safe to Share with AI, or Keep Private?",
      tasks: ["Generally Safe to Share", "Keep Private"],
      examples: [
        { text: "Brainstorming public science fair topic ideas", task: "Generally Safe to Share" },
        { text: "Your password or login codes", task: "Keep Private" },
        { text: "Summarizing a Wikipedia article for notes", task: "Generally Safe to Share" },
        { text: "A classmate's home address", task: "Keep Private" },
        { text: "Generic essay outline (no personal IDs)", task: "Generally Safe to Share" },
        { text: "Medical diagnosis documents", task: "Keep Private" },
        { text: "Credit card or bank numbers", task: "Keep Private" },
        { text: "Practice math problems from a textbook", task: "Generally Safe to Share" },
      ],
    },
    63,
  ),
  callout(
    "When unsure: **pause, ask your instructor, choose less data.** Responsible AI users protect people first, speed second.",
    64,
    "info",
  ),

  // ── Part XV: Hands-On Activities ───────────────────────────────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XV — Hands-On Activities",
      subtitle: "Act like an AI detective and a prompt engineer — not just a reader.",
      activities: [
        {
          id: "scavenger",
          label: "A",
          title: "AI Scavenger Hunt",
          duration: "24–48 hrs",
          icon: "search",
          accent: "violet",
          summary: "Find five distinct AI systems in your real life. For each one, record:",
          steps: [
            "Name of the app or feature",
            "Input data you think it uses",
            "Output or prediction it makes",
            "One benefit and one risk",
          ],
          tags: [
            "Recommendation feed",
            "Spam filter",
            "Smart camera",
            "Translation",
            "Adaptive quiz",
            "Photo enhancement",
          ],
        },
        {
          id: "prompt",
          label: "B",
          title: "Prompt Challenge",
          icon: "wand",
          accent: "emerald",
          wide: true,
          summary: "Rebuild a weak prompt with goal, audience, format, length, and constraints.",
          compare: {
            weak: "Tell me about climate change.",
            strong:
              "Act as an environmental science tutor for 9th graders. Explain three causes of climate change in plain language, 200 words max, bullet points, one greenhouse analogy, and one action teens can take.",
          },
          footer:
            "Run both prompts in an AI tool (if allowed). Compare clarity, structure, and usefulness — not just length.",
        },
        {
          id: "reflect",
          label: "C",
          title: "Reflection Prompts",
          icon: "book",
          accent: "sky",
          summary: "Answer honestly in the reflection blocks below.",
          footer: "Short answers are fine — specific examples beat generic praise.",
        },
        {
          id: "flashcards",
          label: "D",
          title: "Flashcard Review",
          icon: "brain",
          accent: "amber",
          summary: "Flip through the carousel until you can define each term from memory.",
          footer: "Teach one card to a partner — teaching exposes gaps fast.",
        },
      ],
    },
    65,
  ),
  activity(
    {
      title: "AI Scavenger Hunt — Checkpoint",
      prompt: "Which AI systems did you locate? Select all you documented (or will document) in your scavenger hunt.",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Streaming recommendation feed",
        "Predictive text or autocomplete",
        "Maps / traffic routing",
        "Face unlock or photo grouping",
        "Voice assistant or chatbot",
        "School adaptive learning or plagiarism tool",
        "Social media content ranking",
        "Camera night mode or object search",
        "Spam or fraud filter (email/bank)",
        "Other — I found something not listed",
      ],
      revealMessage:
        "Great hunters notice AI is **everywhere** once they look. Bring one example to class discussion — especially the risk you identified.",
    },
    66,
  ),
  activity(
    {
      title: "Prompt Challenge — Pick Your Upgrade Path",
      prompt:
        "Which weak prompt will you rewrite for the Prompt Challenge? (You will improve it in the next reflection.)",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Help with homework",
        "Write a story",
        "Explain science",
        "Make a study guide",
        "I will supply my own weak prompt",
      ],
      revealMessage:
        "Any choice works — the skill is adding **audience, format, length, constraints, and role** so the AI knows what 'good' looks like.",
    },
    67,
  ),
  reflect(
    "Prompt Challenge — Paste your **improved** prompt here (after adding goal, audience, format, length, and constraints).",
    68,
  ),
  reflect(
    "Scavenger Hunt — Describe the most surprising AI system you found and one risk most users ignore.",
    69,
  ),
  interactive(
    {
      variant: "flashcard_carousel",
      title: "Module 1 Foundations — Flashcard Review",
      cards: [
        {
          id: "ai",
          front: "Artificial Intelligence",
          back: "Computer systems performing tasks that normally require human intelligence — often by learning patterns from data.",
        },
        {
          id: "ml",
          front: "Machine Learning",
          back: "A branch of AI where systems improve by finding patterns in examples instead of relying on hand-written rules alone.",
        },
        {
          id: "gen",
          front: "Generative AI",
          back: "AI that creates new content such as text, images, audio, video, or code from learned patterns.",
        },
        {
          id: "llm",
          front: "Large Language Model (LLM)",
          back: "A text-focused AI trained on huge datasets to predict and generate language token by token.",
        },
        {
          id: "narrow",
          front: "Narrow AI",
          back: "AI designed for specific tasks — face unlock, recommendations, translation — not general human-level ability.",
        },
        {
          id: "hallucination",
          front: "Hallucination",
          back: "A confident AI answer that includes false or invented information — always verify important claims.",
        },
        {
          id: "token",
          front: "Token",
          back: "A small chunk of text the model processes — parts of words, whole words, or punctuation.",
        },
        {
          id: "oversight",
          front: "Human Oversight",
          back: "People reviewing, verifying, and taking responsibility for AI-assisted decisions and submissions.",
        },
      ],
    },
    70,
  ),

  // ── Closing reflections + module completion ────────────────────────────────
  reflect("What is one AI system you did not realize was using AI until this module?", 71),
  reflect("What is one task you believe humans should continue to control — even as AI improves?", 72),
  reflect("What is one AI myth you used to believe, and what is the accurate version?", 73),
  reflect(
    "In 2–3 sentences, explain Artificial Intelligence to a friend who has never taken a tech class.",
    74,
  ),
  {
    block_type: "module_completion",
    sort_order: 75,
    content: {
      title: "Congratulations!",
      message:
        "You completed Module 1: What Is Artificial Intelligence? You can now explain AI in plain language, spot everyday applications, compare AI with traditional software, describe ML and Generative AI, recognize Narrow AI, separate myths from facts, and apply responsible-use habits.",
      rewards: {
        xp: 150,
        badges: ["ai-foundations-explorer"],
        nextModule: "Module 2: Exploring AI Tools",
        comingNext:
          "In the next module, you will compare AI assistants side by side, test the same prompt across tools, and discover why different systems produce different answers.",
      },
    },
  },
]
