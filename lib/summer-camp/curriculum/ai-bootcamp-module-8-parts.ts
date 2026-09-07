/**
 * AI Bootcamp Module 7 — AI Career Accelerator parts (file: module-8).
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

const TUTOR = (file: string) => `/summer-camp/ai-bootcamp/tutorials/module-7-career/${file}.png`

function stepTutorial(
  caption: string,
  cards: Array<{ title: string; description?: string; imageUrl: string; bullets?: string[] }>,
  sort: number,
): CurriculumBlock {
  return { block_type: "image_gallery", content: { caption, cards }, sort_order: sort }
}

export const AI_BOOTCAMP_MODULE_8_PART_BLOCKS: CurriculumBlock[] = [
  // Part I — Future of Work
  text(
    `## Part I — The Future of Work in the AI Era

**Estimated time:** ~20 minutes

> **Will AI take your future job?** A better question: **How will AI change your future job?**

Technology repeatedly changed work: agriculture → manufacturing → computers → internet → smartphones → **AI** (knowledge work).`,
    8,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "AI Replacement vs Augmentation",
      subtitle: "A profession = many tasks. AI may transform parts without eliminating the profession.",
      columns: 2,
      cards: [
        {
          icon: "zap",
          title: "AI replacement",
          body: "AI performs a task previously done entirely by a person.",
        },
        {
          icon: "brain",
          title: "AI augmentation",
          body: "AI helps a person perform faster or better — often the useful framework.",
        },
        {
          icon: "target",
          title: "Engineer",
          body: "AI assists with code and docs; human judgment still drives design and safety.",
        },
        {
          icon: "message",
          title: "Teacher",
          body: "AI generates materials; human connection and mentorship stay essential.",
        },
        {
          icon: "book",
          title: "Researcher",
          body: "AI scans literature; humans design experiments and interpret meaning.",
        },
      ],
    },
    9,
  ),
  interactive(
    {
      variant: "hands_on_missions",
      title: "Activity — My Dream Career",
      subtitle: "Pick a career and investigate how AI is changing it today.",
      activities: [
        {
          id: "investigate",
          label: "1",
          title: "Research your career",
          icon: "book",
          accent: "violet",
          summary:
            "Responsibilities · AI use today · automatable tasks · human-only tasks · emerging skills · risks · your interest.",
        },
        {
          id: "deliverable",
          label: "2",
          title: "Deliverable: My AI Career Profile",
          icon: "target",
          accent: "sky",
          summary:
            "Career, industry, AI applications, human/technical skills, opportunities, risks, personal interest.",
        },
      ],
    },
    10,
  ),
  reflect("My AI Career Profile — Career choice and how AI is changing it (5–8 sentences).", 11),

  interactive(
    {
      variant: "topic_deck",
      title: "Free Career AI Tools + Privacy (read first)",
      subtitle: "ChatGPT Free · Gemini Free · Perplexity Free — typed facts only, no confidential uploads.",
      columns: 3,
      sections: [
        {
          title: "ChatGPT Free",
          icon: "message",
          body: "chatgpt.com — resume bullets, cover letters, mock interview, outreach emails.",
          accent: "violet",
        },
        {
          title: "Gemini Free",
          icon: "sparkles",
          body: "gemini.google.com — same career prompts; use Google account.",
          accent: "sky",
        },
        {
          title: "Perplexity Free",
          icon: "book",
          body: "perplexity.ai — career/industry research with citations for your AI Career Profile.",
          accent: "emerald",
        },
        {
          title: "Do NOT upload",
          icon: "shield",
          body: "No employer-confidential docs, SSN, full unreleased resumes with home address, or others' data.",
          accent: "amber",
        },
        {
          title: "DO type instead",
          icon: "target",
          body: "Anonymized bullets, your own project facts, job description snippets (no internal-only postings).",
          accent: "violet",
        },
        {
          title: "Verify every claim",
          icon: "cpu",
          body: "AI improves wording — never invent experience. You sign your resume and applications.",
          accent: "sky",
        },
      ],
      footer: "Green zone: typed experience facts + AI polish. Red zone: fake jobs, inflated skills, mass spam outreach.",
    },
    12,
  ),
  callout(
    "**Login:** Free ChatGPT, Gemini, or Perplexity require sign-in. Use personal or school-approved accounts. Walkthrough screenshots below use live free-tier homepages — same prompts work on any platform.",
    13,
    "info",
  ),
  stepTutorial(
    "Walkthrough A — Career research with Perplexity Free (Part I · My Dream Career)",
    [
      {
        title: "Step 1 — Open Perplexity Free",
        description: "Go to **perplexity.ai** and sign in. Free tier supports cited career research.",
        imageUrl: TUTOR("02-perplexity-home"),
        bullets: [
          "Pick a dream career from Part I (engineer, designer, healthcare, etc.).",
          "Research how AI is changing that field today — not in 10 years.",
        ],
      },
      {
        title: "Step 2 — Paste a research prompt (typed only)",
        description:
          "Ask for augmentation vs human-only tasks, emerging skills, and **sources**. Do not paste proprietary employer documents.",
        imageUrl: TUTOR("04-perplexity-career-research-prompt"),
        bullets: [
          "Example: How is AI changing electrical engineering careers for new graduates? List 3 augmentation tasks and 3 human-only skills. Cite sources.",
          "Save 3 citations + 5 bullets for your AI Career Profile deliverable.",
        ],
      },
      {
        title: "Step 3 — Synthesize into My AI Career Profile",
        description: "Cross-check facts. Write in your own words — AI research is a starting point, not the final essay.",
        imageUrl: TUTOR("01-gemini-home"),
        bullets: [
          "Include: career, AI applications today, human skills, risks, your interest.",
          "Submit reflection above when ready.",
        ],
      },
    ],
    14,
  ),

  // Part II — Future-Proof Skills
  text(
    `## Part II — Future-Proof Skills

**Estimated time:** ~15 minutes

**Future-ready professional = Domain knowledge + AI fluency + Human skills + Continuous learning**`,
    20,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Technical Skills",
      columns: 2,
      cards: [
        { icon: "brain", title: "AI literacy", body: "Understand what AI can and cannot do — and when to verify." },
        { icon: "book", title: "Data literacy", body: "Read charts, spot patterns, question sources." },
        { icon: "zap", title: "Programming & tools", body: "Automate tasks and build with digital platforms." },
        { icon: "target", title: "Research & automation", body: "Find evidence fast — then validate and apply it." },
      ],
    },
    21,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Human Skills",
      columns: 3,
      cards: [
        { icon: "message", title: "Communication", body: "Explain ideas clearly to diverse audiences." },
        { icon: "wand", title: "Creativity", body: "Generate novel approaches AI cannot copy alone." },
        { icon: "shield", title: "Leadership & judgment", body: "Decide under uncertainty; take responsibility." },
        { icon: "brain", title: "Critical thinking", body: "Evaluate claims, bias, and tradeoffs." },
        { icon: "sparkles", title: "Collaboration & empathy", body: "Work with people; understand stakeholder needs." },
        { icon: "target", title: "Adaptability", body: "Learn continuously as tools and roles evolve." },
      ],
    },
    22,
  ),
  interactive(
    {
      variant: "concept_cards",
      title: "Skills Inventory",
      subtitle: "Score 1–5: communication · technology · AI literacy · leadership · research · writing · creativity · teamwork · problem solving · public speaking",
      cards: [
        {
          title: "Identify strengths",
          body: "Select 2 skills where you score highest — these anchor your brand.",
        },
        {
          title: "Choose growth areas",
          body: "Select 2 skills to improve this semester with a concrete plan.",
        },
        {
          title: "Start immediately",
          body: "Pick 1 skill to practice this week — one action, one evidence artifact.",
        },
      ],
    },
    23,
  ),

  // Part III — Resume
  text(
    `## Part III — Building a Professional Resume

**Estimated time:** ~30 minutes

Goal: show **why your experiences are relevant** — not list everything ever done.`,
    28,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Resume Structure",
      columns: 2,
      cards: [
        { icon: "message", title: "Header", body: "Name, contact, LinkedIn or portfolio link." },
        { icon: "book", title: "Education", body: "School, GPA if strong, relevant coursework." },
        { icon: "target", title: "Experience & projects", body: "Roles, leadership, capstone work with achievement bullets." },
        { icon: "wand", title: "Skills & awards", body: "Honest skill levels, certifications, competitions." },
      ],
      footer: "Professional summary (optional) — 2–3 lines tying your story together.",
    },
    29,
  ),
  interactive(
    {
      variant: "comparison_table",
      title: "Achievement Bullets — Weak vs Strong",
      leftHeader: "Version",
      rightHeader: "Example",
      rows: [
        { left: "Weak", right: "Helped robotics team." },
        {
          left: "Strong",
          right:
            "Collaborated with a four-member team to design and test an autonomous robot, completing 20+ trial runs before competition.",
        },
      ],
      footer: "Formula: Action + Task + Result — every claim must be verifiable.",
    },
    30,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "AI Resume Workflow",
      steps: [
        { title: "Real experience", body: "Start with facts you can prove — dates, roles, outcomes." },
        { title: "AI clarifies wording", body: "Use AI to tighten language — not to invent achievements." },
        { title: "Student verifies", body: "Check every claim against reality before submitting." },
        { title: "Tailor to opportunity", body: "Match keywords from the job description honestly." },
        { title: "Human review", body: "Teacher, mentor, or peer reviews final PDF." },
      ],
      footer: "AI may improve how you describe experience. It must never invent the experience.",
    },
    30,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "ATS Basics",
      intro: "Clear headings · relevant keywords · simple formatting · accurate skills — not \"ATS hacking.\"",
      layout: "horizontal",
      steps: [
        { icon: "book", title: "Job description analysis", body: "Identify five key skills — required vs preferred." },
        { icon: "shield", title: "Do not inflate", body: "Never add qualifications not present in your background." },
        { icon: "target", title: "Honest keywords", body: "Mirror role language only where you have real evidence." },
      ],
    },
    30,
  ),
  interactive(
    {
      variant: "hands_on_missions",
      title: "Lab — Resume Build",
      subtitle: "Assemble Professional Resume V1 for upload.",
      activities: [
        {
          id: "header",
          label: "1",
          title: "Header & education",
          icon: "message",
          accent: "violet",
          summary: "Contact info, school, relevant coursework.",
        },
        {
          id: "skills",
          label: "2",
          title: "Skills & projects",
          icon: "wand",
          accent: "sky",
          summary: "Honest skill list plus 1–2 project highlights.",
        },
        {
          id: "bullets",
          label: "3",
          title: "Achievement bullets",
          icon: "target",
          accent: "emerald",
          summary: "Action + Task + Result for each role; optional summary paragraph.",
        },
      ],
      footer: "Deliverable: Professional Resume V1 — upload at the checkpoint below when ready.",
    },
    30,
  ),
  stepTutorial(
    "Walkthrough B — Resume bullet upgrade (ChatGPT or Gemini Free · Part III)",
    [
      {
        title: "Step 1 — Open free AI chat",
        description: "Use **ChatGPT Free** or **Gemini Free**. New chat — career/resume coach mode.",
        imageUrl: TUTOR("03-chatgpt-home"),
        bullets: [
          "Rule: provide real facts only. AI tightens wording; it does not invent roles or numbers.",
          "Never upload a full PDF with your home address — type bullet facts instead.",
        ],
      },
      {
        title: "Step 2 — Paste weak bullet + verified facts",
        description: "Give the weak line, then the facts you can prove (team size, outcomes, metrics).",
        imageUrl: TUTOR("05-chatgpt-resume-bullet-prompt"),
        bullets: [
          "Prompt: Improve this resume bullet. Do NOT invent facts. Weak: Helped robotics team. Facts: 4-member team, autonomous robot, 20+ trial runs.",
          "Ask for Action + Task + Result format in one line.",
        ],
      },
      {
        title: "Step 3 — Verify & paste into Resume V1",
        description: "Read aloud: could you defend every word in an interview? If yes, add to your resume draft.",
        imageUrl: TUTOR("06-resume-bullet-demo"),
        bullets: [
          "Compare AI output to the Strong example in the module.",
          "Repeat for each experience block before checkpoint upload.",
        ],
      },
    ],
    30,
  ),
  {
    block_type: "checkpoint",
    sort_order: 31,
    content: {
      title: "Upload Professional Resume V1",
      description: "PDF of your internship-ready resume (verify every claim is true).",
      acceptedTypes: ["application/pdf"],
      maxSizeMb: 5,
    },
  },

  // Part IV — Cover letters
  text(
    `## Part IV — Cover Letters & Professional Communication

**Estimated time:** ~15 minutes

Answer: **Why this opportunity? · Why this organization? · Why you?**`,
    40,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Cover Letter Structure",
      layout: "horizontal",
      steps: [
        { icon: "message", title: "Opening", body: "State the role and how you learned about it." },
        { icon: "brain", title: "Connection", body: "Link your interests to the organization's mission." },
        { icon: "target", title: "Evidence", body: "One concrete project or experience that proves fit." },
        { icon: "wand", title: "Value", body: "What you will contribute in the first 90 days." },
        { icon: "sparkles", title: "Close", body: "Thank them; express enthusiasm for next steps." },
      ],
      footer: "Provide real experience, project, goal, and job description — then AI helps organize (not generic spam).",
    },
    41,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Professional Communication Practice",
      columns: 2,
      cards: [
        { icon: "message", title: "Internship inquiry", body: "Professional tone; specific role; clear ask." },
        { icon: "sparkles", title: "Thank-you note", body: "Send within 24 hours; reference one conversation detail." },
        { icon: "book", title: "Professor intro", body: "Context, purpose, respectful length." },
        { icon: "target", title: "Networking follow-up", body: "Reference your conversation; one focused question." },
        { icon: "shield", title: "Interview follow-up", body: "Gratitude plus reiterate fit — keep it brief." },
      ],
    },
    42,
  ),
  stepTutorial(
    "Walkthrough C — Cover letter draft (free AI chat · Part IV)",
    [
      {
        title: "Step 1 — Gather typed facts (no file upload)",
        description:
          "Role title, organization mission (public website), one real project, and why you care — typed into chat.",
        imageUrl: TUTOR("03-chatgpt-home"),
        bullets: [
          "Use [PLACEHOLDER] for company name until you tailor per application.",
          "Job description: paste only the public posting snippet, not internal HR docs.",
        ],
      },
      {
        title: "Step 2 — Request structured opening paragraph",
        description: "Ask for ~150 words: opening, connection, evidence, value, close.",
        imageUrl: TUTOR("07-cover-letter-demo"),
        bullets: [
          "Prompt: Draft cover letter opening for high-school engineering internship. Grade 11, robotics programmer, line-following robot, embedded systems interest.",
          "Tone: professional and specific — not Dear Hiring Manager spam.",
        ],
      },
      {
        title: "Step 3 — Human edit before sending",
        description: "Replace placeholders, cut generic lines, add one sentence only you could write.",
        imageUrl: TUTOR("07-cover-letter-demo"),
        bullets: [
          "Read aloud — does it sound like you?",
          "Save best version to Career Toolkit folder in CourseCollab.",
        ],
      },
    ],
    43,
  ),

  // Part V — LinkedIn & brand
  text(
    `## Part V — LinkedIn & Professional Presence

**Estimated time:** ~25 minutes

> **Your digital presence becomes part of your professional reputation.**`,
    48,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "LinkedIn Essentials",
      columns: 2,
      cards: [
        {
          icon: "message",
          title: "Headline",
          body: "High School Student | Robotics & AI Enthusiast | Aspiring Electrical Engineer",
        },
        {
          icon: "book",
          title: "About section",
          body: "Who you are · interests · learning · building · opportunities sought.",
        },
        {
          icon: "wand",
          title: "Projects",
          body: "Robotics · apps · Creator Studio work · research · capstone — honest skill levels.",
        },
        {
          icon: "target",
          title: "Personal brand formula",
          body: "What I care about · What I can do · What I am building toward.",
        },
      ],
    },
    49,
  ),
  interactive(
    {
      variant: "hands_on_missions",
      title: "Lab — Personal Brand Studio",
      subtitle: "Build your professional presence with verified claims only.",
      activities: [
        { id: "headline", label: "1", title: "Headline", icon: "message", accent: "violet", summary: "One line that captures your focus." },
        { id: "bio", label: "2", title: "100–150 word bio", icon: "book", accent: "sky", summary: "Story, skills, and direction." },
        { id: "projects", label: "3", title: "Projects & mission", icon: "target", accent: "emerald", summary: "Project descriptions plus mission statement." },
      ],
      footer: "Professional AI image enhancement ≠ professional misrepresentation.",
    },
    50,
  ),
  reflect("Personal Brand — Your headline and 2–3 sentence mission statement.", 51),
  stepTutorial(
    "Walkthrough D — LinkedIn headline + About (free AI chat · Part V)",
    [
      {
        title: "Step 1 — List honest facts",
        description: "Grade, interests, 1–2 projects, skills at real level (beginner/intermediate).",
        imageUrl: TUTOR("01-gemini-home"),
        bullets: [
          "No exaggeration — recruiters and teachers can verify project claims.",
          "Personal brand formula: what I care about · what I can do · what I am building toward.",
        ],
      },
      {
        title: "Step 2 — Generate headline + About draft",
        description: "Ask for headline (one line) and ~120-word About section.",
        imageUrl: TUTOR("08-linkedin-brand-demo"),
        bullets: [
          "Example: Grade 11, robotics & AI enthusiast, aspiring electrical engineer, Arduino plant monitor project.",
          "Request honest skill levels and student-appropriate tone.",
        ],
      },
      {
        title: "Step 3 — Publish on LinkedIn (or draft in doc first)",
        description: "Copy to LinkedIn profile or save draft for instructor review.",
        imageUrl: TUTOR("08-linkedin-brand-demo"),
        bullets: [
          "Add projects section with evidence links (GitHub, club page, portfolio).",
          "Deliverable: headline + mission statement reflection above.",
        ],
      },
    ],
    52,
  ),

  // Part VI — Networking
  text(
    `## Part VI — Networking in the AI Era

**Estimated time:** ~20 minutes

Networking = **building genuine professional relationships** — not asking strangers for jobs.`,
    60,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Networking Sources & Outreach",
      columns: 2,
      cards: [
        {
          icon: "sparkles",
          title: "Where to connect",
          body: "Teachers · alumni · fairs · clubs · LinkedIn · internships · associations.",
        },
        {
          icon: "message",
          title: "5-minute interview questions",
          body: "What do you do? How did you enter? What skills matter? What should I learn?",
        },
        {
          icon: "target",
          title: "Outreach structure",
          body: "Introduction → connection → reason → specific question → thank you.",
        },
        {
          icon: "shield",
          title: "Responsible AI use",
          body: "AI may improve tone and prep questions — not mass-spam or fake connections.",
        },
      ],
    },
    61,
  ),
  stepTutorial(
    "Walkthrough E — Networking outreach email (free AI chat · Part VI)",
    [
      {
        title: "Step 1 — Pick one real contact",
        description: "Alumni, club mentor, career fair speaker — someone you can truthfully reference.",
        imageUrl: TUTOR("02-perplexity-home"),
        bullets: [
          "Structure: intro → connection → reason → specific question → thank you.",
          "Never mass-blast identical AI emails to strangers.",
        ],
      },
      {
        title: "Step 2 — Draft 4-sentence email",
        description: "Under 100 words. One specific question about their path or your interest area.",
        imageUrl: TUTOR("10-networking-email-demo"),
        bullets: [
          "Prompt: Grade 11, robotics club, seeking internship advice — 4 sentences, professional tone.",
          "AI improves clarity; you personalize names and connection detail.",
        ],
      },
      {
        title: "Step 3 — Send (or practice) responsibly",
        description: "Have a teacher or peer review before first outreach if unsure.",
        imageUrl: TUTOR("10-networking-email-demo"),
        bullets: [
          "Follow up once politely if no reply in 2 weeks.",
          "Log outreach in your Career Toolkit.",
        ],
      },
    ],
    62,
  ),

  // Part VII — Elevator pitch
  text(
    `## Part VII — Elevator Pitch

**30-second framework:** **Who** · **What** (studying/interests) · **Evidence** (what you've done) · **Future** (opportunity sought)`,
    70,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Elevator Pitch Framework",
      layout: "horizontal",
      steps: [
        { icon: "message", title: "Who", body: "Name and grade level." },
        { icon: "brain", title: "What", body: "Field of study and core interests." },
        { icon: "target", title: "Evidence", body: "One project or club achievement." },
        { icon: "sparkles", title: "Future", body: "Opportunity you are seeking." },
      ],
      footer:
        "Example: I'm Maya, a senior interested in computer engineering and robotics. I've built Arduino/AI projects in our tech club, including an automated plant monitor. I'm seeking embedded systems and research opportunities. Activity: write 15s · 30s · 60s versions and practice aloud.",
    },
    71,
  ),

  // Part VIII — Interview coach
  text(
    `## Part VIII — AI Interview Coach

**Estimated time:** ~30 minutes`,
    80,
  ),
  interactive(
    {
      variant: "concept_cards",
      title: "Interview Types & STAR",
      cards: [
        { title: "Behavioral", body: "Past behavior predicts future performance — use STAR stories." },
        { title: "Technical", body: "Problem-solving, tools, and domain knowledge." },
        { title: "Case / scenario", body: "Think aloud through a structured approach." },
        { title: "Motivational", body: "Why this role, organization, and field?" },
        { title: "STAR framework", body: "Situation → Task → Action → Result — one story per question." },
      ],
    },
    81,
  ),
  interactive(
    {
      variant: "hands_on_missions",
      title: "Mock Interview & Improvement Report",
      subtitle: "AI evaluates structure — not personality, cultural fit, or true confidence.",
      activities: [
        {
          id: "mock",
          label: "1",
          title: "Mock interview prompt",
          icon: "message",
          accent: "violet",
          summary:
            "Act as an interviewer for a high-school engineering internship. Ask one question at a time. Do not give model answers before I respond. After each response, evaluate clarity, evidence, organization, professionalism, relevance.",
        },
        {
          id: "report",
          label: "2",
          title: "Personal Interview Improvement Report",
          icon: "target",
          accent: "sky",
          summary: "Strengths · weaknesses · filler words · STAR usage · three goals.",
        },
      ],
    },
    82,
  ),
  stepTutorial(
    "Walkthrough F — Mock interview + STAR feedback (free AI chat · Part VIII)",
    [
      {
        title: "Step 1 — Set interviewer rules",
        description:
          "New chat. Paste mock interview prompt: one question at a time, no model answers before you respond, STAR feedback after.",
        imageUrl: TUTOR("03-chatgpt-home"),
        bullets: [
          "Act as interviewer for high-school engineering internship.",
          "After each answer: evaluate clarity, evidence, STAR structure, professionalism.",
        ],
      },
      {
        title: "Step 2 — Answer with a STAR story",
        description: "Use a real project. Situation → Task → Action → Result — one story per question.",
        imageUrl: TUTOR("09-mock-interview-demo"),
        bullets: [
          "Example story: robotics club autonomous mode, 20+ trial runs, top-3 regional result.",
          "Speak your answer aloud first, then type a summary for AI feedback.",
        ],
      },
      {
        title: "Step 3 — Personal Interview Improvement Report",
        description: "From AI feedback, list strengths, filler words, STAR gaps, and 3 goals.",
        imageUrl: TUTOR("09-mock-interview-demo"),
        bullets: [
          "Repeat with 2 more behavioral questions.",
          "AI evaluates structure — not personality, cultural fit, or true confidence.",
        ],
      },
    ],
    83,
  ),

  // Part IX — Research studio
  text(
    `## Part IX — AI Research & Innovation Studio

**Estimated time:** ~25 minutes

> Executives need the most important information, clearly communicated and evidence-backed.`,
    90,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Research Workflow",
      steps: [
        { title: "Question", body: "Define the decision or topic clearly." },
        { title: "Discover & sources", body: "Perplexity · NotebookLM · Consensus · Scholar · Elicit." },
        { title: "Evidence & analysis", body: "Cross-check claims; note conflicts." },
        { title: "Synthesis", body: "Opportunities, risks, recommendation." },
        { title: "Verified sources", body: "Cite every key finding — no orphan claims." },
      ],
    },
    91,
  ),
  interactive(
    {
      variant: "hands_on_missions",
      title: "Mini Challenge — One-Page Executive Brief",
      subtitle: "Healthcare AI · smart cities · robotics · cybersecurity · or your chosen topic.",
      activities: [
        {
          id: "brief",
          label: "1",
          title: "Structure",
          icon: "book",
          accent: "violet",
          summary: "Topic · Why it matters · Key findings · Opportunities · Risks · Recommendation · Verified sources.",
        },
      ],
    },
    92,
  ),

  // Part X — Entrepreneurship
  text(
    `## Part X — AI Entrepreneurship & Innovation

**Estimated time:** ~30 minutes

Start with: **What meaningful problem are we solving?** — not "let's build an app because AI is cool."`,
    100,
  ),
  interactive(
    {
      variant: "vertical_pipeline",
      title: "Startup Workflow",
      steps: [
        { title: "Problem", body: "Who hurts and how badly?" },
        { title: "Customer", body: "Specific user segment — not \"everyone.\"" },
        { title: "Solution & value", body: "What you offer and why it matters." },
        { title: "Test", body: "Smallest experiment that validates demand." },
        { title: "Business model", body: "How it sustains — revenue, partners, or mission funding." },
      ],
    },
    101,
  ),
  interactive(
    {
      variant: "topic_deck",
      title: "Lean AI Canvas",
      subtitle: "Map problem, solution, AI role, human role, and responsible AI before you pitch.",
      columns: 2,
      sections: [
        { title: "Problem & user", icon: "target", body: "Problem · target user · urgency.", accent: "violet" },
        { title: "Solution & value", icon: "wand", body: "Solution · value proposition · key features.", accent: "sky" },
        { title: "AI & human roles", icon: "brain", body: "What AI does · what humans must own.", accent: "emerald" },
        { title: "Risks & success", icon: "shield", body: "Risks · sustainability · success measure.", accent: "amber" },
      ],
      footer: "3-minute pitch: problem · solution · customer · AI role · benefits · responsible AI · call to action.",
    },
    102,
  ),

  // Part XI — Productivity
  text(
    `## Part XI — AI Productivity for Professionals

**Estimated time:** ~25 minutes`,
    110,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Where AI Supports Professionals",
      columns: 3,
      cards: [
        { icon: "message", title: "Communication", body: "Email drafts, tone checks, follow-ups." },
        { icon: "book", title: "Research & planning", body: "Literature scans, agendas, prioritization." },
        { icon: "wand", title: "Documents & slides", body: "Outlines, summaries, spreadsheet analysis." },
      ],
      footer: "Meeting workflow: agenda before · structured notes during · decisions/actions/owners/deadlines after. Automate routine work. Do not automate responsibility.",
    },
    111,
  ),

  // Part XII — Productivity stack
  interactive(
    {
      variant: "feature_cards",
      title: "Part XII — Build Your AI Productivity Stack",
      subtitle: "Document one trusted tool per category — and how you use it responsibly.",
      columns: 2,
      cards: [
        { icon: "message", title: "Communication", body: "Email, chat, scheduling." },
        { icon: "book", title: "Research", body: "Search, synthesis, citation." },
        { icon: "wand", title: "Writing & presentations", body: "Drafts, slides, visual polish." },
        { icon: "target", title: "Data & organization", body: "Spreadsheets, notes, task tracking." },
        { icon: "sparkles", title: "Creative work", body: "Images, audio, video where policy allows." },
      ],
    },
    120,
  ),
  reflect("My Professional AI Stack — One tool per category and how you use it responsibly.", 121),

  // Part XIII — Portfolio
  text(
    `## Part XIII — Building Your Professional Portfolio

**Estimated time:** ~30 minutes

Resume tells claims — **portfolio shows evidence.**`,
    130,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Project Page Template",
      columns: 2,
      cards: [
        { icon: "target", title: "Problem & role", body: "What you solved and your contribution." },
        { icon: "book", title: "Process & tools", body: "How you built it — stack and workflow." },
        { icon: "wand", title: "Result & learning", body: "Outcomes, metrics, lessons." },
        { icon: "shield", title: "AI disclosure", body: "Where AI helped — transparent and honest." },
      ],
      footer: "Optional: simple portfolio website (hero · about · projects · resume · contact).",
    },
    131,
  ),

  // Part XIV — Career planning
  text(
    `## Part XIV — Career Planning Workshop

**Roadmap:** Now → Destination → Gap → Plan → Evidence → Network → Review`,
    140,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "One-Year Goals & Internship Strategy",
      layout: "horizontal",
      steps: [
        { icon: "book", title: "Academic & skills", body: "Courses, certifications, deliberate practice." },
        { icon: "target", title: "Project & evidence", body: "One portfolio piece per quarter." },
        { icon: "message", title: "Network", body: "Informational interviews and club leadership." },
        { icon: "sparkles", title: "Apply cycle", body: "Discover → Prepare → Apply → Interview → Follow up → Learn." },
      ],
      footer: "Application tracker: organization · role · deadline · resume version · status · contact · follow-up · notes.",
    },
    141,
  ),

  // Parts XV–XVII — Prompt library, responsible AI, hiring
  interactive(
    {
      variant: "topic_deck",
      title: "Part XV — Professional Prompt Library",
      subtitle: "Categories to save and reuse responsibly.",
      comparisonLabels: { left: "Category", right: "Use case" },
      comparisonRows: [
        { left: "Resume & job analysis", right: "Review bullets; extract required skills from postings." },
        { left: "Interview & networking", right: "Mock questions; outreach drafts you verify." },
        { left: "Research & summaries", right: "Executive briefs with cited sources." },
        { left: "Communication", right: "Professional email, presentations, project planning." },
        { left: "Skill development", right: "Learning plans tied to real projects." },
      ],
    },
    150,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Part XVI — Responsible AI in the Workplace",
      columns: 2,
      cards: [
        {
          icon: "shield",
          title: "Never upload casually",
          body: "Customer data · proprietary code · passwords · confidential research · employee records · trade secrets.",
        },
        {
          icon: "brain",
          title: "Professional PAUSE",
          body: "Privacy · Accuracy · Understand · Safety & Fairness · Explain & Evaluate (Module 4).",
        },
      ],
    },
    151,
  ),
  callout(
    "Part XVII — AI in Hiring: Build around demonstrating authentic skills — not beating algorithms. Understand bias, transparency, and privacy on both candidate and employer sides.",
    152,
    "info",
  ),

  // Career Battle, Toolkit, Masterclass
  interactive(
    {
      variant: "feature_cards",
      title: "Part XVIII — AI Career Battle (Optional)",
      subtitle: "Judge: authenticity · clarity · evidence · professionalism · responsible AI.",
      columns: 2,
      cards: [
        { icon: "book", title: "Resume round", body: "Improve one achievement bullet live." },
        { icon: "message", title: "Pitch & STAR", body: "Elevator pitch plus one behavioral answer." },
        { icon: "target", title: "Brief & portfolio", body: "Executive brief and project description." },
        { icon: "sparkles", title: "Startup pitch", body: "3-minute Lean AI Canvas presentation." },
      ],
    },
    155,
  ),
  interactive(
    {
      variant: "topic_deck",
      title: "Part XIX — AI Career Toolkit",
      comparisonLabels: { left: "Asset", right: "Purpose" },
      comparisonRows: [
        { left: "Resume & cover letter", right: "Application-ready documents." },
        { left: "Bio & brand guide", right: "Consistent professional presence." },
        { left: "Interview & research kit", right: "STAR stories and brief templates." },
        { left: "Productivity playbook", right: "Tool stack with PAUSE checks." },
        { left: "Internship tracker", right: "Pipeline from discovery to follow-up." },
        { left: "AI Career Blueprint", right: "90-day plan tying it all together." },
      ],
    },
    156,
  ),
  interactive(
    {
      variant: "numbered_steps",
      title: "Part XX — Executive Masterclass: Becoming AI-Ready",
      layout: "horizontal",
      steps: [
        { icon: "brain", title: "More than a user", body: "Build evidence, not just prompts." },
        { icon: "book", title: "Learn continuously", body: "Domain expertise plus AI fluency." },
        { icon: "message", title: "Communicate clearly", body: "Pitch, write, and present with proof." },
        { icon: "sparkles", title: "Build relationships", body: "Network authentically; protect reputation." },
        { icon: "target", title: "Solve problems", body: "Focus on meaningful outcomes for people." },
      ],
      footer: "Also: develop domain expertise · protect reputation · become a trusted problem solver.",
    },
    157,
  ),
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XXI — My AI Career Blueprint + 90-Day Action Plan",
      subtitle: "Vision · skills · education · projects · experience · network · brand · AI strategy · responsibility",
      activities: [
        {
          id: "pick-five",
          label: "1",
          title: "Pick five actions",
          icon: "target",
          accent: "violet",
          summary: "One skill · one project · one person · one opportunity · one professional asset.",
        },
      ],
    },
    158,
  ),
  reflect("AI Career Blueprint — Your 90-day action plan (skill, project, person, opportunity, asset).", 161),

  // Innovation challenge
  interactive(
    {
      variant: "hands_on_missions",
      title: "Part XXII — AI Career & Innovation Challenge",
      subtitle: "Teams identify a real problem (scholarships · tutoring · recycling · career guidance · small business support…).",
      activities: [
        {
          id: "deliverables",
          label: "1",
          title: "Team deliverables",
          icon: "target",
          accent: "violet",
          summary:
            "Problem · users · solution · AI role · human role · prototype concept · impact · responsible AI · model · 3-minute pitch.",
        },
      ],
      footer: "Rubric: problem 15% · solution 20% · AI use 15% · feasibility 10% · responsible AI 15% · communication 15% · creativity 10%.",
    },
    170,
  ),

  interactive(
    {
      variant: "flashcard_carousel",
      title: "Module 7 — Flashcard Review",
      cards: [
        { id: "build", front: "B-U-I-L-D", back: "Brand · Upskill · Innovate · Leverage · Demonstrate." },
        { id: "aug", front: "Augmentation", back: "AI helps humans perform better — often not full replacement." },
        { id: "atr", front: "Achievement bullets", back: "Action + Task + Result — verified truth only." },
        { id: "star", front: "STAR", back: "Situation · Task · Action · Result." },
        { id: "pitch", front: "Elevator pitch", back: "Who · What · Evidence · Future." },
        { id: "brief", front: "Executive brief", back: "Findings, risks, recommendation, verified sources." },
        { id: "prod", front: "Productivity rule", back: "Automate routine work — not responsibility." },
        { id: "fly", front: "Career flywheel", back: "Learn → Build → Document → Share → Connect → Apply → Reflect." },
      ],
    },
    180,
  ),

  interactive(
    {
      variant: "feature_cards",
      title: "Module Summary",
      subtitle: "Become AI-ready + career-ready + future-ready — not merely AI-literate.",
      columns: 3,
      cards: [
        { icon: "wand", title: "B — Brand", body: "Headline, bio, portfolio, professional presence." },
        { icon: "book", title: "U — Upskill", body: "Technical + human skills with evidence." },
        { icon: "sparkles", title: "I — Innovate", body: "Research briefs, startups, problem-solving." },
        { icon: "target", title: "L — Leverage", body: "AI productivity stack used responsibly." },
        { icon: "shield", title: "D — Demonstrate", body: "Resume, STAR, pitch — prove it, don't claim it." },
        { icon: "brain", title: "Bridge to Module 8", body: "Team capstone, Innovation Expo, and graduation next." },
      ],
      footer: "You have professional tools and a roadmap. Next: team capstone, Innovation Expo, and graduation.",
    },
    190,
  ),

  reflect("Reflection 1 — How will AI change your preferred career?", 400),
  reflect("Reflection 2 — Which professional skill do you most need to strengthen?", 401),
  reflect("Reflection 3 — Which artifact from this module will be most useful immediately?", 402),
  reflect("Reflection 4 — What part of professional work should AI never completely replace?", 403),
  reflect("Reflection 5 — How will you demonstrate AI ability rather than simply claim it?", 404),
  reflect("Reflection 6 — What career action will you complete within 30 days?", 405),
  {
    block_type: "checkpoint",
    sort_order: 406,
    content: {
      title: "Professional Portfolio Checkpoint",
      description: "Upload resume, bio, or portfolio PDF from your Career Toolkit.",
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg"],
      maxSizeMb: 10,
    },
  },
  {
    block_type: "module_completion",
    sort_order: 407,
    content: {
      title: "Congratulations!",
      message:
        "You completed Module 7: AI Career Accelerator. You can build resumes, brand, pitch, interview with STAR, research professionally, plan your career, and use AI responsibly at work.",
      rewards: {
        xp: 350,
        badges: ["ai-career-accelerator"],
        nextModule: "Module 8: AI Innovation Challenge & Graduation Showcase",
        comingNext:
          "Apply your skills in a team capstone project, present at the AI Innovation Expo, and graduate as an AI Innovator.",
      },
    },
  },
]
