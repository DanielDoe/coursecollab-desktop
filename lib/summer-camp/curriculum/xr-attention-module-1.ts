/**
 * Module 1 — Introduction to Extended Reality (XR)
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

export const XR_ATTENTION_MODULE_1: CurriculumModule = {
  title: "Module 1 — Introduction to Extended Reality (XR)",
  description:
    "Understand XR, AR, VR, and MR; explore industry transformation, eye tracking, AI, and our summer research project.",
  sort_order: 1,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 45–60 minutes · Difficulty: Beginner · XP reward: 100 XP · Badge: XR Foundations",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Extended Reality (XR)",
        subtitle: "The Future of Human-Computer Interaction",
        tags: ["XR", "VR", "Eye Tracking", "AI", "Immersive Learning"],
        imageUrl: "/summer-camp/xr-attention/xr-module-1-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "Explore Virtual Reality, Eye Tracking, Artificial Intelligence, and Immersive Learning through the visual research theme introduced above.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

### What you will be able to do

- Understand what XR, AR, VR, and MR are
- Understand how XR technologies are transforming industries
- Understand why eye tracking is important
- Understand how AI and XR work together
- Understand the goals of our summer research project
- Become excited about immersive technologies and research`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Welcome to the World of XR

### Opening story

Imagine walking into a classroom where textbooks become 3D objects.

Imagine learning anatomy by standing inside a human heart.

Imagine learning electrical engineering by manipulating circuits floating in the air.

Imagine an AI tutor watching where you look and helping when it notices confusion.

**This is no longer science fiction. This is Extended Reality (XR).**

Today, XR technologies are transforming:

- Education
- Healthcare
- Engineering
- Manufacturing
- Military training
- Entertainment
- Scientific research

Throughout this summer, you will learn how these technologies work and how researchers use them to understand human attention and learning.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 5,
      content: {
        title: "Have you ever used any XR technology?",
        prompt: "Select all that apply:",
        options: [
          "Never",
          "VR Headset",
          "AR Mobile App",
          "Pokémon GO",
          "Snapchat Filters",
          "HoloLens",
          "Meta Quest",
          "Other",
        ],
        activityType: "poll",
        multiSelect: true,
        revealMessage: "Thanks — your experience helps us personalize the training.",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — What is XR?

### The Reality–Virtuality Continuum

Physical Reality → Augmented Reality (AR) → Mixed Reality (MR) → Virtual Reality (VR) → Fully Virtual Environment`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "Reality–Virtuality Continuum",
        steps: [
          "Physical Reality",
          "Augmented Reality (AR)",
          "Mixed Reality (MR)",
          "Virtual Reality (VR)",
          "Fully Virtual Environment",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 8,
      content: {
        markdown: `### Explanation cards

**Reality** — The real world around us (classroom, laboratory, campus).

**Augmented Reality (AR)** — Digital information added to the real world (Pokémon GO, Google Maps navigation, Snapchat filters).

**Mixed Reality (MR)** — Virtual objects understand and interact with the physical world (HoloLens 2, Apple Vision Pro).

**Virtual Reality (VR)** — A completely computer-generated environment (HTC Vive Pro Eye, Meta Quest, flight simulators).`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 9,
      content: {
        variant: "task_sort",
        title: "Place each application into AR, MR, or VR",
        tasks: ["AR", "MR", "VR"],
        examples: [
          { text: "Pokémon GO", task: "AR" },
          { text: "HTC Vive", task: "VR" },
          { text: "HoloLens 2", task: "MR" },
          { text: "Snapchat Filter", task: "AR" },
          { text: "Flight Simulator", task: "VR" },
          { text: "Apple Vision Pro", task: "MR" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 10,
      content: {
        markdown: `## Section 3 — Why XR Matters

XR is reshaping how we learn, work, and conduct research across many industries.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 11,
      content: {
        variant: "industry_sectors",
        sectors: [
          {
            title: "Education",
            examples: ["Virtual labs", "3D anatomy", "Immersive lectures"],
            imageUrl: "/summer-camp/xr-attention/virtual-classroom-scene.png",
          },
          {
            title: "Healthcare",
            examples: ["Surgical training", "Patient therapy", "Medical imaging"],
            imageUrl: "/summer-camp/shared/ai-healthcare.png",
          },
          {
            title: "Manufacturing",
            examples: ["Assembly guidance", "Remote assistance", "Digital twins"],
            imageUrl: "/summer-camp/shared/iot-industry.png",
          },
          {
            title: "Military",
            examples: ["Combat simulation", "Equipment training", "Mission rehearsal"],
            imageUrl: "/summer-camp/xr-attention/steamvr-tracking-chain.png",
          },
          {
            title: "Architecture",
            examples: ["Walk-through models", "Design review", "Client visualization"],
            imageUrl: "/summer-camp/xr-attention/xr-architecture-sector.png",
          },
          {
            title: "Entertainment",
            examples: ["Immersive games", "Virtual concerts", "Theme park rides"],
            imageUrl: "/summer-camp/xr-attention/gaze-ray-visualization.png",
          },
          {
            title: "Autonomous Vehicles",
            examples: ["Driver training sims", "Sensor visualization", "HMI design"],
            imageUrl: "/summer-camp/module-0/autonomous-vehicle.png",
          },
          {
            title: "Space Exploration",
            examples: ["Mission training", "Robotic teleoperation", "Zero-G simulation"],
            imageUrl: "/summer-camp/xr-attention/xr-module-1-hero.png",
          },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 12,
      content: {
        markdown: `### Case study — Medical training

Instead of reading about surgery, students can practice procedures inside VR.

**Benefits:** Safe · Repeatable · Low cost · High engagement

### Case study — Engineering education

Students can walk through factories, inspect engines, assemble machines, and explore circuits without needing physical equipment.`,
      },
    },
    reflect("If you could use XR to solve one problem, what would it be?", 13),
    {
      block_type: "text",
      sort_order: 14,
      content: {
        markdown: `## Section 4 — Meet the Devices

Compare leading XR platforms used in research and industry.`,
      },
    },
    {
      block_type: "image_gallery",
      sort_order: 15,
      content: {
        cards: [
          { title: "HTC Vive Pro Eye", description: "Research VR platform with built-in eye tracking", imageUrl: "/summer-camp/xr-attention/vive-pro-eye-hardware.png" },
          { title: "Meta Quest", description: "Consumer VR platform", imageUrl: "/summer-camp/xr-attention/meta-quest-device.png" },
          { title: "HoloLens 2", description: "Mixed reality platform", imageUrl: "/summer-camp/xr-attention/hololens-device.png" },
          { title: "Apple Vision Pro", description: "Spatial computing platform", imageUrl: "/summer-camp/xr-attention/vision-pro-device.png" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 16,
      content: {
        markdown: `### Device comparison

| Device | VR | MR | Eye Tracking | Hand Tracking |
| --- | --- | --- | --- | --- |
| Vive Pro Eye | ✓ | ✗ | ✓ | Limited |
| Quest Pro | ✓ | Limited | ✓ | ✓ |
| HoloLens 2 | ✗ | ✓ | ✓ | ✓ |
| Vision Pro | ✓ | ✓ | ✓ | ✓ |

**This summer we will primarily use the HTC Vive Pro Eye** — a research-grade VR platform with integrated Tobii eye tracking.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 17,
      content: {
        title: "Which device will we primarily use this summer?",
        prompt: "Select one:",
        options: ["Quest Pro", "HoloLens 2", "HTC Vive Pro Eye", "Apple Vision Pro"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: HTC Vive Pro Eye",
        revealMessage:
          "The Vive Pro Eye is our primary research platform — VR with integrated eye tracking for attention analytics.",
      },
    },
    {
      block_type: "text",
      sort_order: 18,
      content: {
        markdown: `## Section 5 — Why Eye Tracking?

Human attention is selective. Eye tracking lets us measure where people look — often without them realizing it.

### Attention experiment

Look at a complex scene for 10 seconds. Most people look at **faces**, **bright objects**, and **large text** first.

### What eye tracking measures

Eye → Infrared sensors → Gaze data → Heatmap → Attention analysis

### Key concepts

- **Fixation** — When your eyes stop and focus on one location
- **Saccade** — Rapid movement between locations
- **Scanpath** — The route your eyes follow
- **Heatmap** — Visualization of attention over time`,
      },
    },
    {
      block_type: "activity",
      sort_order: 19,
      content: {
        title: "Where do you think people look first on a website?",
        prompt: "Make a prediction, then reveal the heatmap:",
        options: ["Logo / header", "Main image", "Navigation menu", "Call-to-action button"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Typical eye-tracking result",
        revealMessage:
          "Heatmaps often show attention on faces, bright elements, and large headings first — before users consciously decide where to look.",
      },
    },
    {
      block_type: "text",
      sort_order: 20,
      content: {
        markdown: `## Section 6 — XR + AI

Imagine an AI tutor that knows what you looked at, what you ignored, when you became distracted, and when you became confused.

AI can use eye-tracking data to estimate **attention**, **engagement**, and **learning performance**.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 21,
      content: {
        variant: "vertical_pipeline",
        title: "AI-assisted learning pipeline",
        steps: [
          "Student in VR",
          "Eye tracking",
          "Data collection",
          "Machine learning",
          "Attention prediction",
          "Personalized learning",
        ],
      },
    },
    {
      block_type: "callout",
      sort_order: 22,
      content: {
        variant: "tip",
        text: "Research question: Can AI use eye-tracking data to better understand student attention in virtual reality learning environments? This question forms the foundation of our summer research project.",
      },
    },
    {
      block_type: "text",
      sort_order: 23,
      content: {
        markdown: `## Section 7 — Summer Research Project Preview

### Project title

**AI-Assisted Analysis of Student Attention in Virtual Reality Learning Environments**

### What we will do

1. Learn XR technologies
2. Learn eye tracking
3. Build VR environments
4. Collect multimodal data
5. Analyze eye-tracking data
6. Apply AI techniques
7. Create visualizations
8. Produce research outputs

### Final deliverables

- Research poster
- Technical report
- Project demonstration
- GitHub repository
- Potential research publication`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 24,
      content: {
        variant: "vertical_pipeline",
        title: "Your research roadmap",
        steps: [
          "XR Foundations",
          "Eye Tracking",
          "HTC Vive Pro Eye",
          "Unity Development",
          "Data Collection",
          "AI Analytics",
          "Research Project",
          "Final Showcase",
        ],
      },
    },
    {
      block_type: "activity",
      sort_order: 25,
      content: {
        title: "Discussion — Which XR application excites you most?",
        prompt: "Share in the discussion thread below. Topics: Education · Healthcare · Gaming · Robotics · Autonomous vehicles · Smart cities · Digital twins",
        activityType: "first_discussion",
      },
    },
    callout("🎉 XR Explorer Badge · +50 XP for participating in the module discussion", 26),
    kc("Knowledge Check — Introduction to XR", [
      {
        id: "q1",
        prompt: "What does XR stand for?",
        options: ["Extreme Reality", "Extended Reality", "Experimental Reality", "External Reality"],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "Which technology overlays digital information onto the real world?",
        options: ["VR", "AR", "AI", "IoT"],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "Which device will be used in this training?",
        options: ["Meta Quest", "HTC Vive Pro Eye", "Nintendo Switch", "Xbox"],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "What is a fixation?",
        options: [
          "Eye movement",
          "Eye blink",
          "Moment eyes focus on one location",
          "Head movement",
        ],
        correctIndex: 2,
      },
      {
        id: "q5",
        prompt: "Why is eye tracking useful?",
        options: [
          "Measure attention",
          "Improve battery life",
          "Reduce storage",
          "Increase internet speed",
        ],
        correctIndex: 0,
      },
    ], 27),
    {
      block_type: "reflection",
      sort_order: 28,
      content: {
        prompt: "How familiar are you now with XR?",
        options: ["😀 Very Familiar", "🙂 Somewhat Familiar", "😐 Neutral", "🙁 Still Confused"],
        saveToProfile: true,
        profileKey: "xrFamiliarity",
      },
    },
    reflect("What topic are you most excited to learn next?", 29, {
      options: ["Eye Tracking", "HTC Vive Pro Eye", "Unity Development", "AI", "Research Methods"],
      saveToProfile: true,
      profileKey: "xrNextTopicInterest",
    }),
    {
      block_type: "feedback",
      sort_order: 30,
      content: {
        kind: "module_reflection",
        interestingPrompt: "What was the most interesting thing you learned about XR or eye tracking?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 31,
      content: {
        title: "🎉 Congratulations!",
        message: "You completed Module 1: Introduction to Extended Reality (XR)",
        rewards: {
          xp: 100,
          badges: ["xr-foundations", "xr-explorer", "research-explorer"],
          nextModule: "Module 2 — Human Vision, Attention, and Eye Tracking Fundamentals",
        },
      },
    },
  ],
}