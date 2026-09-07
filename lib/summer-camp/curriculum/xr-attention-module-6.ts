/**
 * Module 6 — Building Educational VR Experiences and Experimental Design
 * XR Attention Analytics · Summer Research Training 2026
 *
 * Instructor note (not shown to students): add classroom wireframe, educational VR examples,
 * attention-guided UI examples, study workflow diagram, HCD infographic, experimental design
 * flowchart, and learning analytics dashboard mockup.
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
      acceptedTypes: ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
      maxSizeMb: 25,
      facultyApproval: true,
    },
  }
}

export const XR_ATTENTION_MODULE_6: CurriculumModule = {
  title: "Module 6 — Building Educational VR Experiences and Experimental Design",
  description:
    "Educational VR design, attention-aware interfaces, human-centered UX, experimental design, pilot studies, learning outcomes, and research ethics.",
  sort_order: 6,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 3–4 hours · Difficulty: Intermediate · XP reward: 300 XP · Badge: XR Learning Designer",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Designing Virtual Learning Experiences",
        subtitle: "Creating XR Environments That Help People Learn",
        tags: ["Educational VR", "UX Design", "Experimental Design", "Attention", "Research"],
        imageUrl: "/summer-camp/xr-attention/xr-module-6-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The hero above presents an attention-aware learning space with instructional content, gaze analytics, and AI support.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand principles of educational VR design
- Learn how to design attention-aware learning environments
- Build an educational VR classroom
- Understand user experience (UX) and human-centered design
- Learn how to create research experiments in VR
- Design a pilot study for data collection
- Understand how learning outcomes are measured
- Prepare the environment for our summer research project`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — From Technology to Learning

### Opening story

**Classroom A:** Empty room, slides on a wall, no interaction, no feedback, no engagement.

**Classroom B:** 3D content, highlighted concepts, adaptive behavior, AI tutor assistance, active exploration.

Which produces better learning outcomes? Most people choose **Classroom B**.

Good learning experiences require instructional design, interaction design, and user experience — not technology alone.`,
      },
    },
    {
      block_type: "reflection",
      sort_order: 5,
      content: {
        prompt: "What makes a classroom engaging?",
        options: [
          "Interactive content",
          "Good instructor",
          "Visual demonstrations",
          "Collaboration",
          "Feedback",
          "Gamification",
        ],
        saveToProfile: true,
        profileKey: "engagingClassroomFactors",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — What Makes Educational VR Effective?

### Learning vs. technology

Technology → immersion → interaction → engagement → **learning**

### Common mistake

Many developers build "cool VR experiences" but not **effective learning experiences**.

### Educational VR goals

Good educational VR should increase attention, improve understanding, improve retention, encourage exploration, and reduce cognitive overload.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "From technology to learning",
        steps: ["Technology", "Immersion", "Interaction", "Engagement", "Learning"],
      },
    },
    {
      block_type: "activity",
      sort_order: 8,
      content: {
        title: "Which objective is most important for educational VR?",
        prompt: "Select one:",
        options: ["Realistic graphics", "Learning outcomes", "Number of objects", "Processing power"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Learning outcomes",
        revealMessage:
          "Graphics and immersion support learning — but the primary goal is measurable improvement in understanding and retention.",
      },
    },
    {
      block_type: "text",
      sort_order: 9,
      content: {
        markdown: `## Section 3 — Human-Centered Design

**Human-centered design** means designing technology around people — not forcing people to adapt to technology.

### Design process

Users → needs → design → prototype → testing → feedback → improvement

### Our users

**Target users:** college students

**Goals:** learn effectively · stay engaged · complete tasks`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 10,
      content: {
        variant: "vertical_pipeline",
        title: "Human-centered design flow",
        steps: ["Users", "Needs", "Design", "Prototype", "Testing", "Feedback", "Improvement"],
      },
    },
    {
      block_type: "activity",
      sort_order: 11,
      content: {
        title: "Discussion — What challenges do students face in traditional classrooms?",
        prompt: "Share examples: distractions, lack of engagement, passive learning, accessibility barriers, etc.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 12,
      content: {
        markdown: `## Section 4 — Attention-Aware Design

Students cannot learn what they do not notice. Eye tracking reveals what students view, ignore, and where attention is drawn.

### Poor design

Cluttered slides · too much text · competing objects

### Good design

Focused content · clear hierarchy · guided attention

### Design principles

**Visual hierarchy** — important content stands out

**Reduce clutter** — too many objects split attention

**Guide attention** — use motion, color, position, and highlighting`,
      },
    },
    {
      block_type: "activity",
      sort_order: 13,
      content: {
        title: "Which classroom scene better guides attention?",
        prompt: "Scene A: dense text, many floating objects, equal visual weight. Scene B: one focal slide, minimal clutter, highlighted key concept.",
        options: ["Scene A", "Scene B"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Scene B guides attention better",
        revealMessage:
          "Clear visual hierarchy and reduced clutter help students fixate on instructional content — a core goal of attention-aware VR design.",
      },
    },
    {
      block_type: "text",
      sort_order: 14,
      content: {
        markdown: `## Section 5 — Designing the Virtual Classroom

### Classroom architecture

![Virtual classroom research zones](/summer-camp/xr-attention/classroom-wireframe-zones.png)

### Research zones

**Zone 1 — Learning content:** slides, videos, 3D models

**Zone 2 — Interaction zone:** quizzes, tasks, object manipulation

**Zone 3 — Observation zone:** eye tracking, behavior logging, data collection`,
      },
    },
    step(
      "Sketch your classroom layout",
      "Draw or diagram instructor area, screen, student position, interaction zone, and where loggers run.",
      15,
    ),
    checkpoint(
      "Classroom Layout Sketch",
      "Upload your classroom layout sketch or wireframe showing research zones and content placement.",
      16,
    ),
    {
      block_type: "text",
      sort_order: 17,
      content: {
        markdown: `## Section 6 — Creating Educational Content

### Content types

Text · images · videos · 3D models · simulations · interactive activities

Research generally shows **interactive content** often produces higher engagement than passive content.

### Example

Instead of showing a picture of a circuit, let students assemble components, observe current flow, and interact with simulations.`,
      },
    },
    {
      block_type: "image_gallery",
      sort_order: 18,
      content: {
        cards: [
          { title: "Text & Slides", description: "Structured explanations with clear hierarchy", imageUrl: "/summer-camp/xr-attention/educational-content-slides.png" },
          { title: "3D Models", description: "Manipulable objects for spatial understanding", imageUrl: "/summer-camp/xr-attention/educational-3d-models.png" },
          { title: "Simulations", description: "Cause-and-effect exploration", imageUrl: "/summer-camp/xr-attention/educational-simulations.png" },
          { title: "Interactive Activities", description: "Quizzes, tasks, and hands-on challenges", imageUrl: "/summer-camp/xr-attention/interactive-activities.png" },
        ],
      },
    },
    reflect("How might VR improve your own learning experiences?", 19),
    {
      block_type: "text",
      sort_order: 20,
      content: {
        markdown: `## Section 7 — Experimental Design Fundamentals

Research requires **evidence** — not opinions or assumptions.

### Research process

Research question → hypothesis → experiment → data collection → analysis → findings

### Example research question

Can eye-tracking metrics predict student engagement in VR learning environments?

### Example hypothesis

Students with longer fixation durations on instructional content will perform better on learning assessments.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 21,
      content: {
        variant: "vertical_pipeline",
        title: "Research process",
        steps: [
          "Research Question",
          "Hypothesis",
          "Experiment",
          "Data Collection",
          "Analysis",
          "Findings",
        ],
      },
    },
    reflect("Write your own research hypothesis for a VR attention or learning study.", 22),
    {
      block_type: "text",
      sort_order: 23,
      content: {
        markdown: `## Section 8 — Variables in XR Research

**Independent variables** — manipulated by the researcher (content type, teaching method, AI tutor presence)

**Dependent variables** — measured outcomes (fixation duration, quiz score, completion time)

**Control variables** — kept constant (room lighting, device, lesson duration)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 24,
      content: {
        variant: "matching",
        title: "Classify each variable",
        prompt: "Tap each row to reveal the classification.",
        pairs: [
          { task: "Content Type (slides vs. 3D)", capability: "Independent Variable" },
          { task: "Quiz Score", capability: "Dependent Variable" },
          { task: "Lesson Duration (fixed at 15 min)", capability: "Control Variable" },
          { task: "Fixation Duration on Slide", capability: "Dependent Variable" },
          { task: "AI Tutor On/Off", capability: "Independent Variable" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 25,
      content: {
        markdown: `## Section 9 — Designing a Pilot Study

A **pilot study** is a small-scale experiment used to test procedures, identify issues, and validate equipment.

### Example pilot

**Participants:** 5 students · **Task:** watch VR lesson · **Data:** eye tracking, head tracking, quiz performance

**Expected outcomes:** identify technical issues, data quality problems, and experimental weaknesses before the full study.`,
      },
    },
    step(
      "Design your pilot study",
      "Define participants (n), task, data streams, duration, and success criteria for a small pilot run.",
      26,
    ),
    {
      block_type: "text",
      sort_order: 27,
      content: {
        markdown: `## Section 10 — Measuring Learning Outcomes

**Looking ≠ learning.** Researchers must measure outcomes beyond gaze.

### Learning metrics

Attention metrics + behavior metrics + assessment metrics → **learning outcomes**

### Possible measures

Quiz scores · task completion · retention tests · survey responses`,
      },
    },
    {
      block_type: "activity",
      sort_order: 28,
      content: {
        title: "Discussion — What metrics would you use to determine whether learning occurred?",
        prompt: "Consider pre/post tests, transfer tasks, self-report, and behavioral indicators.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 29,
      content: {
        markdown: `## Section 11 — Research Ethics and User Studies

We are studying **people** — ethics matter.

### Key principles

✓ Voluntary participation · ✓ Informed consent · ✓ Privacy protection · ✓ Data security`,
      },
    },
    {
      block_type: "activity",
      sort_order: 30,
      content: {
        title: "Should eye-tracking data be considered sensitive?",
        prompt: "Select one, then discuss in the thread:",
        options: ["Yes — it reveals attention and behavior", "No — it is not personal", "It depends on context and consent"],
        activityType: "poll",
        multiSelect: false,
        revealMessage:
          "Gaze data can reveal interests, confusion, and health-related patterns. Consent, anonymization, and secure storage are essential.",
      },
    },
    reflect("How would you feel if your gaze behavior were being recorded during a VR lesson?", 31),
    {
      block_type: "text",
      sort_order: 32,
      content: {
        markdown: `## Section 12 — Summer Research Project Integration

### Project goal

**AI-Assisted Analysis of Student Attention in Virtual Reality Learning Environments**

### What we will build

Virtual classroom → educational content → eye tracking collection → attention analytics → AI models → research findings

### Team contributions

| Focus | Lead | Responsibilities |
| --- | --- | --- |
| Eye tracking analytics | Nader | Visualization, heatmaps, scanpaths |
| AI & data processing | Aisosa | Models, pipelines, feature engineering |
| Human factors & study design | Kevin | Protocol, literature, experimental design |`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 33,
      content: {
        variant: "vertical_pipeline",
        title: "Summer research pipeline",
        steps: [
          "Virtual Classroom",
          "Educational Content",
          "Eye Tracking Collection",
          "Attention Analytics",
          "AI Models",
          "Research Findings",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 34,
      content: {
        markdown: `## Section 13 — Mini Project

### Design your research study

Create:

1. Research question
2. Hypothesis
3. Virtual environment description
4. Independent, dependent, and control variables
5. Data collection plan
6. Expected findings`,
      },
    },
    checkpoint(
      "Study Proposal",
      "Upload your study proposal (PDF or DOCX) covering research question, hypothesis, variables, pilot plan, and expected findings.",
      35,
    ),
    reflect(
      "Mini project reflection — What is the strongest part of your study design? What would you improve before running participants?",
      36,
    ),
    kc("Knowledge Check — Educational VR & Experimental Design", [
      {
        id: "q1",
        prompt: "What is the primary goal of educational VR?",
        options: ["Better graphics", "Improved learning outcomes", "Faster hardware", "More objects"],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "What is an independent variable?",
        options: [
          "Variable measured",
          "Variable manipulated by researcher",
          "Constant value",
          "Output file",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "Why conduct a pilot study?",
        options: [
          "Publish immediately",
          "Test procedures before larger studies",
          "Improve graphics",
          "Reduce storage",
        ],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "Looking at content guarantees learning.",
        options: ["True", "False"],
        correctIndex: 1,
        trueFalse: true,
      },
      {
        id: "q5",
        prompt: "Which principle helps direct attention?",
        options: ["Clutter", "Visual Hierarchy", "Random Placement", "Sensor Fusion"],
        correctIndex: 1,
      },
    ], 37),
    {
      block_type: "activity",
      sort_order: 38,
      content: {
        title: "Discussion — How should an AI tutor respond to gaze data?",
        prompt:
          "If a tutor knows where students look, what they ignore, and what confuses them — should it provide hints, change content, ask questions, or recommend resources? Discuss advantages and concerns.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 39,
      content: {
        markdown: `### Research thinking questions

1. What factors influence attention in VR?
2. Can AI improve learning outcomes?
3. How should virtual classrooms differ from physical classrooms?
4. What behavioral signals indicate confusion?
5. How can eye tracking be combined with AI to personalize education?

### Preview of Module 7

**Building Attention-Aware XR Systems and AI Analytics** — attention metrics, heatmaps, scanpaths, visualization, feature engineering, machine learning for attention prediction, AI-assisted learning analytics, and research dashboard development.`,
      },
    },
    {
      block_type: "feedback",
      sort_order: 40,
      content: {
        kind: "module_reflection",
        interestingPrompt: "When did you shift from thinking like a developer to thinking like an XR researcher?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 41,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 6 — Building Educational VR Experiences and Experimental Design.",
        rewards: {
          xp: 300,
          badges: ["xr-learning-designer", "educational-researcher"],
          nextModule: "Module 7 — Building Educational VR Experiences",
        },
      },
    },
  ],
}
