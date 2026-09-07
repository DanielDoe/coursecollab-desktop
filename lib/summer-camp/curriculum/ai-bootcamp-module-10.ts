/**
 * AI Bootcamp Module 9 — Summary, Showcase & Graduation Ceremony (shared).
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

export const AI_BOOTCAMP_MODULE_10: CurriculumModule & { pathway: "shared" } = {
  title: "Module 9: Summary, Showcase & Graduation Ceremony",
  description:
    "Celebrate your AI journey—reflect, showcase, peer-evaluate, complete the final survey, and graduate as a Certified AI Explorer.",
  sort_order: 10,
  pathway: "shared",
  blocks: [
    {
      block_type: "hero",
      sort_order: 0,
      content: {
        title: "Summary, Showcase & Graduation",
        subtitle: "Celebrating Your AI Journey",
        tags: ["Graduate", "Celebrate", "Explorer"],
      },
    },
    callout(
      "Estimated time: 60–90 minutes · Difficulty: All Levels · XP Reward: 500 XP · Badge: Certified AI Explorer · Certificate of Completion",
      1,
    ),
    text(
      "## Welcome to Graduation Day!\n\nOver the past modules you explored Artificial Intelligence—from basics to real AI-powered projects.\n\nToday: celebrate accomplishments, showcase creativity, reflect on your journey, and **officially graduate** from the AI Summer Bootcamp.",
      2,
    ),
    {
      block_type: "interactive",
      sort_order: 3,
      content: { variant: "start_journey", title: "Start Final Mission: Graduation Day" },
    },
    {
      block_type: "mission_objectives",
      sort_order: 4,
      content: {
        title: "Your Final Mission",
        missions: [
          { title: "Reflect on everything you've learned", xp: 50 },
          { title: "Showcase your capstone project", xp: 100 },
          { title: "Learn from classmates (peer feedback)", xp: 75 },
          { title: "Complete the Final Reflection Survey", xp: 75 },
          { title: "Celebrate achievements & receive certificate", xp: 200 },
        ],
      },
    },
    callout(
      "Complete this module to earn **500 XP**, the **Certified AI Explorer** badge, and your **Prairie View A&M University AI Bootcamp Certificate**.",
      5,
      "info",
    ),

    // Section 1 — Journey
    text(
      "## Section 1 — Looking Back: Your AI Journey\n\n### Bootcamp Journey Map\n\nFrom first prompts to Certified AI Explorer — review the milestones below.",
      6,
    ),
    interactive(
      {
        variant: "numbered_steps",
        title: "Bootcamp Journey Roadmap",
        intro: "Your path from Welcome & Orientation through Graduation.",
        layout: "horizontal",
        steps: [
          { icon: "message", title: "Welcome & Orientation", body: "Platform tour and bootcamp roadmap." },
          { icon: "brain", title: "What is AI?", body: "Fundamentals, types, and daily AI chain." },
          { icon: "wand", title: "Exploring AI Tools", body: "Hands-on with major platforms." },
          { icon: "target", title: "Prompt Engineering", body: "R-T-C-A-C-F and strong prompts." },
          { icon: "shield", title: "AI Ethics", body: "PAUSE, bias, privacy, responsible use." },
          { icon: "sparkles", title: "AI Creator Studio", body: "Multi-format creative workflows." },
          { icon: "book", title: "AI Learning Accelerator", body: "Study smarter with AI." },
          { icon: "zap", title: "AI Career Accelerator", body: "Resume, brand, pitch, interview." },
          { icon: "target", title: "Innovation Capstone", body: "Team project and Expo presentation." },
          { icon: "sparkles", title: "Graduation", body: "Celebrate and certify your journey." },
        ],
        footer: "Milestones from basics through capstone to graduation.",
      },
      8,
    ),
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "step_order",
        title: "Put the bootcamp journey in order",
        prompt: "Drag the milestones into the order you experienced them.",
        correctOrder: [
          "Welcome & Orientation",
          "What is Artificial Intelligence?",
          "Exploring AI Tools",
          "Prompt Engineering",
          "AI Ethics",
          "AI Creator Studio",
          "AI Learning Accelerator",
          "AI Career Accelerator",
          "AI Innovation Capstone",
          "Graduation",
        ],
        successMessage: "Welcome → Fundamentals → Tools → Prompts → Ethics → Creator → Learning → Career → Capstone → Graduation",
        retryMessage: "Start with Welcome & Orientation, then follow the module sequence through Graduation.",
      },
    },
    reflect("The most surprising thing I learned…", 9),
    reflect("My favorite module…", 10),
    reflect("The most challenging activity…", 11),
    reflect("One AI tool I will continue using…", 12),

    // Section 2 — Showcase
    text(
      "## Section 2 — Capstone Project Showcase (AI Innovation Expo)\n\n**Presentation:** 5–7 minutes · **Q&A:** 2–3 minutes",
      13,
    ),
    interactive(
      {
        variant: "numbered_steps",
        title: "Presentation Structure",
        layout: "horizontal",
        steps: [
          { icon: "message", title: "Introduction", body: "Name(s), school, grade." },
          { icon: "target", title: "The Problem", body: "What & why it matters." },
          { icon: "brain", title: "Your AI Solution", body: "How AI helped you build it." },
          { icon: "wand", title: "AI Tools Used", body: "ChatGPT, Gemini, Copilot, Canva, Gamma, Perplexity, NotebookLM, Cursor, Lovable, Bolt, etc." },
          { icon: "sparkles", title: "Live Demo", body: "Website, app, video, poster, study guide, prototype…" },
          { icon: "book", title: "Reflection", body: "Biggest challenge, learnings, future improvements." },
        ],
        footer: "Audience activity: for each team, submit one positive comment and one thoughtful question.",
      },
      13,
    ),
    reflect("Expo — My team / project title + 30-second pitch outline:", 14),
    reflect("Audience feedback — Positive comment for a peer team:", 15),
    reflect("Audience feedback — Thoughtful question for a peer team:", 16),

    // Section 3 — Peer Evaluation
    text("## Section 3 — Peer Evaluation", 17),
    interactive(
      {
        variant: "feature_cards",
        title: "Rate a Peer Project (1–5 stars each)",
        columns: 3,
        cards: [
          { icon: "sparkles", title: "Innovation", body: "Novel idea or approach." },
          { icon: "wand", title: "Creativity", body: "Original design and storytelling." },
          { icon: "target", title: "Technical Quality", body: "Solid execution and integration." },
          { icon: "message", title: "Communication", body: "Clear Expo delivery." },
          { icon: "brain", title: "Practical Impact", body: "Real-world usefulness." },
          { icon: "shield", title: "Responsible AI", body: "Ethical, transparent AI use." },
          { icon: "book", title: "Teamwork", body: "Collaboration and shared credit." },
        ],
      },
      17,
    ),
    reflect(
      "Peer evaluation — Project/team name + your star ratings (Innovation–Teamwork) + optional comments:",
      18,
    ),

    // Section 4 — Instructor rubric (info for students)
    text("## Section 4 — Instructor Evaluation (100 points)", 19),
    interactive(
      {
        variant: "comparison_table",
        title: "Instructor Scoring Rubric",
        leftHeader: "Criterion",
        rightHeader: "Points",
        rows: [
          { left: "Problem Definition", right: "15" },
          { left: "AI Tool Integration", right: "20" },
          { left: "Technical Quality", right: "20" },
          { left: "Creativity", right: "15" },
          { left: "Presentation Skills", right: "15" },
          { left: "Reflection", right: "15" },
        ],
        footer: "Instructors score during/after the Expo. Focus on clear problem → solution → demo → reflection.",
      },
      19,
    ),

    // Section 5 — Portfolio
    text("## AI Skills Portfolio\n\nUpload your portfolio packet and review the checklist below.", 20),
    interactive(
      {
        variant: "feature_cards",
        title: "Section 5 — AI Skills Portfolio",
        subtitle: "Skills across fundamentals, creation, learning, career readiness, and capstone delivery.",
        columns: 3,
        cards: [
          { icon: "brain", title: "AI fundamentals", body: "Prompt engineering · responsible AI · tool fluency." },
          { icon: "wand", title: "Creation & build", body: "Image/video · websites/apps · coding assistance." },
          { icon: "book", title: "Learning & career", body: "Research · productivity · career documents · teamwork." },
        ],
      },
      20,
    ),
    interactive(
      {
        variant: "topic_deck",
        title: "Digital Portfolio Checklist",
        comparisonLabels: { left: "Artifact", right: "Include" },
        comparisonRows: [
          { left: "Resume", right: "Updated from Career Accelerator module." },
          { left: "Capstone project", right: "Slides, demo link, or summary PDF." },
          { left: "AI artwork & presentation", right: "Creator Studio highlights." },
          { left: "Website (optional)", right: "Portfolio or project landing page." },
          { left: "Project video & reflection", right: "5–7 min video + 2–3 page report." },
          { left: "Certificates", right: "Bootcamp badges and completion proof." },
        ],
      },
      20,
    ),
    {
      block_type: "checkpoint",
      sort_order: 21,
      content: {
        title: "Upload your AI Skills Portfolio packet",
        description:
          "PDF or ZIP with resume, capstone highlights, optional artwork/presentation screenshots, and reflection notes.",
        acceptedTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "application/zip",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        maxSizeMb: 50,
        facultyApproval: true,
      },
    },

    // Section 6 — Careers
    text("## AI Career Pathways", 22),
    interactive(
      {
        variant: "feature_cards",
        title: "Section 6 — AI Career Pathways",
        subtitle: "AI is transforming industries across healthcare, technology, and society.",
        columns: 3,
        cards: [
          { icon: "shield", title: "Healthcare & science", body: "Diagnostics, research, environmental science." },
          { icon: "zap", title: "Technology & transport", body: "Software, games, autonomous systems, space." },
          { icon: "book", title: "Society & business", body: "Education, agriculture, law, finance, entertainment." },
        ],
      },
      22,
    ),
    reflect("Which career interests you most, and how could AI make that career better?", 23),

    // Section 7 — Continue
    text("## Continue Your AI Journey", 24),
    interactive(
      {
        variant: "feature_cards",
        title: "Section 7 — Continue Your AI Journey",
        subtitle: "Keep exploring courses, skills, and project ideas after graduation.",
        columns: 2,
        cards: [
          {
            icon: "book",
            title: "Learn next",
            body: "Free online courses · Python · robotics · machine learning · data science · web/mobile dev.",
          },
          {
            icon: "sparkles",
            title: "Suggested projects",
            body: "AI chatbot · mobile app · portfolio site · tutoring assistant · educational game · smart home · computer vision · hackathons.",
          },
        ],
      },
      24,
    ),
    reflect("One future project or workshop topic you want to pursue next:", 25),

    // Section 8 — Final Survey
    text("## Final Reflection Survey\n\nAnswer each prompt honestly — your feedback shapes the next cohort.", 26),
    callout("Complete every survey item before marking the module done.", 26, "info"),
    {
      block_type: "activity",
      sort_order: 27,
      content: {
        title: "Before this bootcamp, how much did you know about AI?",
        prompt: "Select one.",
        activityType: "poll",
        multiSelect: false,
        options: ["Nothing", "A Little", "Some Knowledge", "A Lot"],
        revealMessage: "Every starting point is valid—growth is what counts.",
      },
    },
    {
      block_type: "feedback",
      sort_order: 28,
      content: {
        question: "After this bootcamp, how confident are you using AI responsibly? (1–5)",
      },
    },
    {
      block_type: "activity",
      sort_order: 29,
      content: {
        title: "Which module had the greatest impact on your learning?",
        prompt: "Select one.",
        activityType: "poll",
        multiSelect: false,
        options: [
          "AI Fundamentals",
          "AI Tools",
          "Prompt Engineering",
          "AI Ethics",
          "AI Creator Studio",
          "AI Learning Accelerator",
          "AI Career Development",
          "Capstone Project",
        ],
        revealMessage: "Thanks—your answer helps shape the next cohort.",
      },
    },
    reflect("Which AI tool was your favorite?", 30),
    reflect("What new skill are you most proud of?", 31),
    reflect("How do you plan to use AI after this workshop?", 32),
    {
      block_type: "activity",
      sort_order: 33,
      content: {
        title: "Would you recommend this bootcamp to a friend?",
        prompt: "Select one, then explain below.",
        activityType: "poll",
        multiSelect: false,
        options: ["Yes", "Maybe", "No"],
        revealMessage: "Your honesty helps us improve.",
      },
    },
    reflect("Explain your recommendation answer:", 34),
    {
      block_type: "activity",
      sort_order: 35,
      content: {
        title: "Which future workshops would you like to attend?",
        prompt: "Select ALL that interest you.",
        activityType: "poll",
        multiSelect: true,
        options: [
          "Robotics",
          "Cybersecurity",
          "Machine Learning",
          "Data Science",
          "Drone Technology",
          "IoT & Smart Cities",
          "Programming",
          "Game Development",
          "App Development",
          "AI Research",
          "Computer Vision",
          "Raspberry Pi & Edge AI",
        ],
        revealMessage: "Great—we'll use interest signals for future CREDIT Center programs.",
      },
    },

    // Section 9 — Achievement summary
    text("## Camp Achievement Summary", 36),
    interactive(
      {
        variant: "feature_cards",
        title: "Section 9 — Camp Achievement Summary",
        subtitle: "You completed Modules 0–9 from Welcome through Innovation Capstone.",
        columns: 3,
        cards: [
          { icon: "message", title: "Communicate with AI", body: "Professional prompts and tool fluency." },
          { icon: "wand", title: "Create with AI", body: "Media, websites, apps, and presentations." },
          { icon: "shield", title: "Use AI responsibly", body: "Ethics, verification, and PAUSE." },
          { icon: "book", title: "Study & research", body: "Learning accelerator and evidence-backed work." },
          { icon: "target", title: "Career-ready", body: "Resume, brand, pitch, portfolio artifacts." },
          { icon: "sparkles", title: "Innovate & present", body: "Capstone solution and Expo delivery." },
        ],
      },
      36,
    ),

    // Section 10 — Ceremony
    text("## Graduation Ceremony", 37),
    interactive(
      {
        variant: "feature_cards",
        title: "Section 10 — Graduation Ceremony",
        subtitle: "Prairie View A&M University AI Summer Bootcamp · ECE · CREDIT Center",
        columns: 2,
        cards: [
          { icon: "book", title: "Modules 0–9 complete", body: "Knowledge checks and checkpoints submitted." },
          { icon: "target", title: "Capstone & Expo", body: "Project submitted · Expo presentation · final survey." },
        ],
      },
      37,
    ),
    interactive(
      {
        variant: "feature_cards",
        title: "Graduation Awards (celebrated in class)",
        columns: 3,
        cards: [
          { icon: "sparkles", title: "Outstanding AI Innovator", body: "Top overall achievement." },
          { icon: "wand", title: "Best Capstone", body: "Strongest complete project." },
          { icon: "target", title: "Best Technical Solution", body: "Excellent execution." },
          { icon: "brain", title: "Most Creative", body: "Original idea and design." },
          { icon: "message", title: "Best Presentation", body: "Engaging Expo delivery." },
          { icon: "book", title: "Best Teamwork", body: "Collaborative capstone success." },
          { icon: "zap", title: "Future Entrepreneur", body: "Startup-ready pitch." },
          { icon: "shield", title: "Responsible AI Champion", body: "Exemplary ethical AI use." },
          { icon: "sparkles", title: "People's Choice", body: "Audience favorite." },
        ],
        footer:
          "🎉 You officially graduate from the Prairie View A&M University AI Summer Bootcamp · Department of Electrical & Computer Engineering · CREDIT Center",
      },
      37,
    ),
    {
      block_type: "checkpoint",
      sort_order: 38,
      content: {
        title: "Optional: Graduation photo / class selfie",
        description: "Upload a graduation or Expo photo for the gallery (optional).",
        acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
        maxSizeMb: 15,
      },
    },
    interactive(
      {
        variant: "feature_cards",
        title: "Final Message",
        columns: 1,
        cards: [
          {
            icon: "sparkles",
            title: "You are now a Certified AI Explorer",
            body: "AI's greatest strength is helping people become more creative, productive, and better problem solvers. Continue asking questions. Continue learning. Continue creating. Use AI responsibly to make a positive impact. The future isn't something you wait for — it's something you build. Thank you for being part of the Prairie View A&M University AI Summer Bootcamp.",
          },
        ],
        footer: "🚀 The future starts with you.",
      },
      39,
    ),
    reflect("Alumni interest — Email or preferred contact (optional) for future CREDIT Center opportunities:", 40),
    {
      block_type: "feedback",
      sort_order: 41,
      content: {
        kind: "clarity",
        question: "Was Graduation Day clear, meaningful, and well organized?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 42,
      content: {
        title: "Congratulations — Certified AI Explorer!",
        message:
          "You graduated from the Prairie View A&M University AI Summer Bootcamp. Download your Certificate of Completion from the Graduation hub. Keep learning, keep building, keep innovating.",
        rewards: {
          xp: 500,
          badges: ["certified-ai-explorer", "camp-certificate-2026"],
          nextModule: "Graduation Hub — Download Certificate",
          comingNext:
            "Open Summer Camp → Graduation to view and download your personalized Certificate of Completion and alumni achievements.",
        },
      },
    },
  ],
}
