/**
 * Module 5 — Unity XR Development Environment
 * XR Attention Analytics · Summer Research Training 2026
 *
 * Instructor note (not shown to students): add labeled Unity Editor screenshot, OpenXR
 * architecture diagram, Vive connection workflow, Tobii SDK architecture, classroom wireframe,
 * XR camera rig diagram, real-time gaze ray visualization, and hands-on lab milestones.
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

export const XR_ATTENTION_MODULE_5: CurriculumModule = {
  title: "Module 5 — Unity XR Development Environment",
  description:
    "Unity fundamentals, OpenXR, HTC Vive Pro Eye, Tobii XR SDK, real-time gaze access, research logging, and your first virtual classroom.",
  sort_order: 5,
  blocks: [
    {
      block_type: "callout",
      sort_order: 0,
      content: {
        variant: "tip",
        text: "Estimated time: 3–4 hours · Difficulty: Beginner to Intermediate · XP reward: 250 XP · Badge: Unity XR Developer",
      },
    },
    {
      block_type: "hero",
      sort_order: 1,
      content: {
        title: "Unity XR Development",
        subtitle: "Building Immersive Virtual Reality Experiences",
        tags: ["Unity", "OpenXR", "Vive Pro Eye", "Tobii", "XR Development"],
        imageUrl: "/summer-camp/xr-attention/xr-module-5-hero.png",
      },
    },
    {
      block_type: "text",
      sort_order: 2,
      content: {
        markdown:
          "From research ideas to interactive virtual worlds, with Unity, XR hardware, and analytics working together.",
      },
    },
    {
      block_type: "text",
      sort_order: 3,
      content: {
        markdown: `### Learning objectives

By the end of this module you should:

- Understand Unity and Unreal Engine as XR development platforms
- Understand how XR applications are built
- Install and configure Unity (or Unreal with instructor approval) for XR development
- Understand scenes, game objects, and components
- Configure OpenXR and HTC Vive Pro Eye
- Integrate Tobii XR SDK
- Access real-time eye-tracking data
- Build your first XR learning environment
- Understand the software architecture used in our research project`,
      },
    },
    {
      block_type: "text",
      sort_order: 4,
      content: {
        markdown: `## Section 1 — Welcome to XR Development

### Opening story

Everything we have discussed — human attention, eye tracking, multimodal sensing, data collection — requires a **virtual environment** where users can interact.

That environment must render 3D content, track users, record behavior, support eye tracking, and support AI analytics.

To build it we use a **game engine** — primarily **Unity** in our lab, with **Unreal Engine** as a supported alternative for approved teams.`,
      },
    },
    {
      block_type: "reflection",
      sort_order: 5,
      content: {
        prompt: "Have you used Unity or Unreal Engine before?",
        options: ["Never used either", "Unity only", "Unreal only", "Both engines"],
        saveToProfile: true,
        profileKey: "xrEngineExperience",
      },
    },
    {
      block_type: "text",
      sort_order: 6,
      content: {
        markdown: `## Section 2 — XR Development Platforms

Research VR experiences are built in a **game engine** — software that renders 3D worlds, tracks users, and logs behavioral data. Our lab primarily uses **Unity**, but **Unreal Engine** is a supported alternative for teams with instructor approval.

### Unity — primary lab platform

**Unity** turns research ideas into interactive virtual worlds where users generate gaze, movement, and interaction data.

![Unity Editor — Scene, Game, Hierarchy, Project, and Inspector (Unity Manual)](/summer-camp/xr-attention/engine-docs/unity-editor-workspace.jpg)

Before you open the Editor, you manage installs and projects in **Unity Hub**:

![Unity Hub — Projects tab (Unity Manual)](/summer-camp/xr-attention/engine-docs/unity-hub-projects.png)

*Unity screenshots from official Unity documentation (© Unity Technologies).*`,
      },
    },
    {
      block_type: "text",
      sort_order: 7,
      content: {
        markdown: `### Unreal Engine — alternative platform

**Unreal Engine** is widely used in research labs, simulation, and high-fidelity VR when teams need advanced rendering or Blueprint/C++ workflows.

![Unreal Editor — default Level Editor layout (Epic Games documentation)](/summer-camp/xr-attention/engine-docs/unreal-editor-interface.png)

| | Unity (lab default) | Unreal Engine (alternative) |
| --- | --- | --- |
| Primary language | C# | C++ / Blueprints |
| Project hub | Unity Hub | Epic Games Launcher |
| XR standard | OpenXR | OpenXR |
| Eye tracking | Tobii XR SDK (our lab stack) | OpenXR + vendor plugins (confirm with instructor) |
| Best for | Rapid XR prototyping, Tobii + Vive integration | High-fidelity visuals, large simulation scenes |

Both engines can target **HTC Vive Pro Eye** through **OpenXR** and SteamVR. Modules 5–6 follow **Unity** step-by-step; Unreal teams should mirror the same milestones (install → OpenXR → calibration → gaze logging) using Epic’s equivalent tools.

*Unreal screenshot from [Epic Games Unreal Engine documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/level-editor-in-unreal-engine).*`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 8,
      content: {
        variant: "vertical_pipeline",
        title: "From research idea to findings",
        steps: [
          "Research Idea",
          "Engine Project (Unity or Unreal)",
          "Virtual Environment",
          "User Interaction",
          "Data Collection",
          "Research Findings",
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 9,
      content: {
        markdown: `### Why researchers use game engines

✓ VR / XR support · ✓ OpenXR device integration · ✓ Eye-tracking plugins · ✓ Physics simulation · ✓ Data logging · ✓ Cross-platform deployment

### Real-world example (Unity)

A VR classroom built in Unity lets students attend lectures, interact with content, take quizzes, and generate eye-tracking data — all in one environment.

### Real-world example (Unreal)

Simulation and training labs use Unreal for photorealistic environments while streaming gaze and interaction events to analytics pipelines — same research goal, different toolchain.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 10,
      content: {
        variant: "industry_sectors",
        sectors: [
          { title: "Education", examples: ["VR classrooms", "Lab simulations", "Attention studies"], imageUrl: "/summer-camp/xr-attention/virtual-classroom-scene.png" },
          { title: "Healthcare", examples: ["Surgical training", "Therapy environments", "Patient education"], imageUrl: "/summer-camp/shared/ai-healthcare.png" },
          { title: "Automotive", examples: ["Driver simulators", "HMI testing", "Design review"], imageUrl: "/summer-camp/module-0/autonomous-vehicle.png" },
          { title: "Gaming", examples: ["Immersive titles", "Locomotion research", "UX testing"], imageUrl: "/summer-camp/xr-attention/gaze-ray-visualization.png" },
          { title: "Military", examples: ["Mission rehearsal", "Equipment training", "Situational awareness"], imageUrl: "/summer-camp/xr-attention/steamvr-tracking-chain.png" },
          { title: "Manufacturing", examples: ["Assembly guidance", "Digital twins", "Safety training"], imageUrl: "/summer-camp/shared/iot-industry.png" },
          { title: "Digital Twins", examples: ["Factory models", "Building walkthroughs", "Process simulation"], imageUrl: "/summer-camp/xr-attention/digital-twin-factory.png" },
          { title: "Research Labs", examples: ["HCI studies", "Eye-tracking experiments", "AI analytics"], imageUrl: "/summer-camp/xr-attention/xr-module-5-hero.png" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 11,
      content: {
        markdown: `## Section 3 — Unity Ecosystem

### Software stack

| Component | Role |
| --- | --- |
| Unity Hub | Project management and editor installs |
| Unity LTS | Main development platform for scenes and scripts |
| OpenXR | Industry-standard XR framework |
| SteamVR | Communication with HTC Vive hardware |
| Tobii XR SDK | Eye tracking integration and gaze APIs |
| GitHub | Version control and team collaboration |`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 12,
      content: {
        variant: "matching",
        title: "Match the component",
        prompt: "Tap each row to reveal the match.",
        pairs: [
          { task: "Unity", capability: "Development Platform" },
          { task: "SteamVR", capability: "Device Runtime" },
          { task: "OpenXR", capability: "XR Standard" },
          { task: "Tobii XR SDK", capability: "Eye Tracking" },
          { task: "GitHub", capability: "Version Control" },
        ],
      },
    },
    {
      block_type: "text",
      sort_order: 13,
      content: {
        markdown: `## Section 4 — Installing Unity

Follow these steps on your lab PC. Compare your screen to the **official Unity Hub screenshots** below — your Installs tab and module dialog should match.

### Step 1 — Install Unity Hub

Download Unity Hub from [unity.com/download](https://unity.com/download), install it, and sign in with your camp account.

![Unity Hub — main window with Projects tab (Unity Manual)](/summer-camp/xr-attention/unity-docs/gs_projects_tab_hub.png)

### Step 2 — Install Unity LTS

Open the **Installs** tab → **Install Editor** → choose the **lab-standard LTS version** (e.g., Unity 2022 LTS or Unity 6 LTS — confirm with your instructor).

![Unity Hub — Installs tab with Install Editor (Unity Manual)](/summer-camp/xr-attention/unity-docs/gs_hub_installs_screen2.png)

Use the **gear (⋮) menu** next to an installed editor to add modules later.

![Gear menu on an editor install (Unity Manual)](/summer-camp/xr-attention/unity-docs/gs_gear_icon.png)

### Step 3 — Required modules

On the module selection screen, enable:

✓ Windows Build Support · ✓ Visual Studio · ✓ XR-related modules listed by your instructor

![Unity Hub — choose modules during install (Unity Manual)](/summer-camp/xr-attention/unity-docs/gs_choose_components.png)

*Reference screenshots from Unity documentation (© Unity Technologies).*`,
      },
    },
    step("Install Unity Hub", "Download Unity Hub, install it, and sign in with your camp account.", 14),
    step("Install Unity LTS editor", "Install the lab-standard LTS version with Windows Build Support and Visual Studio.", 15),
    step("Install XR Tools module", "Add XR Plugin Management and related modules via Unity Hub.", 16),
    checkpoint(
      "Unity Installation Verification",
      "Upload a screenshot showing Unity Hub with your installed editor and XR modules configured.",
      17,
    ),
    {
      block_type: "text",
      sort_order: 18,
      content: {
        markdown: `## Section 5 — Understanding Unity Basics

### Unity Editor tour

Match your Editor layout to the official Unity window map below (Scene, Game, Hierarchy, Project, Inspector).

![Unity Editor — main windows labeled (Unity Manual)](/summer-camp/xr-attention/unity-docs/BasicsIntroPic.jpg)

### Core concept: Game Objects

Everything in Unity is a **Game Object** — camera, cube, chair, student avatar, classroom.

### Components

Game objects become useful through **components**. Example: Camera + Transform + XR Camera → functional XR camera.

The **Inspector** (right panel) is where you edit components and properties for the selected object:

![Inspector window — edit components on selected objects (Unity Manual)](/summer-camp/xr-attention/unity-docs/InspectorWindowCallout.jpg)`,
      },
    },
    {
      block_type: "activity",
      sort_order: 19,
      content: {
        title: "What is the purpose of the Inspector?",
        prompt: "Select one:",
        options: ["Edit object properties", "Run code", "Install Unity", "Create projects"],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Correct: Edit object properties",
        revealMessage:
          "The Inspector shows and edits components and properties for the selected Game Object.",
      },
    },
    {
      block_type: "text",
      sort_order: 20,
      content: {
        markdown: `## Section 6 — Creating Your First XR Project

### Create new project

In Unity Hub, click **New project** and choose **3D (Core)** or **3D (URP)** per lab standard. Name your project for your team (e.g., \`XR-Attention-Lab\`).

![Unity Hub — create a new project (Unity Manual)](/summer-camp/xr-attention/unity-docs/gs_create_project_hub.png)

### Recommended folder layout

\`\`\`
Assets/
├── Scenes/
├── Scripts/
├── Materials/
├── Models/
├── Prefabs/
├── XR/
├── Data/
└── Resources/
\`\`\`

Use the **Project** window to create folders under \`Assets/\`:

![Unity Project window — folder layout under Assets (Unity Manual)](/summer-camp/xr-attention/unity-docs/project-window-wide-layout.png)

Good structure improves collaboration, reproducibility, and maintainability for research projects.`,
      },
    },
    step("Create XR Research Project", "Create a new 3D project named for your team (e.g., XR-Attention-Lab).", 21),
    step("Set up folder structure", "Create Scenes, Scripts, XR, and Data folders under Assets.", 22),
    checkpoint(
      "Project Structure Screenshot",
      "Upload a screenshot of your Unity Project window showing the recommended folder layout.",
      23,
    ),
    {
      block_type: "text",
      sort_order: 24,
      content: {
        markdown: `## Section 7 — Configuring OpenXR

### Why OpenXR?

Historically every headset required different code. **OpenXR** provides one industry-standard XR API.

### Architecture

Unity → OpenXR → SteamVR Runtime → HTC Vive Pro Eye

### Configuration steps

1. Open **Edit → Project Settings → XR Plug-in Management**
2. If prompted, click **Install XR Plugin Management**
3. Select the **Windows, Mac, Linux** tab
4. Check **OpenXR** under Plug-in Providers
5. Under **OpenXR**, add the **HTC Vive Controller** interaction profile
6. Set **Play Mode OpenXR Runtime** to **SteamVR** when testing with Vive in the Editor

#### Install XR Plug-in Management

![Install XR Plug-in Management button (Unity Manual)](/summer-camp/xr-attention/unity-docs/xr-management-enable-plugin.png)

#### Enable OpenXR

![Enable OpenXR in Plug-in Providers (OpenXR Plugin documentation)](/summer-camp/xr-attention/unity-docs/openxr-xrmanagement.png)

#### Interaction profiles (Vive)

![Add OpenXR interaction profile — HTC Vive Controller (OpenXR Plugin documentation)](/summer-camp/xr-attention/unity-docs/openxr-choose-interaction-profile.png)

#### OpenXR features & validation

![OpenXR features panel (OpenXR Plugin documentation)](/summer-camp/xr-attention/unity-docs/openxr-features.png)

![XR Project Validation — fix warnings before Play Mode (Unity Manual)](/summer-camp/xr-attention/unity-docs/xr-project-validation.png)

*Reference screenshots from Unity OpenXR Plugin and XR Plug-in Management documentation.*`,
      },
    },
    step("Enable OpenXR", "Install XR Plugin Management, enable OpenXR, and configure for PC VR / Vive.", 25),
    step("Verify OpenXR initialization", "Enter Play Mode or build to device and confirm no OpenXR init errors in Console.", 26),
    {
      block_type: "text",
      sort_order: 27,
      content: {
        markdown: `## Section 8 — Connecting HTC Vive Pro Eye

### Device connection flow

HTC Vive → SteamVR → OpenXR → Unity

### Validation steps

1. Start **SteamVR** from Steam
2. Connect headset, Link Box, and controllers
3. Confirm **all device icons are green** in the SteamVR status window (solid green = ready)
4. Open Unity and enter **Play Mode**

![SteamVR status window — headset, controllers, and base stations ready (Valve Developer Community)](/summer-camp/xr-attention/unity-docs/steamvr-status.png)

**Expected result:** movement in the real world maps to movement inside the virtual environment.

### Common issues

Headset not detected · tracking lost · controllers unavailable — check cables, base stations, Link Box power, and SteamVR status before debugging Unity.`,
      },
    },
    step("Connect Vive Pro Eye in SteamVR", "Confirm headset and controllers show green/ready in SteamVR dashboard.", 28),
    {
      block_type: "activity",
      sort_order: 29,
      content: {
        title: "Troubleshooting challenge — headset not detected",
        prompt: "What should you check first?",
        options: [
          "Reinstall Word",
          "Verify USB/DisplayPort, Link Box, and SteamVR status",
          "Disable eye tracking permanently",
          "Delete the Unity project",
        ],
        activityType: "poll",
        multiSelect: false,
        revealTitle: "Check hardware and SteamVR",
        revealMessage:
          "Verify cables, Link Box power, SteamVR running, and that the headset is recognized before debugging Unity.",
      },
    },
    {
      block_type: "text",
      sort_order: 30,
      content: {
        markdown: `## Section 9 — Tobii XR SDK Integration

### Why Tobii?

The Tobii XR SDK gives researchers access to gaze rays, eye position, eye openness, and tracking confidence.

### Installation

1. Download SDK (lab-provided version)
2. In Unity: **Assets → Import Package → Custom Package…**
3. Select the \`.unitypackage\` file and click **Import**
4. Configure XR / Tobii services per lab documentation

![Import Package dialog — select all Tobii SDK files (Unity Manual)](/summer-camp/xr-attention/unity-docs/custom-package-install-dialog.png)

Use **Window → Package Manager** to verify XR-related packages are present:

![Unity Package Manager (Unity Manual)](/summer-camp/xr-attention/unity-docs/upm-ui.png)

### Architecture

Eye → Tobii sensors → Tobii SDK → Unity → research logger`,
      },
    },
    step("Import Tobii XR SDK", "Import the Tobii package into your Unity project.", 31),
    step("Run sample gaze tracking scene", "Open the Tobii sample scene and verify gaze rays in Play Mode with headset.", 32),
    {
      block_type: "text",
      sort_order: 33,
      content: {
        markdown: `## Section 10 — Accessing Eye Tracking Data

### Real-time data flow

Eye → gaze direction → Unity → research dashboard / logger

### Example variables

Gaze origin · gaze direction · eye position · tracking status · timestamp

![Real-time gaze ray visualization](/summer-camp/xr-attention/gaze-ray-visualization.png)`,
      },
    },
    reflect("What could we infer from real-time gaze data in a VR classroom?", 34, {
      hint: "Consider attention, interest, and navigation behavior.",
    }),
    {
      block_type: "text",
      sort_order: 35,
      content: {
        markdown: `## Section 11 — Building a Virtual Classroom

### Project goal

Build a simple educational environment that mirrors our research study.

### Environment components

![Virtual classroom scene mockup](/summer-camp/xr-attention/virtual-classroom-scene.png)

Include: floor · walls · projector screen · slides · desk · student position

Students will later view educational content, generate gaze data, and produce attention metrics in this space.`,
      },
    },
    step("Build classroom prototype", "Add floor, walls, screen, and a student stand position to your scene.", 36),
    {
      block_type: "text",
      sort_order: 37,
      content: {
        markdown: `## Section 12 — Research Logging Architecture

### Data collection pipeline

User → eye tracking → Unity events → logger → CSV → Python analytics

### What we will record

✓ Gaze data · ✓ Head data · ✓ Interaction data · ✓ Slide changes · ✓ Quiz responses

Researchers must log every meaningful event so multimodal streams can be synchronized and analyzed later.`,
      },
    },
    {
      block_type: "interactive",
      sort_order: 38,
      content: {
        variant: "vertical_pipeline",
        title: "Unity research logging pipeline",
        steps: [
          "User in VR classroom",
          "Eye + head + interaction events",
          "Unity event manager",
          "CSV / JSON logger",
          "Python analytics",
        ],
      },
    },
    {
      block_type: "activity",
      sort_order: 39,
      content: {
        title: "Discussion — Why must researchers log every event?",
        prompt: "Share how missing events would break synchronization or bias your analysis.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 40,
      content: {
        markdown: `## Section 13 — Mini Project

### Build your first XR research scene

Requirements:

✓ XR camera · ✓ Classroom environment · ✓ Eye tracking (gaze rays visible or logged) · ✓ Basic logging hook (even a simple CSV write)

#### XR Origin reference (Unity XR)

Your scene should include an **XR Origin** rig for head-tracked VR. Match the hierarchy below:

![XR Origin Game Object hierarchy (Unity XR Core Utils documentation)](/summer-camp/xr-attention/unity-docs/xr-origin.png)

If using **XR Interaction Toolkit**, add an **Input Action Manager** to the scene:

![Input Action Manager component in scene (Unity XRI documentation)](/summer-camp/xr-attention/unity-docs/input-action-manager.png)

**Milestone:** By the end of this module your project should run on Vive Pro Eye, track head and gaze, log data to file, and render a basic virtual classroom.`,
      },
    },
    step("Add XR camera rig", "Configure XR Origin / camera for head-tracked VR.", 41),
    step("Display or log gaze data", "Show gaze rays in-scene or write gaze samples to a CSV in Assets/Data.", 42),
    checkpoint(
      "XR Research Scene — Scene Screenshot",
      "Upload a screenshot of your virtual classroom scene in the Unity Editor or in-headset view.",
      43,
    ),
    checkpoint(
      "XR Research Scene — Eye Tracking Screenshot",
      "Upload a screenshot showing gaze rays, gaze cursor, or logged gaze data from Play Mode.",
      44,
    ),
    reflect(
      "Mini project reflection — What challenges did you encounter? How might this environment be improved for learning research?",
      45,
    ),
    kc("Knowledge Check — Unity XR Development", [
      {
        id: "q1",
        prompt: "What is Unity primarily used for?",
        options: ["Word Processing", "XR Development", "Database Management", "Networking"],
        correctIndex: 1,
      },
      {
        id: "q2",
        prompt: "What standard helps support multiple XR devices?",
        options: ["HTML", "OpenXR", "SQL", "CSS"],
        correctIndex: 1,
      },
      {
        id: "q3",
        prompt: "Which SDK provides eye tracking access?",
        options: ["Unity Hub", "Tobii XR SDK", "Visual Studio", "GitHub"],
        correctIndex: 1,
      },
      {
        id: "q4",
        prompt: "Why use version control?",
        options: [
          "Collaboration and tracking changes",
          "Better graphics",
          "Better tracking",
          "Better battery life",
        ],
        correctIndex: 0,
      },
      {
        id: "q5",
        prompt: "What is the purpose of the virtual classroom?",
        options: [
          "Entertainment",
          "Research data collection and learning studies",
          "Video Editing",
          "Networking",
        ],
        correctIndex: 1,
      },
    ], 46),
    {
      block_type: "activity",
      sort_order: 47,
      content: {
        title: "Discussion — Designing the perfect VR classroom",
        prompt:
          "What features would improve student learning? Consider visual content, interaction, AI tutors, collaboration, and accessibility.",
        activityType: "first_discussion",
      },
    },
    {
      block_type: "text",
      sort_order: 48,
      content: {
        markdown: `### Research thinking questions

1. How can eye tracking improve educational experiences?
2. What data should be logged during a learning session?
3. How can AI use gaze data in real time?
4. What challenges arise when collecting data from multiple users?
5. What ethical considerations must be addressed?

### Preview of Module 6

**Building Educational VR Experiences and Experimental Design** — VR classroom design principles, educational content, attention-aware interfaces, UX design, experimental protocols, research study design, and pilot testing.`,
      },
    },
    {
      block_type: "feedback",
      sort_order: 49,
      content: {
        kind: "module_reflection",
        interestingPrompt:
          "What was the hardest part of getting your engine (Unity or Unreal), OpenXR, and eye tracking working together?",
      },
    },
    {
      block_type: "module_completion",
      sort_order: 50,
      content: {
        title: "🎉 Congratulations!",
        message: "You have completed Module 5 — Unity XR Development Environment.",
        rewards: {
          xp: 250,
          badges: ["unity-xr-developer", "virtual-environment-builder"],
          nextModule: "Module 6 — Building Educational VR Experiences and Experimental Design",
        },
      },
    },
  ],
}
