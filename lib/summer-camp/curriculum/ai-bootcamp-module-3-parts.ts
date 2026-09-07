/**
 * AI Bootcamp Module 3 — Part blocks (merged: revised enterprise + prior activities).
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

export const AI_BOOTCAMP_MODULE_3_PART_BLOCKS: CurriculumBlock[] = [
  // ── Part I — What Is a Prompt? ────────────────────────────────────────────
  text(
    `## Part I — What Is a Prompt?

**Estimated time:** ~10 minutes

### Opening Challenge

> **Tell me about space.**

Is this wrong? Not necessarily — but it leaves unanswered: which part of space? for what purpose? for whom? how detailed? what format?

Compare:

> **Explain how astronauts live aboard the International Space Station to a ninth-grade student. Focus on sleeping, eating, exercise, and hygiene. Use four short sections and keep the explanation below 300 words.**

### Key Concept

A **prompt** is information or instruction provided to an AI system to guide its response. Prompts can include questions, instructions, documents, images, data, examples, constraints, and conversation history — connecting to **multimodal AI** from Module 2.

> **Better instructions generally give AI a clearer target — but cannot guarantee truth.**`,
    10,
  ),
  activity(
    {
      title: "Opening Challenge — Which prompt is clearer?",
      prompt: "For a ninth-grade ISS lesson, which prompt gives clearer instructions?",
      activityType: "poll",
      multiSelect: false,
      options: ["Tell me about space.", "Structured ISS prompt with sections and word limit"],
      revealMessage: "Specific audience, focus, structure, and constraints give AI a clearer target — then verify facts.",
    },
    11,
  ),

  // ── Part II — What Is Prompt Engineering? ────────────────────────────────
  text(
    `## Part II — What Is Prompt Engineering?

**Estimated time:** ~10 minutes

Prompt engineering is the systematic process of **designing and refining instructions** to help AI produce useful outputs.

**Goal** → **Prompt** → **AI Output** → **Evaluate** → **Refine** → **Improved Output**

Also track: **User Intent** → **Prompt** → **AI Interpretation** → **Output** → **Human Evaluation**

### Important Principle

> **Prompt Engineering ≠ Magic Words**

Good prompting improves communication. It does **not** guarantee truth, accuracy, fairness, current information, reliable citations, safe code, or good judgment. Human evaluation remains necessary.`,
    20,
  ),

  // ── Part III — Why Prompts Matter ───────────────────────────────────────
  text(
    `## Part III — Why Prompts Matter

**Estimated time:** ~10 minutes

Same topic — increasingly precise prompts:

1. *Tell me about electricity.*
2. *Explain electricity.*
3. *Explain electricity to a ninth-grade student.*
4. *Explain voltage, current, and resistance to a ninth-grade student using a water-pipe analogy.*
5. *…Include one real-world example for each concept, a comparison table, and three check-for-understanding questions.*

Each added instruction changes the output. AI cannot automatically know your intent, knowledge level, format needs, or trusted sources — **your prompt supplies what is missing.**`,
    30,
  ),

  // ── Part IV — R-T-C-A-C-F ───────────────────────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part IV — Anatomy of a Strong Prompt: R-T-C-A-C-F",
      subtitle: "Use every letter when a prompt matters — each piece answers one design question.",
      columns: 3,
      sections: [
        { title: "R — Role", icon: "brain", body: "Who should the AI act as?", accent: "violet" },
        { title: "T — Task", icon: "target", body: "What exactly should it do?", accent: "sky" },
        { title: "C — Context", icon: "book", body: "What information does it need?", accent: "violet" },
        { title: "A — Audience", icon: "message", body: "Who is the result for?", accent: "emerald" },
        { title: "C — Constraints", icon: "zap", body: "What rules or boundaries?", accent: "amber" },
        { title: "F — Format", icon: "wand", body: "How should the answer be organized?", accent: "sky" },
      ],
      comparisonLabels: { left: "Component", right: "Worked example — Newton's Laws" },
      comparisonRows: [
        { left: "Role", right: "Patient high-school science tutor" },
        { left: "Task", right: "Explain Newton's three laws of motion" },
        { left: "Context", right: "I understand speed/acceleration but not forces formally" },
        { left: "Audience", right: "Ninth-grade student" },
        { left: "Constraints", right: "Avoid advanced math; use everyday examples" },
        { left: "Format", right: "Three sections, one analogy per law, three practice questions" },
      ],
      footer:
        "Complete prompt: You are a patient high-school science tutor. Explain Newton's three laws of motion to a ninth-grade student who understands speed and acceleration but has not formally studied forces. Avoid advanced mathematics. Give one everyday analogy for each law. Organize into three short sections and finish with three practice questions.",
    },
    40,
  ),
  interactive(
    {
      variant: "step_order",
      title: "Arrange R-T-C-A-C-F",
      prompt: "Put the framework in logical order for building a prompt.",
      correctOrder: ["Role", "Task", "Context", "Audience", "Constraints", "Format"],
      successMessage: "Correct — Role → Task → Context → Audience → Constraints → Format",
      retryMessage: "Try: Role, Task, Context, Audience, Constraints, Format.",
    },
    41,
  ),
  interactive(
    {
      variant: "topic_deck",
      title: "Weak → Strong Diagnosis (History)",
      subtitle: "Same topic — each row adds audience, structure, and constraints.",
      comparisonLabels: { left: "Level", right: "Example" },
      comparisonRows: [
        { left: "Weak", right: "Tell me about World War II." },
        { left: "Better", right: "Explain the major causes of World War II." },
        {
          left: "Strong",
          right:
            "Explain four major causes to a Grade 10 student. For each: 2–3 sentences + one historical example. Summarize how causes connected.",
        },
      ],
    },
    42,
  ),
  interactive(
    {
      variant: "prompt_workshop",
      title: "Part IV — Interactive Prompt Makeover Lab",
      subtitle: "Analyze the weak prompt → read what we had in mind → craft your version → check keywords → reveal the model answer.",
      scenarios: [
        {
          id: "wwii",
          title: "History · WWII",
          weakPrompt: "Tell me about World War II.",
          instructorBrief:
            "Explain the major causes of World War II to a Grade 10 student — not a novel-length timeline. Include structure, one historical example per cause, and a short summary of how the causes connected.",
          criteria: [
            {
              id: "role",
              letter: "R",
              label: "Role",
              hint: "Who should the AI act as? (tutor, teacher, historian…)",
              keywords: ["act as", "you are", "history teacher", "history tutor", "historian", "teacher", "tutor"],
            },
            {
              id: "task",
              letter: "T",
              label: "Task",
              hint: "Use a strong verb and focus on causes — not everything about the war.",
              keywords: ["explain", "causes", "cause", "major", "four", "4"],
            },
            {
              id: "context",
              letter: "C",
              label: "Context",
              hint: "Scope the topic — causes, not every battle and date.",
              keywords: ["causes", "cause", "world war ii", "world war 2", "wwii", "ww2"],
            },
            {
              id: "audience",
              letter: "A",
              label: "Audience",
              hint: "Name the reader level (Grade 10, high school…).",
              keywords: ["grade 10", "10th grade", "tenth grade", "high school", "student"],
            },
            {
              id: "constraints",
              letter: "C",
              label: "Constraints",
              hint: "Limit length, depth, or scope so the answer stays usable.",
              keywords: ["sentence", "short", "brief", "2-3", "two", "three", "example", "historical"],
            },
            {
              id: "format",
              letter: "F",
              label: "Format",
              hint: "Ask for sections, bullets, or a summary structure.",
              keywords: ["section", "paragraph", "bullet", "summar", "organize", "each cause"],
            },
          ],
          modelAnswer:
            "You are a patient high school history teacher. Explain four major causes of World War II to a Grade 10 student. For each cause, write 2–3 sentences and include one historical example. End with a short summary explaining how the causes connected. Avoid listing every battle or date.",
        },
        {
          id: "biology",
          title: "Biology · Cells",
          weakPrompt: "Help with biology.",
          instructorBrief:
            "Compare mitosis and meiosis for a student with a quiz tomorrow — purpose, number of divisions, resulting cells, and genetic similarity. Keep it study-ready, not a textbook chapter.",
          criteria: [
            {
              id: "role",
              letter: "R",
              label: "Role",
              hint: "Science tutor or biology teacher voice.",
              keywords: ["act as", "you are", "biology tutor", "science tutor", "biology teacher", "tutor", "teacher"],
            },
            {
              id: "task",
              letter: "T",
              label: "Task",
              hint: "Compare two processes — name both mitosis and meiosis.",
              keywords: ["compare", "mitosis", "meiosis", "contrast", "difference"],
            },
            {
              id: "context",
              letter: "C",
              label: "Context",
              hint: "Mention quiz timing or what the student already knows.",
              keywords: ["quiz", "tomorrow", "test", "exam", "study", "review"],
            },
            {
              id: "audience",
              letter: "A",
              label: "Audience",
              hint: "High school / beginner level.",
              keywords: ["student", "ninth", "9th", "high school", "beginner", "grade"],
            },
            {
              id: "constraints",
              letter: "C",
              label: "Constraints",
              hint: "Focus on purpose, divisions, cells, genetic similarity.",
              keywords: ["purpose", "division", "cell", "genetic", "similar", "resulting"],
            },
            {
              id: "format",
              letter: "F",
              label: "Format",
              hint: "Table, bullets, or side-by-side structure.",
              keywords: ["table", "bullet", "column", "side by side", "section", "row"],
            },
          ],
          modelAnswer:
            "Act as a friendly high school biology tutor. Compare mitosis and meiosis for a student with a quiz tomorrow. Cover purpose, number of divisions, resulting cells, and genetic similarity. Use a simple comparison table or bullet points. Keep language clear for a beginner.",
        },
        {
          id: "climate-slides",
          title: "Presentation · Climate",
          weakPrompt: "Write something about climate change for my presentation.",
          instructorBrief:
            "Eight slides for Grade 10: problem → three renewable technologies → compare strengths and limitations → one discussion question. One key message per slide with a visual suggestion.",
          criteria: [
            {
              id: "role",
              letter: "R",
              label: "Role",
              hint: "Presentation coach or science teacher planning slides.",
              keywords: ["act as", "you are", "presentation", "science teacher", "teacher", "coach", "tutor"],
            },
            {
              id: "task",
              letter: "T",
              label: "Task",
              hint: "Outline slides — not a full essay.",
              keywords: ["slide", "outline", "presentation", "renewable", "technology", "technologies"],
            },
            {
              id: "context",
              letter: "C",
              label: "Context",
              hint: "Climate change + renewable energy focus.",
              keywords: ["climate", "renewable", "energy", "global warming", "environment"],
            },
            {
              id: "audience",
              letter: "A",
              label: "Audience",
              hint: "Grade 10 / high school classmates.",
              keywords: ["grade 10", "10th grade", "high school", "classmate", "student"],
            },
            {
              id: "constraints",
              letter: "C",
              label: "Constraints",
              hint: "Eight slides, compare strengths/limitations, discussion question.",
              keywords: ["eight", "8", "strength", "limitation", "discussion", "question", "one message"],
            },
            {
              id: "format",
              letter: "F",
              label: "Format",
              hint: "Slide-by-slide outline with titles and bullet points.",
              keywords: ["slide", "outline", "bullet", "title", "key message", "visual"],
            },
          ],
          modelAnswer:
            "Act as a presentation coach for a Grade 10 student. Create an eight-slide outline on climate change and renewable energy. Structure: problem → three renewable technologies → compare strengths and limitations → discussion question. For each slide, give a title, 3 bullet points, one key message, and a simple visual suggestion.",
        },
      ],
    },
    43,
  ),

  // ── Parts V–X: Components ───────────────────────────────────────────────
  text(
    `## Part V — Component 1: Define the Task

**Estimated time:** ~10 minutes

> Help with biology. → **Compare mitosis and meiosis** → **Compare mitosis and meiosis focusing on purpose, divisions, resulting cells, and genetic similarity.**

Strong task verbs: explain · compare · analyze · summarize · classify · generate · design · evaluate · rewrite · extract · brainstorm · critique · recommend · organize`,
    50,
  ),
  text(
    `## Part VI — Component 2: Provide Context

**Estimated time:** ~10 minutes

> Help me prepare. → *I have a ninth-grade biology quiz tomorrow on photosynthesis, cellular respiration, and plant cells. I have 45 minutes.*

Also: *I understand cells well but struggle with genetics — prioritize genetics in a 45-minute study session with retrieval practice.*

> **Does the AI need this information to complete the task?** If not, remove it. More information is not automatically better.`,
    60,
  ),
  text(
    `## Part VII — Component 3: Define the Audience

**Estimated time:** ~5 minutes

Topic **cybersecurity** for: a sixth-grader · a small-business owner · a computer-science student.

Topic **neural networks** for: a 7-year-old · a high-school student · a first-year CS student.

Same topic — different vocabulary, depth, examples, and tone.`,
    70,
  ),
  activity(
    {
      title: "Audience Check",
      prompt: "Which mismatch is most likely when audience is missing or wrong?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Graduate-level math for a 7-year-old prompt",
        "Simple analogy when a CS student asked for technical depth",
        "Both can happen",
        "Audience never affects output",
      ],
      revealMessage: "Specify audience/level — one of the fastest fixes for mismatched answers.",
    },
    71,
  ),
  text(
    `## Part VIII — Component 4: Role or Perspective

**Estimated time:** ~10 minutes

Useful: *Act as a patient mathematics tutor* · *editor reviewing a newspaper article* · *debate coach* · *beginner-friendly Python instructor*

**Weak:** *You are the greatest genius in history.*

**Better:** *You are a mathematics tutor. Guide me toward the solution without immediately giving the final answer.*

> **Giving AI an expert role does not make it a verified expert.**`,
    80,
  ),
  activity(
    {
      title: "Role vs Reality",
      prompt: "\"Act as a licensed physician and diagnose my symptoms.\" Best response?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Trust the diagnosis",
        "Use general educational info only; seek real medical professionals",
        "Share private health records for accuracy",
        "Skip verification because tone sounds confident",
      ],
      revealMessage: "Roles shape style — they do not replace qualified judgment.",
    },
    81,
  ),
  text(
    `## Part IX — Component 5: Constraints

**Estimated time:** ~10 minutes

Length · reading level · scope · tone · evidence (distinguish facts from uncertain claims) · exclusion (*do not reveal the final answer until I attempt the problem*).

> Constraints should **improve** the result, not unnecessarily restrict it.`,
    90,
  ),
  text(
    `## Part X — Component 6: Output Format

**Estimated time:** ~10 minutes

Request structure: paragraphs · bullets · numbered steps · tables · checklists · timelines · study guides · flashcards · quizzes · JSON · code · presentation outlines.

> Compare renewable and nonrenewable energy **in a four-column table**: definition, examples, advantages, disadvantages.`,
    100,
  ),

  // ── Part XI — Examples ───────────────────────────────────────────────────
  text(
    `## Part XI — Using Examples (Zero / One / Few-Shot)

**Estimated time:** ~10 minutes

**Zero-shot:** *Classify this review as positive, neutral, or negative.*

**One-shot:** *"The movie was fantastic." → Positive. Now classify: "The movie was fine, but nothing special."*

**Few-shot:** Several examples establish pattern, tone, classification, or formatting.

> Sometimes **showing** what you want beats describing it repeatedly.`,
    110,
  ),
  activity(
    {
      title: "When to Use Examples",
      prompt: "You need AI to label posts using your teacher's exact rubric labels. Best approach?",
      activityType: "poll",
      multiSelect: false,
      options: ["Few-shot with labeled examples", "Zero-shot only", "Skip the rubric", "Share private student data"],
      revealMessage: "Few-shot helps when you need a specific pattern or format.",
    },
    111,
  ),

  // ── Part XII — Grounded Prompting ─────────────────────────────────────────
  text(
    `## Part XII — Prompting with Reference Material (Grounded Prompting)

**Estimated time:** ~10 minutes

> Using **only** the article provided below, identify the author's three main arguments. For each, provide supporting evidence from the article. If the article lacks enough information, **say so** rather than adding outside information.

Reference material: documents · class notes · images · tables · data · articles · assignment instructions.`,
    120,
  ),

  // ── Part XIII — Tutoring ──────────────────────────────────────────────────
  text(
    `## Part XIII — Prompting AI to Tutor You

**Estimated time:** ~10 minutes

**Poor:** Question → AI gives answer → Copy

**Better:** Question → Student attempts → AI gives hint → Student revises → AI explains error → Student solves

### Tutor Prompt

> Act as a tutor rather than an answer generator. Ask me one question at a time about photosynthesis. If I answer incorrectly, give a hint before explaining. Increase difficulty gradually.`,
    130,
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Learning Prompt or Cheating Prompt?",
      tasks: ["Learning Prompt", "Cheating Prompt"],
      examples: [
        { text: "Ask one question at a time; hint if stuck — no final answers yet.", task: "Learning Prompt" },
        { text: "Complete my homework so I can submit unchanged.", task: "Cheating Prompt" },
        { text: "Identify the first error without rewriting everything.", task: "Learning Prompt" },
        { text: "Write my lab report so my teacher cannot tell.", task: "Cheating Prompt" },
        { text: "Create five practice problems at my level.", task: "Learning Prompt" },
      ],
    },
    131,
  ),

  // ── Part XIV — Decomposition ────────────────────────────────────────────
  text(
    `## Part XIV — Breaking Complex Tasks Into Steps

**Estimated time:** ~10 minutes

Instead of *Help me create my science fair project*:

1. Suggest five renewable-energy science fair ideas
2. Compare on cost, difficulty, safety, time
3. Identify which is realistic for four weeks
4. Create a four-week schedule
5. Identify weaknesses in the plan

Also for presentations: brainstorm topics → compare → outline → gather evidence → draft slides → review clarity.

> **Prompt decomposition** — also an early foundation for **AI agents** (Module 2).`,
    140,
  ),
  interactive(
    {
      variant: "prompt_workshop",
      title: "Part XIV — Decomposition Prompt Lab",
      subtitle: "Turn one giant request into a step-by-step prompt chain.",
      scenarios: [
        {
          id: "science-fair",
          title: "Science Fair",
          weakPrompt: "Write my entire science fair project for me about renewable energy.",
          instructorBrief:
            "Do NOT generate the whole project in one shot. Break the work into steps: brainstorm ideas, compare options, pick a realistic plan, build a schedule, and review weaknesses — the student still does the thinking.",
          criteria: [
            {
              id: "role",
              letter: "R",
              label: "Role",
              hint: "Project coach or science mentor — not a ghostwriter.",
              keywords: ["act as", "you are", "coach", "mentor", "advisor", "teacher", "tutor"],
            },
            {
              id: "task",
              letter: "T",
              label: "Task",
              hint: "Ask for steps — brainstorm, compare, schedule, review.",
              keywords: ["step", "brainstorm", "compare", "schedule", "plan", "outline", "break"],
            },
            {
              id: "context",
              letter: "C",
              label: "Context",
              hint: "Renewable energy science fair with time limits.",
              keywords: ["renewable", "energy", "science fair", "four week", "4 week", "weeks"],
            },
            {
              id: "audience",
              letter: "A",
              label: "Audience",
              hint: "High school student level.",
              keywords: ["student", "high school", "grade", "ninth", "10th"],
            },
            {
              id: "constraints",
              letter: "C",
              label: "Constraints",
              hint: "Do not write the full project; one step at a time.",
              keywords: ["do not write", "don't write", "not write", "one step", "first step", "without writing", "guide me"],
            },
            {
              id: "format",
              letter: "F",
              label: "Format",
              hint: "Numbered steps or a phased plan.",
              keywords: ["numbered", "step 1", "1.", "phase", "list", "sequence"],
            },
          ],
          modelAnswer:
            "Act as a science fair project coach for a high school student. Do not write the full project. First, suggest five renewable-energy science fair ideas. After I pick one, compare options on cost, difficulty, safety, and time. Then help me choose a realistic four-week plan, create a weekly schedule, and identify weaknesses in the plan. Work one step at a time.",
        },
      ],
    },
    141,
  ),

  // ── Part XV — Iteration ───────────────────────────────────────────────────
  text(
    `## Part XV — Iterative Prompting

**Estimated time:** ~10 minutes

Professional use is conversational. Example chain on *climate change*:

→ Make this Grade 9 appropriate · Add two real-world examples · Separate causes from effects · Turn into a study guide · Quiz me on it

**Prompt** → **Review** → **Identify problem** → **Refine** → **Generate again** → **Evaluate**`,
    150,
  ),

  // ── Part XVI — Critique & Revision ────────────────────────────────────────
  interactive(
    {
      variant: "prompt_workshop",
      title: "Part XVI — Critique Prompt Lab",
      subtitle: "Practice prompts that improve your writing or tutoring — without doing the work for you.",
      scenarios: [
        {
          id: "writing-coach",
          title: "Writing Coach",
          weakPrompt: "Make my paragraph better.",
          instructorBrief:
            "Review the student's draft for clarity, organization, evidence, and grammar. Identify the three most important weaknesses — but do NOT rewrite the paragraph yet.",
          criteria: [
            {
              id: "role",
              letter: "R",
              label: "Role",
              hint: "Writing coach or editor voice.",
              keywords: ["act as", "you are", "writing coach", "editor", "english teacher", "tutor"],
            },
            {
              id: "task",
              letter: "T",
              label: "Task",
              hint: "Review and identify weaknesses — not full rewrite.",
              keywords: ["review", "identify", "weakness", "feedback", "critique", "analyze"],
            },
            {
              id: "context",
              letter: "C",
              label: "Context",
              hint: "Clarity, organization, evidence, grammar.",
              keywords: ["clarity", "organization", "evidence", "grammar", "paragraph", "draft"],
            },
            {
              id: "audience",
              letter: "A",
              label: "Audience",
              hint: "Student author — preserve their argument.",
              keywords: ["my", "student", "author", "argument", "my paragraph", "my draft"],
            },
            {
              id: "constraints",
              letter: "C",
              label: "Constraints",
              hint: "Do not rewrite yet — three weaknesses only.",
              keywords: ["do not rewrite", "don't rewrite", "not rewrite", "without rewriting", "three", "3", "yet"],
            },
            {
              id: "format",
              letter: "F",
              label: "Format",
              hint: "Numbered list of weaknesses or labeled feedback.",
              keywords: ["list", "numbered", "bullet", "three", "3", "label"],
            },
          ],
          modelAnswer:
            "Act as a writing coach. Review my paragraph below for clarity, organization, evidence, and grammar. Identify the three most important weaknesses. Do not rewrite the paragraph yet — only explain what should improve and why.",
        },
        {
          id: "tutor-hints",
          title: "Tutor Mode",
          weakPrompt: "What is the answer to question 7?",
          instructorBrief:
            "Tutor mode: ask guiding questions, give hints if the student is stuck, and increase difficulty gradually — do NOT give the final answer immediately.",
          criteria: [
            {
              id: "role",
              letter: "R",
              label: "Role",
              hint: "Tutor — not an answer vending machine.",
              keywords: ["act as", "you are", "tutor", "teacher", "coach"],
            },
            {
              id: "task",
              letter: "T",
              label: "Task",
              hint: "Hint, question, guide — not 'here is the answer'.",
              keywords: ["hint", "question", "guide", "help me", "one question", "ask me"],
            },
            {
              id: "context",
              letter: "C",
              label: "Context",
              hint: "Name the subject or topic (e.g. photosynthesis).",
              keywords: ["photosynthesis", "math", "algebra", "physics", "question 7", "problem"],
            },
            {
              id: "audience",
              letter: "A",
              label: "Audience",
              hint: "Student who should attempt first.",
              keywords: ["student", "me", "my level", "beginner", "high school"],
            },
            {
              id: "constraints",
              letter: "C",
              label: "Constraints",
              hint: "No final answer until the student tries.",
              keywords: ["do not give", "don't give", "not give", "without giving", "final answer", "no answer", "attempt"],
            },
            {
              id: "format",
              letter: "F",
              label: "Format",
              hint: "One question at a time or step-by-step hints.",
              keywords: ["one question", "one at a time", "step by step", "gradually", "then"],
            },
          ],
          modelAnswer:
            "Act as a tutor, not an answer generator. I am working on question 7 about photosynthesis. Ask me one question at a time. If I answer incorrectly, give a hint before explaining. Do not give the final answer until I attempt the problem. Increase difficulty gradually.",
        },
      ],
    },
    160,
  ),

  // ── Part XVII — Check Its Work ────────────────────────────────────────────
  text(
    `## Part XVII — Asking AI to Check Its Work

**Estimated time:** ~5 minutes

- *Check whether your response followed every requirement in my original prompt.*
- *Identify claims that should be independently verified.*
- *Review your calculation for possible errors.*
- *Compare the final response against this rubric.*

AI reviewing itself **does not replace external verification.**`,
    170,
  ),

  // ── Part XVIII — Research ─────────────────────────────────────────────────
  text(
    `## Part XVIII — Prompting for Research

**Estimated time:** ~10 minutes

Weak: *Research climate change.*

Better:

> Help me identify four major causes of coral bleaching. Separate well-established causes from emerging questions. Recommend reliable source types and identify claims requiring current evidence.

Ask for: scope · evidence · sources · dates · uncertainty · contradictory evidence · verification.`,
    180,
  ),

  // ── Part XIX — Images (S-S-C-C-L + detailed) ─────────────────────────────
  text(
    `## Part XIX — Prompting for Images

**Estimated time:** ~10 minutes

### S-S-C-C-L Framework

**S**ubject · **S**cene · **C**omposition · **C**reative style · **L**ighting / look

**Weak:** *Robot classroom.*

**Strong:** *Create a modern educational illustration showing diverse high-school students building a small robot in a futuristic STEM classroom. Four students around a central workbench with laptops and components, friendly mobile robot, clean vector-isometric style, bright natural lighting, blue/teal accents, uncluttered background, no text, 16:9.*

Also useful: **Subject + Action + Environment + Composition + Style + Lighting + Details + Aspect Ratio** — change **one variable at a time** when refining.`,
    190,
  ),
  reflect("Image Prompt — Write a full educational image prompt using S-S-C-C-L or the extended structure.", 191),

  // ── Part XX — Video & Audio (from prior module) ───────────────────────────
  text(
    `## Part XX — Prompting for Video and Audio

**Estimated time:** ~8 minutes

**Video:** subject · action · scene · camera movement · visual style · lighting · duration

**Voice:** script · speaking style · pace · emotion · audience

**Music:** genre · mood · instruments · tempo · purpose

Different modalities require different prompting strategies.`,
    200,
  ),

  // ── Part XXI — Presentations ──────────────────────────────────────────────
  text(
    `## Part XXI — Prompting for Presentations

**Estimated time:** ~10 minutes

Weak: *Make a presentation about renewable energy.*

Strong:

> Create an eight-slide presentation for Grade 10 students introducing renewable energy. Begin with a real-world problem; explain solar, wind, and hydro; compare advantages and limitations; include one discussion question; conclude with three takeaways. For each slide: title, max three key points, recommended visual.`,
    210,
  ),

  // ── Part XXII — Coding ────────────────────────────────────────────────────
  text(
    `## Part XXII — Prompting for Code

**Estimated time:** ~10 minutes

> Create a beginner-friendly Python program that asks for five quiz scores and calculates the average. Validate scores 0–100. Explain each section after providing code.

**Educational sequence:**
1. *Do not write the program yet. Help me design the algorithm first.*
2. *Review my code and identify the error without rewriting the entire solution.*

> **Never use AI-generated code you cannot explain or test.**`,
    220,
  ),

  // ── Part XXIII — Data ─────────────────────────────────────────────────────
  text(
    `## Part XXIII — Prompting for Data Analysis

**Estimated time:** ~10 minutes

> Analyze the attached dataset of study hours and quiz scores. Identify major patterns, recommend two appropriate visualizations, describe limitations preventing strong conclusions. **Do not claim correlation proves causation.**`,
    230,
  ),

  // ── Part XXIV — Multimodal ────────────────────────────────────────────────
  text(
    `## Part XXIV — Multimodal Prompting

**Estimated time:** ~10 minutes

> Examine this photograph of a circuit and the attached lab instructions. Identify major components and explain how they relate to the experiment. If a component cannot be identified confidently, label it **uncertain** rather than guessing.

Also: PDF-only revision questions · chart trends + unsupported conclusions · screenshot error explanations.`,
    240,
  ),

  // ── Part XXV — Prompt Chains ──────────────────────────────────────────────
  text(
    `## Part XXV — Prompt Chains and Workflows

**Estimated time:** ~10 minutes

**Research** → **Analyze** → **Draft** → **Critique** → **Human Review** → **Revise** → **Human Finalization**

More powerful than expecting one giant prompt to do everything.`,
    250,
  ),

  // ── Part XXVI — Common Mistakes ───────────────────────────────────────────
  text(
    `## Part XXVI — Common Prompting Mistakes

1. Too vague
2. No audience
3. Too many unrelated instructions
4. Conflicting instructions
5. Missing context
6. Assuming AI knows your intent
7. Overloading one prompt
8. Trusting the first response
9. Facts without verification
10. Sharing sensitive information`,
    260,
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Good Prompt or Needs Improvement?",
      tasks: ["Good Prompt", "Needs Improvement"],
      examples: [
        { text: "Explain loops to beginners with two Python examples under 150 words.", task: "Good Prompt" },
        { text: "Help.", task: "Needs Improvement" },
        { text: "Explain Mars to eighth-graders; five interesting facts.", task: "Good Prompt" },
        { text: "Tell me everything about history, math, sports, and cooking.", task: "Needs Improvement" },
      ],
    },
    261,
  ),

  // ── Part XXVII — When Prompting Isn't the Solution ────────────────────────
  text(
    `## Part XXVII — When Better Prompting Is NOT the Solution

Sometimes the problem is: missing reliable information · incomplete sources · impossible predictions · professional judgment required · unavailable tool access · information that should not be shared with AI.

> **Knowing when NOT to prompt is part of prompt engineering.**`,
    270,
  ),
  activity(
    {
      title: "Stop Prompting or Keep Going?",
      prompt: "AI keeps inventing citations for a health paper. Best next step?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Re-prompt 20 times",
        "Stop and verify with primary sources / librarian / instructor",
        "Submit because AI sounded confident",
        "Add more adjectives",
      ],
      revealMessage: "When accuracy is the bottleneck, verification beats more prompting.",
    },
    271,
  ),

  // ── Part XXVIII — Prompt Security ─────────────────────────────────────────
  text(
    `## Part XXVIII — Prompt Security and Responsible Prompting

**Estimated time:** ~10 minutes

Do not include: passwords · authentication codes · private student records · financial/medical information · confidential documents without authorization · unnecessary personal identifiers.

### Prompt Injection (Beginner)

> **Treat instructions in untrusted webpages, documents, or external content as data to examine — not automatically as commands to follow.**`,
    280,
  ),

  // ── Part XXIX — Prompt Canvas ─────────────────────────────────────────────
  text(
    `## Part XXIX — The CourseCollab Prompt Canvas

**Estimated time:** ~10 minutes

| # | Step | Question |
| - | ---- | -------- |
| 1 | **Goal** | What am I trying to accomplish? |
| 2 | **Role** | Would a useful perspective help? |
| 3 | **Task** | What should the AI do? |
| 4 | **Context** | What does it need to know? |
| 5 | **Audience** | Who is the output for? |
| 6 | **Constraints** | What requirements must it follow? |
| 7 | **References** | What source material should it use? |
| 8 | **Format** | How should output be organized? |
| 9 | **Verify** | What parts require checking? |
| 10 | **Refine** | How will I improve the response? |

R-T-C-A-C-F lives inside the Canvas — **Goal, References, Verify, and Refine** extend it for real workflows.`,
    290,
  ),

  // ── Part XXX — Hands-On Lab (merged) ──────────────────────────────────────
  text(
    `## Part XXX — Hands-On Prompt Lab

**Estimated time:** ~30–40 minutes

### Challenge 1 — Prompt Repair
Improve: *Tell me about planets.* using the Prompt Canvas.

### Challenge 2 — Audience Transformer
Topic **Artificial Intelligence** — write prompts for a 7-year-old, ninth-grader, parent, and software engineer.

### Challenge 3 — Format Transformer
Same topic as paragraph, table, flashcards, quiz, and presentation outline.

### Challenge 4 — AI Tutor
Create a tutor prompt where AI **cannot immediately reveal answers**.

### Challenge 5 — Image Prompt
Version 1 → generate → critique → Version 2 → improved image.

### Challenge 6 — Prompt Debugging
Repair poor prompts: identify missing context, ambiguous task, wrong audience, conflicting constraints, missing format.

### Bonus — 5-Round Upgrade (Renewable Energy)
Start *Tell me about renewable energy.* → add Task → Context → Audience → Constraints → Format. Compare Version 1 vs Version 5.`,
    300,
  ),
  activity(
    {
      title: "Lab Challenges Completed",
      prompt: "Select every lab challenge you completed (or reviewed with your instructor).",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Challenge 1 — Prompt Repair",
        "Challenge 2 — Audience Transformer",
        "Challenge 3 — Format Transformer",
        "Challenge 4 — AI Tutor",
        "Challenge 5 — Image Prompt",
        "Challenge 6 — Prompt Debugging",
        "Bonus — 5-Round Renewable Energy Upgrade",
      ],
    },
    301,
  ),
  reflect("Lab — Version 1 vs Version 5 (or best before/after): what changed in your prompt and the AI output?", 302),

  // ── Part XXXI — Prompt Battle (from prior) ────────────────────────────────
  text(
    `## Part XXXI — Prompt Battle

**Estimated time:** ~15 minutes (instructor-led or teams)

Shared task: **Use AI to teach a 12-year-old how earthquakes happen.**

Three prompt attempts. Compete for: most accurate · clearest · most engaging · best analogy · best structure.

Explain **why your final prompt worked** — which Canvas / R-T-C-A-C-F components made the difference.`,
    310,
  ),
  reflect("Prompt Battle — Paste your team's winning prompt and explain why it worked.", 311),

  // ── Part XXXII — Challenge V1→V3 (merged) ───────────────────────────────
  text(
    `## Part XXXII — Prompt Engineering Challenge

**Estimated time:** ~20 minutes

Choose a real task: studying · research · writing · presentation · coding · image · data · career exploration

**Version 1** (basic) → **Version 2** (structured Canvas) → **Version 3** (refined after evaluating output)

Document: what changed · why · how the response changed · what still needed human correction · what required verification.

Mission options: **AI Tutor** · **Research Assistant** · **Creative Designer** · **Coding Coach** · **Career Coach** · **Data Analyst**`,
    320,
  ),
  activity(
    {
      title: "Challenge Mission",
      prompt: "Which mission or task type did you choose?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Studying / AI Tutor",
        "Research Assistant",
        "Creative Designer / Image",
        "Coding Coach",
        "Career Coach",
        "Data Analyst",
        "Other real school task",
      ],
    },
    321,
  ),
  reflect("Challenge — Version 1 (basic prompt):", 322),
  reflect("Challenge — Version 3 (refined prompt after evaluation):", 323),
  reflect("Challenge — What did you verify manually before calling it final?", 324),
  {
    block_type: "checkpoint",
    sort_order: 325,
    content: {
      title: "Optional: Prompt Challenge Screenshot",
      description: "Upload a screenshot of your prompt conversation (optional).",
      acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
      maxSizeMb: 8,
    },
  },

  // ── Part XXXIII — Prompt Library (merged) ───────────────────────────────
  text(
    `## Part XXXIII — Build Your Personal Prompt Library

**Estimated time:** ~15 minutes

Create reusable templates for: **Learning** · **Studying** · **Research** · **Writing** · **Creativity** · **Images** · **Presentations** · **Coding** · **Career**

### Learning Template
> Teach me **[TOPIC]** at **[LEVEL]**. I understand **[KNOWLEDGE]** but struggle with **[DIFFICULTY]**. Explain using **[FORMAT]**. Test me with **[NUMBER]** questions. Do not reveal answers until I respond.

### Research Template
> Help me investigate **[QUESTION]**. Identify major claims, evidence to find, competing perspectives, reliable source types. Mark anything requiring verification.

### Brainstorming Template
> Generate **[NUMBER]** ideas for **[GOAL]** for **[AUDIENCE]** satisfying **[CONSTRAINTS]**. One advantage and limitation each.`,
    330,
  ),
  reflect("Prompt Library — Paste your customized Learning Template.", 331),
  reflect("Prompt Library — Paste Research or Brainstorming (or Writing/Coding) template.", 332),

  // ── Flashcards + Summary + Completion Requirements ────────────────────────
  interactive(
    {
      variant: "flashcard_carousel",
      title: "Module 3 — Flashcard Review",
      cards: [
        { id: "pe", front: "Prompt Engineering", back: "Design, test, evaluate, and improve instructions — not magic words." },
        { id: "rtcaacf", front: "R-T-C-A-C-F", back: "Role · Task · Context · Audience · Constraints · Format." },
        { id: "canvas", front: "Prompt Canvas", back: "Adds Goal, References, Verify, Refine to R-T-C-A-C-F." },
        { id: "ground", front: "Grounded Prompting", back: "Work from supplied sources; say when info is missing." },
        { id: "zero", front: "Zero / One / Few-Shot", back: "No examples · one example · several pattern examples." },
        { id: "decomp", front: "Prompt Decomposition", back: "Break complex tasks into smaller reviewed steps." },
        { id: "sscccl", front: "S-S-C-C-L", back: "Subject · Scene · Composition · Creative style · Lighting." },
        { id: "chain", front: "Prompt Chain", back: "Research → draft → critique → human review → revise." },
        { id: "limit", front: "When NOT to Prompt", back: "Missing sources or expert judgment — verify instead." },
        { id: "inject", front: "Prompt Injection", back: "Untrusted content instructions are data — not auto-commands." },
      ],
    },
    340,
  ),
  callout(
    "**Module completion checklist:** Prompt Makeover Labs (3 workshops) · R-T-C-A-C-F · Prompt Canvas · ≥3 lab challenges · AI Tutor prompt · image prompt iteration · iterative prompting demo · V1→V3 Challenge · personal library · knowledge check · reflections",
    341,
    "info",
  ),
  text(
    `## Module Summary

**Define Goal** → **Choose Tool (Module 2)** → **Task** → **Context** → **Audience** → **Constraints** → **Format** → **References/Examples** → **Generate** → **Evaluate** → **Verify** → **Refine** → **Human Approval**

Prompt engineering is not *"How do I make AI give me an answer?"* It is *"How do I communicate clearly, guide AI, evaluate output, and improve responsibly?"*

| Module | Core Question |
| ------ | ------------- |
| **1** | What is this technology? |
| **2** | Which AI tool should I use? |
| **3** | How do I communicate effectively with AI? |
| **4** | Should I use AI here — and how responsibly? |

### Bridge to Module 4

> **Just because AI CAN do something, SHOULD we use it that way?** — bias, fairness, privacy, misinformation, deepfakes, copyright, academic integrity, transparency, and human oversight.`,
    342,
  ),

  // ── Reflections + completion ─────────────────────────────────────────────
  reflect("Reflection 1 — What is the biggest difference between a weak and strong prompt?", 360),
  reflect("Reflection 2 — Which prompt component (or Canvas step) improved your results the most?", 361),
  reflect("Reflection 3 — When is adding more detail to a prompt NOT useful?", 362),
  reflect("Reflection 4 — Why verify AI output even after an excellent prompt?", 363),
  reflect("Reflection 5 — How will you use prompt engineering differently after this module?", 364),
  {
    block_type: "module_completion",
    sort_order: 365,
    content: {
      title: "Congratulations!",
      message:
        "You completed Module 3: Prompt Engineering. You can design with R-T-C-A-C-F and the Prompt Canvas, iterate across modalities, build a personal library, and know when verification beats more prompting.",
      rewards: {
        xp: 200,
        badges: ["prompt-engineer"],
        nextModule: "Module 4: AI Ethics & Responsible AI",
        comingNext:
          "In Module 4, you'll explore responsible decision-making: fairness, privacy, misinformation, deepfakes, copyright, academic integrity, and human oversight.",
      },
    },
  },
]
