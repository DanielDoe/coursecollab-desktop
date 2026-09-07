/**
 * AI Bootcamp Module 2 — Part blocks (I–XXII + closing).
 * Preamble and knowledge check are composed in ai-bootcamp-module-2.ts.
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

const M2 = "/summer-camp/ai-bootcamp"

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
          id: `m2-row-${sort}`,
          columns: columns.map((col, i) => ({
            id: `m2-col-${sort}-${i}`,
            widthFraction: col.widthFraction,
            cells: col.cells.map((cell, j) => ({
              id: `m2-cell-${sort}-${i}-${j}`,
              ...cell,
            })),
          })),
        },
      ],
    },
  }
}

export const AI_BOOTCAMP_MODULE_2_PART_BLOCKS: CurriculumBlock[] = [
  // ── Part I — Welcome to the AI Tool Ecosystem (~10 min) ───────────────────
  text(
    `## Part I — Welcome to the AI Tool Ecosystem

**Estimated time:** ~10 minutes

### Opening Question

> **How many AI tools can you name in 60 seconds?**

Brainstorm with your class or jot ideas here before continuing. Likely answers include ChatGPT, Gemini, Claude, Copilot, Perplexity, Meta AI, NotebookLM, Canva, Midjourney, and GitHub Copilot.

Then ask yourself:

> **Are all of these tools designed to do the same thing?**

**No.** That is the central idea of Module 2.

### Key Concept

There is no single "best AI tool." A better question is:

> **What is the best tool for this particular task?**

An image generator may outperform a chatbot for visuals. A research-focused system may be better when citations matter. A coding assistant may be more useful inside a programming environment. A document-grounded assistant may be preferable when studying course materials.`,
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
            markdown: `### Opening Question

> **How many AI tools can you name in 60 seconds?**

Brainstorm before continuing. Likely answers include ChatGPT, Gemini, Claude, Copilot, Perplexity, Meta AI, NotebookLM, Canva, Midjourney, and GitHub Copilot.

> **Are all of these tools designed to do the same thing?**`,
          },
        ],
      },
      {
        widthFraction: 0.55,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-one-ai-question.png`,
            alt: "Student at a laptop surrounded by many different AI capability icons",
            caption: "AI is much more than one chatbot — many capability types emerge from a single workspace.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  gallery(
    12,
    "Different problems need different tools — there is no single best AI for every task.",
    [
      {
        title: "Different Problems Need Different Tools",
        description:
          "One student choosing among specialized AI capabilities for answering questions, research, PDF analysis, illustration, coding, and data analysis.",
        imageUrl: `${M2}/m2-different-problems.png`,
      },
    ],
  ),
  activity(
    {
      title: "Opening Brainstorm — Name AI Tools",
      prompt: "Which AI tools did you think of in 60 seconds? Select all that apply (or add your own in the reflection later).",
      activityType: "poll",
      multiSelect: true,
      options: [
        "ChatGPT",
        "Google Gemini",
        "Claude",
        "Microsoft Copilot",
        "Perplexity",
        "Canva / image tools",
        "GitHub Copilot / coding tools",
        "Other — I thought of tools not listed",
      ],
      revealMessage:
        "Great start — Module 2 organizes these into **categories** so you can choose intentionally instead of guessing.",
    },
    13,
  ),

  // ── Part II — AI Model vs Tool vs Application (~10 min) ───────────────────
  text(
    `## Part II — AI Model vs AI Tool vs AI Application

**Estimated time:** ~10 minutes

Students frequently use these terms interchangeably. They are not the same.

### AI Model

An **AI model** is the underlying computational system trained to recognize patterns or generate outputs — language models, image models, speech models, multimodal models. Think of the model as the **engine**.

### AI Tool or Application

An **AI application** provides an interface and features that let people use one or more models. Think of the application as the **vehicle built around the engine**.

### Simple Analogy

**Engine** → AI Model → **Car** → AI Application → **Driver** → User → **Destination** → Task

### Important Insight

Two applications may use similar underlying technologies but offer very different interfaces, features, search capabilities, file support, integrations, privacy controls, collaboration features, and output formats.

> **Choosing an AI tool involves more than choosing an AI model.**`,
    20,
  ),
  gallery(
    21,
    "AI Model → AI Application → User → Task · Engine → Vehicle → Driver → Destination",
    [
      {
        title: "Engine–Car–Driver–Destination Analogy",
        description:
          "Four stages: the AI model (engine), the application (vehicle), the user (driver), and the task (destination).",
        imageUrl: `${M2}/m2-engine-analogy.png`,
      },
    ],
  ),
  gallery(
    22,
    "Two applications may share similar underlying AI technologies but offer very different experiences.",
    [
      {
        title: "Same Engine, Different Applications",
        description:
          "One central AI model connected to four visually different applications: conversational assistant, research workspace, coding environment, and document analysis.",
        imageUrl: `${M2}/m2-same-engine-apps.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "matching",
      title: "Model, App, or Role? — Tap to Reveal",
      prompt: "Match each item to the best description.",
      pairs: [
        { task: "GPT-style language model", capability: "AI Model — the engine trained on data" },
        { task: "ChatGPT web app", capability: "AI Application — interface built around models" },
        { task: "You writing a prompt", capability: "User — the driver choosing the destination (task)" },
        { task: "Summarize my lab report", capability: "Task — the destination you want to reach" },
      ],
    },
    23,
  ),

  // ── Part III — What Is Multimodal AI? (~10 min) ───────────────────────────
  text(
    `## Part III — What Is Multimodal AI?

**Estimated time:** ~10 minutes

A multimodal AI system can work with more than one type at once.`,
    30,
  ),
  gallery(
    31,
    "Multimodal AI accepts text, images, audio, video, documents, code, and data — then produces combined understanding.",
    [
      {
        title: "Multimodal AI Hub",
        description:
          "Six information types flow into a central AI system; combined explanation emerges on the other side.",
        imageUrl: `${M2}/m2-multimodal-hub.png`,
      },
    ],
  ),
  text(
    `Earlier AI systems often specialized in one type of information. Modern systems increasingly work across multiple **modalities**:

| Modality | Examples |
| -------- | -------- |
| **Text** | Essays, questions, documents, code |
| **Images** | Photos, diagrams, charts, screenshots |
| **Audio** | Speech, music, environmental sounds |
| **Video** | Moving images and audio |
| **Documents** | PDFs, presentations, spreadsheets |
| **Code** | Programming languages and software projects |

Example: a student uploads a **photograph**, a **PDF**, and a **question** — the AI may examine the photo, read the PDF, understand the question, combine the information, and generate an explanation.

### Classroom Demonstration Idea

Show an image of a plant and ask an assistant:

> Identify the major visible parts of this plant and explain their functions to a ninth-grade biology student.`,
    32,
  ),
  columnGrid(
    33,
    [
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "text",
            markdown: `### Multimodal Student Example

A biology student uploads a **plant photograph**, a **biology PDF**, and a **typed question** into the same AI workspace. The assistant examines the plant, reads the document, combines the information, and returns an organized explanation.

Try it yourself with any course reading plus a related image.`,
          },
        ],
      },
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-multimodal-student.png`,
            alt: "Biology student using multimodal AI with a plant photo, PDF, and question",
            caption: "One workspace — photo, document, and question combined.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  activity(
    {
      title: "Multimodal Scenario",
      prompt:
        "A student uploads a chart screenshot, a PDF worksheet, and asks: \"Which step did I get wrong?\" Which modalities are involved?",
      activityType: "poll",
      multiSelect: true,
      options: ["Text (the question)", "Image (the chart screenshot)", "Document (the PDF)", "Only audio"],
      revealMessage: "Multimodal workflows combine several input types — that is why modern assistants feel more flexible than old single-purpose tools.",
    },
    34,
  ),

  // ── Part IV — The Modern AI Tool Landscape (~15 min) ──────────────────────
  text(
    `## Part IV — The Modern AI Tool Landscape

**Estimated time:** ~15 minutes

Today's ecosystem spans **15 major categories**. You do not need mastery of every platform — you need to know **what exists**, **what each is good for**, and **how to choose**.`,
    40,
  ),
  gallery(
    41,
    "Fifteen capability zones surround a central AI hub — assistants, research, documents, images, video, audio, presentations, coding, data, study, writing, productivity, translation, and agents.",
    [
      {
        title: "Master AI Tool Landscape",
        description:
          "Ecosystem map of modern AI tools organized into fifteen visually distinct capability zones.",
        imageUrl: `${M2}/m2-15-category-landscape.png`,
        bullets: [
          "General AI assistants",
          "Search & research",
          "Document intelligence",
          "Image generation",
          "Video generation",
          "Voice & speech",
          "Music creation",
          "Presentation & design",
          "Coding assistants",
          "Data analysis",
          "Study & education",
          "Writing & communication",
          "Productivity & meetings",
          "Translation & language learning",
          "AI agents & automation",
        ],
      },
    ],
  ),
  text(
    `| # | Category | Example tools | Primary uses |
| - | -------- | ------------- | ------------ |
| 1 | **General-purpose assistants** | ChatGPT, Gemini, Claude, Copilot, Meta AI, Le Chat, DeepSeek, Grok | Q&A, writing, reasoning, coding, files, multimodal chat |
| 2 | **AI search & research** | Perplexity, Elicit, Consensus, Scite | Source discovery, literature, evidence, citations |
| 3 | **Document & knowledge** | NotebookLM, assistant document modes | PDFs, summaries, study guides, Q&A on uploads |
| 4 | **Image generation** | ChatGPT images, Firefly, Midjourney, Ideogram, Leonardo, Canva AI | Illustrations, posters, concept art, diagrams |
| 5 | **Video AI** | Sora, Veo, Runway, Pika, Synthesia, HeyGen | Text/image-to-video, editing, avatars, explainers |
| 6 | **Voice & speech** | ElevenLabs, Descript, Otter.ai, assistant speech | TTS, transcription, narration, meeting notes |
| 7 | **Music AI** | Suno, Udio | Song concepts, background music — discuss copyright |
| 8 | **Presentations & design** | Canva, Gamma, PowerPoint AI, Beautiful.ai | Slides, layout, visual storytelling |
| 9 | **Coding assistants** | GitHub Copilot, Cursor, Replit, Windsurf | Explain, write, debug, test, prototype code |
| 10 | **Data analysis** | Copilot, Gemini, Excel/Power BI AI features | Spreadsheets, charts, patterns, formulas |
| 11 | **Study & education** | NotebookLM, Khanmigo, Quizlet AI, tutor modes | Quizzes, flashcards, guided explanations |
| 12 | **Writing & communication** | Grammarly, Notion AI, assistant writing modes | Grammar, tone, rewriting, professional comms |
| 13 | **Productivity & meetings** | Copilot, Workspace AI, Notion AI, Zoom AI | Summaries, action items, email, workflows |
| 14 | **Translation & language** | Assistant translation features | Translation, practice — important content may need human review |
| 15 | **AI agents & automation** | Emerging agentic workflows | Goal → plan → actions → tools → evaluation → result |

> **AI is evolving from answering questions toward helping complete tasks.**`,
    42,
  ),
  interactive(
    {
      variant: "matching",
      title: "Category Quick Match — Tap to Reveal",
      prompt: "Match each need to the best AI category.",
      pairs: [
        { task: "Find citations for a research paper", capability: "Category 2 — AI search & research" },
        { task: "Generate a poster illustration", capability: "Category 4 — Image generation" },
        { task: "Debug a Python homework script", capability: "Category 9 — Coding assistants" },
        { task: "Summarize uploaded course PDFs", capability: "Category 3 — Document & knowledge AI" },
        { task: "Plan a multi-step project with tool use", capability: "Category 15 — AI agents & automation" },
      ],
    },
    43,
  ),

  // ── Part V — General-Purpose AI Assistants (~15 min) ──────────────────────
  text(
    `## Part V — General-Purpose AI Assistants

**Estimated time:** ~15 minutes

Introduce several major assistants — capabilities matter more than brand loyalty.`,
    50,
  ),
  gallery(
    51,
    "Focus on what a general-purpose assistant can do — not brand loyalty.",
    [
      {
        title: "AI Assistant Capability Wheel",
        description:
          "Conversation, explanation, reasoning, writing, images, documents, research, coding, data, voice, and multimodal understanding.",
        imageUrl: `${M2}/m2-capability-wheel.png`,
      },
    ],
  ),
  text(
    `### ChatGPT
Conversation, explanation, writing, reasoning, images, files, coding, data analysis, research, multimodal interaction.

### Google Gemini
Conversational assistance, multimodal understanding, research, Google ecosystem integration, documents and productivity workflows.

### Claude
Long-form writing, document analysis, reasoning, coding, structured content.

### Microsoft Copilot
AI assistance, search, Microsoft productivity integration (Word, PowerPoint, Excel), Windows and enterprise workflows.

### Others (briefly)
Meta AI, Le Chat, DeepSeek, Grok — tools evolve rapidly. Focus on **capabilities and evaluation**, not loyalty to one brand.`,
    52,
  ),
  gallery(
    53,
    "The same student question may produce visibly different responses across assistants — compare capabilities, not brands.",
    [
      {
        title: "Same Task, Different Assistants",
        description:
          "Four neutral assistant panels show concise, detailed, source-oriented, and productivity-integrated responses to the same prompt.",
        imageUrl: `${M2}/m2-same-task-assistants.png`,
      },
    ],
  ),
  activity(
    {
      title: "Assistant Strengths",
      prompt: "Which task is MOST aligned with exploring a long PDF and structured writing in one session?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "A music generator only",
        "A document-capable assistant (e.g., Claude-style or similar)",
        "A video avatar tool only",
        "A spreadsheet macro with no language model",
      ],
      revealMessage: "Document analysis + long-form writing is a common assistant strength — still verify facts and protect sensitive uploads.",
    },
    54,
  ),

  // ── Part VI — AI Search, Research, and Fact Finding (~15 min) ─────────────
  text(
    `## Part VI — AI Search, Research, and Fact Finding

**Estimated time:** ~15 minutes

### Traditional Search
User searches *causes of coral bleaching* → search engine returns **web pages and links** → the human reads and synthesizes.

### AI-Assisted Search
User asks for major causes **with sources to examine** → AI may search, synthesize, explain, and cite → **you still verify**.`,
    60,
  ),
  gallery(
    61,
    "Traditional search returns links you read manually; AI-assisted research synthesizes sources — but you must still verify.",
    [
      {
        title: "Traditional Search vs AI-Assisted Research",
        description:
          "Left: keyword search and manual reading. Right: detailed question, multi-source synthesis, organized answer with references to verify.",
        imageUrl: `${M2}/m2-search-vs-research.png`,
      },
    ],
  ),
  text(
    `### Research-Focused Tools
- **Perplexity** — AI-assisted discovery and web research
- **Elicit** — literature discovery and analysis
- **Consensus** — research-literature questions
- **Scite** — how citations support or challenge claims
- **NotebookLM** — user-supplied source collections

### Critical Lesson

> **A citation is not proof that a statement is correct.**

Check: Does the source exist? Does it support the claim? Is it credible and current? Is the AI representing it accurately?`,
    62,
  ),
  gallery(
    63,
    "Never skip verification — AI can invent or misrepresent citations.",
    [
      {
        title: "Citation Verification Workflow",
        description:
          "Six stages: AI response with reference → open source → confirm existence → check support → evaluate credibility → mark verified or questionable.",
        imageUrl: `${M2}/m2-citation-verification.png`,
      },
    ],
  ),
  activity(
    {
      title: "Research Verification Checklist",
      prompt: "An AI answer includes three journal links. What should you do before citing them in your paper?",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Open each source and confirm it supports the claim",
        "Check whether sources are real and current",
        "Assume links are correct because they look academic",
        "Compare the AI summary to the original abstract",
      ],
      revealMessage: "Never skip verification — AI can invent or misrepresent citations (hallucinations).",
    },
    64,
  ),

  // ── Part VII — Document AI and Study Tools (~10 min) ──────────────────────
  text(
    `## Part VII — Document AI and Study Tools

**Estimated time:** ~10 minutes

### Document-Grounded Workflow

Upload a short science reading, then try:

1. *Summarize the three most important ideas.*
2. *Create five flashcards.*
3. *Quiz me without giving answers immediately.*
4. *Which section should I review if I misunderstood photosynthesis?*`,
    70,
  ),
  gallery(
    71,
    "One uploaded PDF can branch into summaries, flashcards, quizzes, concept maps, and personalized explanations.",
    [
      {
        title: "One Document, Many Learning Outputs",
        description:
          "A science PDF enters an AI study assistant and branches into multiple learning outputs while the student verifies against the original.",
        imageUrl: `${M2}/m2-one-doc-outputs.png`,
      },
    ],
  ),
  columnGrid(
    72,
    [
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "text",
            markdown: `### Important Principle

AI should **support learning**, not replace it.

- **Good:** "Explain why my answer is wrong."
- **Less useful:** "Give me all the answers so I can submit them."`,
          },
        ],
      },
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-tutor-vs-answer.png`,
            alt: "Split comparison of AI as answer machine versus AI as tutor",
            caption: "Use AI as a tutor for hints and feedback — not as a shortcut around thinking.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  reflect(
    "Document AI Lab (preview) — What is one question you would ask about an uploaded reading to **learn**, not just copy answers?",
    73,
  ),

  // ── Part VIII — AI Image Generation and Design (~15 min) ──────────────────
  text(
    `## Part VIII — AI Image Generation and Design

**Estimated time:** ~15 minutes

**Text Prompt** → **AI Image Model** → **Generated Image**`,
    80,
  ),
  gallery(
    81,
    "Write a prompt → AI image model generates outputs → select and refine for another generation.",
    [
      {
        title: "Text-to-Image Workflow",
        description:
          "Student writes a detailed prompt; polished visual outputs emerge; student selects one result and refines the prompt.",
        imageUrl: `${M2}/m2-text-to-image.png`,
      },
    ],
  ),
  text(
    `### Demonstration Prompt

> Create a friendly educational illustration showing a diverse group of high school students learning robotics in a modern classroom. Flat vector style, bright lighting, white background, presentation quality.

Revise once:

> Make the classroom more futuristic and add an autonomous robot.

### Concepts to Know
Text-to-image · image-to-image · editing · background replacement · style transformation · inpainting · generative expansion

### Discussion

> If AI creates an image, who decides whether it is appropriate to publish?

**The user** — you remain responsible.`,
    82,
  ),
  gallery(
    83,
    "Six panels show text-to-image, transform, background replace, style change, object removal, and generative expansion on the same base scene.",
    [
      {
        title: "Image AI Capabilities",
        description:
          "Same classroom scene demonstrating six different AI image capabilities side by side.",
        imageUrl: `${M2}/m2-image-capabilities.png`,
      },
    ],
  ),
  activity(
    {
      title: "Image AI Responsibility",
      prompt: "Before publishing an AI-generated poster for school, you should check…",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Accuracy of any text in the image",
        "Copyright, consent, and school policies",
        "Whether the image respects classmates and community",
        "Nothing — AI output is always safe to share",
      ],
      revealMessage: "Human approval comes before publish — especially for educational and public audiences.",
    },
    84,
  ),

  // ── Part IX — AI Video, Audio, Voice, and Music (~10 min) ───────────────
  text(
    `## Part IX — AI Video, Audio, Voice, and Music

**Estimated time:** ~10 minutes

Generative AI extends beyond text and images.`,
    90,
  ),
  gallery(
    91,
    "Generative media spans video, speech, transcription, and music — all from text or other inputs.",
    [
      {
        title: "Generative Media Spectrum",
        description:
          "Four panels: text to video, script to narration, voice to transcript, and description to generated music.",
        imageUrl: `${M2}/m2-generative-media.png`,
      },
    ],
  ),
  columnGrid(
    92,
    [
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "text",
            markdown: `| Flow | Example |
| ---- | ------- |
| Text → Video | Short explainers, storyboards animated |
| Image → Video | Still photo becomes motion clip |
| Text → Speech | Narration and voiceovers |
| Voice → Text | Transcription and meeting notes |
| Description → Music | Song concepts and background tracks |

### Important Risks (brief)
Deepfakes · impersonation · misleading media · copyright · consent · voice cloning · synthetic media disclosure

Detailed ethics are explored further in Module 4.`,
          },
        ],
      },
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-synthetic-media.png`,
            alt: "Teenager creating AI media with warning symbols for deepfakes, consent, and responsible disclosure",
            caption: "Create responsibly — disclose synthetic media and respect consent and copyright.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),

  // ── Part X — AI Presentation and Content Creation (~10 min) ─────────────
  text(
    `## Part X — AI Presentation and Content Creation

**Estimated time:** ~10 minutes

**Idea** → AI brainstorm → **Outline** → presentation draft → visual generation → **human editing** → final presentation

Tools may include Canva, Gamma, PowerPoint AI, or general assistants.

> **AI can create a first draft quickly. Humans remain responsible for the final message.**

Check: accuracy · story · design · audience · evidence · accessibility · originality`,
    100,
  ),
  gallery(
    101,
    "Human editing and verification stages are as important as AI brainstorming and draft generation.",
    [
      {
        title: "AI-Assisted Presentation Workflow",
        description:
          "Idea → brainstorm → outline → slide draft → visuals → manual review → fact-check → polished final presentation.",
        imageUrl: `${M2}/m2-presentation-workflow.png`,
      },
    ],
  ),

  // ── Part XI — AI for Coding (~10 min) ─────────────────────────────────────
  text(
    `## Part XI — AI for Coding

**Estimated time:** ~10 minutes

Even without programming experience, understand what coding assistants do.`,
    110,
  ),
  columnGrid(
    111,
    [
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "text",
            markdown: `Try:

> Create a Python program that asks for a student's name and displays a welcome message.

Then:

> Explain every line to a beginner.

The AI suggests code, explains logic, identifies bugs — **you review and test before accepting.**`,
          },
        ],
      },
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-human-ai-coding.png`,
            alt: "Student learning Python with an AI coding assistant in a collaborative workflow",
            caption: "Collaboration — not automatic code generation.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  text(
    `### Golden Rule

> **Never submit or deploy AI-generated code you do not understand.**

AI code may contain bugs, security problems, incorrect assumptions, inefficient logic, or **invented libraries**.`,
    112,
  ),
  gallery(
    113,
    "Understand the logic, test the program, inspect for bugs, and review security before approving AI-generated code.",
    [
      {
        title: "AI Coding Golden Rule",
        description:
          "Four checks before using AI code: understand logic, test, inspect bugs, review security — then approve.",
        imageUrl: `${M2}/m2-coding-golden-rule.png`,
      },
    ],
  ),
  activity(
    {
      title: "Coding AI Safety",
      prompt: "Your AI script runs but you cannot explain the loop. What should you do before submitting?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Submit immediately — if it runs, it is fine",
        "Ask the AI to explain, test edge cases, and only submit what you understand",
        "Remove comments so the instructor cannot tell AI helped",
        "Share your password so the AI can deploy it",
      ],
      revealMessage: "Understanding + testing + security review = professional habit.",
    },
    114,
  ),

  // ── Part XII — AI for Data Analysis (~10 min) ─────────────────────────────
  text(
    `## Part XII — AI for Data Analysis

**Estimated time:** ~10 minutes`,
    120,
  ),
  gallery(
    121,
    "Data → AI → insight → human judgment. AI assists interpretation; critical thinking remains necessary.",
    [
      {
        title: "Data → AI → Insight → Human Judgment",
        description:
          "Student dataset enters AI analysis; patterns and charts emerge; student critically examines what the data supports.",
        imageUrl: `${M2}/m2-data-insight.png`,
      },
    ],
  ),
  text(
    `| Student | Study Hours | Quiz Score |
| ------- | ----------: | ---------: |
| A | 2 | 65 |
| B | 4 | 78 |
| C | 5 | 84 |
| D | 7 | 93 |

Ask AI:

> Describe the pattern in this dataset and recommend an appropriate chart.

Then:

> Create three questions we should investigate before drawing conclusions.

AI can help analyze data — **critical thinking remains necessary.**`,
    122,
  ),
  reflect(
    "Data AI — What is one conclusion you should NOT jump to from a tiny four-row classroom dataset?",
    123,
  ),

  // ── Part XIII — AI Agents (~10 min) ───────────────────────────────────────
  text(
    `## Part XIII — AI Agents: From Answers to Actions

**Estimated time:** ~10 minutes

### Evolution
1. **Generation 1** — AI predicts
2. **Generation 2** — AI generates
3. **Generation 3** — AI reasons across modalities
4. **Emerging** — AI uses tools and completes multi-step workflows

**Chatbot** → primarily converses · **Assistant** → helps perform tasks · **Agent** → may plan and execute steps with tools`,
    130,
  ),
  gallery(
    131,
    "Chatbot: one question, one answer. Assistant: connected tasks through conversation. Agent: goal → plan → tools → completed result under supervision.",
    [
      {
        title: "Chatbot vs Assistant vs Agent",
        description:
          "Three-column progression from single Q&A to multi-task assistance to goal-driven agentic workflows.",
        imageUrl: `${M2}/m2-chatbot-assistant-agent.png`,
      },
    ],
  ),
  text(
    `### Example Goal
*Help me plan a science fair project.*

A basic chatbot suggests ideas. An agent might research topics, compare options, build a schedule, organize resources, create a checklist, and help monitor progress.

You do not build agents in this module — you **recognize the shift**.

### Agentic Workflow

**Goal** → **Plan** → **Actions** → **Tools** → **Evaluation** → **Result**`,
    132,
  ),
  gallery(
    133,
    "Agents loop through planning, tool use, and evaluation until a result is ready for human review.",
    [
      {
        title: "Agentic Workflow",
        description:
          "Goal → plan → actions → external tools → evaluation → completed result, with feedback between evaluation and planning.",
        imageUrl: `${M2}/m2-agentic-workflow.png`,
      },
    ],
  ),

  // ── Part XIV — Choosing the Right AI Tool (~10 min) ─────────────────────
  text(
    `## Part XIV — Choosing the Right AI Tool

**Estimated time:** ~10 minutes

### TASK Framework

| Letter | Question |
| ------ | -------- |
| **T — Task** | What am I trying to accomplish? |
| **A — Audience** | Who will use the result? |
| **S — Sensitivity** | Private, confidential, copyrighted, or high-risk information? |
| **K — Kind of Output** | Text, research, image, video, audio, code, data, presentation, workflow? |`,
    140,
  ),
  gallery(
    141,
    "T — Task · A — Audience · S — Sensitivity · K — Kind of Output",
    [
      {
        title: "TASK Framework",
        description:
          "Four connected cards: task/goal, intended audience, privacy and risk (shield), and required output type icons.",
        imageUrl: `${M2}/m2-task-framework.png`,
      },
    ],
  ),
  text(
    `### AI Tool Selection Matrix

| Task | Useful AI Category |
| ---- | ------------------ |
| Explain a concept | General AI assistant |
| Find research | Research/search AI |
| Analyze assigned sources | Document-grounded AI |
| Create illustration | Image AI |
| Generate video concept | Video AI |
| Narrate a project | Voice AI |
| Create music | Music AI |
| Build slides | Presentation AI |
| Debug Python | Coding assistant |
| Analyze spreadsheet | Data AI |
| Create flashcards | Study AI |
| Improve writing | Writing assistant |
| Multi-step workflow | Agentic AI |`,
    142,
  ),
  gallery(
    143,
    "Start with the result you need — then follow the branch to the right AI tool category.",
    [
      {
        title: "Tool Selection Decision Map",
        description:
          "Decision tree from output type to corresponding neutral AI tool categories.",
        imageUrl: `${M2}/m2-tool-selection-map.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "matching",
      title: "TASK Matrix — Match Task to Category",
      prompt: "Tap each scenario to reveal the best category.",
      pairs: [
        { task: "Explain black holes to a 12-year-old", capability: "General AI assistant" },
        { task: "Verify claims with academic sources", capability: "Research/search AI" },
        { task: "Build slides for a club meeting", capability: "Presentation AI" },
        { task: "Automate research + outline + checklist", capability: "Agentic AI" },
      ],
    },
    144,
  ),

  // ── Part XV — Why Different Tools Give Different Answers (~10 min) ────────
  text(
    `## Part XV — Why Different AI Tools Give Different Answers

**Estimated time:** ~10 minutes

Use the same prompt in two assistants:

> Explain black holes to a 12-year-old using one analogy and fewer than 150 words.

Differences may come from: underlying model · training · system instructions · available context · search access · safety rules · tool capabilities · settings · prompt interpretation`,
    150,
  ),
  gallery(
    151,
    "The same prompt produces different outputs because of model design, context, search, safety rules, and settings.",
    [
      {
        title: "One Prompt, Different Responses",
        description:
          "Identical user prompt entering four neutral AI systems with visibly different output styles.",
        imageUrl: `${M2}/m2-one-prompt-responses.png`,
      },
    ],
  ),

  // ── Part XVI — How to Evaluate AI Outputs (~10 min) ───────────────────────
  text(
    `## Part XVI — How to Evaluate AI Outputs

**Estimated time:** ~10 minutes

### CLEAR Framework

| Letter | Check |
| ------ | ----- |
| **C — Clear** | Can I understand the response? |
| **L — Logical** | Is it organized sensibly? |
| **E — Evidence-aware** | Can important claims be supported or verified? |
| **A — Appropriate** | Does it fit audience, purpose, and situation? |
| **R — Relevant** | Did it actually answer the request? |`,
    160,
  ),
  gallery(
    161,
    "C — Clear · L — Logical · E — Evidence-Aware · A — Appropriate · R — Relevant",
    [
      {
        title: "CLEAR Framework",
        description:
          "Five evaluation lenses around a central AI-generated response: readability, organization, evidence, audience fit, and relevance.",
        imageUrl: `${M2}/m2-clear-framework.png`,
      },
    ],
  ),
  text(
    `### Human Verification Layer

**AI Output** → **Question It** → **Verify Important Claims** → **Revise** → **Human Approval** → **Use**`,
    162,
  ),
  gallery(
    163,
    "Responsible use: AI produces → student questions → verifies claims → revises → approves → uses or submits.",
    [
      {
        title: "Human Verification Layer",
        description:
          "Six-stage pipeline from AI answer through external verification, revision, and final human approval.",
        imageUrl: `${M2}/m2-human-verification.png`,
      },
    ],
  ),
  activity(
    {
      title: "CLEAR Quick Check",
      prompt: "An AI writes a confident paragraph with no sources on a health topic for a school poster. Which CLEAR checks fail first?",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Evidence-aware — claims need verification",
        "Appropriate — health topics may need expert review",
        "Relevant — it answered the prompt so nothing else matters",
        "Clear — easy words mean it must be accurate",
      ],
      revealMessage: "Clear writing ≠ correct writing. Verify before you publish.",
    },
    164,
  ),

  // ── Part XVII — Privacy, Security, and Safe Tool Use (~10 min) ──────────
  text(
    `## Part XVII — Privacy, Security, and Safe Tool Use

**Estimated time:** ~10 minutes

Before entering information, ask:

> **Would I be comfortable sharing this with someone I do not know?**

**Do not casually enter:** passwords · authentication codes · student IDs · financial or medical records · confidential school information · private conversations · someone else's personal information`,
    170,
  ),
  columnGrid(
    171,
    [
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "text",
            markdown: `### Data Classification (enterprise concept)

| Level | Guidance |
| ----- | -------- |
| **Public** | Generally safe for approved public use |
| **Internal** | May require organizational approval |
| **Confidential** | Should not go into unauthorized systems |
| **Restricted/Sensitive** | Requires strict protection |`,
          },
        ],
      },
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-what-not-to-share.png`,
            alt: "Shield stopping sensitive items from entering an AI system",
            caption: "Passwords, IDs, medical records, and private information should not enter AI tools casually.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  gallery(
    172,
    "Public → Internal → Confidential → Restricted/Sensitive — progressively stronger protection.",
    [
      {
        title: "Enterprise Data Classification",
        description:
          "Four tiers from public information to highly restricted sensitive data with increasing security protection.",
        imageUrl: `${M2}/m2-data-classification.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "task_sort",
      title: "Safe to Share or Keep Private?",
      tasks: ["Safe to Share", "Keep Private"],
      examples: [
        { text: "Brainstorming a public science fair topic", task: "Safe to Share" },
        { text: "Your password or MFA code", task: "Keep Private" },
        { text: "Public facts from an open textbook", task: "Safe to Share" },
        { text: "Classmate's private medical information", task: "Keep Private" },
        { text: "Confidential school records", task: "Keep Private" },
        { text: "Generic writing tone feedback (no names)", task: "Safe to Share" },
        { text: "Student ID + home address together", task: "Keep Private" },
        { text: "Ideas for a presentation outline (no secrets)", task: "Safe to Share" },
      ],
    },
    173,
  ),

  // ── Part XVIII — Hands-On AI Tool Exploration Lab (~30–40 min) ────────────
  text(
    `## Part XVIII — Hands-On AI Tool Exploration Lab

**Estimated time:** ~30–40 minutes

Work in **stations** — you do not need every tool on every station.`,
    180,
  ),
  gallery(
    181,
    "Eight activity stations: assistants, research, documents, images, presentations, coding, data, and creative media.",
    [
      {
        title: "AI Tool Lab Stations",
        description:
          "Students rotating through differentiated lab stations with laptops, evaluation sheets, and collaborative learning.",
        imageUrl: `${M2}/m2-ai-tool-lab.png`,
      },
    ],
  ),
  text(
    `| Station | Focus | Task |
| ------- | ----- | ---- |
| **A — Assistant Lab** | Compare two general assistants | Explain renewable energy to a ninth grader with analogy + three examples |
| **B — Research Lab** | Research AI | *How can AI help reduce food waste?* — note findings, sources, claims to verify |
| **C — Document Lab** | Document AI | Upload PDF → summary → flashcards → one question → verify against source |
| **D — Image Lab** | Image AI | Sustainable future city prompt — revise once |
| **E — Presentation Lab** | Slides AI | Outline: *Three Ways Students Can Use AI Responsibly* — evaluate organization |
| **F — Coding Lab** | Coding AI | Simple program + explain input, processing, output |
| **G — Data Lab** | Data AI | Summarize small dataset, patterns, chart idea, limits of conclusions |
| **H — Creative Media Lab** | Video/voice/music | Short approved educational media piece |`,
    182,
  ),
  activity(
    {
      title: "Lab Stations Completed",
      prompt: "Select every station you completed (or reviewed with your instructor).",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Station A — Assistant Lab",
        "Station B — Research Lab",
        "Station C — Document Lab",
        "Station D — Image Lab",
        "Station E — Presentation Lab",
        "Station F — Coding Lab",
        "Station G — Data Lab",
        "Station H — Creative Media Lab",
      ],
      revealMessage: "Complete at least **three stations** for module credit — depth beats rushing through all eight.",
    },
    183,
  ),

  // ── Part XIX — AI Tool Comparison Challenge (~20 min) ───────────────────
  text(
    `## Part XIX — The AI Tool Comparison Challenge

**Estimated time:** ~20 minutes

Use the **same prompt** in at least two assistants:

> Explain photosynthesis to a 10-year-old. Use simple language, one everyday analogy, three short bullet points, and one question to check understanding.

### Compare — rate each response 1–5 on:
Clarity · Accuracy · Relevance · Organization · Audience fit · Instruction following · Need for verification

Then answer:

> Which response is better **for this specific task**, and why?

Do **not** conclude *Tool A is always better.* Conclude *Tool A performed better for this task under these conditions.*`,
    190,
  ),
  gallery(
    191,
    "Evaluate side-by-side responses using clarity, accuracy, relevance, organization, audience fit, and verification — not just picking a winner.",
    [
      {
        title: "Side-by-Side Evaluation",
        description:
          "Student comparing two AI responses on a large screen using criteria cards, checkmarks, and thoughtful rating.",
        imageUrl: `${M2}/m2-side-by-side-eval.png`,
      },
    ],
  ),
  activity(
    {
      title: "Comparison Challenge — Rate Clarity",
      prompt: "After running the shared photosynthesis prompt in two tools, which dimension usually differs MOST between assistants?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "Audience fit and analogy choice",
        "Your Wi-Fi router brand",
        "The font size of your keyboard",
        "The day of the week you logged in",
      ],
      revealMessage: "Audience fit, structure, and verification needs often differ — that is why we compare on purpose.",
    },
    192,
  ),
  reflect("Comparison Challenge — Which tool won for the photosynthesis task, and **why for this task** (not forever)?", 193),
  reflect("Comparison Challenge — Paste or summarize one response bullet you verified or corrected.", 194),

  // ── Part XX — Build Your Personal AI Toolkit (~15 min) ────────────────────
  text(
    `## Part XX — Build Your Personal AI Toolkit

**Estimated time:** ~15 minutes

Create your starter toolkit below. Turn exploration into **decision-making**, not brand collecting.`,
    200,
  ),
  columnGrid(
    201,
    [
      {
        widthFraction: 0.4,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-personal-toolkit.png`,
            alt: "Student assembling a personalized digital AI toolkit",
            caption: "Select tools based on needs — not collect everything.",
            imageWidthPercent: 100,
          },
        ],
      },
      {
        widthFraction: 0.6,
        cells: [
          {
            type: "text",
            markdown: `Fill in your starter toolkit below (reflection prompts follow):

| Category | My choice | What I'd use it for | When I would NOT use it |
| -------- | --------- | ------------------- | ----------------------- |
| Learning & Explanation | | | |
| Research | | | |
| Documents | | | |
| Images | | | |
| Presentations | | | |
| Coding | | | |
| Data | | | |
| Creative Media | | | |
| Productivity | | | |`,
          },
        ],
      },
    ],
  ),
  reflect("My AI Toolkit — Learning & Explanation: tool choice + one use case + one situation to avoid.", 202),
  reflect("My AI Toolkit — Research + Documents: tool choices and when you will verify manually.", 203),
  reflect("My AI Toolkit — Creative (images/media) + Coding or Data: choices and responsible limits.", 204),
  callout(
    "These directories update frequently. Use them to **discover options by category** — not as a substitute for TASK, CLEAR, or your school's approved-tool policy.",
    205,
    "info",
  ),
  text(
    `## Further Resources — Explore the AI Tool Landscape

Bookmark these references when building or updating your personal toolkit:

| Resource | What it offers |
| -------- | -------------- |
| [**Toolkitly Awesome AI Tools**](https://github.com/ToolkitlyAI/awesome-ai-tools) | Open-source, community-maintained list of **650+ AI tools** organized by category (assistants, image, video, coding, research, productivity, and more) |
| [**aixplore AI Tools Directory**](https://aixplore.in/tool_main) | Searchable directory with filters for content type, pricing, and audience (students, researchers, creators, etc.) |
| [**Harvard University AI Tools**](https://www.huit.harvard.edu/ai/tools) | Institutional guide to AI tools — useful model for how universities evaluate and recommend responsible options |
| [**Exploring AI Tools: Types, Applications, Challenges & Future Trends**](https://www.researchgate.net/publication/382760446_Exploring_Ai_Tools_Types_Applications_Challenges_And_Future_Trends) | Academic overview of tool categories, applications, and emerging trends |

> **Reminder:** Listing a tool does not mean it is approved for your school, free, or safe for every task. Always apply **TASK** (especially **Sensitivity**) before signing up or uploading files.`,
    206,
  ),

  // ── Part XXI — Mini Project (~20 min) ─────────────────────────────────────
  text(
    `## Part XXI — Mini Project: One Idea, Multiple AI Tools

**Estimated time:** ~20 minutes

Pick one topic (climate change, space, healthy living, cybersecurity, transportation, robotics, renewable energy, etc.).`,
    210,
  ),
  gallery(
    211,
    "One project idea flows through research AI, conversational AI, and image AI — with the student fact-checking and combining at every stage.",
    [
      {
        title: "One Idea, Multiple AI Tools",
        description:
          "Sustainable transportation project: research → organize → visual → fact-check → edit → polished final project under human control.",
        imageUrl: `${M2}/m2-one-idea-multiple-tools.png`,
      },
    ],
  ),
  text(
    `Use **three different categories**:

1. **Research AI** — gather information
2. **Conversational AI** — create an explanation
3. **Image AI** — supporting visual

Then **you** fact-check, revise, and combine.

### Deliverable checklist
1. Topic · 2. Tools used · 3. Prompts · 4. AI artifacts · 5. What each tool contributed · 6. What you changed manually · 7. What you verified · 8. Final result`,
    212,
  ),
  reflect("Mini Project — Topic and the three AI categories/tools you used.", 213),
  reflect("Mini Project — Paste your three prompts (or summaries).", 214),
  reflect("Mini Project — What did you verify or change manually before submitting?", 215),
  {
    block_type: "checkpoint",
    sort_order: 216,
    content: {
      title: "Optional: Mini Project Artifact Upload",
      description: "Upload one screenshot or file from your mini project (optional).",
      acceptedTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
      maxSizeMb: 8,
    },
  },

  // ── Part XXII — Flashcard Review ──────────────────────────────────────────
  interactive(
    {
      variant: "flashcard_carousel",
      title: "Module 2 — Flashcard Review",
      cards: [
        { id: "model", front: "AI Model", back: "The underlying trained system — the engine behind an application." },
        { id: "tool", front: "AI Tool / Application", back: "The interface and features built around one or more models." },
        { id: "multimodal", front: "Multimodal AI", back: "AI that works across text, images, audio, video, documents, or code." },
        { id: "generative", front: "Generative AI", back: "AI that creates new content — text, images, audio, video, code." },
        { id: "assistant", front: "AI Assistant", back: "Conversational AI for questions, tasks, and explanations." },
        { id: "search", front: "AI Search", back: "Search + synthesis with sources — still requires verification." },
        { id: "docai", front: "Document AI", back: "Upload-grounded Q&A, summaries, and study workflows." },
        { id: "agent", front: "AI Agent", back: "May plan and execute multi-step workflows using tools." },
        { id: "task", front: "TASK Framework", back: "Task · Audience · Sensitivity · Kind of output — for tool selection." },
        { id: "clear", front: "CLEAR Framework", back: "Clear · Logical · Evidence-aware · Appropriate · Relevant." },
        { id: "verify", front: "Verification", back: "Check important claims with trusted sources before use." },
        { id: "hallucination", front: "Hallucination", back: "Confident AI output that is wrong or invented — including fake citations." },
        { id: "oversight", front: "Human Oversight", back: "People remain responsible for approving AI-assisted work." },
      ],
    },
    220,
  ),
  text(
    `## Module Summary

**AI is not one tool — it is an ecosystem.**

Different tools specialize in conversation, research, documents, images, video, audio, presentations, coding, data, learning, productivity, and agents.

The professional skill is knowing **which tool to use, when to use it, how to evaluate its output, and when human judgment must take over.**

### Bridge to Module 3

You now know **what AI tools exist.** Next: **how to communicate effectively with them** — role, task, context, audience, constraints, examples, and output format in **Prompt Engineering**.`,
    230,
  ),
  gallery(
    235,
    "Recap the full Module 2 mental map before the knowledge check — tool categories plus human responsibilities.",
    [
      {
        title: "Module 2 Mental Map",
        description:
          "Central AI concept surrounded by tool categories and an outer layer of human responsibilities: choose, protect, evaluate, verify, and maintain oversight.",
        imageUrl: `${M2}/m2-mental-map.png`,
      },
    ],
  ),

  // ── Part XXIV — Reflection + completion (quiz inserted in composer) ───────
  columnGrid(
    249,
    [
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "text",
            markdown: `## Reflection

Before completing the module, consider:

- Which AI tool category surprised you most?
- Which three tools would be most useful for your education?
- What task should you NOT delegate entirely to AI?
- What will you check before trusting an AI-generated answer?`,
          },
        ],
      },
      {
        widthFraction: 0.5,
        cells: [
          {
            type: "image",
            imageUrl: `${M2}/m2-reflection-explorer.png`,
            alt: "Students confidently facing a landscape of AI capabilities they have explored",
            caption: "Thoughtful users directing technology — not the other way around.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),
  reflect("Reflection 1 — Which AI tool category surprised you most?", 250),
  reflect("Reflection 2 — Which three AI tools would be most useful for your education?", 251),
  reflect("Reflection 3 — What task should you NOT delegate entirely to AI?", 252),
  reflect("Reflection 4 — What will you check before trusting an AI-generated answer?", 253),
  reflect(
    "Reflection 5 — How did using several AI tools change your understanding of Artificial Intelligence?",
    254,
  ),
  gallery(
    255,
    "AI Tool Explorer — achievement unlocked.",
    [
      {
        title: "AI Tool Explorer Badge",
        description: "Congratulations on completing Module 2: Exploring AI Tools.",
        imageUrl: `${M2}/m2-badge-celebration.png`,
      },
    ],
  ),
  {
    block_type: "module_completion",
    sort_order: 256,
    content: {
      title: "Congratulations!",
      message:
        "You completed Module 2: Exploring AI Tools. You mapped the modern AI ecosystem, practiced TASK and CLEAR frameworks, completed lab stations and the comparison challenge, built a personal toolkit, and finished the mini project.",
      rewards: {
        xp: 175,
        badges: ["ai-tool-explorer"],
        nextModule: "Module 3: Prompt Engineering",
        comingNext:
          "In Module 3, you will learn how role, task, context, audience, constraints, examples, and output format dramatically change the quality of AI-generated results.",
      },
    },
  },
]
