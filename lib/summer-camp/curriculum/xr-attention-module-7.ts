/**
 * Module 7 — Building Educational VR Experiences
 * XR Attention Analytics · Summer Research Training 2026
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

function reflect(prompt: string, sort: number, extra?: Record<string, unknown>): CurriculumBlock {
  return { block_type: "reflection", sort_order: sort, content: { prompt, ...extra } }
}

function callout(text: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", sort_order: sort, content: { variant, text } }
}

function step(title: string, description: string, sort: number): CurriculumBlock {
  return {
    block_type: "step",
    sort_order: sort,
    content: { title, description, checkable: true },
  }
}

function checkpoint(title: string, description: string, sort: number): CurriculumBlock {
  return {
    block_type: "checkpoint",
    sort_order: sort,
    content: {
      title,
      description,
      acceptedTypes: [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ],
      maxSizeMb: 25,
      facultyApproval: true,
    },
  }
}

export const XR_ATTENTION_MODULE_7: CurriculumModule = {
  title: "Module 7 — Building Educational VR Experiences",
  description:
    "Educational VR design principles, virtual classroom layout, interactive content, attention guidance, lesson flow, and data-collection hooks.",
  sort_order: 7,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 2–3 hours · Difficulty: Intermediate · XP reward: 250 XP · Badge: Educational XR Designer",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Building Educational VR Experiences",
        subtitle: "Designing Learning Environments for the Future",
        tags: ["Educational VR", "Unity", "Classroom Design", "Interaction", "Learning"],
        imageUrl: "/summer-camp/xr-attention/xr-module-7-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The hero above shows the target experience: a student-centered VR classroom with interactive learning content and analytics.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand what makes VR learning effective
- Design a virtual classroom environment
- Create educational content inside Unity
- Build interactive learning experiences
- Guide student attention inside VR
- Create a complete VR lesson
- Prepare the environment for future data collection`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Welcome to Educational VR Design

Welcome to Module 7.

So far you have learned XR fundamentals, human attention, eye tracking, HTC Vive Pro Eye setup, multimodal sensing, and Unity XR development.

Now it is time to build something meaningful.

Technology alone does not create learning. A VR headset alone does not educate students.

A virtual classroom becomes valuable only when it is **designed** to help people understand, explore, and interact with knowledge.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 5,
      content: {
        variant: "start_journey",
        title: "🏫 Enter the Virtual Classroom",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — What Makes Learning Effective?

Think about the best class you have ever taken. Was it memorable because of the slides? Probably not.

Memorable learning involves exploration, experimentation, interaction, problem solving, and immediate feedback.

Educational VR lets you walk through a circuit, disassemble a machine, or participate inside a simulation — not just read about them.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "From lecture to VR learning",
        steps: [
          "Traditional Lecture",
          "Student Watches",
          "VR Learning Experience",
          "Student Interacts",
          "Student Explores",
          "Student Learns",
        ],
      },
    },
    {
      block_type: "reflection",
      sort_order: 8,
      content: {
        prompt: "Which learning style do you enjoy most?",
        options: [
          "Reading",
          "Watching Videos",
          "Hands-On Activities",
          "Interactive Simulations",
          "Group Projects",
        ],
        saveToProfile: true,
        profileKey: "preferredLearningStyle",
      },
    },
    {
      block_type: "text",
      sort_order: 9,
      content: {
        markdown: `## Section 3 — Principles of Educational VR Design

### Educational design pyramid

Content → Interaction → Engagement → **Learning**

### Principle 1 — Active learning

Students participate — manipulate objects, explore environments, solve problems, perform experiments.

### Principle 2 — Immediate feedback

Quiz responses, activity completion, visual indicators, AI assistance.

### Principle 3 — Learning by doing

Active participation improves retention and understanding.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 10,
      content: {
        title: "Which activity is likely to produce stronger learning?",
        prompt: "Select one:",
        options: ["Reading a PDF", "Exploring an interactive VR simulation"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Interactive VR simulation",
        revealMessage:
          "Active exploration and manipulation typically produce stronger learning than passive reading alone.",
      },
    },
    {
      block_type: "text",
      sort_order: 11,
      content: {
        markdown: `## Section 4 — Designing a Virtual Classroom

### Classroom layout

![Virtual classroom layout wireframe](/summer-camp/xr-attention/classroom-layout-wireframe.png)

**Poor design** causes confusion, distraction, and navigation issues.

**Good design** promotes focus, exploration, and engagement.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 12,
      content: {
        variant: "task_sort",
        title: "Place classroom objects into the correct zone",
        tasks: ["Learning Zone", "Interaction Zone", "Assessment Zone"],
        examples: [
          { text: "Lecture slides / screen", task: "Learning Zone" },
          { text: "3D motor model", task: "Interaction Zone" },
          { text: "Quiz panel", task: "Assessment Zone" },
          { text: "Instructor podium", task: "Learning Zone" },
          { text: "Circuit assembly table", task: "Interaction Zone" },
          { text: "Post-lesson survey", task: "Assessment Zone" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 13,
      content: {
        markdown: `## Section 5 — Creating Educational Content

### Content types

Lecture slides · videos · images · 3D models · simulations · virtual laboratories

### Example

**Traditional:** static motor diagram

**VR:** interactive motor — rotate, zoom, disassemble, inspect components`,
      },
    },
    {
      block_type: "image_gallery",
      sort_order: 14,
      content: {
        cards: [
          { title: "Lecture Slides", description: "Structured explanations on screen", imageUrl: "/summer-camp/xr-attention/educational-content-slides.png" },
          { title: "3D Models", description: "Manipulable engineering objects", imageUrl: "/summer-camp/xr-attention/educational-3d-models.png" },
          { title: "Simulations", description: "Cause-and-effect exploration", imageUrl: "/summer-camp/xr-attention/educational-simulations.png" },
          { title: "Virtual Laboratories", description: "Hands-on experiments in VR", imageUrl: "/summer-camp/xr-attention/virtual-laboratory.png" },
        ],
      },
    },
    reflect("Which engineering concepts would benefit most from immersive learning?", 15),
    {
      block_type: "text",
      sort_order: 16,
      content: {
        markdown: `## Section 6 — Interactive Learning Objects

Learning improves when students engage directly with content.

**Common interactions:** grab · rotate · move · assemble · disassemble · inspect

### Mission

Design one interactive object for your VR classroom — e.g., circuit board, robot arm, engine, or communication network.`,
      },
    },
    callout("🎮 Interaction Designer Badge — complete your interactive object design in the lab", 17),
    step(
      "Design one interactive learning object",
      "Choose an object, list interactions (grab, rotate, etc.), and sketch or implement it in Unity.",
      18,
    ),
    {
      block_type: "text",
      sort_order: 19,
      content: {
        markdown: `## Section 7 — Guiding Student Attention

Students do not always look at the right thing — designers must **guide attention**.

**Techniques:** highlighting · animations · arrows · audio prompts · visual contrast`,
      },
    },
    {
      block_type: "activity",
      sort_order: 20,
      content: {
        title: "Which object will attract attention first?",
        prompt: "Scene: dim background, one bright highlighted object with motion vs. several equal-weight objects. Select:",
        options: ["Bright highlighted object", "Largest object", "Object farthest away", "Random — no pattern"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Bright highlighted object",
        revealMessage:
          "Motion, contrast, and highlighting are effective attention-guidance techniques in VR instructional design.",
      },
    },
    {
      block_type: "text",
      sort_order: 21,
      content: {
        markdown: `## Section 8 — Creating Learning Activities

### Activity types

Exploration · problem solving · simulations · quizzes · team activities

### Example: Build a simple circuit

1. Place resistor → 2. Connect source → 3. Observe output → 4. Answer assessment question`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 22,
      content: {
        variant: "vertical_pipeline",
        title: "Circuit building activity flow",
        steps: [
          "Place resistor",
          "Connect source",
          "Observe output",
          "Answer assessment question",
        ],
      },
    },
    reflect("Create a learning activity for your virtual classroom — describe steps and learning goal.", 23),
    {
      block_type: "text",
      sort_order: 24,
      content: {
        markdown: `## Section 9 — Lesson Flow Design

### Student journey

Welcome → Introduction → Learning Content → Interaction → Assessment → Completion

A good lesson feels natural; a poor lesson feels confusing.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 25,
      content: {
        variant: "step_order",
        title: "Arrange the lesson flow in correct order",
        correctOrder: [
          "Welcome",
          "Introduction",
          "Learning Content",
          "Interaction",
          "Assessment",
          "Completion",
        ],
      },
    },
    step("Build a lesson flow diagram", "Sketch or document your lesson states from welcome through completion.", 26),
    {
      block_type: "text",
      sort_order: 27,
      content: {
        markdown: `## Section 10 — Preparing for Data Collection

Although analytics come later, prepare the classroom now.

**Events to record:** lesson start/end · slide changes · object interactions · quiz responses · activity completion

![Data collection hooks from classroom to dataset](/summer-camp/xr-attention/data-collection-hooks.png)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 28,
      content: {
        variant: "vertical_pipeline",
        title: "Data collection hooks",
        steps: [
          "Student in VR classroom",
          "Interaction events",
          "Unity logger",
          "Research dataset",
        ],
      },
    },
    {
      block_type: "activity",
      sort_order: 29,
      content: {
        title: "Discussion — What student behaviors should we track?",
        prompt: "Consider gaze targets, interactions, quiz scores, time-on-task, and navigation paths.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 30,
      content: {
        markdown: `## Section 11 — Build Your First Educational VR Lesson

### Mini project

Create:

- One virtual classroom
- Five instructional slides (or screens)
- One interactive object
- One learning activity
- One assessment question`,
      },
    },
    checkpoint(
      "Classroom Screenshot",
      "Upload a screenshot of your virtual classroom in Unity or in-headset view.",
      31,
    ),
    checkpoint(
      "Unity Scene Screenshot",
      "Upload a screenshot of your Unity Hierarchy/Scene showing lesson structure.",
      32,
    ),
    checkpoint(
      "Lesson Flow Diagram",
      "Upload your lesson flow diagram (PNG or PDF).",
      33,
    ),
    kc("Knowledge Check — Educational VR Design", [
      {
        id: "q1",
        prompt: "What is the primary goal of educational VR?",
        options: ["Better Graphics", "Better Learning Outcomes", "Faster Rendering", "More Objects"],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "Which learning strategy encourages engagement?",
        options: ["Passive Viewing", "Active Learning", "Memorization Only", "Repetition Only"],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "Why is visual hierarchy important?",
        options: [
          "Guides Attention",
          "Improves Internet Speed",
          "Improves Tracking",
          "Improves Performance",
        ],
        correctIndex: 0,
      },
      {
        id: "q4",
        prompt: "Why add interaction?",
        options: [
          "Increase Engagement",
          "Increase File Size",
          "Increase Processing Load",
          "Increase Complexity",
        ],
        correctIndex: 0,
      },
      {
        id: "q5",
        prompt: "What events should be logged?",
        options: [
          "Quiz Responses only",
          "Object Interactions only",
          "Lesson Events only",
          "All of the Above",
        ],
        correctIndex: 3,
      },
    ], 34),
    {
      block_type: "reflection",
      sort_order: 35,
      content: {
        prompt: "How confident are you in designing educational VR experiences?",
        options: ["😀 Very Confident", "🙂 Confident", "😐 Neutral", "🙁 Need More Practice"],
        saveToProfile: true,
        profileKey: "educationalVrConfidence",
      },
    },
    {
      block_type: "activity",
      sort_order: 36,
      content: {
        title: "Describe the educational VR experience you would most like to build",
        prompt: "Share your vision — subject, interactions, and who would benefit.",
        activityType: "first_discussion",
      },
    },
    callout("🏆 Educational XR Designer Badge — awarded on module completion", 37),
    {
      block_type: "feedback",
      sort_order: 38,
      content: {
        kind: "module_reflection",
        interestingPrompt: "What design choice in your classroom best supports learning and future data collection?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 39,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 7 — Building Educational VR Experiences.",
        rewards: {
          xp: 250,
          badges: ["educational-xr-designer", "virtual-classroom-builder"],
          nextModule: "Module 8 — Data Analysis and Visualization",
        },
      },
    },
  ],
}
