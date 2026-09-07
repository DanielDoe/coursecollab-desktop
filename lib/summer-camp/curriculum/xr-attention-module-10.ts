/**
 * Module 10 — Research Methods and Publication
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
        "application/zip",
      ],
      maxSizeMb: 50,
      facultyApproval: true,
    },
  }
}

export const XR_ATTENTION_MODULE_10: CurriculumModule = {
  title: "Module 10 — Research Methods and Publication",
  description:
    "Experimental design, user studies, scientific writing, figures, posters, conference papers, and final program deliverables.",
  sort_order: 10,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 4–5 hours · Difficulty: Intermediate to Advanced · Final module · Badge: Summer Research Scholar",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Research Methods and Publication",
        subtitle: "Transforming Research Projects into Scientific Contributions",
        tags: ["Research", "Publication", "User Studies", "Scientific Writing", "Poster"],
        imageUrl: "/summer-camp/xr-attention/xr-module-10-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "The hero above sets the publication goal: turn XR experiments, analytics, and figures into a professional research contribution.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand how publishable research is conducted
- Learn how to formulate research questions and hypotheses
- Design XR user studies and experiments
- Recruit and manage study participants
- Create surveys and experimental protocols
- Understand scientific writing structure
- Create publication-quality figures and tables
- Design research posters
- Prepare a conference-style paper draft
- Complete the final summer research deliverable`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Welcome to Research and Publication

You have built XR environments, collected multimodal data, analyzed eye tracking, and built AI attention models.

**Research is not complete until it is communicated.**

Researchers create impact through conference papers, journal articles, research posters, presentations, and technical reports.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 5,
      content: {
        variant: "start_journey",
        title: "📄 Start My Research Journey",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — What Makes Research Publishable?

**Student A:** builds a system, collects data, stops.

**Student B:** builds, collects, analyzes, communicates, publishes.

Research becomes valuable when others can learn from it.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 7,
      content: {
        variant: "vertical_pipeline",
        title: "Research lifecycle",
        steps: [
          "Research Question",
          "Experiment",
          "Data Collection",
          "Analysis",
          "Results",
          "Publication",
        ],
      },
    },
    {
      block_type: "reflection",
      sort_order: 8,
      content: {
        prompt: "Why do researchers publish?",
        options: [
          "Share discoveries",
          "Advance knowledge",
          "Improve society",
          "Build careers",
          "Enable future research",
        ],
        saveToProfile: true,
        profileKey: "whyPublishResearch",
      },
    },
    {
      block_type: "text",
      sort_order: 9,
      content: {
        markdown: `## Section 3 — Experimental Design

Poor experiments produce poor conclusions. Good experiments produce reliable evidence.

**Example research question:** Can eye-tracking data predict student engagement in VR learning environments?`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 10,
      content: {
        variant: "matching",
        title: "Question vs. hypothesis",
        prompt: "Tap each row to reveal the match.",
        pairs: [
          { task: "Can gaze metrics predict engagement?", capability: "Research Question" },
          { task: "Longer fixation duration predicts higher quiz scores", capability: "Hypothesis" },
          { task: "What is VR?", capability: "Not a research hypothesis" },
          { task: "Interactive lessons increase dwell time on AOIs", capability: "Hypothesis" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 11,
      content: {
        markdown: `## Section 4 — Hypothesis Formulation

A **hypothesis** is a testable prediction.

**Good:** Students with longer fixation durations will achieve higher quiz scores.

**Poor:** VR is cool.

Characteristics: testable · measurable · specific · research-oriented`,
      },
    },
    reflect("Create a hypothesis linking eye tracking to learning outcomes for your summer project.", 12),
    callout("🧠 Research Thinker Badge — for drafting a testable hypothesis", 13),
    {
      block_type: "text",
      sort_order: 14,
      content: {
        markdown: `## Section 5 — Independent and Dependent Variables

**Independent variables** — manipulated or compared (content type, AI tutor on/off, lesson difficulty, visual design).

**Dependent variables** — measured outcomes (quiz scores, fixation duration, dwell time, task completion time, attention scores).

**Example:** Does lesson design influence attention? → Dependent variable: average fixation duration on instructional AOIs.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 15,
      content: {
        variant: "matching",
        title: "Match research question to dependent variable",
        prompt: "Tap each row to reveal the match.",
        pairs: [
          { task: "Does VR lesson type affect quiz scores?", capability: "Quiz Score" },
          { task: "Does design affect attention?", capability: "Average Fixation Duration" },
          { task: "Does AI tutor affect engagement?", capability: "Dwell Time on AOIs" },
          { task: "Group A slides vs Group B interactive VR", capability: "Learning Environment (IV)" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 16,
      content: {
        markdown: `## Section 6 — User Studies, Recruitment, and Protocols

### User studies

Researchers study people — experiments must be designed carefully.

**Workflow:** Recruit → Consent → Instructions → Experiment → Survey → Debrief

### Participant recruitment

Participants should match the target audience (e.g., college students for student attention research).

**Sources:** university students · summer camp participants · research volunteers · student organizations

**Best practices:** diverse participants · clear communication · ethical recruitment

### Experimental protocol design

A **protocol** defines exactly how the study is conducted.

**Example flow:** Arrival → Consent → Calibration → VR Lesson → Quiz → Survey → Exit

Protocols ensure consistency across participants.

### Surveys and questionnaires

Not all information can be observed — researchers often ask participants directly.

**Topics:** engagement · usability · satisfaction · learning experience · workload · presence

**Example:** "I felt engaged during the lesson." (Strongly Disagree → Strongly Agree)`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 17,
      content: {
        variant: "vertical_pipeline",
        title: "User study workflow",
        steps: ["Recruit Participants", "Consent", "Instructions", "Experiment", "Survey", "Debrief"],
      },
    },
    {
      block_type: "activity",
      sort_order: 18,
      content: {
        title: "Discussion — What challenges arise in human-subject studies?",
        prompt: "Consider recruitment, ethics, dropout, equipment issues, and data quality.",
        activityType: "first_discussion",
      },
    },
    reflect("Design a participant recruitment strategy for your VR attention study (who, how many, how recruited).", 20),
    step("Create a protocol for your VR attention study", "Document each step from arrival through debrief with timing estimates.", 22),
    reflect("Write three survey questions for your XR attention study.", 24),
    {
      block_type: "text",
      sort_order: 25,
      content: {
        markdown: `## Section 7 — Scientific Writing and Results

### Research writing fundamentals

Good research can be overlooked if poorly communicated.

**Goals:** clarity · precision · objectivity · reproducibility

Scientific writing builds from evidence → analysis → results → conclusions.

### Writing an abstract

Concise summary: **Problem → Method → Results → Contribution**

**Example opening:** "This paper investigates student attention in VR learning environments using eye-tracking analytics and machine learning techniques."

### Writing an introduction

Explain why the problem matters, existing challenges, the research gap, and your contributions.

Structure: Background → Problem → Gap → Contributions

### Writing methodology

Include: participants · equipment · procedures · data collection · analysis methods

**Example equipment:** HTC Vive Pro Eye · Tobii eye tracking · Unity XR environment · Python analytics pipeline

### Writing results

Present findings **objectively** — statistics, visualizations, tables, model performance.

**Example:** "Random Forest achieved 87% accuracy for attention prediction."`,
      },
    },
    {
      block_type: "activity",
      sort_order: 26,
      content: {
        title: "Discussion — How is scientific writing different from everyday writing?",
        prompt: "Share examples of objectivity, citations, and reproducibility.",
        activityType: "first_discussion",
      },
    },
    reflect("Draft a 150-word abstract for your summer research project.", 28),
    step("Draft methodology section", "Write participants, apparatus, procedure, and analysis for your summer project.", 31),
    {
      block_type: "activity",
      sort_order: 33,
      content: {
        title: "Interpret a results figure",
        prompt: "A bar chart shows Random Forest (87%) > Logistic Regression (81%). What conclusion is supported?",
        options: [
          "Random Forest performed best among compared models",
          "All models performed identically",
          "Eye tracking is useless",
          "No conclusion possible",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Random Forest performed best",
        revealMessage: "Results sections state what the data show — interpretation belongs in Discussion.",
      },
    },
    {
      block_type: "text",
      sort_order: 34,
      content: {
        markdown: `## Section 8 — Scientific Visualization

### Why Figures Matter

Most readers examine figures before reading text.

Good figures:

✓ Communicate findings clearly

✓ Highlight important trends

✓ Support research conclusions

✓ Improve paper readability

---

### Characteristics of Good Figures

✓ Clear Labels

✓ Minimal Clutter

✓ Consistent Formatting

✓ Easy Interpretation

✓ Visually Engaging

---

### Common Research Figures

#### Eye Tracking Visualizations

* Heatmaps
* Scanpaths
* Attention Maps
* AOI (Area of Interest) Charts
* Fixation Duration Histograms
* Gaze Transition Diagrams

---

#### Statistical Visualizations

* Scatter Plots
* Correlation Matrices
* Box Plots
* Bar Charts
* Line Charts
* Regression Plots

---

#### Machine Learning Visualizations

* Confusion Matrices
* ROC Curves
* Precision-Recall Curves
* Feature Importance Charts
* Decision Tree Visualizations

---

#### Human Factors Visualizations

* Survey Response Charts
* Participant Journey Maps
* Task Completion Charts
* Interaction Frequency Charts
* Engagement and Usability Summaries

---

### Publication Figures for This Project

Students should generate:

✓ Eye-Tracking Heatmap

✓ Scanpath Visualization

✓ AOI Analysis Chart

✓ Correlation Plot

✓ Feature Importance Chart

✓ Confusion Matrix

✓ Survey Results Visualization

✓ Research Poster Figures

---

### Research Tip

A well-designed figure can often communicate more information than an entire page of text.

---

### Tables

| Model | Accuracy |
| --- | --- |
| Logistic Regression | 81% |
| Random Forest | 87% |
| XGBoost | 89% |

Use consistent formatting, clear labels, and minimal clutter.`,
      },
    },
    {
      block_type: "image_gallery",
      sort_order: 35,
      content: {
        cards: [
          { title: "Heatmaps", description: "Spatial attention distribution", imageUrl: "/summer-camp/xr-attention/heatmap-figure.png" },
          { title: "Scanpaths", description: "Fixation sequence and saccade paths", imageUrl: "/summer-camp/xr-attention/scanpath-viz-research.png" },
          { title: "AOI Charts", description: "Dwell time by region", imageUrl: "/summer-camp/xr-attention/aoi-chart.png" },
          { title: "Confusion Matrices", description: "Model classification performance", imageUrl: "/summer-camp/xr-attention/confusion-matrix.png" },
          { title: "Feature Importance", description: "ML model interpretability", imageUrl: "/summer-camp/xr-attention/feature-importance.png" },
          { title: "Survey Results", description: "Human factors response summaries", imageUrl: "/summer-camp/xr-attention/survey-results-viz.png" },
        ],
      },
    },
    {
      block_type: "activity",
      sort_order: 36,
      content: {
        title: "Review a research figure",
        prompt: "Review a sample research figure and identify: (1) What finding is being communicated? (2) Is the figure clear and effective? (3) How could the visualization be improved?",
        options: [
          "The figure clearly shows the main finding with readable labels",
          "The figure is cluttered or hard to interpret",
          "I would improve labels, color contrast, or remove unnecessary elements",
        ],
        activityType: "poll",
        multiSelect: true,
        revealTitle: "Figures should tell the story at a glance",
        revealMessage: "Strong figures communicate findings clearly, use minimal clutter, and support your conclusions — often more effectively than long paragraphs of text.",
      },
    },
    {
      block_type: "text",
      sort_order: 37,
      content: {
        markdown: `## Section 9 — Posters and Conference Papers

### Research posters

Visual summary: Title · Introduction · Methodology · Results · Discussion · Future Work

**Design rules:** large figures · minimal text · clear story · professional layout

### Drafting a conference paper

**Suggested title:** Understanding Student Attention in Virtual Reality Learning Environments Through Eye-Tracking Analytics and AI

**Paper structure:** Abstract · Introduction · Related Work · Methodology · Results · Discussion · Conclusion · References

**Team contributions:**

| Focus | Lead |
| --- | --- |
| Eye tracking analytics | Nader |
| Machine learning & evaluation | Aisosa |
| Literature & human factors | Kevin |
| Faculty mentor | Project integration, scientific direction, final review |`,
      },
    },
    step("Sketch a research poster layout", "Outline sections and where key figures will appear.", 39),
    callout("🎨 Scientific Communicator Badge — for completing your poster layout", 40),
    {
      block_type: "text",
      sort_order: 41,
      content: {
        markdown: `## Section 10 — Final Deliverables and Program Completion

Prepare a conference-style paper with title, abstract, introduction, methodology, results, discussion, conclusion, and references.

### Program completion

You have reached the final milestone of the **AI, XR, and Eye-Tracking Research Summer Program**.

From XR foundations and eye-tracking hardware to multimodal analytics, Unity development, and publication-ready research — you completed the full research training arc.

> 🎉 **Congratulations!** You are ready to graduate as an **XR Research Scholar**.

### Research skills you gained

You are now prepared to:

- **Conduct XR research** — design immersive studies with clear hypotheses and protocols
- **Design user studies** — recruit participants, obtain consent, and run ethical experiments
- **Analyze eye-tracking data** — extract fixations, saccades, heatmaps, and AOI metrics
- **Apply AI to behavioral analytics** — build models that predict attention and engagement
- **Write scientific papers** — structure abstracts, methods, results, and discussion sections
- **Present research professionally** — design posters and deliver conference-style talks
- **Contribute to publications** — prepare work for conference and journal submission`,
      },
    },
    checkpoint(
      "Draft Conference Paper",
      "Upload your draft conference paper (PDF) with all major sections.",
      43,
    ),
    checkpoint(
      "Research Poster",
      "Upload your research poster (PDF or PNG).",
      44,
    ),
    checkpoint(
      "Final Presentation Slides",
      "Upload your final presentation (PDF or PPTX).",
      45,
    ),
    callout("🏆 Summer Research Scholar Badge — awarded upon faculty review of final deliverables", 46),
    kc("Knowledge Check — Research Methods and Publication", [
      {
        id: "q1",
        prompt: "What is a hypothesis?",
        options: ["A proven result", "A testable prediction", "A conclusion", "A survey"],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "What is an independent variable?",
        options: [
          "Measured outcome",
          "Variable manipulated by researchers",
          "Data file",
          "Statistical result",
        ],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "What section summarizes the entire paper?",
        options: ["Methodology", "Abstract", "Results", "References"],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "What should a research figure do?",
        options: [
          "Improve graphics",
          "Communicate findings clearly",
          "Increase page count",
          "Reduce storage",
        ],
        correctIndex: 1,
      },
      {
        id: "q5",
        prompt: "What is the final deliverable of this module?",
        options: ["Dashboard", "XR Environment", "Draft Conference Paper", "Heatmap"],
        correctIndex: 2,
      },
    ], 47),
    {
      block_type: "reflection",
      sort_order: 48,
      content: {
        prompt: "How confident are you in preparing a research publication?",
        options: ["😀 Very Confident", "🙂 Confident", "😐 Neutral", "🙁 Need More Practice"],
        saveToProfile: true,
        profileKey: "researchPublicationConfidence",
      },
    },
    {
      block_type: "activity",
      sort_order: 49,
      content: {
        title: "What aspect of research publication do you find most challenging?",
        prompt: "Experimental Design · Data Analysis · Writing · Presenting · Literature Review — share in the thread.",
        activityType: "first_discussion",
      },
    },
    callout("📚 Research Author Badge — for participating in final module discussions", 50),
    {
      block_type: "interactive",
      sort_order: 52,
      content: {
        variant: "achievement_summary",
        title: "Your Research Journey",
        subtitle: "Ten modules of hands-on XR, eye tracking, AI analytics, and scientific communication.",
        items: [
          "Completed Modules 1–10",
          "Built XR environments and data pipelines",
          "Collected and analyzed eye-tracking data",
          "Trained AI attention and engagement models",
          "Drafted conference paper and research poster",
          "Delivered final research presentation",
        ],
      },
    },
    {
      block_type: "interactive",
      sort_order: 53,
      content: {
        variant: "certificate_requirements",
        title: "Final Certification Requirements",
        description: "Track what you have completed before claiming your certificate on the Graduation page.",
        requirements: [
          "Complete all modules (1–10)",
          "Finish laboratory activities and checkpoints",
          "Contribute to the team research project",
          "Submit draft conference paper (PDF)",
          "Submit research poster (PDF or PNG)",
          "Deliver final presentation (PDF or PPTX)",
          "Complete module knowledge checks and reflections",
        ],
      },
    },
    {
      block_type: "interactive",
      sort_order: 55,
      content: {
        variant: "certificate_award",
        certificateTitle: "XR, Eye Tracking, and AI Research Training Certificate",
        subtitle: "Certificate in AI, Virtual Reality, Eye-Tracking, and Behavioral Analytics Research",
        issuer: "Issued jointly by Prairie View A&M University and Central State University",
        partnerLine: "Department of Electrical and Computer Engineering",
        pvamuLogoUrl: "/summer-camp/pvamu-logo.png",
        partnerLogoUrl: "/summer-camp/csu-logo.png",
      },
    },
    {
      block_type: "interactive",
      sort_order: 56,
      content: {
        variant: "graduation",
        headline: "You are now an XR Research Scholar",
        programName: "XR, Eye Tracking, and AI Research Training",
        skillsLeadIn: "You are now prepared to:",
        skills: [
          "XR Research",
          "User Study Design",
          "Eye-Tracking Analytics",
          "AI Behavioral Models",
          "Scientific Writing",
          "Conference Presentations",
        ],
      },
    },
    {
      block_type: "feedback",
      sort_order: 57,
      content: {
        kind: "module_reflection",
        interestingPrompt: "What are you most proud of accomplishing in this summer research program?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 58,
      content: {
        title: "🎉 Program Complete!",
        message:
          "You have completed Module 10 and the XR Attention Analytics research training program.",
        rewards: {
          xp: 500,
          badges: [
            "summer-research-scholar",
            "xr-researcher",
            "scientific-communicator",
            "research-author",
            "xr-attention-certificate-2026",
          ],
          comingNext:
            "Continue to the VR Attention Research Capstone to integrate your team project, or visit Graduation to claim your certificate.",
        },
      },
    },
  ],
}
