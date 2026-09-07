/**
 * Module 9 — AI for Attention Analysis
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
        "text/csv",
        "application/json",
        "application/zip",
      ],
      maxSizeMb: 25,
      facultyApproval: true,
    },
  }
}

export const XR_ATTENTION_MODULE_9: CurriculumModule = {
  title: "Module 9 — AI for Attention Analysis",
  description:
    "Feature engineering, classification, logistic regression, random forest, XGBoost, model evaluation, and attention prediction from XR behavioral data.",
  sort_order: 9,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 4–5 hours · Difficulty: Intermediate to Advanced · XP reward: 350 XP · Badge: AI Researcher",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "AI for Attention Analysis",
        subtitle: "Teaching Machines to Understand Human Behavior",
        tags: ["Machine Learning", "Feature Engineering", "Classification", "Attention", "XR Analytics"],
        imageUrl: "/summer-camp/xr-attention/xr-module-9-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The hero above connects gaze features, model evaluation, and attention prediction in one AI analytics view.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand how AI can be used to analyze human behavior
- Learn feature engineering for eye-tracking datasets
- Build machine learning models for attention prediction
- Understand classification problems
- Train and evaluate attention prediction models
- Compare multiple machine learning approaches
- Interpret AI model outputs
- Build an attention prediction system using XR behavioral data`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Welcome to AI-Powered Attention Analytics

In Module 8 you learned to analyze eye-tracking data, generate heatmaps, visualize scanpaths, and perform statistical analysis.

Now we teach machines to recognize patterns automatically.

**Can AI determine whether a student is paying attention?**

This question sits at the heart of educational technology, HCI, cognitive science, learning analytics, and XR research.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 5,
      content: {
        variant: "start_journey",
        title: "🤖 Train My First AI Model",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — What is Behavioral Analytics?

Humans naturally identify behavioral patterns in a classroom — note-taking, questions, distraction.

**Behavioral analytics** uses data, statistics, and machine learning to identify meaningful patterns automatically.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "Attention prediction pipeline",
        steps: [
          "Eye Tracking Data",
          "Feature Extraction",
          "Machine Learning",
          "Attention Prediction",
        ],
      },
    },
    {
      block_type: "reflection",
      sort_order: 8,
      content: {
        prompt: "What behavior do you think best indicates attention?",
        options: [
          "Looking at content",
          "Taking notes",
          "Interacting with objects",
          "Asking questions",
          "Completing tasks",
        ],
        saveToProfile: true,
        profileKey: "attentionBehaviorIndicator",
      },
    },
    {
      block_type: "text",
      sort_order: 9,
      content: {
        markdown: `## Section 3 — Understanding Feature Engineering

AI models do not understand raw gaze coordinates or logs. Researchers transform behavior into **measurable features**.

Raw Data → Feature Engineering → Machine Learning → Predictions`,
      },
    },
    {
      block_type: "activity",
      sort_order: 10,
      content: {
        title: "Which is easier for a machine learning model?",
        prompt: "Select one:",
        options: [
          "Millions of raw gaze points",
          "Meaningful behavioral features",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Meaningful behavioral features",
        revealMessage:
          "Feature engineering converts high-dimensional raw data into interpretable variables models can learn from.",
      },
    },
    {
      block_type: "text",
      sort_order: 11,
      content: {
        markdown: `## Section 4 — Core Attention Features

### Feature 1: Fixation duration

**Fixation duration** — time eyes focus on one location.

Longer fixations may indicate interest, attention, cognitive processing, or difficulty.

**Example:** Student A average fixation = 150 ms vs. Student B = 400 ms — who appears to spend more time processing information?

### Feature 2: Dwell time

**Dwell time** — total viewing time on an object (e.g., lecture slide viewed for 12 seconds → dwell time = 12 s).

Often reflects engagement, interest, and content relevance.

### Feature 3: Blink frequency

**Blink frequency** — blinks over time. May correlate with fatigue, cognitive workload, and attention shifts.

Low blink rate may accompany high focus; high blink rate may suggest fatigue — but blink frequency alone cannot determine attention.`,
      },
    },
    reflect("From sample fixation data in your lab notebook, calculate or estimate average fixation duration for one participant.", 12),
    {
      block_type: "activity",
      sort_order: 14,
      content: {
        title: "Which object received the highest dwell time?",
        prompt: "Sample: Slide A = 12 s, Slide B = 4 s, Interactive object = 18 s, Background = 2 s",
        options: ["Slide A", "Slide B", "Interactive object", "Background"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Interactive object (18 s)",
        revealMessage: "Compare dwell times across AOIs to see where students spent the most viewing time.",
      },
    },
    {
      block_type: "activity",
      sort_order: 16,
      content: {
        title: "Discussion — Can blink frequency alone determine attention?",
        prompt: "Share your reasoning — what other signals would you combine?",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 17,
      content: {
        markdown: `## Section 5 — Preparing Features for Machine Learning

### Example feature table

| Feature | Description |
| --- | --- |
| Average fixation duration | Mean fixation time |
| Average dwell time | Mean time on AOIs |
| Blink frequency | Blinks per minute |
| Interaction count | Clicks / selections |
| Task completion time | Seconds to finish |
| Quiz score | Assessment outcome |

One feature rarely tells the whole story — **combining features improves prediction**.`,
      },
    },
    {
      block_type: "activity",
      sort_order: 18,
      content: {
        title: "Select features that best predict engagement",
        prompt: "Select all that apply:",
        options: [
          "Average fixation duration",
          "Average dwell time on instructional AOIs",
          "Blink frequency",
          "Interaction count",
          "Task completion time",
          "GPU model name",
        ],
        activityType: "poll",
        multiSelect: true,
        revealMessage: "Behavioral and performance features predict engagement — not hardware metadata unrelated to the user.",
      },
    },
    {
      block_type: "text",
      sort_order: 19,
      content: {
        markdown: `## Section 6 — Machine Learning Fundamentals

**Machine learning** identifies patterns from examples instead of hand-written rules.

Input: eye tracking features → Model → Output: **Attentive** or **Distracted**

**Classification** — predict categories · **Regression** — predict numerical values`,
      },
    },
    {
      block_type: "activity",
      sort_order: 20,
      content: {
        title: "Predicting Attentive vs. Distracted is an example of:",
        prompt: "Select one:",
        options: ["Classification", "Regression"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Classification",
        revealMessage: "Category labels (attentive/distracted) are classification problems; continuous scores use regression.",
      },
    },
    {
      block_type: "text",
      sort_order: 21,
      content: {
        markdown: `## Section 7 — Machine Learning Models

### Logistic regression

Simple, fast, interpretable classification: features → weighted combination → probability → prediction.

**Example:** P(attentive) = 0.85 → predict **Attentive**

### Random Forest

A **collection of decision trees** that vote on the final prediction.

Fixation duration? → Dwell time? → Blink frequency? → Prediction

**Advantages:** high accuracy, robust, handles complex data, exposes **feature importance**.

### XGBoost

Powerful gradient boosting used in industry, research, and competitions.

**Strengths:** high performance, nonlinear patterns, strong prediction accuracy.

Features → XGBoost → attention score → prediction`,
      },
    },
    reflect("Interpret a logistic regression output: if P(attentive) = 0.32, what label would you predict and why?", 22),
    {
      block_type: "activity",
      sort_order: 24,
      content: {
        title: "Feature importance — which feature might rank highest for attention?",
        prompt: "In many VR lesson studies, which often matters most?",
        options: [
          "Dwell time on instructional AOIs",
          "Random number generator seed",
          "File name length",
          "Monitor refresh rate",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Dwell time on instructional AOIs",
        revealMessage:
          "Random Forest feature importance often highlights gaze-on-content and interaction features for engagement prediction.",
      },
    },
    {
      block_type: "activity",
      sort_order: 26,
      content: {
        title: "Compare models — which is typically most interpretable vs. most accurate?",
        prompt: "Logistic Regression = most interpretable. Which often achieves highest accuracy on tabular behavioral features?",
        options: ["Logistic Regression", "Random Forest", "XGBoost", "All equal always"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Often XGBoost or Random Forest",
        revealMessage:
          "Trade-off: logistic regression is easiest to explain; ensemble methods often win on accuracy but need careful evaluation.",
      },
    },
    {
      block_type: "text",
      sort_order: 27,
      content: {
        markdown: `## Section 8 — Model Evaluation

A model predicting "Attentive" for everyone may show high **accuracy** but be useless.

### Accuracy
Percentage of correct predictions (90/100 correct → 90%).

### Precision
Of students predicted attentive, how many truly were? Reduces false positives.

### Recall
Of all attentive students, how many were found? Reduces missed detections.

### F1 Score
Balances precision and recall — especially important with **imbalanced datasets**.

![Attention classifier confusion matrix](/summer-camp/xr-attention/confusion-matrix.png)`,
      },
    },
    {
      block_type: "activity",
      sort_order: 28,
      content: {
        title: "Why is accuracy sometimes misleading?",
        prompt: "Select the best answer:",
        options: [
          "Class imbalance — most labels are one class",
          "Models always use too much memory",
          "Heatmaps are too colorful",
          "Unity scenes are too large",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Class imbalance",
        revealMessage:
          "If 95% of trials are 'attentive', predicting attentive always yields 95% accuracy while missing all distracted cases.",
      },
    },
    {
      block_type: "text",
      sort_order: 29,
      content: {
        markdown: `## Section 9 — Building an Attention Prediction Model

### Complete workflow

Eye tracking data → feature engineering → training dataset → ML model → evaluation → attention prediction

This process powers educational analytics systems, intelligent tutoring systems, and human-AI interaction platforms — including our summer research project.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 30,
      content: {
        variant: "vertical_pipeline",
        title: "Full ML pipeline",
        steps: [
          "Eye Tracking Data",
          "Feature Engineering",
          "Training Dataset",
          "Machine Learning Model",
          "Evaluation",
          "Attention Prediction",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 31,
      content: {
        markdown: `## Section 10 — Laboratory Exercise

### Build your first attention prediction model

Using a provided XR dataset:

1. Load dataset
2. Extract features
3. Train logistic regression
4. Train random forest
5. Train XGBoost
6. Compare results
7. Select best model`,
      },
    },
    step("Load dataset and extract features", "Build a feature table with fixation, dwell, blink, and interaction features.", 32),
    step("Train logistic regression, random forest, and XGBoost", "Fit three classifiers and record metrics for each.", 33),
    checkpoint(
      "Model Results & Confusion Matrix",
      "Upload model results (PDF or notebook) including accuracy, precision, recall, F1, and confusion matrix for each model.",
      34,
    ),
    checkpoint(
      "Feature Importance Plot",
      "Upload a feature importance or coefficient plot from your best-performing model.",
      35,
    ),
    reflect(
      "Lab reflection — Which model performed best? Which features appeared most important? What limitations exist?",
      36,
    ),
    callout("🤖 AI Researcher Badge — awarded for completing the attention prediction lab", 37),
    kc("Knowledge Check — AI for Attention Analysis", [
      {
        id: "q1",
        prompt: "What is feature engineering?",
        options: [
          "Designing hardware",
          "Converting raw data into useful features",
          "Building XR environments",
          "Creating datasets",
        ],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "Which feature measures total viewing time?",
        options: ["Blink Frequency", "Dwell Time", "Accuracy", "Precision"],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "Which model is easiest to interpret?",
        options: ["Logistic Regression", "XGBoost", "Random Forest", "Neural Network"],
        correctIndex: 0,
      },
      {
        id: "q4",
        prompt: "What does precision measure?",
        options: [
          "Correct positive predictions among predicted positives",
          "Correct negative predictions only",
          "Training speed",
          "Memory usage",
        ],
        correctIndex: 0,
      },
      {
        id: "q5",
        prompt: "Why use F1 Score?",
        options: [
          "Measure graphics quality",
          "Balance precision and recall",
          "Increase accuracy automatically",
          "Improve data collection",
        ],
        correctIndex: 1,
      },
    ], 38),
    {
      block_type: "reflection",
      sort_order: 39,
      content: {
        prompt: "How confident are you in building machine learning models?",
        options: ["😀 Very Confident", "🙂 Confident", "😐 Neutral", "🙁 Need More Practice"],
        saveToProfile: true,
        profileKey: "mlModelConfidence",
      },
    },
    {
      block_type: "activity",
      sort_order: 40,
      content: {
        title: "If you could build an AI tutor that understands student attention, what should it do when attention drops?",
        prompt: "Examples: hints, questions, highlight content, recommend review. Discuss advantages and risks.",
        activityType: "first_discussion",
      },
    },
    callout("🏆 Attention AI Specialist Badge — for thoughtful discussion participation", 41),
    {
      block_type: "feedback",
      sort_order: 42,
      content: {
        kind: "module_reflection",
        interestingPrompt: "What surprised you most about training or evaluating an attention classifier?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 43,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 9 — AI for Attention Analysis.",
        rewards: {
          xp: 350,
          badges: ["ai-researcher", "behavioral-analytics-specialist"],
          nextModule: "Module 10 — Research Methods and Publication",
        },
      },
    },
  ],
}
