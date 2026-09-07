/**
 * Module 2 — Human Vision, Attention, and Eye Tracking Fundamentals
 * XR Attention Analytics · Summer Research Training 2026
 *
 * Instructor note (not shown to students): add real eye anatomy figures, ICVR heatmaps,
 * scanpath visualizations, gorilla selective-attention video, fixation/saccade animation,
 * and a short Vive Pro Eye gaze-ray demo before Module 3.
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

export const XR_ATTENTION_MODULE_2: CurriculumModule = {
  title: "Module 2 — Human Vision, Attention, and Eye Tracking Fundamentals",
  description:
    "How humans see, how attention works, eye movements, eye tracking technology, research metrics, and their role in VR learning research.",
  sort_order: 2,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 60–90 minutes · Difficulty: Beginner · XP reward: 100 XP · Badge: Attention Scientist",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Human Attention",
        subtitle: "Understanding What People See, Ignore, and Learn",
        tags: ["Vision", "Attention", "Eye Tracking", "Cognition", "Research"],
        imageUrl: "/summer-camp/xr-attention/xr-module-2-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The module hero introduces the connection between human vision, gaze behavior, and XR attention analytics.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand how humans see the world
- Understand how attention works
- Understand the difference between looking and seeing
- Understand how eye trackers measure gaze
- Understand fixation, saccades, scanpaths, and pupil dilation
- Understand why eye tracking is valuable for education research
- Understand the behavioral metrics used in our research project`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Why Study Human Attention?

### Opening story

Imagine you are studying for an exam. Your textbook is open. Your eyes are pointed at the page.

Yet suddenly you realize: **"I have no idea what I just read."**

How is that possible? Your eyes were looking at the page — but your brain was paying attention somewhere else.

This highlights one of the most important concepts in human cognition:

### Looking is not the same as paying attention

As researchers, we want to understand:

- What people look at
- How long they look
- Why they look there
- Whether they are engaged
- Whether learning is occurring

This is the foundation of modern eye-tracking research.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 5,
      content: {
        title: "Have you ever read a page and realized you remembered nothing?",
        prompt: "Select one:",
        options: ["Frequently", "Sometimes", "Rarely", "Never"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Why this happens",
        revealMessage:
          "This phenomenon occurs because visual attention and cognitive attention are not always synchronized.",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — How Human Vision Works

### Human eye overview

![Eye anatomy reference for gaze tracking](/summer-camp/xr-attention/eye-anatomy-diagram.png)

The eye acts like a biological camera. The lens focuses light. The retina captures information. The brain interprets what is seen.

Unlike a camera, however, humans do **not** see everything equally. We only see a small region with high detail.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "How we see detail",
        steps: ["Blurred surroundings (peripheral vision)", "Sharp center region (foveal vision)"],
      },
    },
    {
      block_type: "text",
      sort_order: 8,
      content: {
        markdown: `### Foveal vision

Only about **1–2%** of your visual field is viewed with maximum detail. This area is called the **fovea**.

When you read text, your eyes constantly move to place words inside the fovea.

### Peripheral vision

Everything outside the fovea. Useful for motion detection, awareness, and navigation — but less useful for reading fine details.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 9,
      content: {
        title: "Visual search exercise",
        prompt:
          "Look at a complex image (or the scene around you). Count the number of red objects. How many eye movements did you need?",
        options: ["1–2 movements", "3–5 movements", "6–10 movements", "More than 10"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Why your eyes moved",
        revealMessage:
          "Because the fovea only sees a tiny area clearly, you had to move your eyes repeatedly — fixating on different regions — to gather information about each red object.",
      },
    },
    {
      block_type: "text",
      sort_order: 10,
      content: {
        markdown: `## Section 3 — Attention and Cognitive Processing

### What is attention?

Attention is the process of **selecting information for further processing**. Humans cannot process everything simultaneously — the brain constantly prioritizes information.`,
      },
    },
    {
      block_type: "video",
      sort_order: 11,
      content: {
        title: "Selective Attention Test — The Invisible Gorilla",
        url: "https://www.youtube.com/embed/vJG698U8M-I",
      },
    },
    {
      block_type: "callout",
      sort_order: 12,
      content: {
        variant: "tip",
        text: "Watch the video and count basketball passes. Many people miss a gorilla walking across the screen — because attention is limited and the brain filters information.",
      },
    },
    {
      block_type: "text",
      sort_order: 13,
      content: {
        markdown: `### Types of attention

**Selective attention** — Focusing on one thing (e.g., listening to a lecturer).

**Sustained attention** — Maintaining focus over time (e.g., studying for an exam).

**Divided attention** — Managing multiple tasks (e.g., driving while listening to navigation instructions).`,
      },
    },
    reflect("Which type of attention do you think is most important for learning?", 14),
    {
      block_type: "text",
      sort_order: 15,
      content: {
        markdown: `## Section 4 — Eye Movements

### Why eyes move

The fovea only sees a tiny area clearly — so the eyes constantly move. These movements reveal attention patterns.

![Fixation and saccade cycle](/summer-camp/xr-attention/fixation-saccade-cycle.png)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 16,
      content: {
        variant: "vertical_pipeline",
        title: "Eye movement cycle",
        steps: ["Fixation (eyes stable)", "Saccade (rapid jump)", "Fixation", "Saccade", "…"],
      },
    },
    {
      block_type: "text",
      sort_order: 17,
      content: {
        markdown: `### Fixations

Periods where the eyes remain relatively stable. Typical duration: **100–500 milliseconds**.

Longer fixations may indicate interest, difficulty, or cognitive processing.

### Saccades

Rapid jumps between fixations — several times every second. During a saccade, the brain temporarily suppresses visual perception.

### Scanpaths

The sequence of fixations and saccades. Scanpaths reveal viewing behavior and attention patterns over time.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 18,
      content: {
        title: "Where would your eyes move first on a website?",
        prompt: "Make a prediction, then reveal a typical scanpath:",
        options: ["Logo / header", "Main image or hero", "Navigation menu", "Call-to-action button"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Typical scanpath pattern",
        revealMessage:
          "Real scanpaths often start at salient elements — faces, large headings, or bright regions — then jump via saccades to navigation and content areas. See the scanpath visualization in the lesson section below.",
      },
    },
    {
      block_type: "text",
      sort_order: 19,
      content: {
        markdown: `## Section 5 — Eye Tracking Technology

### How eye trackers work

![Infrared eye-tracking pipeline](/summer-camp/xr-attention/eye-tracking-pipeline.png)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 20,
      content: {
        variant: "vertical_pipeline",
        title: "Eye tracking pipeline",
        steps: [
          "Infrared light",
          "Eye reflection",
          "Camera detection",
          "Pupil tracking",
          "Gaze estimation",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 21,
      content: {
        markdown: `### What the eye tracker sees

![Pupil and corneal reflection tracking reference](/summer-camp/xr-attention/tobii-gaze-pipeline.png)

### HTC Vive Pro Eye

This headset contains infrared illuminators, eye tracking cameras, and **Tobii** eye tracking technology.

The system continuously estimates:

- Where you are looking
- How your eyes move
- Pupil measurements`,
      },
    },
    {
      block_type: "activity",
      sort_order: 22,
      content: {
        title: "Do you think the headset records everything you see?",
        prompt: "Select one:",
        options: ["Yes", "No"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: No",
        revealMessage:
          "The headset does not record a video of your visual experience. It estimates gaze direction, eye movements, and attention metrics from infrared sensors.",
      },
    },
    {
      block_type: "text",
      sort_order: 23,
      content: {
        markdown: `## Section 6 — Eye Tracking Metrics

These metrics form the behavioral foundation of our summer research project.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 24,
      content: {
        variant: "matching",
        title: "Match each metric to its research use",
        prompt: "Tap each row to reveal the match.",
        pairs: [
          { task: "Fixation Duration", capability: "Interest, attention, cognitive effort" },
          { task: "Fixation Count", capability: "Exploration behavior" },
          { task: "Time to First Fixation", capability: "Visual saliency, UI design" },
          { task: "Dwell Time", capability: "Engagement — total viewing time" },
          { task: "Pupil Diameter", capability: "Cognitive workload, mental effort" },
        ],
      },
    },
    {
      block_type: "activity",
      sort_order: 25,
      content: {
        title: "Match the metric",
        prompt: "Which metric measures how quickly users notice an object?",
        options: [
          "Fixation Duration",
          "Fixation Count",
          "Time to First Fixation",
          "Dwell Time",
          "Pupil Diameter",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Time to First Fixation",
        revealMessage:
          "Time to First Fixation measures how quickly a user's gaze lands on a target — useful for studying visual saliency and interface design.",
      },
    },
    {
      block_type: "text",
      sort_order: 26,
      content: {
        markdown: `## Section 7 — Eye Tracking in Education Research

### Educational questions

Can eye tracking help us answer:

- Are students paying attention?
- Which content attracts attention?
- What causes confusion?
- Which teaching materials are effective?

### Example study

![Virtual classroom attention heatmap](/summer-camp/xr-attention/attention-heatmap-classroom.png)

**Finding:** Students who focused more on key instructional content often performed better.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 27,
      content: {
        title: "Discussion — Could an AI tutor use eye-tracking data to help students learn?",
        prompt: "Share your thoughts in the discussion thread. Consider what gaze data reveals — and what it cannot reveal alone.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 28,
      content: {
        markdown: `## Section 8 — Our Summer Research Project

### Project connection

This summer we will investigate:

**How eye-tracking data can be used to understand student attention in virtual reality learning environments.**

### What we will measure (HTC Vive Pro Eye)

- Gaze position
- Fixations
- Head movement
- Controller interactions
- Task completion

### What we will analyze

- Heatmaps
- Scanpaths
- Attention scores
- Behavioral patterns

### What we will build

- Analytics dashboards
- AI prediction models
- Research visualizations`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 29,
      content: {
        variant: "vertical_pipeline",
        title: "From gaze data to research insights",
        steps: [
          "Collect gaze + behavior in VR",
          "Segment fixations & scanpaths",
          "Compute attention metrics",
          "Train AI models",
          "Visualize & publish findings",
        ],
      },
    },
    kc("Knowledge Check — Vision, Attention & Eye Tracking", [
      {
        id: "q1",
        prompt: "What part of the eye provides the highest visual detail?",
        options: ["Retina", "Lens", "Fovea", "Cornea"],
        correctIndex: 2,
      },
      {
        id: "q2",
        prompt: "What is a fixation?",
        options: ["Rapid eye movement", "Stable gaze period", "Blink", "Head movement"],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "What is a saccade?",
        options: [
          "Stable gaze",
          "Rapid eye jump between fixations",
          "Blink",
          "Eye calibration",
        ],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "Which metric measures total viewing time?",
        options: ["Scanpath", "Dwell Time", "Saccade", "Blink Rate"],
        correctIndex: 1,
      },
      {
        id: "q5",
        prompt: "Why do researchers use eye tracking?",
        options: [
          "Measure attention and behavior",
          "Increase internet speed",
          "Improve battery life",
          "Reduce storage",
        ],
        correctIndex: 0,
      },
    ], 30),
    {
      block_type: "activity",
      sort_order: 31,
      content: {
        title: "Discussion — Where do your eyes spend the most time?",
        prompt:
          "Think about a website, video game, or mobile app you use regularly. Where do you think your eyes spend the most time? Why?",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "reflection",
      sort_order: 32,
      content: {
        prompt: "How confident are you in understanding eye tracking?",
        options: ["😀 Very Confident", "🙂 Confident", "😐 Neutral", "🙁 Need More Practice"],
        saveToProfile: true,
        profileKey: "eyeTrackingConfidence",
      },
    },
    {
      block_type: "text",
      sort_order: 33,
      content: {
        markdown: `### Research thinking — follow-up questions

Reflect on these before Module 3:

1. Does looking at something always mean a person understands it?
2. Can eye tracking alone determine whether someone is learning?
3. What additional data might help us understand learning and engagement?
4. How might AI use eye-tracking data to personalize education?
5. What ethical concerns should researchers consider when collecting gaze data?`,
      },
    },
    {
      block_type: "feedback",
      sort_order: 34,
      content: {
        kind: "module_reflection",
        interestingPrompt: "What was the most surprising thing you learned about attention or eye movements?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 35,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 2 — Human Vision, Attention, and Eye Tracking Fundamentals.",
        rewards: {
          xp: 100,
          badges: ["attention-scientist", "human-factors-explorer"],
          nextModule: "Module 3 — Eye Tracking Systems and HTC Vive Pro Eye Hardware",
        },
      },
    },
  ],
}
