/**
 * AI Bootcamp Module 5 — AI Creator Studio parts (merged Module 5+6).
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

const TOOL_IMG = (slug: string) => `/summer-camp/ai-bootcamp/tools/${slug}-homepage.png`
const TUTOR = (folder: string, file: string) =>
  `/summer-camp/ai-bootcamp/tutorials/${folder}/${file}.png`
const M5 = "/summer-camp/ai-bootcamp/assets/module-5"

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
          id: `m5-row-${sort}`,
          columns: columns.map((col, i) => ({
            id: `m5-col-${sort}-${i}`,
            widthFraction: col.widthFraction,
            cells: col.cells.map((cell, j) => ({
              id: `m5-cell-${sort}-${i}-${j}`,
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

function toolSpotlight(
  title: string,
  sort: number,
  slug: string,
  intro: string,
  steps: Array<{ icon: string; title: string; body: string }>,
  footer?: string,
): CurriculumBlock {
  return interactive(
    {
      variant: "numbered_steps",
      title,
      intro,
      layout: "split",
      imageUrl: TOOL_IMG(slug),
      imageCaption: "Official homepage — open only with instructor/school approval.",
      steps,
      footer,
    },
    sort,
  )
}

export const AI_BOOTCAMP_MODULE_5_PART_BLOCKS: CurriculumBlock[] = [
  // ── Part I — From AI User to AI Creator (~10 min) ───────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part I — From AI User to AI Creator",
      subtitle: "~10 minutes · What can you create using AI today?",
      columns: 2,
      cards: [
        {
          icon: "sparkles",
          title: "What You Can Create",
          body: "Essays · images · videos · songs · websites · apps — and more.",
        },
        {
          icon: "wand",
          title: "The Modern AI Creator Uses AI To",
          body: "Think (brainstorm) · Write (scripts) · Design (visuals) · Speak (narration) · Animate (video) · Compose (music) · Build (prototypes) · Publish (multi-platform)",
        },
        {
          icon: "brain",
          title: "You Still Control",
          body: "Purpose, audience, message, style, quality, ethics, and final approval.",
        },
        {
          icon: "lightbulb",
          title: "Core Idea",
          body: "AI does not replace creativity. It expands the creator's toolbox.",
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
            markdown: `### From AI User to AI Creator

AI expands your toolbox — you still control purpose, audience, message, style, quality, ethics, and final approval.

> **Core idea:** AI does not replace creativity. It expands the creator's toolbox.`,
          },
        ],
      },
      {
        widthFraction: 0.55,
        cells: [
          {
            type: "image",
            imageUrl: `${M5}/m5-user-to-creator.png`,
            alt: "Student moving from asking AI questions to directing a full multimedia project",
            caption: "Move from consuming AI outputs to directing and producing creative work.",
            imageWidthPercent: 100,
          },
        ],
      },
    ],
  ),

  // ── Part II — Multimodal Generative AI (~10 min) ─────────────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part II — What Is Multimodal Generative AI?",
      subtitle: "~10 minutes · One idea can travel across every format below.",
      steps: [
        { label: "TEXT", detail: "Scripts, slogans, copy, and briefs" },
        { label: "IMAGE", detail: "Visuals, mascots, illustrations, and graphics" },
        { label: "AUDIO", detail: "Music, narration, voice, and sound design" },
        { label: "VIDEO", detail: "Clips, animations, ads, and motion content" },
        { label: "CODE", detail: "Websites, apps, and interactive prototypes" },
      ],
    },
    20,
  ),
  gallery(
    21,
    "One AI-assisted project can travel across text, image, audio, video, and code — all from a single creative brief.",
    [
      {
        title: "Multimodal Creative Workstation",
        description:
          "A professional desk where one campaign appears as copy, visuals, audio, video timeline, website prototype, and code — human-directed, AI-assisted.",
        imageUrl: `${M5}/m5-multimodal-workstation.png`,
      },
    ],
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Example — Robotics Club Campaign",
      subtitle: "One idea → entire digital campaign.",
      columns: 2,
      cards: [
        { icon: "message", title: "ChatGPT", body: "Slogan and campaign copy" },
        { icon: "wand", title: "Image AI", body: "Club mascot and hero visuals" },
        { icon: "target", title: "Canva", body: "Flyer layout and typography" },
        { icon: "book", title: "Gamma", body: "Presentation slides" },
        { icon: "sparkles", title: "Suno", body: "Background music" },
        { icon: "cpu", title: "ElevenLabs", body: "Narration and voiceover" },
        { icon: "zap", title: "Runway / Pika", body: "Promotional video clips" },
        { icon: "lightbulb", title: "Lovable / Cursor", body: "Landing page or microsite" },
      ],
    },
    22,
  ),

  // ── Part II-B — Creator Tool Studio (visit + practice) ───────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part II-B — Creator Tool Studio Map",
      subtitle: "~25 minutes · Visit each tool homepage with instructor approval, then complete the mini-task before moving on.",
      columns: 3,
      sections: [
        {
          title: "Images",
          icon: "wand",
          body: "ChatGPT · Adobe Firefly · Midjourney · Ideogram · Leonardo · Canva AI",
          accent: "violet",
        },
        {
          title: "Design & Slides",
          icon: "book",
          body: "Canva · Gamma · PowerPoint Copilot · Microsoft Designer",
          accent: "sky",
        },
        {
          title: "Video",
          icon: "zap",
          body: "Runway · Pika · Canva Video · Firefly Video (where available)",
          accent: "emerald",
        },
        {
          title: "Voice & Audio",
          icon: "message",
          body: "ElevenLabs · Descript · Otter.ai · platform TTS",
          accent: "amber",
        },
        {
          title: "Music",
          icon: "sparkles",
          body: "Suno · Udio · stock libraries with AI assist",
          accent: "violet",
        },
        {
          title: "Web & Apps",
          icon: "cpu",
          body: "Lovable · Replit · Cursor · v0 · Bolt",
          accent: "sky",
        },
      ],
      footer:
        "Rule: one brief → one tool → one artifact → evaluate → revise. Screenshot your homepage visit and save prompts + outputs for your portfolio.",
    },
    23,
  ),
  callout(
    "Instructor configures which tools your cohort may use. Free tiers, age limits, and school policies vary — never create accounts without permission.",
    24,
    "warning",
  ),

  // ── Part III — C-R-E-A-T-E (~10 min) ────────────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part III — The AI Creator Workflow: C-R-E-A-T-E",
      subtitle: "Six steps from concept through enhance — plan before you prompt.",
      imageUrl: `${M5}/m5-create-workflow.png`,
      imageCaption: "Concept → requirements → explore → assemble → test → enhance — leave space between stages for labels.",
      columns: 3,
      sections: [
        { title: "C — Concept", icon: "lightbulb", body: "What are you creating?", accent: "violet" },
        { title: "R — Requirements", icon: "target", body: "Who is it for; what must it accomplish?", accent: "sky" },
        { title: "E — Explore", icon: "sparkles", body: "Generate ideas and alternatives.", accent: "emerald" },
        { title: "A — Assemble", icon: "wand", body: "Combine text, visuals, audio, and media.", accent: "amber" },
        {
          title: "T — Test",
          icon: "shield",
          body: "Quality, accuracy, consistency, accessibility, responsible use.",
          accent: "violet",
        },
        { title: "E — Enhance", icon: "zap", body: "Refine and finalize.", accent: "sky" },
      ],
      footer:
        "Also track: Idea → Brief → Prompt → Generate → Evaluate → Refine → Combine → Human Edit → Publish",
    },
    30,
  ),
  interactive(
    {
      variant: "step_order",
      title: "Arrange C-R-E-A-T-E",
      prompt: "Put the creator workflow in order.",
      correctOrder: ["Concept", "Requirements", "Explore", "Assemble", "Test", "Enhance"],
      successMessage: "Concept → Requirements → Explore → Assemble → Test → Enhance",
      retryMessage: "Try: Concept, Requirements, Explore, Assemble, Test, Enhance",
    },
    31,
  ),

  // ── Part IV — Creative Brief (~10 min) ────────────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part IV — Start with a Creative Brief",
      subtitle: "~10 minutes · Plan goal, audience, message, style, and deliverables before prompting.",
      comparisonLabels: { left: "Field", right: "Example (AI Summer Camp Open House)" },
      comparisonRows: [
        { left: "Project", right: "Open house campaign" },
        { left: "Goal", right: "Encourage registration" },
        { left: "Audience", right: "High-school students & parents" },
        { left: "Message", right: "Innovative, welcoming, hands-on AI" },
        { left: "Tone", right: "Exciting, innovative" },
        { left: "Visual style", right: "Modern tech + student creativity" },
        {
          left: "Deliverables",
          right: "Flyer, Instagram post, 20-sec video, landing page",
        },
        { left: "Constraints", right: "School policies, brand colors, deadlines" },
      ],
    },
    40,
  ),
  reflect(
    "Creative Brief — Fill in Project, Goal, Audience, Deliverables, and Constraints for your Creator Studio project.",
    41,
  ),
  gallery(
    42,
    "Plan goal, audience, message, style, and deliverables before you prompt — professionals start with a brief.",
    [
      {
        title: "Creative Brief Session",
        description:
          "Diverse students review mood boards, personas, color swatches, and objectives — like a real advertising team at project kickoff.",
        imageUrl: `${M5}/m5-creative-brief.png`,
      },
    ],
  ),

  // ── Part V — AI Image Generation (~20 min) ────────────────────────────────
  callout(
    "**Start here — practical demo:** Open ChatGPT (or your assigned image tool), paste the prompt below, generate, and save prompt + output for your portfolio. Screenshots walk through every click.",
    485,
    "info",
  ),
  stepTutorial(
    "Walkthrough A — Generate an image in ChatGPT (or any chat-based image tool). Repeat with YOUR event brief.",
    [
      {
        title: "Step 1 — Open ChatGPT",
        description: "Go to chatgpt.com → sign in with school-approved account → start a new chat.",
        imageUrl: TUTOR("chatgpt-image", "01-chatgpt-open"),
        bullets: ["Select a model that supports image generation (instructor will confirm).", "You can also use Gemini, Copilot, or Leonardo — same prompt structure applies."],
      },
      {
        title: "Step 2 — Paste your prompt & generate",
        description:
          "Type or paste a detailed prompt. Example used in this course demo — copy it exactly for your first try, then change ONE variable (lighting, style, or subject) for V2.",
        imageUrl: TUTOR("chatgpt-image", "02-prompt-and-result"),
        bullets: [
          "Prompt: Modern educational illustration — four diverse high-school students exploring AI in a futuristic STEM classroom, holographic visualizations, polished vector-isometric style, clean background, blue/teal accents, bright lighting, no text, 16:9.",
          "Wait for the image → download PNG → filename: prompt-v1.png",
        ],
      },
      {
        title: "Step 3 — Evaluate & iterate",
        description: "Compare output to your creative brief. If the scene is wrong, revise ONE element — do not rewrite everything.",
        imageUrl: TUTOR("chatgpt-image", "03-generated-result"),
        bullets: [
          "Good: subject, diversity, style, no garbled text.",
          "Fix in V2 example: 'make lighting warmer' or 'more isometric, less photoreal'.",
          "Bad fix: vague 'make it better' — always name what changes.",
        ],
      },
    ],
    486,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Part V — AI Image Generation",
      intro: "~20 minutes · Description → Image Model → Generated Image → Evaluation → Revision",
      layout: "horizontal",
      steps: [
        { icon: "target", title: "Subject", body: "Who or what is the focus?" },
        { icon: "wand", title: "Scene", body: "Where and what is happening?" },
        { icon: "book", title: "Composition", body: "Framing, layout, and visual hierarchy." },
        { icon: "sparkles", title: "Style", body: "Vector, photo-real, isometric, cinematic, etc." },
        { icon: "zap", title: "Lighting / Color", body: "Mood, palette, and time of day." },
        { icon: "cpu", title: "Format", body: "Aspect ratio, resolution, no-text rules." },
      ],
      footer:
        "Also consider environment, camera angle, and quality details — e.g. wide-angle, shallow depth of field, cinematic golden hour, ultra detailed.",
      imageUrl: `${M5}/m5-image-generation.png`,
      imageCaption: "Enter a visual concept, compare generated variations critically, and iterate with your sketchbook.",
    },
    49,
  ),
  interactive(
    {
      variant: "topic_deck",
      title: "Weak → Strong Image Prompts",
      subtitle: "Layer subject, place, style, light, camera, and details — then iterate.",
      comparisonLabels: { left: "Level", right: "Prompt" },
      comparisonRows: [
        { left: "Weak", right: "Students learning AI." },
        {
          left: "Strong",
          right:
            "Modern educational illustration — four diverse high-school students exploring AI in a futuristic STEM classroom, holographic visualizations, polished vector-isometric style, clean background, blue/teal accents, bright lighting, no text, 16:9.",
        },
      ],
      footer:
        "Concepts: text-to-image · image-to-image · editing · inpainting/outpainting · style transfer · upscaling. Change one variable at a time and compare versions — professionals rarely stop at one image.",
    },
    50,
  ),
  activity(
    {
      title: "Image prompt upgrade",
      prompt: "Which prompt will produce a clearer result?",
      activityType: "poll",
      multiSelect: false,
      options: [
        "A dog.",
        "Happy golden retriever playing fetch in an autumn park, cinematic lighting, realistic photo, shallow depth of field, vibrant, ultra detailed.",
      ],
      revealMessage: "Layer subject, place, style, light, camera, and details — then iterate.",
    },
    51,
  ),

  toolSpotlight(
    "Tool Spotlight — ChatGPT Images",
    52,
    "chatgpt",
    "Built into ChatGPT: describe → generate → edit in conversation. Best for quick concepts and iteration.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Text-to-image, image editing, style variants, and combining ideas in one chat thread — no separate app required if your school allows ChatGPT.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Mascot concepts, storyboard frames, classroom diagrams, 'make it bluer' revisions, and uploading a sketch to match.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Generate 3 Robotics Club mascot concepts. Pick one. Ask for a 16:9 variant in blue/teal vector style with NO text. Save prompt + final image.",
      },
      {
        icon: "sparkles",
        title: "Sample prompt",
        body: "Friendly robot mascot for a high-school robotics club, waving, vector illustration, clean white background, blue and teal accents, no text, 16:9.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Readable event titles inside the image usually fail — add typography later in Canva.",
      },
    ],
    "Concepts to try: text-to-image · upload sketch → style match · inpainting ('remove background').",
  ),

  toolSpotlight(
    "Tool Spotlight — Adobe Firefly",
    53,
    "firefly",
    "Adobe's generative image/video suite — strong for edits, fills, and commercial-use awareness.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Generate images from text, generative fill/expand, text effects, and (where enabled) video clips — tied to Adobe's Content Credentials approach.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Poster backgrounds, photo composites, replacing backgrounds, and projects where instructors want documented commercial-use training.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Create a FutureTech Innovation Night background (no text). Use generative fill to extend canvas to Instagram portrait. Export and note Content Credentials if shown.",
      },
      {
        icon: "sparkles",
        title: "Sample prompt",
        body: "Futuristic student innovation fair at night, holographic displays, diverse teens collaborating, cinematic lighting, wide 16:9, no words or logos.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Still verify facts in any infographic-style output — Firefly does not guarantee accuracy.",
      },
    ],
  ),

  toolSpotlight(
    "Tool Spotlight — Midjourney",
    54,
    "midjourney",
    "Discord-based image model known for stylized, cinematic visuals — instructor must provision access.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "High-quality text-to-image with strong aesthetic control via prompts and parameters (--ar 16:9, --style raw, etc. on supported plans).",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Hero art, cinematic posters, concept art, mood boards, and brand illustration when you need a distinctive look.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Create one campaign hero image for EcoTrack (food-waste startup). Generate V1 and V2 changing ONLY lighting. Document both prompts.",
      },
      {
        icon: "sparkles",
        title: "Sample prompt",
        body: "Isometric illustration of students scanning cafeteria food waste into smart bins, green and white palette, optimistic, clean, no text --ar 16:9",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Public Discord channels may show others' work — use school-approved private setup when possible.",
      },
    ],
  ),

  toolSpotlight(
    "Tool Spotlight — Ideogram",
    55,
    "ideogram",
    "Image model that handles short text in graphics better than many rivals — still verify spelling.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Text-to-image with improved typography for posters, logos, and social graphics (results vary — always proofread).",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Event titles on graphics, typographic posters, meme-style announcements, and quick social tiles when Canva is not available.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Generate a square post titled 'AI FOR SOCIAL GOOD DAY' — check every letter. If wrong, regenerate or fix text manually in Canva.",
      },
      {
        icon: "sparkles",
        title: "Sample prompt",
        body: "Square social poster, bold headline text 'AI FOR SOCIAL GOOD DAY', modern tech aesthetic, teal and purple, diverse students, clean layout.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "AI text often misspells — never publish without human proofreading.",
      },
    ],
  ),

  toolSpotlight(
    "Tool Spotlight — Leonardo AI",
    56,
    "leonardo",
    "Web studio with models, style presets, and canvas editing — good for iterative visual exploration.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Multiple fine-tuned models, real-time canvas, upscaling, and consistent character/style tools on supported tiers.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Game-style art, consistent character sheets, story scenes, and students who want a dedicated image workspace.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Create 2 story scenes for a 300-word community-tech story: cover + one key moment. Use the same style preset for both.",
      },
      {
        icon: "sparkles",
        title: "Sample prompt",
        body: "Young student presenting a solar-powered community garden app to neighbors, warm sunset, editorial illustration, hopeful mood, no text.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Track which model/preset you used so you can reproduce the look for slide 2–5 of your deck.",
      },
    ],
  ),

  interactive(
    {
      variant: "hands_on_missions",
      title: "Hands-On Lab 1 — Event Flyer (FutureTech Night)",
      subtitle: "~20 minutes · Required deliverable before Part VI.",
      activities: [
        {
          id: "lab1-flyer",
          label: "Lab 1",
          title: "FutureTech Student Innovation Night Flyer",
          icon: "wand",
          accent: "violet",
          duration: "20 min",
          wide: true,
          summary:
            "Combine image AI + Canva (or approved design tool). AI generates visuals; YOU own readable typography.",
          steps: [
            "Write a 5-line creative brief (goal, audience, message, style, deliverable).",
            "In ChatGPT Images, Firefly, or Midjourney — generate BACKGROUND ONLY (no event text in prompt).",
            "Open Canva → custom size flyer → import background → add title, date placeholder, location, CTA manually.",
            "Apply hierarchy: title largest, CTA high contrast, date/location secondary.",
            "Export PNG + check readability on phone screen size.",
            "Save: brief, image prompt, raw AI output, final flyer, 2-sentence AI disclosure.",
          ],
          footer: "Pass criteria: readable text added by human · brand colors · clear CTA · disclosure included.",
        },
      ],
    },
    57,
  ),
  gallery(
    58,
    "Lab 1 — Combine AI-generated visuals with human typography for a readable event flyer.",
    [
      {
        title: "FutureTech Student Innovation Night Flyer Lab",
        description:
          "Students design a technology-event flyer — AI generates backgrounds; humans own readable title, date, location, and CTA.",
        imageUrl: `${M5}/m5-event-flyer-lab.png`,
      },
    ],
  ),

  // ── Part VI — Graphic Design (~10 min) ────────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part VI — Graphic Design with AI",
      subtitle: "~10 minutes · Image generation creates assets; graphic design organizes them into readable layouts.",
      columns: 2,
      cards: [
        { icon: "target", title: "Hierarchy", body: "What viewers notice first — size, weight, and placement guide the eye." },
        { icon: "zap", title: "Contrast", body: "Important elements stand out from the background." },
        { icon: "book", title: "Alignment", body: "Organized layout — grids and consistent spacing." },
        { icon: "wand", title: "Consistency", body: "Unified fonts, colors, and visual language." },
        { icon: "lightbulb", title: "Simplicity", body: "Every element serves a purpose — remove clutter." },
        {
          icon: "message",
          title: "Typography Tip",
          body: "Do not rely on AI-generated images for perfect readable text — add typography manually in Canva, Figma, or PowerPoint.",
        },
      ],
    },
    60,
  ),

  toolSpotlight(
    "Tool Spotlight — Canva AI",
    61,
    "canva",
    "All-in-one design platform: Magic Design, text-to-image, layouts, video, and brand kits — where most flyer/social labs run.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Templates + AI: generate designs from prompts, remove backgrounds, Magic Write for captions, resize for Instagram/LinkedIn/story, and animate posts.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Flyers, Instagram carousels, club announcements, simple videos, brand kits, and combining AI images with real typography.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Magic Design → 'Robotics Club recruitment Instagram carousel' → pick layout → replace placeholder text with YOUR brief → apply brand colors from Part VII.",
      },
      {
        icon: "sparkles",
        title: "Workflow tip",
        body: "Generate/import hero image → Magic Write caption draft → YOU edit tone and facts → Resize to Story + Feed → export both.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Magic Write can invent event dates or stats — replace every placeholder with verified info.",
      },
    ],
    "Pair with Lab 1 & Lab 4 — Canva is the assembly layer after raw image AI.",
  ),

  // ── Part VII — Brand Identity (~15 min) ───────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part VII — AI Logo & Brand Identity",
      subtitle: "~15 minutes · Logo = visual identifier · Brand = full identity and experience.",
      columns: 2,
      cards: [
        {
          icon: "wand",
          title: "Logo",
          body: "The visual mark — icon, wordmark, or combination that identifies you at a glance.",
        },
        {
          icon: "sparkles",
          title: "Brand",
          body: "The full identity system: name, mission, colors, typography, voice, and every touchpoint.",
        },
        { icon: "book", title: "Name & Mission", body: "What you stand for and who you serve." },
        { icon: "target", title: "Logo Concept", body: "Visual direction — not necessarily final art." },
        { icon: "wand", title: "Color Palette", body: "Primary, secondary, and accent colors." },
        { icon: "message", title: "Typography & Tagline", body: "Font direction and memorable phrase." },
        { icon: "sparkles", title: "Visual Style", body: "Photo, illustration, minimal, bold — pick one lane." },
        { icon: "brain", title: "Brand Voice", body: "How you sound in copy — friendly, expert, playful, etc." },
      ],
      footer:
        "AI logos may have trademark conflicts, similarity to existing brands, or text errors — not automatically legally safe commercially. Brand Activity — Pick a fictional startup (study planner, recycling app, event finder, etc.). Use AI for five names, taglines, personality, logo concepts, palette, and a mini brand board.",
    },
    70,
  ),
  reflect("Brand Activity — Startup name, tagline, and 3–5 brand keywords.", 71),
  gallery(
    72,
    "Logo = visual mark · Brand = full identity system — students debate and refine, not just generate.",
    [
      {
        title: "Logo & Brand Identity Studio",
        description:
          "Startup branding workshop with logo sketches, palettes, typography samples, mood boards, and app mockups.",
        imageUrl: `${M5}/m5-brand-identity.png`,
      },
    ],
  ),

  // ── Part VIII — Presentations (~10 min) ───────────────────────────────────
  interactive(
    {
      variant: "comparison_table",
      title: "Part VIII — AI Presentations (~10 min)",
      leftHeader: "Approach",
      rightHeader: "Example",
      rows: [
        { left: "Bad", right: "Generate 30 slides about climate change." },
        {
          left: "Better",
          right:
            "Eight-slide story for Grade 10: problem → three renewable technologies → compare strengths/limitations → discussion question. One key message + recommended visual per slide.",
        },
      ],
    },
    80,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Presentation Workflow",
      intro: "Objective first — then story, structure, and human polish.",
      layout: "horizontal",
      steps: [
        { icon: "target", title: "Objective", body: "What should the audience know or do?" },
        { icon: "book", title: "Story", body: "Problem → insight → evidence → call to action." },
        { icon: "wand", title: "Outline", body: "One key message per slide before generating." },
        { icon: "sparkles", title: "Slides & Visuals", body: "Generate structure; add or refine imagery." },
        { icon: "brain", title: "Human Edit", body: "Fix facts, tone, accessibility, and flow." },
        { icon: "message", title: "Rehearse", body: "Practice delivery — slides support you, not replace you." },
      ],
    },
    81,
  ),

  toolSpotlight(
    "Tool Spotlight — Gamma",
    82,
    "gamma",
    "AI presentation builder: outline → generated slide deck → edit in browser — faster than blank PowerPoint.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Turn a topic or pasted outline into a styled deck with layouts, icons, and images; refine per-slide with AI edit commands.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Pitch decks, lesson recaps, project showcases, and 'first draft in 5 minutes' before human polish.",
      },
      {
        icon: "book",
        title: "Mini-task (15 min) — Lab 2",
        body: "Paste outline: 5 slides on 'How AI Could Improve Our School' (problem, idea, how it works, benefits/risks, recommendation). Generate → fix one factual error → simplify bullet overload on 2 slides.",
      },
      {
        icon: "sparkles",
        title: "Paste this outline starter",
        body: "Slide1 Problem: scheduling chaos. Slide2 Idea: AI assistant for room booking. Slide3 How: students submit requests, AI suggests slots. Slide4 Benefits/risks. Slide5 Recommendation.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Gamma may generate stock-photo people and invented statistics — replace with your school's real context.",
      },
    ],
  ),

  interactive(
    {
      variant: "hands_on_missions",
      title: "Hands-On Lab 2 — Presentation in Minutes",
      subtitle: "~15 minutes · Gamma, Canva Present, or PowerPoint Copilot (instructor choice).",
      activities: [
        {
          id: "lab2-deck",
          label: "Lab 2",
          title: "How AI Could Improve Our School",
          icon: "book",
          accent: "sky",
          duration: "15 min",
          wide: true,
          summary: "Five slides minimum. Human edit required before submit.",
          steps: [
            "List slide titles before opening any tool (do not skip outline).",
            "Generate deck from outline — NOT from 'make 30 slides about AI'.",
            "Slide 1: one-sentence problem. Slide 2: your AI idea. Slide 3: how it works (3 steps max).",
            "Slide 4: two benefits + two risks (balanced). Slide 5: recommendation + discussion question.",
            "Remove paragraphs — max 6 bullets total per slide.",
            "Rehearse 60-second verbal summary; note where slides support you vs. replace thinking.",
          ],
        },
      ],
    },
    83,
  ),
  gallery(
    84,
    "Human editing and storytelling — not one-click slide generation.",
    [
      {
        title: "AI Presentation Creation",
        description:
          "Student reviews AI-assisted slides, edits hierarchy, inserts charts, and selects visuals while a peer provides feedback.",
        imageUrl: `${M5}/m5-presentation.png`,
      },
    ],
  ),

  // ── Part IX — AI Video Creation (~30 min) ─────────────────────────────────
  gallery(
    888,
    "Student production studio — edit timelines, review clips, storyboard, and check color and sound.",
    [
      {
        title: "AI Video Creation",
        description:
          "Diverse HBCU team creating an AI-assisted promotional video with cameras, headphones, editing controllers, and shot boards.",
        imageUrl: `${M5}/m5-video-creation.png`,
      },
    ],
  ),
  callout(
    "**Primary video lab tools for this cohort:** Higgsfield (Create Video + Grok Imagine), Grok Imagine on grok.com, and Nano Banana / Bananai for image→video. Follow the screenshot walkthroughs below — storyboard BEFORE you generate.",
    889,
    "info",
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Part IX — AI Video Creation",
      subtitle: "~30 minutes · Higgsfield · Grok Imagine · Nano Banana · (optional: Runway, Pika)",
      columns: 3,
      cards: [
        { icon: "message", title: "Text-to-Video", body: "Describe a scene; AI generates motion." },
        { icon: "wand", title: "Image-to-Video", body: "Animate a still into a short clip." },
        { icon: "zap", title: "Video-to-Video", body: "Transform style, extend, or edit existing footage." },
      ],
    },
    90,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Video Production Workflow",
      subtitle: "Storyboard before you generate — saves time and improves coherence.",
      steps: [
        { label: "Idea", detail: "Hook, audience, and core message" },
        { label: "Script", detail: "Spoken or on-screen copy" },
        { label: "Storyboard", detail: "Frame-by-frame plan before generation" },
        { label: "Shot List", detail: "Angles, duration, and transitions" },
        { label: "Generate Clips", detail: "AI video segments per shot" },
        { label: "Narration & Music", detail: "Voice, score, and sound design" },
        { label: "Edit & Captions", detail: "Trim, sync, accessibility, export" },
      ],
    },
    91,
  ),
  callout(
    "Storyboard example (recycling app): Problem bins → student scans item → AI identifies bin → waste decreases.",
    92,
    "info",
  ),

  stepTutorial(
    "Walkthrough B — Higgsfield Create Video (text-to-video & image-to-video). Instructor account required.",
    [
      {
        title: "Step 1 — Open Higgsfield",
        description: "Visit higgsfield.ai → sign in (Google) → from the dashboard choose **Create Video**.",
        imageUrl: TUTOR("higgsfield-video", "01-homepage"),
        bullets: ["Credits apply per generation — test at 720p / 5 sec first.", "Browse Community for prompt inspiration."],
      },
      {
        title: "Step 2 — Create Video workspace",
        description: "You will see: model picker (Veo, Kling, Grok, etc.), prompt box, duration, resolution, and optional image upload.",
        imageUrl: TUTOR("higgsfield-video", "02-create-video-ui"),
        bullets: ["Image-to-video: upload your Part V hero still as the visual anchor.", "Text-to-video: write subject + action + setting + camera in 1–3 sentences."],
      },
      {
        title: "Step 3 — Write the shot prompt",
        description: "Use director language: who/what, action, setting, camera move, mood, duration, aspect ratio.",
        imageUrl: TUTOR("higgsfield-video", "05-prompt-filled"),
        bullets: [
          "Example: Slow cinematic push-in — diverse high-school students in a cafeteria scan food items on phones, soft morning light, realistic, 5 seconds, 16:9.",
          "Enable **Prompt Enhance** if available — review before generating.",
        ],
      },
      {
        title: "Step 4 — Pick motion & generate",
        description: "Choose a motion preset (dolly, pan, orbit) or Grok Imagine for fast clips. Generate 2–3 variations; pick the best.",
        imageUrl: TUTOR("higgsfield-video", "03-grok-imagine-page"),
        bullets: ["Download MP4 → name: scene1-higgsfield-v1.mp4", "If faces distort, switch to illustrated source image from Part V."],
      },
      {
        title: "Step 5 — Learn the workflow (Academy)",
        description: "Higgsfield Academy documents model choice, 720p testing, and image prep — read before burning credits on 1080p.",
        imageUrl: TUTOR("higgsfield-video", "04-academy-guide"),
        bullets: ["Change one variable per retry: motion, prompt, or model — not all three.", "Stitch 3–4 clips in CapCut/Canva for a 20–30 sec ad."],
      },
    ],
    925,
  ),

  stepTutorial(
    "Walkthrough C — Grok Imagine (xAI) — text or image to video with synced audio on supported plans.",
    [
      {
        title: "Step 1 — Open Grok Imagine",
        description: "Visit grok.com/imagine (or Grok Imagine inside Higgsfield) → sign in with approved account.",
        imageUrl: TUTOR("grok-imagine", "01-imagine-landing"),
        bullets: ["Modes may include Normal / Fun — pick Normal for school projects.", "Set aspect ratio (16:9 feed vs 9:16 Reels) before generating."],
      },
      {
        title: "Step 2 — Image-to-video",
        description: "Upload your EcoTrack or Robotics Club still → describe MOTION only (not the whole scene again).",
        imageUrl: TUTOR("grok-imagine", "02-capabilities-overview"),
        bullets: [
          "Motion prompt example: Slow push-in as students walk past recycling bins, gentle camera drift, 8 seconds.",
          "Grok Imagine Video 1.5 supports configurable duration and up to 1080p on paid tiers.",
        ],
      },
      {
        title: "Step 3 — Export & disclose",
        description: "Download clip → add to Lab 3 timeline → label synthetic video in portfolio disclosure.",
        imageUrl: TUTOR("higgsfield-video", "03-grok-imagine-page"),
        bullets: ["Never impersonate real people or fabricate news footage.", "Pair with ElevenLabs narration or Grok native audio — pick one, don't double-stack music."],
      },
    ],
    926,
  ),

  stepTutorial(
    "Walkthrough D — Nano Banana (Google Gemini image) + Bananai image→video pipeline.",
    [
      {
        title: "Step 1 — Nano Banana / Bananai hub",
        description: "Nano Banana is Google's Gemini image model family. Bananai.io combines Nano Banana image tools with video models in one workspace.",
        imageUrl: TUTOR("nano-banana", "01-bananai-home"),
        bullets: ["In Gemini app: Create images → Thinking model = Nano Banana Pro quality.", "Free quotas vary — instructor confirms your tier."],
      },
      {
        title: "Step 2 — Generate or edit an image",
        description: "Text-to-image or upload a photo → prompt edit ('change background to school cafeteria, keep character').",
        imageUrl: TUTOR("nano-banana", "02-image-workspace"),
        bullets: ["Strong at character consistency across edits — reuse same base photo for slide 2–4.", "Proofread any text Nano Banana renders — spelling errors are common."],
      },
      {
        title: "Step 3 — Animate to video",
        description: "Switch to video workspace → image-to-video → pick model (Veo, Kling, Wan, etc. on Bananai) → describe camera motion.",
        imageUrl: TUTOR("nano-banana", "03-video-workspace"),
        bullets: ["Pipeline: still frame storyboard → Nano Banana polish → image-to-video → edit in CapCut.", "Duration often 5–15 sec per clip — plan a multi-clip storyboard."],
      },
      {
        title: "Step 4 — Nano Banana editor (alternative UI)",
        description: "nanobanana.io offers prompt-based editing with in-context generation — good for cover + scene pairs.",
        imageUrl: TUTOR("nano-banana", "04-nanobanana-io"),
        bullets: ["Mini-task: cover image + one story scene, same character style.", "Save before/after edits for Part XIX version history."],
      },
    ],
    927,
  ),

  toolSpotlight(
    93,
    "runway",
    "Professional-grade Gen-4 video: text/image-to-video, lip sync, and editing — use for Lab 3 clips.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Generate short clips from text or still images, extend shots, and apply video-to-video styles on supported plans.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "15–30 sec promo hooks, animating a mascot still, B-roll for school projects, and storyboarded scenes (not random one-offs).",
      },
      {
        icon: "book",
        title: "Mini-task — Lab 3 clip A",
        body: "From your storyboard Scene 1 (problem): 5-sec clip, 16:9, no logos. Prompt: overflowing recycling bins in school hallway, handheld camera feel, concerned mood.",
      },
      {
        icon: "sparkles",
        title: "Image-to-video tip",
        body: "Export your EcoTrack hero still from Part V → upload to Runway → 'slow push-in, students walk past' → 5 seconds.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Faces and school logos may distort — use generic settings or illustrated assets when policy requires.",
      },
    ],
  ),

  toolSpotlight(
    "Tool Spotlight — Pika",
    94,
    "pika",
    "Fast text/image-to-video with playful effects — good for social-first vertical clips.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Quick video generations, scene morphs, and short vertical clips from prompts or reference images.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "TikTok/Reels-style hooks, animating posters, and rapid A/B tests of opening shots.",
      },
      {
        icon: "book",
        title: "Mini-task — Lab 3 clip B",
        body: "Generate a 9:16 hook (0–3 sec): phone notification 'EcoTrack' → student smiles → text overlay YOU add in CapCut/Canva (not in AI).",
      },
      {
        icon: "sparkles",
        title: "Sample prompt",
        body: "Vertical video, smartphone screen glowing green, student in cafeteria, optimistic lighting, 3 seconds, cinematic.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Combine 2–3 short clips in an editor — single prompts rarely produce a full 30-sec ad.",
      },
    ],
  ),

  interactive(
    {
      variant: "hands_on_missions",
      title: "Hands-On Lab 3 — Promotional Video",
      subtitle: "~25 minutes · 15–30 sec ad for your fictional startup.",
      activities: [
        {
          id: "lab3-video",
          label: "Lab 3",
          title: "Startup Promo (Runway + Pika + editor)",
          icon: "zap",
          accent: "amber",
          duration: "25 min",
          wide: true,
          summary: "Hook · problem · solution · brand · CTA — storyboard BEFORE generate.",
          steps: [
            "Script 4 beats on paper (0–5s hook, 5–12 problem, 12–22 solution, 22–30 CTA).",
            "Storyboard 4 frames — use Part V stills as source images.",
            "Higgsfield Create Video OR Grok Imagine: generate clip 1 (5 sec, 720p test).",
            "Nano Banana/Bananai OR Higgsfield: image-to-video for clips 2–3 from storyboard stills.",
            "Import to CapCut or Canva Video — trim to 30 sec, add captions + CTA text manually.",
            "Add ElevenLabs voice + Suno bed (Parts X–XI). Export MP4 + disclosure.",
          ],
        },
      ],
    },
    95,
  ),

  // ── Part X — Audio & Voice (~10 min) ──────────────────────────────────────
  interactive(
    {
      variant: "concept_cards",
      title: "Part X — AI Audio & Voice",
      subtitle: "~10 minutes · Text-to-speech · speech-to-text · narration · podcasts",
      cards: [
        {
          icon: "message",
          title: "Creation Tools",
          body: "Generate narration, transcribe interviews, dub clips, and prototype podcast segments.",
        },
        {
          icon: "shield",
          title: "Responsible Voice Use",
          body: "Never clone voices without authorization. Discuss consent, impersonation, fraud, deepfakes, and disclosure (Module 4).",
        },
      ],
    },
    100,
  ),
  callout(
    "Compare human voice vs synthetic for your project — which is appropriate and why?",
    101,
    "tip",
  ),
  gallery(
    103,
    "Professional but accessible — narration, waveforms, and studio headphones in a student media lab.",
    [
      {
        title: "AI Voice & Audio Studio",
        description:
          "Black student records narration while teammates edit waveforms and listen through studio headphones.",
        imageUrl: `${M5}/m5-voice-studio.png`,
      },
    ],
  ),

  toolSpotlight(
    "Tool Spotlight — ElevenLabs",
    102,
    "elevenlabs",
    "Industry-leading text-to-speech: narration, voice design, dubbing — use responsibly (Module 4).",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Turn scripts into natural speech, clone-voice workflows (restricted), multilingual dubbing, and sound effects on supported tiers.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "30-sec promo voiceover, podcast intros, accessibility narration, and drafting timing before recording your own voice.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Write 30-sec narration for Lab 3. Generate with a neutral preset voice. Record yourself reading the same script. Compare clarity, emotion, and trust.",
      },
      {
        icon: "sparkles",
        title: "Sample script",
        body: "Every day, our cafeteria throws away hundreds of pounds of food. EcoTrack helps students scan items and pick the right bin — less waste, smarter schools. Join us.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Never clone a real person's voice without written consent. Label synthetic audio in your portfolio.",
      },
    ],
  ),

  // ── Part XI — Music (~10 min) ─────────────────────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part XI — AI Music & Sound",
      subtitle: "~10 minutes · Prompt with genre, mood, tempo, instruments, energy, purpose, and duration.",
      columns: 3,
      sections: [
        { title: "Genre", icon: "sparkles", body: "Electronic, orchestral, hip-hop, ambient, etc.", accent: "violet" },
        { title: "Mood & Tempo", icon: "zap", body: "Upbeat, calm, tense — BPM and energy level.", accent: "sky" },
        { title: "Instruments", icon: "wand", body: "Synths, drums, piano — specify what you want heard.", accent: "emerald" },
        { title: "Purpose", icon: "target", body: "Intro sting, background bed, full theme.", accent: "amber" },
        { title: "Duration", icon: "book", body: "15 sec ad vs 3 min track — state length upfront.", accent: "violet" },
        { title: "Vocals", icon: "message", body: "Instrumental only, or lyrics — and language if sung.", accent: "sky" },
      ],
      footer:
        "Example: Upbeat 20-second instrumental for high-school tech event — modern electronic, optimistic, clean synths, moderate tempo, no vocals. Discuss: Should AI imitate a living artist exactly? (copyright, identity, attribution)",
    },
    110,
  ),
  gallery(
    112,
    "Experiment with genre, mood, tempo, and purpose — AI music supports your edit, not replaces your judgment.",
    [
      {
        title: "AI Music Creation Studio",
        description:
          "Students compare AI-generated background music variations using headphones, DAW controls, and MIDI keyboard.",
        imageUrl: `${M5}/m5-music-studio.png`,
      },
    ],
  ),

  toolSpotlight(
    "Tool Spotlight — Suno",
    111,
    "suno",
    "Text-to-music: full songs or instrumentals from prompts — pair with Lab 3 video bed.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Describe genre, mood, and lyrics (or instrumental) → Suno generates audio tracks you can download and trim.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "20-sec event stings, background beds under narration, and prototyping theme music before licensing stock audio.",
      },
      {
        icon: "book",
        title: "Mini-task (10 min)",
        body: "Generate a 20-sec instrumental for your Lab 3 promo: 'upbeat modern electronic, optimistic, no vocals, 110 BPM'. Import under voiceover; duck volume when narrator speaks.",
      },
      {
        icon: "sparkles",
        title: "Sample prompt",
        body: "20 second instrumental, modern electronic, clean synths, optimistic energy, tech event vibe, no vocals, moderate tempo.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Do not prompt 'in the style of [living artist]'. Check platform terms before publishing commercially.",
      },
    ],
  ),

  // ── Part XII — Storytelling (~10 min) ─────────────────────────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part XII — AI Storytelling",
      subtitle: "~10 minutes · AI should expand imagination — not make every creative decision for you.",
      steps: [
        { label: "Character", detail: "Who drives the story?" },
        { label: "Goal", detail: "What do they want to achieve?" },
        { label: "Conflict", detail: "What stands in the way?" },
        { label: "Journey", detail: "Attempts, setbacks, and discoveries" },
        { label: "Resolution", detail: "Outcome — change, lesson, or call to action" },
      ],
    },
    120,
  ),
  callout(
    "Mini activity: 300-word story about a student solving a community problem with technology + cover image + one illustrated scene.",
    121,
    "info",
  ),
  gallery(
    122,
    "AI supports imagination — students remain the storytellers.",
    [
      {
        title: "Storytelling With AI",
        description:
          "Writing, character concepts, and AI-generated scene illustrations in one collaborative storytelling session.",
        imageUrl: `${M5}/m5-storytelling.png`,
      },
    ],
  ),

  // ── Part XIII — Social Media (~10 min) ────────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XIII — Social Media Content",
      subtitle: "~10 minutes · Treat posts as a campaign system — not one-off graphics.",
      columns: 2,
      cards: [
        { icon: "target", title: "Goal", body: "Awareness, sign-ups, engagement, or education." },
        { icon: "brain", title: "Audience", body: "Who scrolls this feed and what do they care about?" },
        { icon: "message", title: "Message", body: "One clear idea per post or carousel." },
        { icon: "wand", title: "Platforms", body: "Instagram, TikTok, LinkedIn — format per channel." },
        { icon: "sparkles", title: "Content Mix", body: "Image post · carousel · short video · story · caption · poll · announcement graphic." },
        { icon: "zap", title: "Call to Action", body: "Register, learn more, share, or tag a friend." },
      ],
    },
    130,
  ),

  interactive(
    {
      variant: "hands_on_missions",
      title: "Hands-On Lab 4 — Social Campaign (AI for Social Good Day)",
      subtitle: "~20 minutes · Three posts, one brand system — Canva + Ideogram optional.",
      activities: [
        {
          id: "lab4-social",
          label: "Lab 4",
          title: "3-Post Campaign",
          icon: "message",
          accent: "emerald",
          duration: "20 min",
          wide: true,
          summary: "Announcement → educational → CTA. Same colors, fonts, and tone on all three.",
          steps: [
            "Define style guide mini-sheet: 2 hex colors, 1 font pair, 3 tone words (from Part XVIII).",
            "Post 1 — Announcement: date placeholder, event name, hero visual (AI image + manual text).",
            "Post 2 — Educational: one stat YOU verify or label [source needed] + infographic layout.",
            "Post 3 — CTA: 'Register / Learn more / Share' with link placeholder.",
            "Export feed (1080×1080) and story (1080×1920) for Post 1.",
            "Write caption for each post (Magic Write draft OK — human edit required).",
          ],
          footer: "Submit: 3 PNGs + style guide screenshot + captions + disclosure.",
        },
      ],
    },
    131,
  ),
  gallery(
    132,
    "Goal → Audience → Message → Platforms → Content → CTA — treat posts as a coordinated campaign.",
    [
      {
        title: "Social Media Campaign Studio",
        description:
          "Student marketing team reviews post layouts, video thumbnails, color palettes, and campaign sequencing across devices.",
        imageUrl: `${M5}/m5-social-campaign.png`,
      },
    ],
  ),

  // ── Part XIV — Marketing (~10 min) ────────────────────────────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part XIV — AI Marketing Materials",
      subtitle: "~10 minutes · Move audiences through Attention → Interest → Value → Action.",
      steps: [
        { label: "Attention", detail: "Hook — visual, headline, or pattern interrupt" },
        { label: "Interest", detail: "Problem or opportunity they recognize" },
        { label: "Value", detail: "Benefits, proof, and differentiation" },
        { label: "Action", detail: "Clear next step — sign up, buy, donate, share" },
      ],
    },
    140,
  ),
  callout(
    "Avoid: fake testimonials · false claims · manipulative deepfakes · invented statistics · misleading before/after · hidden sponsorship.",
    141,
    "warning",
  ),

  // ── Part XV — AI Web Application Creation (~30 min) ─────────────────────
  gallery(
    146,
    "Build responsive landing pages with AI assistance — then refine layout and usability on desktop and mobile.",
    [
      {
        title: "AI Website Generation",
        description:
          "Students build a landing page prototype with AI assistance, refining desktop and mobile layouts together.",
        imageUrl: `${M5}/m5-website-generation.png`,
      },
    ],
  ),
  callout(
    "**Web apps ≠ websites only.** AI app builders turn natural language into working interfaces + code: landing pages, dashboards, and clickable prototypes. You do NOT need to memorize syntax — you DO need to test every button and fix AI mistakes.",
    147,
    "info",
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Part XV — AI Web & App Builders",
      subtitle: "~30 minutes · Lovable · v0 · Bolt · Replit · Cursor — pick 1–2 with instructor",
      columns: 2,
      cards: [
        { icon: "cpu", title: "Lovable", body: "Full React sites from prompts — deployable URLs fast (Lab 5 default)." },
        { icon: "wand", title: "v0 (Vercel)", body: "Component-level UI generation — great for polished sections & dashboards." },
        { icon: "zap", title: "Bolt.new", body: "Instant full-stack sandbox — describe app → edit live in browser." },
        { icon: "book", title: "Replit Agent", body: "Hosted apps + AI agent — Homework Planner prototype (Part XVI)." },
        { icon: "sparkles", title: "Cursor", body: "AI inside a code editor — iterate when you outgrow no-code builders." },
        { icon: "target", title: "Your job", body: "Prompt → generate → click every flow → list bugs → re-prompt fixes → re-test." },
      ],
    },
    148,
  ),
  stepTutorial(
    "Walkthrough E — Build a web app with AI (Lovable → v0 → Bolt). Complete Lab 5 EcoTrack OR Part XVI Homework Planner.",
    [
      {
        title: "Step 1 — Lovable: describe the whole app",
        description: "lovable.dev → sign in → paste a structured prompt covering pages, sections, colors, and mobile layout.",
        imageUrl: TUTOR("web-apps", "01-lovable-home"),
        bullets: [
          "EcoTrack prompt: Landing page for EcoTrack — schools reduce cafeteria food waste. Hero headline, problem paragraph, 3 feature cards, impact section with [placeholder] stats, email signup CTA, green/white palette, mobile-first.",
          "Wait for generation → open Preview on phone width.",
        ],
      },
      {
        title: "Step 2 — v0: refine UI components",
        description: "v0.dev → describe ONE section at a time (hero, feature grid, pricing) → copy code or export to your stack.",
        imageUrl: TUTOR("web-apps", "07-v0-interface"),
        bullets: ["Example: 'Hero for EcoTrack with illustration placeholder, green CTA button, accessible contrast.'", "Use v0 when Lovable layout is close but one section needs polish."],
      },
      {
        title: "Step 3 — Bolt.new: full app in the browser",
        description: "bolt.new → describe interactive app → AI scaffolds React + runs in sandbox.",
        imageUrl: TUTOR("web-apps", "08-bolt-prompt-filled"),
        bullets: [
          "Homework Planner prompt: Add assignment with title + due date, sort list by date, mark complete, mobile UI, local state only.",
          "Click Add → verify item appears → mark complete → screenshot proof.",
        ],
      },
      {
        title: "Step 4 — Replit Agent (alternative)",
        description: "replit.com → Create Repl → ask Agent to build same Homework Planner → test in preview pane.",
        imageUrl: TUTOR("web-apps", "02-replit-home"),
        bullets: ["Ask: 'Explain which file holds the assignment list' — build literacy, not just clicks.", "Deploy only with instructor permission."],
      },
      {
        title: "Step 5 — Evaluate like a user",
        description: "Run C-R-E-A-T-O-R + mobile test before submitting URL.",
        imageUrl: TUTOR("web-apps", "03-v0-home"),
        bullets: [
          "Can you complete signup CTA flow in 10 seconds?",
          "Replace fake stats with [verify] placeholders.",
          "Submit: URL + mobile screenshot + list of 3 fixes you requested in follow-up prompts.",
        ],
      },
    ],
    149,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Part XV — Landing Page Structure",
      intro: "Every AI web builder prompt should include these sections — copy into Lovable/Bolt/Replit.",
      layout: "horizontal",
      steps: [
        { icon: "sparkles", title: "Hero", body: "Headline, subhead, and primary CTA above the fold." },
        { icon: "target", title: "Problem", body: "Pain point your audience recognizes." },
        { icon: "wand", title: "Solution", body: "How your product or event helps." },
        { icon: "book", title: "Features", body: "Three to five proof points or benefits." },
        { icon: "zap", title: "CTA", body: "Register, download, or contact — repeat strategically." },
        { icon: "message", title: "Footer", body: "Links, policies, contact, and social proof." },
      ],
    },
    150,
  ),

  toolSpotlight(
    "Tool Spotlight — Lovable",
    151,
    "lovable",
    "Natural-language → working React landing pages — fastest path to clickable EcoTrack demo.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Describe a site in plain English; Lovable generates UI, sections, and deployable code you can iterate in chat.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Startup landing pages, hackathon demos, and Lab 5 when students need a real URL in under 30 minutes.",
      },
      {
        icon: "book",
        title: "Mini-task — Lab 5",
        body: "Prompt: 'Landing page for EcoTrack — schools reduce food waste. Hero, problem, 3 features, impact stats placeholders, email signup CTA, mobile-first, green palette.' Review on phone.",
      },
      {
        icon: "sparkles",
        title: "Evaluation checklist",
        body: "Can you find the CTA in 5 sec? Is contrast sufficient? Are stats marked as placeholders? Would a screen reader get headings in order?",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "Replace invented statistics. Do not collect real emails without school privacy approval.",
      },
    ],
  ),

  toolSpotlight(
    "Tool Spotlight — Replit",
    152,
    "replit",
    "Browser IDE + AI Agent: prototype apps, landing pages, and simple tools without local setup.",
    [
      {
        icon: "target",
        title: "What it does",
        body: "Build and host small web apps, use Replit AI to explain/edit code, and share live links for classroom demos.",
      },
      {
        icon: "wand",
        title: "Best for",
        body: "Homework Planner prototype (Part XVI), interactive demos, and students who want to peek under the hood of generated sites.",
      },
      {
        icon: "book",
        title: "Mini-task (15 min)",
        body: "Create Repl 'Homework Planner' — three screens: add assignment, list by due date, mark complete. Use AI to draft HTML/CSS; YOU test all three clicks.",
      },
      {
        icon: "sparkles",
        title: "Starter prompt",
        body: "Simple homework planner web app for high school students: add assignment with title and due date, sort by date, mark complete, mobile-friendly, no backend.",
      },
      {
        icon: "shield",
        title: "Watch out",
        body: "AI-generated code may have bugs — testing is part of the assignment, not optional.",
      },
    ],
  ),

  interactive(
    {
      variant: "hands_on_missions",
      title: "Hands-On Lab 5 — EcoTrack Landing Page",
      subtitle: "~20 minutes · Lovable, Replit, or instructor-approved builder.",
      activities: [
        {
          id: "lab5-web",
          label: "Lab 5",
          title: "EcoTrack Landing Page",
          icon: "cpu",
          accent: "violet",
          duration: "20 min",
          wide: true,
          summary: "Hero → problem → features → impact → CTA — evaluate like a real user.",
          steps: [
            "Paste creative brief from Part IV (adapt for EcoTrack food-waste angle).",
            "Generate first draft in Lovable or Replit AI — do not publish yet.",
            "Mobile test: screenshot hero + CTA above the fold.",
            "Fix one accessibility issue (heading order, contrast, or alt text).",
            "Replace any fake statistics with '[placeholder — verify]' labels.",
            "Submit URL + 3-bullet evaluation: layout, message, accessibility.",
          ],
        },
      ],
    },
    153,
  ),

  // ── Part XVI — App Prototyping (~10 min) ────────────────────────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part XVI — AI App Prototyping",
      subtitle: "~10 minutes · Example: Homework Planner — assignments, due dates, priorities, reminders, progress.",
      steps: [
        { label: "Idea", detail: "Core user problem and one-sentence pitch" },
        { label: "Requirements", detail: "Features list — AI helps brainstorm and prioritize" },
        { label: "Interface", detail: "Wireframe screens and navigation flow" },
        { label: "Prototype", detail: "Clickable mock or working demo" },
        { label: "Test", detail: "Real users try core tasks" },
        { label: "Improve", detail: "Iterate on feedback — AI assists copy and layout" },
      ],
    },
    160,
  ),
  gallery(
    161,
    "Idea → requirements → wireframes → prototype → test → improve — AI assists at every stage.",
    [
      {
        title: "AI App Prototyping Lab",
        description:
          "Team builds a homework-planner prototype with wireframes, feature cards, dashboard, and mobile version.",
        imageUrl: `${M5}/m5-app-prototyping.png`,
      },
    ],
  ),

  // ── Part XVII — Human-Centered Design (~10 min) ───────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part XVII — Human-Centered AI Design",
      subtitle: "~10 minutes · Evaluate every creative output against five criteria.",
      imageUrl: `${M5}/m5-human-centered-design.png`,
      imageCaption: "Real user testing — usefulness, usability, accessibility, trust, and responsible design.",
      columns: 3,
      sections: [
        { title: "Useful", icon: "target", body: "Does it solve a real need for real people?", accent: "violet" },
        { title: "Usable", icon: "wand", body: "Can the audience understand and navigate it?", accent: "sky" },
        { title: "Accessible", icon: "shield", body: "Captions, contrast, alt text, readable fonts.", accent: "emerald" },
        { title: "Trustworthy", icon: "book", body: "Accurate claims, clear sources, no deception.", accent: "amber" },
        { title: "Responsible", icon: "brain", body: "Ethics, consent, disclosure, and human review.", accent: "violet" },
      ],
    },
    170,
  ),

  // ── Part XVIII — Creative Consistency (~10 min) ───────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XVIII — Creative Consistency",
      subtitle: "~10 minutes · Define before multi-asset generation — then reuse in every prompt.",
      columns: 2,
      cards: [
        { icon: "wand", title: "Primary / Secondary Colors", body: "Hex codes or named palette — same in every asset." },
        { icon: "book", title: "Fonts", body: "Heading and body typefaces — do not swap mid-campaign." },
        { icon: "target", title: "Logo", body: "Placement rules and clear-space guidelines." },
        { icon: "sparkles", title: "Image Style", body: "Photo, flat vector, 3D — one visual lane." },
        { icon: "message", title: "Tone", body: "Voice keywords for copy and captions." },
        { icon: "cpu", title: "Icon Style", body: "Line weight, fill, and corner radius — match everywhere." },
      ],
    },
    180,
  ),
  gallery(
    181,
    "Define colors, fonts, logo rules, image style, tone, and icons before multi-asset generation.",
    [
      {
        title: "Creative Consistency Review",
        description:
          "Same campaign expressed consistently across poster, social post, video frame, slide, website, and mobile app.",
        imageUrl: `${M5}/m5-creative-consistency.png`,
      },
    ],
  ),

  // ── Part XIX — Iterative Creation (~10 min) ───────────────────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part XIX — Iterative Creation",
      subtitle: "~10 minutes · Professionals keep versions and explain what improved.",
      steps: [
        { label: "Generate", detail: "First prompt and first output" },
        { label: "Review & Critique", detail: "What works; what fails the brief?" },
        { label: "Revise Prompt", detail: "Change one variable at a time" },
        { label: "Regenerate / Edit", detail: "New output or manual polish" },
        { label: "Compare & Select", detail: "Side-by-side evaluation" },
        { label: "Polish", detail: "Final human edit before publish" },
      ],
    },
    190,
  ),
  callout(
    "Keep Prompt V1 / Output V1 / Prompt V2 / Output V2 / Final — and explain what improved between versions.",
    191,
    "tip",
  ),
  gallery(
    192,
    "Keep V1, V2, and final — annotate what improved between each version.",
    [
      {
        title: "Iterative Creation",
        description:
          "Creator compares Version 1, Version 2, and polished final across screens with annotations and teammate critique.",
        imageUrl: `${M5}/m5-iterative-creation.png`,
      },
    ],
  ),

  // ── Part XX — C-R-E-A-T-O-R Check (~10 min) ───────────────────────────────
  interactive(
    {
      variant: "topic_deck",
      title: "Part XX — Quality Control: C-R-E-A-T-O-R Check",
      subtitle: "~10 minutes · Run this checklist before you publish.",
      imageUrl: `${M5}/m5-quality-control.png`,
      imageCaption: "Correct · Relevant · Ethical · Accessible · Tone · Original · Reviewed — before publication.",
      columns: 3,
      sections: [
        { title: "C — Correct", icon: "target", body: "Facts, spelling, and technical accuracy.", accent: "violet" },
        { title: "R — Relevant", icon: "book", body: "Matches brief, audience, and goal.", accent: "sky" },
        { title: "E — Ethical", icon: "shield", body: "Consent, honesty, no harm.", accent: "emerald" },
        { title: "A — Accessible", icon: "wand", body: "Readable, captioned, inclusive design.", accent: "amber" },
        { title: "T — Tone", icon: "message", body: "Appropriate voice for context.", accent: "violet" },
        { title: "O — Original", icon: "sparkles", body: "Attribution, copyright, disclosure.", accent: "sky" },
        { title: "R — Reviewed", icon: "brain", body: "Human approved — not prompt-and-publish.", accent: "emerald" },
      ],
    },
    200,
  ),

  // ── Part XXI — Authenticity (~10 min) ─────────────────────────────────────
  interactive(
    {
      variant: "concept_cards",
      title: "Part XXI — AI Content Authenticity",
      subtitle: "~10 minutes · Disclosure may be required by context, platform, school policy, competition rules, or professional expectations.",
      cards: [
        {
          icon: "shield",
          title: "When to Disclose",
          body: "School assignments, competitions, news-like content, marketing claims, and any work where viewers assume human-only creation.",
        },
        {
          icon: "message",
          title: "The Real-Event Test",
          body: "Would viewers reasonably assume this depicts a real event? If yes, disclosure matters.",
        },
      ],
    },
    210,
  ),

  // ── Part XXII — Enterprise Workflows (~10 min) ──────────────────────────────
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Part XXII — Enterprise Creative Workflows",
      subtitle: "~10 minutes · Organizations add review gates — not Prompt → Publish alone.",
      steps: [
        { label: "Prompt", detail: "Brief-aligned generation request" },
        { label: "Generate", detail: "Draft assets from approved tools" },
        { label: "Review", detail: "Quality, brand, legal, and accessibility check" },
        { label: "Approve", detail: "Designated owner signs off" },
        { label: "Publish", detail: "Release to channels with disclosure as needed" },
      ],
    },
    220,
  ),

  // ── Part XXIII — Hands-On Creator Labs (summary checklist) ────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XXIII — Hands-On Creator Labs Checklist",
      subtitle: "~90+ minutes total · Detailed steps live in each lab section above — complete all six.",
      activities: [
        {
          id: "lab1",
          label: "1",
          title: "Event Flyer",
          icon: "wand",
          accent: "violet",
          duration: "20 min",
          summary: "FutureTech Night — ChatGPT/Firefly/Midjourney + Canva typography.",
          steps: [
            "See Lab 1 block after Image Tool Spotlights (Part V).",
            "Tools: ChatGPT Images, Firefly, Midjourney, Ideogram, Leonardo + Canva.",
            "Deliverable: brief, prompts, raw AI image, final flyer PNG, disclosure.",
          ],
        },
        {
          id: "lab2",
          label: "2",
          title: "Presentation",
          icon: "book",
          accent: "sky",
          duration: "15 min",
          summary: "5 slides — How AI Could Improve Our School.",
          steps: [
            "See Lab 2 block after Gamma Spotlight (Part VIII).",
            "Tools: Gamma, Canva Present, or PowerPoint Copilot.",
            "Deliverable: outline, deck link/export, list of human edits made.",
          ],
        },
        {
          id: "lab3",
          label: "3",
          title: "Promotional Video",
          icon: "zap",
          accent: "amber",
          duration: "25 min",
          summary: "15–30 sec startup ad — storyboard first.",
          steps: [
            "See Lab 3 block after Higgsfield / Grok / Nano Banana walkthroughs (Part IX).",
            "Tools: Higgsfield, Grok Imagine, Bananai (Nano Banana + video). Optional: Runway, Pika.",
            "Deliverable: script, storyboard, 2+ clips, final MP4, disclosure.",
          ],
        },
        {
          id: "lab4",
          label: "4",
          title: "Social Campaign",
          icon: "message",
          accent: "emerald",
          duration: "20 min",
          summary: "3 posts — AI for Social Good Day.",
          steps: [
            "See Lab 4 block after Part XIII.",
            "Tools: Canva + optional Ideogram for hero graphics.",
            "Deliverable: style guide, 3 PNGs, captions, disclosure.",
          ],
        },
        {
          id: "lab5",
          label: "5",
          title: "Landing Page",
          icon: "cpu",
          accent: "violet",
          duration: "20 min",
          summary: "EcoTrack food-waste startup page.",
          steps: [
            "See Lab 5 block after Lovable + Replit Spotlights (Part XV).",
            "Deliverable: live URL or export, mobile screenshot, 3-bullet evaluation.",
          ],
        },
        {
          id: "lab6",
          label: "6",
          title: "Educational Poster",
          icon: "sparkles",
          accent: "sky",
          duration: "15 min",
          wide: true,
          summary: "Topic YOU pick — AI image + human-written facts.",
          steps: [
            "Pick topic (e.g. how solar panels work, recycling rules, prompt engineering tips).",
            "Generate illustration in Leonardo or ChatGPT Images — no fake text in image.",
            "Canva: title, 3 verified bullet facts, 1 fun fact, source line at bottom.",
            "Run C-R-E-A-T-O-R check before print/export.",
            "Deliverable: poster PNG + sources + prompt log.",
          ],
        },
      ],
    },
    230,
  ),
  activity(
    {
      title: "Labs completed",
      prompt: "Select every lab you completed (or reviewed with instructor).",
      activityType: "poll",
      multiSelect: true,
      options: [
        "Lab 1 Flyer",
        "Lab 2 Presentation",
        "Lab 3 Video",
        "Lab 4 Social",
        "Lab 5 Landing Page",
        "Lab 6 Educational Poster",
      ],
    },
    231,
  ),

  // ── Part XXIV — Creator Studio Project (~20 min) ──────────────────────────
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XXIV — Hands-On Creator Studio Project",
      subtitle: "~20 minutes · Choose event, startup, nonprofit, or social cause. Create at least four assets.",
      activities: [
        {
          id: "brand",
          label: "1",
          title: "Brand",
          icon: "wand",
          accent: "violet",
          summary: "Logo + colors + tagline — define before other assets.",
        },
        {
          id: "graphic",
          label: "2",
          title: "Graphic",
          icon: "sparkles",
          accent: "sky",
          summary: "Poster or social post with manual typography.",
        },
        {
          id: "presentation",
          label: "3",
          title: "Presentation",
          icon: "book",
          accent: "emerald",
          summary: "3–5 slides with one key message per slide.",
        },
        {
          id: "media",
          label: "4",
          title: "Media",
          icon: "zap",
          accent: "amber",
          summary: "Video, voice, music, or illustrated story.",
        },
        {
          id: "optional",
          label: "+",
          title: "Optional Stretch",
          icon: "cpu",
          accent: "violet",
          wide: true,
          summary: "Landing page or app prototype — ties the campaign together.",
        },
      ],
    },
    240,
  ),
  gallery(
    241,
    "Signature project — multiple teams creating brand, video, web, narration, and slides simultaneously.",
    [
      {
        title: "Hands-On Creator Studio",
        description:
          "Large AI Creator Studio with teams designing brands, editing video, building landing pages, and preparing presentations.",
        imageUrl: `${M5}/m5-creator-studio.png`,
      },
    ],
  ),

  // ── Part XXV — Commercial Challenge (~20 min) ─────────────────────────────
  interactive(
    {
      variant: "numbered_steps",
      title: "Part XXV — AI Commercial Challenge",
      intro: "~20 minutes · 20–30 second commercial: brief · script · storyboard · visuals · narration · music · video · final edit",
      layout: "horizontal",
      steps: [
        { icon: "zap", title: "0–5s Hook", body: "Grab attention immediately." },
        { icon: "target", title: "5–12s Problem", body: "Pain point your audience feels." },
        { icon: "wand", title: "12–22s Solution", body: "Your product, event, or cause as the answer." },
        { icon: "message", title: "22–30s CTA", body: "Register, visit, download — one clear action." },
      ],
    },
    250,
  ),
  gallery(
    251,
    "20–30 second commercial: Hook → Problem → Solution → CTA — storyboard before you generate.",
    [
      {
        title: "AI Commercial Challenge",
        description:
          "Student production set with on-camera talent, director, playback monitor, storyboard, and brand assets.",
        imageUrl: `${M5}/m5-commercial-challenge.png`,
      },
    ],
  ),

  // ── Part XXVI — Portfolio (~10 min) ───────────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Part XXVI — AI Creator Portfolio",
      subtitle: "~10 minutes · Save to CourseCollab for review and future reference.",
      columns: 2,
      cards: [
        { icon: "book", title: "Creative Brief", body: "Goal, audience, constraints — your north star." },
        { icon: "message", title: "Prompts & Revisions", body: "V1 → V2 → final with notes on what improved." },
        { icon: "wand", title: "Assets & Final Design", body: "Exports from every lab and project deliverable." },
        { icon: "cpu", title: "Tool List", body: "Which AI tools you used for each asset." },
        { icon: "shield", title: "Responsible AI Disclosure", body: "How you used AI, what you verified, what you edited manually." },
        { icon: "brain", title: "Reflection", body: "What you learned and what you would do differently." },
      ],
    },
    260,
  ),
  reflect(
    "Portfolio — Paste your Responsible AI disclosure (how you used AI, what you verified, what you edited manually).",
    261,
  ),
  gallery(
    262,
    "Save briefs, prompts, assets, disclosures, and reflections — your complete Creator Studio portfolio.",
    [
      {
        title: "AI Creator Portfolio Review",
        description:
          "Student presents complete portfolio on laptop and printed boards while mentor or peer provides feedback.",
        imageUrl: `${M5}/m5-creator-portfolio.png`,
      },
    ],
  ),

  // ── Continue Learning ─────────────────────────────────────────────────────
  interactive(
    {
      variant: "feature_cards",
      title: "Continue Learning — Instructor Resources",
      columns: 3,
      cards: [
        {
          icon: "book",
          title: "Microsoft — Generative AI for Beginners",
          body: "github.com/microsoft/generative-ai-for-beginners",
        },
        {
          icon: "sparkles",
          title: "Awesome Generative AI Guide",
          body: "github.com/aishwaryanr/awesome-generative-ai-guide",
        },
        {
          icon: "wand",
          title: "Awesome Generative AI",
          body: "github.com/steven2358/awesome-generative-ai — image, video, audio categories.",
        },
      ],
    },
    270,
  ),

  interactive(
    {
      variant: "flashcard_carousel",
      title: "Module 5 — Flashcard Review",
      cards: [
        { id: "create", front: "C-R-E-A-T-E", back: "Concept · Requirements · Explore · Assemble · Test · Enhance." },
        { id: "creator", front: "C-R-E-A-T-O-R", back: "Correct · Relevant · Ethical · Accessible · Tone · Original · Reviewed." },
        { id: "brief", front: "Creative Brief", back: "Plan goal, audience, message, style, deliverables before prompting." },
        { id: "multi", front: "Multimodal", back: "Text, image, audio, video, code in one project." },
        { id: "brand", front: "Brand vs Logo", back: "Logo = mark; brand = full identity system." },
        { id: "iter", front: "Iterative Creation", back: "Keep versions; refine prompts; human polish." },
        { id: "voice", front: "Voice Ethics", back: "Consent, no unauthorized cloning, disclose synthetic media." },
        { id: "chain", front: "Prompt Chain", back: "Research → draft → critique → human review → revise." },
      ],
    },
    280,
  ),
  callout(
    "**Completion checklist:** Creative brief · image/flyer lab · brand activity · presentation lab · video or audio · social campaign · Creator Studio project · portfolio · disclosure · quiz · reflections",
    281,
    "info",
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Summary & Bridge to Module 6",
      subtitle:
        "Professional creation: Purpose → Planning → Prompting → Generation → Evaluation → Editing → Integration → Responsible Review → Publishing",
      columns: 3,
      cards: [
        { icon: "shield", title: "Module 4 — Responsible AI", body: "Should I use AI here, and how responsibly?" },
        { icon: "sparkles", title: "Module 5 — AI Creator Studio", body: "How do I create multi-format content with AI?" },
        {
          icon: "brain",
          title: "Module 6 — AI Learning Accelerator",
          body: "Build an AI-powered learning system — tutor, smart notes, exam prep, and responsible academic workflows.",
        },
      ],
      footer:
        "You can create with AI. Next: build your AI tutor, smart note system, exam prep workflow, and personal study toolkit.",
    },
    282,
  ),
  gallery(
    283,
    "AI can create across media — these students operate a real creative studio and produce professional work.",
    [
      {
        title: "Module Summary — AI Can Create Across Media",
        description:
          "Diverse HBCU creators surrounded by images, presentations, audio, video, websites, apps, and brand assets they built.",
        imageUrl: `${M5}/m5-final-hero.png`,
      },
    ],
  ),

  reflect("Reflection 1 — Which AI creative tool surprised you most?", 400),
  reflect("Reflection 2 — Which part required the most human creativity?", 401),
  reflect("Reflection 3 — How did your output change from Version 1 to final?", 402),
  reflect("Reflection 4 — Which AI output did you reject, and why?", 403),
  reflect("Reflection 5 — How did you keep brand consistency across media?", 404),
  reflect("Reflection 6 — Where should AI assistance be disclosed in your project?", 405),
  {
    block_type: "checkpoint",
    sort_order: 406,
    content: {
      title: "Optional: Creator Studio Artifact Upload",
      description: "Upload one poster, slide, or video screenshot from your project.",
      acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
      maxSizeMb: 8,
    },
  },
  {
    block_type: "module_completion",
    sort_order: 407,
    content: {
      title: "Congratulations!",
      message:
        "You completed Module 5: AI Creator Studio. You can plan with C-R-E-A-T-E, produce multi-format media, maintain brand consistency, and publish responsibly.",
      rewards: {
        xp: 250,
        badges: ["ai-creator"],
        nextModule: "Module 6: AI Learning Accelerator",
        comingNext:
          "Build your AI tutor, smart note system, exam prep workflow, and personal study toolkit.",
      },
    },
  },
]
