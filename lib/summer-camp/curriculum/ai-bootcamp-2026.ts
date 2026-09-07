/**
 * AI Bootcamp curriculum — Module 0 mission briefing + pathway modules.
 * Seeded via scripts/seed-ai-bootcamp-curriculum.ts
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_1_HS } from "./ai-bootcamp-module-1"
import { AI_BOOTCAMP_MODULE_2 } from "./ai-bootcamp-module-2"
import { AI_BOOTCAMP_MODULE_3 } from "./ai-bootcamp-module-3"
import { AI_BOOTCAMP_MODULE_4 } from "./ai-bootcamp-module-4"
import { AI_BOOTCAMP_MODULE_5 } from "./ai-bootcamp-module-5"
import { AI_BOOTCAMP_MODULE_6 } from "./ai-bootcamp-module-6"
import { AI_BOOTCAMP_MODULE_8 } from "./ai-bootcamp-module-8"
import { AI_BOOTCAMP_MODULE_9 } from "./ai-bootcamp-module-9"
import { AI_BOOTCAMP_MODULE_10 } from "./ai-bootcamp-module-10"

function text(markdown: string, sort: number): CurriculumBlock {
  return { block_type: "text", content: { markdown }, sort_order: sort }
}

function callout(textContent: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", content: { variant, text: textContent }, sort_order: sort }
}

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

function reflect(prompt: string, sort: number): CurriculumBlock {
  return { block_type: "reflection", content: { prompt }, sort_order: sort }
}

function interactive(content: Record<string, unknown>, sort: number): CurriculumBlock {
  return { block_type: "interactive", content, sort_order: sort }
}

export const AI_BOOTCAMP_MODULES: Array<
  CurriculumModule & { pathway?: "high-school" | "freshman" | "shared" }
> = [
  {
    title: "Module 0 — Welcome to the Foundational AI Workshop",
    description:
      "Mission briefing: workshop goals, platform tour, instructors, expectations, Responsible AI pledge, and readiness check.",
    sort_order: 0,
    pathway: "shared",
    blocks: [
      {
        block_type: "hero",
        sort_order: 0,
        content: {
          variant: "cover",
          title: "Welcome to the Foundational AI Workshop",
          subtitle: "Mission Briefing · Discover, Create, and Succeed with AI",
          tags: ["AI", "Workshop", "Mission", "Responsible AI"],
          imageUrl: "/summer-camp/ai-bootcamp/assets/module-0/m0-hero.png",
        },
      },
      callout(
        "Estimated time: 20–30 minutes · Difficulty: Beginner · XP Reward: 100 XP · Badge: AI Explorer",
        1,
      ),
      interactive(
        {
          variant: "feature_cards",
          title: "Learning Objectives",
          subtitle: "By the end of this module, you will:",
          columns: 2,
          cards: [
            { icon: "sparkles", title: "Workshop goals", body: "Understand the goals of the Foundational AI Workshop" },
            { icon: "cpu", title: "Platform tour", body: "Become familiar with the CourseCollab learning platform" },
            { icon: "map", title: "Workshop map", body: "Understand how the workshop is organized" },
            { icon: "brain", title: "Meet mentors", body: "Meet the instructors and mentors" },
            { icon: "message", title: "Get help", body: "Learn how to ask for help" },
            { icon: "zap", title: "Readiness check", body: "Complete the workshop readiness assessment" },
            { icon: "book", title: "Responsible AI", body: "Accept the Responsible AI Pledge" },
            { icon: "wand", title: "Start strong", body: "Prepare for your AI learning journey" },
          ],
        },
        2,
      ),
      {
        block_type: "interactive",
        sort_order: 3,
        content: { variant: "start_journey", title: "Start My Mission Briefing" },
      },
      text(
        "## Mission Briefing\n\n### Welcome, Future AI Innovator!\n\nArtificial Intelligence is transforming how people learn, communicate, solve problems, and create. During this workshop, you won't just hear about AI — you'll **use** it to collaborate, create, and build projects.",
        4,
      ),
      {
        block_type: "mission_objectives",
        sort_order: 5,
        content: {
          title: "Your Mission — Next Two Days",
          missions: [
            { title: "Learn what Artificial Intelligence is", xp: 25 },
            { title: "Explore popular AI tools", xp: 25 },
            { title: "Write effective prompts", xp: 25 },
            { title: "Create text, images, and presentations", xp: 25 },
            { title: "Discover AI strengths and limits", xp: 25 },
            { title: "Build an AI-powered team project", xp: 50 },
            { title: "Present your ideas", xp: 50 },
          ],
        },
      },
      callout("Complete this orientation to earn **100 XP** and the **AI Explorer** badge.", 6, "info"),
      {
        block_type: "image_gallery",
        sort_order: 8,
        content: {
          caption: "Orientation highlights — workshop goals, platform tour, and team checklist.",
          cards: [
            { title: "Welcome", description: "Opening session and introductions.", imageUrl: "/summer-camp/ai-bootcamp/assets/module-0/m0-welcome-group.png" },
            { title: "Core Concepts", description: "Human expertise + AI fluency + professional habits.", imageUrl: "/summer-camp/ai-bootcamp/assets/module-0/m0-core-concepts.png" },
            { title: "Workshop Agenda", description: "Session map, labs, and deliverables.", imageUrl: "/summer-camp/ai-bootcamp/assets/module-0/m0-workshop-agenda.png" }
          ]
        }
      },
      text(
        "## Section 1: Your AI Journey\n\nAI is becoming important in every profession — not just computer science. By the end of this workshop, you'll know when AI helps, when human judgment matters, and how to use both responsibly.",
        7,
      ),
      interactive(
        {
          variant: "numbered_steps",
          layout: "horizontal",
          title: "AI Bootcamp Roadmap",
          intro: "Your learning journey over the next two days. Each milestone builds on the previous one.",
          steps: [
            {
              icon: "brain",
              title: "Basics",
              body: "Build a clear mental model of what AI is — and what it is not.",
              details: ["Day 1 · Morning", "Definitions, examples, and human vs. machine thinking", "Foundation for every module that follows"],
            },
            {
              icon: "cpu",
              title: "Tools",
              body: "Try the AI assistants you'll use throughout the workshop.",
              details: ["Day 1 · Midday", "Hands-on with chat, image, and productivity tools", "Learn where each tool shines"],
            },
            {
              icon: "message",
              title: "Prompts",
              body: "Write instructions that get useful, accurate responses.",
              details: ["Day 1 · Afternoon", "Role, context, format, and iteration", "Turn vague asks into strong prompts"],
            },
            {
              icon: "book",
              title: "Ethics",
              body: "Use AI responsibly in school, projects, and everyday life.",
              details: ["Day 1 · Wrap-up", "Privacy, bias, citations, and academic integrity", "Commit to the Responsible AI pledge"],
            },
            {
              icon: "wand",
              title: "Create",
              body: "Produce text, images, and slides with AI as a creative partner.",
              details: ["Day 2 · Morning", "Draft, refine, and polish real workshop outputs", "Combine prompts with your own ideas"],
            },
            {
              icon: "sparkles",
              title: "Team project",
              body: "Collaborate on a capstone idea with classmates.",
              details: ["Day 2 · Midday", "Plan, divide tasks, and use AI to accelerate work", "Submit checkpoints on the platform"],
            },
            {
              icon: "zap",
              title: "Present",
              body: "Share your project and explain how AI helped your team.",
              details: ["Day 2 · Afternoon", "Short presentation + peer feedback", "Highlight what you learned, not just what AI generated"],
            },
            {
              icon: "lightbulb",
              title: "Certificate",
              body: "Celebrate skills gained and unlock your workshop certificate.",
              details: ["Day 2 · Closing", "Review XP, badges, and graduation showcase", "Take your portfolio forward after camp"],
            },
          ],
        },
        8,
      ),
      text(
        "## Section 2: Meet Your Learning Platform\n\nEverything you need for the workshop lives inside CourseCollab — lessons, activities, discussions, and project checkpoints in one place.",
        9,
      ),
      interactive(
        {
          variant: "feature_cards",
          title: "What You'll Find",
          columns: 2,
          cards: [
            { icon: "book", title: "Learning Modules", body: "Step-by-step interactive lessons" },
            { icon: "zap", title: "Interactive Activities", body: "Practice with AI tools" },
            { icon: "message", title: "Discussion Board", body: "Collaborate with classmates" },
            { icon: "brain", title: "AI Assistant", body: "Ask questions while you learn" },
            { icon: "sparkles", title: "XP & Badges", body: "Reward your progress" },
            { icon: "map", title: "Progress Tracker", body: "See what's done and what's next" },
            { icon: "cpu", title: "Project Submission", body: "Upload checkpoints and deliverables" },
          ],
        },
        10,
      ),
      {
        block_type: "interactive",
        sort_order: 11,
        content: {
          variant: "matching",
          title: "Platform Tour — Match Each Feature",
          prompt: "Tap a term on the left, then tap its matching description on the right.",
          pairs: [
            { task: "AI Assistant", capability: "Ask questions during the workshop" },
            { task: "Discussion Board", capability: "Collaborate with classmates" },
            { task: "Progress Tracker", capability: "Monitor workshop completion" },
            { task: "XP & Badges", capability: "Reward achievements" },
          ],
        },
      },
      text(
        "## Section 3: Meet Your Instructors\n\nLearning AI is easier when experienced mentors are available to help.",
        12,
      ),
      {
        block_type: "faculty_cards",
        sort_order: 13,
        content: {
          faculty: [
            {
              name: "Workshop Instructor",
              role: "Lead Instructor",
              interests: "Artificial Intelligence, Edge Computing, Education",
              funFact:
                "I look forward to exploring AI with you. Ask questions, stay curious, and enjoy building exciting projects together.",
            },
          ],
          assistants: [
            {
              name: "Teaching Assistant",
              role: "Mentor / TA",
              funFact: "Helps with prompts, tools, and project troubleshooting during both workshop days.",
            },
          ],
        },
      },
      text(
        "## Section 4: How This Workshop Works\n\nEvery module follows the same interactive structure. Tap each step below to see what you'll do in each lesson.",
        14,
      ),
      interactive(
        {
          variant: "numbered_steps",
          title: "Module Learning Cycle",
          steps: [
            {
              icon: "map",
              title: "Mission Briefing",
              body: "Every module opens with a briefing so you know exactly what you are working toward before any lesson content loads.",
              details: [
                {
                  label: "Learning objectives",
                  text: "A numbered checklist of 3–5 skills you will build in this module — for example, defining AI, comparing tools, or writing a strong prompt. Each objective maps to a section you can mark complete.",
                },
                {
                  label: "XP & rewards preview",
                  text: "See how many experience points you can earn from activities, quizzes, reflections, and discussions. Badges you can unlock in this module are listed here so you know what to aim for.",
                },
                {
                  label: "Time & flow overview",
                  text: "A quick read of how long the module takes and the order of sections: briefing → lesson → activities → flashcards → quiz → reflection → progress. Helps you plan breaks during the workshop day.",
                },
                {
                  label: "Capstone connection",
                  text: "A short note linking today's skills to your team project or graduation showcase — so you know which outputs to save for later checkpoints.",
                },
              ],
            },
            {
              icon: "book",
              title: "Interactive Lesson",
              body: "The core teaching section — concepts are broken into scannable cards, diagrams, and tap-to-expand sections instead of long text walls.",
              details: [
                {
                  label: "Concept cards & visuals",
                  text: "Key ideas appear as cards with icons, short definitions, and real-world examples (e.g., how Netflix recommends shows or how spam filters work). Diagrams and comparison tables replace dense paragraphs.",
                },
                {
                  label: "Step-by-step explainers",
                  text: "Numbered flows walk through processes like how a prompt travels from your input to an AI response, or how training data becomes a prediction. Tap each step to read more detail.",
                },
                {
                  label: "Worked examples",
                  text: "Before/after demonstrations show weak vs. strong approaches — you see the actual input, the AI output, and why one version works better. Examples match the workshop theme for that day.",
                },
                {
                  label: "AI Assistant access",
                  text: "While reading, you can open the built-in AI Assistant to ask 'What does this term mean?' or request a simpler explanation — without leaving the lesson or losing your place.",
                },
              ],
            },
            {
              icon: "zap",
              title: "Activities",
              body: "Hands-on exercises where you use AI tools yourself, guided by prompts and checkpoints so you are never staring at a blank screen.",
              details: [
                {
                  label: "Guided prompt labs",
                  text: "Copy-ready prompt templates with blanks to fill in (role, task, format, audience). You paste into ChatGPT, Claude, or the workshop tool and compare your result to the suggested outcome.",
                },
                {
                  label: "Matching & sorting games",
                  text: "Drag-and-drop or tap-to-pair activities — match AI terms to definitions, sort tasks into 'good for AI' vs. 'needs human judgment', or connect platform features to what they do.",
                },
                {
                  label: "Create & iterate tasks",
                  text: "Short build assignments: draft an email, generate an image from a prompt, outline slides, or refine a paragraph through two rounds of AI feedback. You submit or save the best version.",
                },
                {
                  label: "Tool walkthroughs",
                  text: "Screenshots and numbered steps for each AI tool used in camp — where to click, what settings matter, and common mistakes to avoid. Checkpoints confirm you completed each step.",
                },
              ],
            },
            {
              icon: "sparkles",
              title: "Flashcards",
              body: "A focused vocabulary review pulled from the lesson so key terms stick before the quiz.",
              details: [
                {
                  label: "Module vocabulary deck",
                  text: "Typically 8–15 cards covering terms introduced in the lesson (e.g., prompt, hallucination, training data, narrow AI). Front shows the term; back shows a plain-language definition.",
                },
                {
                  label: "Flip & self-check",
                  text: "Tap to flip each card. Mark whether you knew it or need another look — the deck reshuffles so you review weak cards more often.",
                },
                {
                  label: "Example on every card",
                  text: "Definitions include a one-line example from everyday life or the workshop context, not just dictionary text — so you remember when to use the term.",
                },
                {
                  label: "Quiz prep mode",
                  text: "Flashcards mirror concepts tested in the knowledge check. Completing the deck is the recommended step right before you start the quiz.",
                },
              ],
            },
            {
              icon: "brain",
              title: "Knowledge Check",
              body: "A short assessment tied directly to the module objectives — low pressure, focused on finding gaps rather than ranking students.",
              details: [
                {
                  label: "5–10 targeted questions",
                  text: "Mix of multiple choice, true/false, and short response items. Every question maps back to a learning objective from the mission briefing so nothing feels random.",
                },
                {
                  label: "Instant feedback",
                  text: "After each answer you see whether you were correct and a one-sentence explanation of why — especially helpful for ethics and prompt-engineering scenarios.",
                },
                {
                  label: "Retakes encouraged",
                  text: "You can retry until you are confident. The goal is mastery, not a single score. Instructors see completion, not how many attempts you needed.",
                },
                {
                  label: "XP on completion",
                  text: "Earn points for finishing the check; some modules add bonus XP for strong scores. Passing unlocks the reflection and progress sections.",
                },
              ],
            },
            {
              icon: "message",
              title: "Reflection",
              body: "A structured pause to process what you learned — written for you, visible to instructors when you choose to share.",
              details: [
                {
                  label: "Guided reflection prompts",
                  text: "Questions like 'What surprised you?', 'Where could AI help in your own schoolwork?', and 'What would you do differently next time?' — text boxes save automatically as you type.",
                },
                {
                  label: "Discussion thread option",
                  text: "Some modules link to a class discussion where you can post your reflection and read classmates' ideas. Thoughtful posts can earn a First Discussion badge.",
                },
                {
                  label: "Private journal save",
                  text: "Reflections save to your camper profile and journal either way — so you build a record of growth across all nine modules even if you post publicly or not.",
                },
                {
                  label: "Instructor follow-up",
                  text: "Teaching assistants review reflections to spot who needs help with prompts, tools, or project direction — especially before capstone work begins.",
                },
              ],
            },
            {
              icon: "lightbulb",
              title: "Progress",
              body: "The closing section where completion is recorded, rewards are applied, and the next module unlocks on your roadmap.",
              details: [
                {
                  label: "Section completion checklist",
                  text: "A visual list of every part of the module (briefing, lesson, activities, flashcards, quiz, reflection) with checkmarks for what you finished and what remains.",
                },
                {
                  label: "XP & badge awards",
                  text: "Total XP earned in this module appears here, broken down by activity type. New badges (e.g., AI Explorer, Prompt Builder) pop up when you hit milestones.",
                },
                {
                  label: "Module completion certificate",
                  text: "Finishing all required sections marks the module complete on your dashboard and learning roadmap — required before the next scheduled module opens.",
                },
                {
                  label: "What's next preview",
                  text: "A teaser of the following module's title and first objective so you know what tomorrow's workshop day will cover.",
                },
              ],
            },
          ],
        },
        15,
      ),
      text(
        "## Section 5: Meet Your AI Assistant\n\nThroughout the workshop you'll have access to an AI Assistant inside CourseCollab.",
        16,
      ),
      interactive(
        {
          variant: "feature_cards",
          title: "How Your AI Assistant Helps",
          columns: 2,
          cards: [
            { icon: "book", title: "Explain concepts", body: "Break down difficult ideas in plain language" },
            { icon: "brain", title: "Review quizzes", body: "Clarify knowledge-check questions" },
            { icon: "message", title: "Improve prompts", body: "Suggest stronger instructions for AI tools" },
            { icon: "sparkles", title: "Brainstorm ideas", body: "Generate starting points for projects" },
            { icon: "zap", title: "Troubleshoot activities", body: "Get unstuck during hands-on tasks" },
          ],
          footer:
            "Important: The AI Assistant helps you **learn** — not complete your work for you. Always think critically and verify AI-generated information.",
        },
        17,
      ),
      reflect(
        'Try It! Ask yourself (or the AI Assistant): "What is one interesting fact about Artificial Intelligence?" Record your favorite response here.',
        18,
      ),
      text(
        "## Section 6: Workshop Expectations\n\nBring curiosity and willingness to learn — here's what helps you succeed, and what you don't need to worry about.",
        19,
      ),
      interactive(
        {
          variant: "feature_cards",
          title: "Workshop Expectations",
          columns: 2,
          cards: [
            { icon: "sparkles", title: "Be curious", body: "Try new tools and ideas" },
            { icon: "message", title: "Ask questions", body: "Instructors and AI are here to help" },
            { icon: "brain", title: "Collaborate respectfully", body: "Work well with classmates" },
            { icon: "wand", title: "Experiment", body: "Test ideas without fear of mistakes" },
            { icon: "book", title: "Verify AI output", body: "Check important facts independently" },
            { icon: "lightbulb", title: "Respect privacy & copyright", body: "Use AI ethically" },
            { icon: "zap", title: "No programming required", body: "You don't need coding experience" },
            { icon: "cpu", title: "No prior AI knowledge", body: "Beginners are welcome" },
          ],
          footer: "Just bring your curiosity and willingness to learn.",
        },
        20,
      ),
      text(
        "## Section 7: Responsible AI Pledge\n\nBefore continuing, commit to using AI responsibly. Select every commitment below, then save.",
        21,
      ),
      {
        block_type: "activity",
        sort_order: 22,
        content: {
          title: "Responsible AI Pledge",
          prompt: "I will:",
          activityType: "poll",
          multiSelect: true,
          options: [
            "Protect personal information",
            "Verify important AI-generated information",
            "Respect copyright",
            "Follow academic integrity guidelines",
            "Use AI ethically and responsibly",
            "Treat AI as a learning partner — not a replacement for my own thinking",
          ],
          revealMessage:
            "Thank you. Completing Module 0 records your pledge and unlocks the next workshop modules.",
          saveToProfile: true,
          profileKey: "aiBootcampPledge",
        },
      },
      text(
        "## Section 8: Readiness Check\n\nHelp us personalize your workshop experience.",
        23,
      ),
      {
        block_type: "activity",
        sort_order: 24,
        content: {
          title: "How familiar are you with AI?",
          prompt: "Choose the option that fits you best.",
          activityType: "poll",
          multiSelect: false,
          options: [
            "Never used it",
            "Tried it once",
            "Occasionally use it",
            "Frequently use it",
          ],
          saveToProfile: true,
          profileKey: "aiFamiliarity",
        },
      },
      {
        block_type: "activity",
        sort_order: 25,
        content: {
          title: "Which topics interest you the most?",
          prompt: "Select all that apply.",
          activityType: "poll",
          multiSelect: true,
          options: [
            "AI Basics",
            "Prompt Engineering",
            "AI Images",
            "Presentations",
            "Research",
            "Coding",
            "Career Skills",
          ],
          saveToProfile: true,
          profileKey: "aiInterests",
        },
      },
      {
        block_type: "confidence",
        sort_order: 26,
        content: {
          question: "How excited are you about learning AI? (1 = a little, 5 = extremely excited)",
        },
      },
      reflect("What do you hope to learn during this workshop?", 27),
      {
        block_type: "interactive",
        sort_order: 28,
        content: {
          variant: "flashcard_carousel",
          title: "Flashcard Preview",
          cards: [
            {
              id: "ai",
              front: "Artificial Intelligence",
              back: "Technology that enables computers to perform tasks that normally require human intelligence.",
            },
            {
              id: "prompt",
              front: "Prompt",
              back: "The instruction given to an AI system.",
            },
            {
              id: "generative",
              front: "Generative AI",
              back: "AI that creates new text, images, audio, code, or other content.",
            },
            {
              id: "responsible",
              front: "Responsible AI",
              back: "Using AI safely, fairly, ethically, and transparently.",
            },
          ],
        },
      },
      kc(
        "Knowledge Check",
        [
          {
            id: "q1",
            prompt: "True or False: You need programming experience before using AI.",
            options: ["True", "False"],
            correctIndex: 1,
            trueFalse: true,
          },
          {
            id: "q2",
            prompt: "Which feature helps you ask questions during the workshop?",
            options: ["Progress Tracker", "AI Assistant", "Badge Gallery", "Leaderboard"],
            correctIndex: 1,
          },
          {
            id: "q3",
            prompt: "Select ALL that are workshop expectations.",
            options: [
              "Ask questions",
              "Verify AI information",
              "Respect others",
              "Protect personal information",
            ],
            multiSelect: true,
            correctIndices: [0, 1, 2, 3],
          },
          {
            id: "q4",
            prompt: "True or False: AI should always be trusted without verification.",
            options: ["True", "False"],
            correctIndex: 1,
            trueFalse: true,
          },
          {
            id: "q5",
            prompt: "What is the purpose of this workshop?",
            options: [
              "Memorize AI definitions",
              "Learn to responsibly use AI to create, learn, and solve problems",
              "Learn advanced programming only",
              "Build robots",
            ],
            correctIndex: 1,
          },
        ],
        29,
      ),
      reflect("What are you most excited to learn?", 30),
      reflect("Do you have any concerns before starting?", 31),
      {
        block_type: "feedback",
        sort_order: 32,
        content: {
          kind: "clarity",
          question: "Was this orientation clear and helpful?",
        },
      },
      interactive(
        {
          variant: "feature_cards",
          title: "Need Help?",
          columns: 3,
          cards: [
            { icon: "message", title: "Ask Instructor", body: "Use Support or discussion mentions" },
            { icon: "brain", title: "Ask AI Assistant", body: "Get explanations and prompt ideas" },
            { icon: "sparkles", title: "Open Discussion", body: "Collaborate with classmates on this module" },
          ],
        },
        33,
      ),
      {
        block_type: "module_completion",
        sort_order: 34,
        content: {
          title: "Congratulations!",
          message:
            "You have completed your workshop orientation. Workshop Orientation Complete · Responsible AI Pledge Accepted · Readiness Assessment Complete.",
          rewards: {
            xp: 100,
            badges: ["ai-explorer"],
            nextModule: "Module 1: What Is Artificial Intelligence?",
            comingNext:
              "In the next module, you'll discover what AI is, how it works, where it's used in everyday life, and separate common myths from reality.",
          },
        },
      },
    ],
  },
  AI_BOOTCAMP_MODULE_1_HS,
  AI_BOOTCAMP_MODULE_2,
  AI_BOOTCAMP_MODULE_3,
  AI_BOOTCAMP_MODULE_4,
  AI_BOOTCAMP_MODULE_5,
  AI_BOOTCAMP_MODULE_6,
  AI_BOOTCAMP_MODULE_8,
  AI_BOOTCAMP_MODULE_9,
  AI_BOOTCAMP_MODULE_10,
]

export function pathwayFromModuleTitle(title: string): "high-school" | "freshman" | "shared" | null {
  if (title.includes("Module 0") || title.includes("Welcome to the AI Bootcamp") || title.includes("Welcome to the Foundational AI Workshop")) return "shared"
  if (title.includes("Exploring AI Tools")) return "shared"
  if (title.includes("Prompt Engineering")) return "shared"
  if (title.includes("AI Ethics") || title.includes("Responsible AI")) return "shared"
  if (title.includes("AI Creator Studio")) return "shared"
  if (title.includes("AI Learning Accelerator") || title.includes("AI for Academic Success")) return "shared"
  if (title.includes("AI Career Accelerator") || title.includes("Career & Professional") || title.includes("AI Career Builder")) return "shared"
  if (title.includes("Innovation Challenge") || title.includes("Graduation Showcase")) return "shared"
  if (title.includes("Summary, Showcase") || title.includes("Graduation Ceremony")) return "shared"
  if (title.includes("What Is Artificial Intelligence")) return "high-school"
  if (title.includes("AI in College")) return "freshman"
  return null
}
