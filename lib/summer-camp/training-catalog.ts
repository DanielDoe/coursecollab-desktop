/** Display metadata for browse trainings (merged with DB records by slug). */
export type TrainingCatalogMeta = {
  title: string
  /** Short one-liner for cards / listings. */
  summary: string
  /** Longer faculty/student overview copy (standardized Overview tab). */
  overview: string
  duration: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  audience: string
  format: string
  outcomes: string[]
  tags: string[]
  comingSoon?: boolean
}

export const TRAINING_CATALOG: Record<string, TrainingCatalogMeta> = {
  "ai-edge-computing": {
    title: "AI & Edge Computing",
    summary:
      "Guided mission from AI fundamentals through edge computing to deploying object detection on Raspberry Pi.",
    overview:
      "AI & Edge Computing is a hands-on summer training that takes campers from core AI and machine learning concepts to real deployment on edge hardware.\n\n" +
      "Students progress through computer vision, IoT, and edge computing modules, then apply TensorFlow Lite object detection on a Raspberry Pi. " +
      "Checkpoints, reflections, and discussions reinforce each stage. The track culminates in a final showcase: Object Detection on an Edge Device via Deep Learning.\n\n" +
      "Faculty can review module progress, grade checkpoints, and mentor capstone work from this training workspace.",
    duration: "5–8 days",
    difficulty: "Beginner",
    audience: "High school and early undergraduate STEM students",
    format: "Guided modules · hardware labs · checkpoints · final showcase",
    outcomes: [
      "Understand AI, ML, computer vision, IoT, and edge computing",
      "Follow a guided mission before hands-on Raspberry Pi work",
      "Deploy TensorFlow Lite object detection on a Raspberry Pi",
      "Complete checkpoints, reflections, and a final showcase",
    ],
    tags: ["AI", "Edge", "Raspberry Pi", "Computer Vision", "IoT"],
  },
  "robotics-bootcamp": {
    title: "Robotics Bootcamp",
    summary: "Program locomotion, sensors, and autonomous behaviors for a robotics capstone demo.",
    overview:
      "Robotics Bootcamp introduces students to embedded robotics: microcontroller programming, sensor and actuator integration, and autonomous navigation behaviors.\n\n" +
      "Campers build toward a capstone demonstration under faculty mentorship. Use this Overview to confirm track scope, enrollment, and assigned faculty before opening modules and projects.",
    duration: "4 weeks",
    difficulty: "Intermediate",
    audience: "Students with interest in embedded systems and controls",
    format: "Labs · build sessions · mentorship · capstone demo",
    outcomes: [
      "Program microcontrollers for locomotion",
      "Integrate sensors and actuators",
      "Build autonomous navigation behaviors",
      "Present a robotics capstone demo",
    ],
    tags: ["Robotics", "Embedded", "Controls"],
  },
  robotics: {
    title: "Robotics",
    summary: "Program locomotion, sensors, and autonomous behaviors for a robotics capstone demo.",
    overview:
      "Robotics introduces students to embedded robotics: microcontroller programming, sensor and actuator integration, and autonomous navigation behaviors.\n\n" +
      "Campers build toward a capstone demonstration under faculty mentorship.",
    duration: "4 weeks",
    difficulty: "Intermediate",
    audience: "Students with interest in embedded systems and controls",
    format: "Labs · build sessions · mentorship · capstone demo",
    outcomes: [
      "Program microcontrollers for locomotion",
      "Integrate sensors and actuators",
      "Build autonomous navigation behaviors",
      "Present a robotics capstone demo",
    ],
    tags: ["Robotics", "Embedded", "Controls"],
    comingSoon: true,
  },
  cybersecurity: {
    title: "Cybersecurity",
    summary: "Network analysis, secure coding, and a penetration-testing lab with an audit report.",
    overview:
      "Cybersecurity trains students to analyze network traffic, identify vulnerabilities, practice secure coding fundamentals, and complete a penetration-testing lab.\n\n" +
      "The track emphasizes responsible disclosure and clear documentation through a security audit report.",
    duration: "3 weeks",
    difficulty: "Intermediate",
    audience: "Students exploring security, networking, and Linux tooling",
    format: "Labs · threat analysis · audit report",
    outcomes: [
      "Analyze network traffic and vulnerabilities",
      "Practice secure coding fundamentals",
      "Complete a penetration-testing lab",
      "Document a security audit report",
    ],
    tags: ["Security", "Networking", "Linux"],
    comingSoon: true,
  },
  "drone-systems": {
    title: "Drone Systems",
    summary: "Configure flight controllers, vision payloads, and safe autonomous missions.",
    overview:
      "Drone Systems covers flight controllers, telemetry, vision payloads, and safe autonomous mission planning.\n\n" +
      "Students culminate in a field demonstration that shows reliable configuration and operational awareness.",
    duration: "3 weeks",
    difficulty: "Advanced",
    audience: "Students ready for UAV systems and field operations",
    format: "Hardware labs · mission planning · field demo",
    outcomes: [
      "Configure flight controllers and telemetry",
      "Integrate vision payloads",
      "Plan safe autonomous missions",
      "Deliver a field demonstration",
    ],
    tags: ["Drones", "UAV", "Embedded"],
    comingSoon: true,
  },
  "embedded-systems": {
    title: "Embedded Systems",
    summary: "GPIO prototyping, datasheets, firmware debugging, and a working embedded prototype.",
    overview:
      "Embedded Systems builds foundational skills with GPIO and peripherals, datasheet reading, wiring, and serial debugging.\n\n" +
      "Students ship a working embedded prototype with faculty feedback through checkpoints and discussion.",
    duration: "4 weeks",
    difficulty: "Beginner",
    audience: "Beginners in hardware and C/C++ firmware",
    format: "Hardware labs · firmware practice · prototype delivery",
    outcomes: [
      "Prototype with GPIO and peripherals",
      "Read datasheets and wire hardware",
      "Debug firmware with serial tools",
      "Ship a working embedded prototype",
    ],
    tags: ["Embedded", "C/C++", "Hardware"],
    comingSoon: true,
  },
  "xr-attention-analytics": {
    title: "XR, Eye Tracking, and AI Research Training",
    summary:
      "Research training on XR, eye tracking, Unity, and AI-assisted analysis of attention in VR learning.",
    overview:
      "XR, Eye Tracking, and AI Research Training is an advanced research track on AI-assisted analysis of student attention in virtual reality learning environments.\n\n" +
      "Participants work with the HTC Vive Pro Eye, build educational VR experiences in Unity with Tobii integration, analyze multimodal gaze data in Python, and train attention prediction models. " +
      "The program emphasizes research design, user studies, and scholarly deliverables: poster, report, and paper draft.\n\n" +
      "Faculty use this workspace to mentor research projects, review submissions, and coordinate training faculty.",
    duration: "6–10 weeks",
    difficulty: "Advanced",
    audience: "Undergraduate and early graduate researchers in XR / HCI / AI",
    format: "Research modules · Unity labs · data analysis · poster & paper",
    outcomes: [
      "Configure HTC Vive Pro Eye and collect multimodal gaze data",
      "Build educational VR experiences in Unity with Tobii integration",
      "Analyze eye-tracking data and train attention prediction models",
      "Design user studies and produce research poster, report, and paper draft",
    ],
    tags: ["XR", "VR", "Eye Tracking", "Unity", "AI", "HCI"],
  },
  "ai-bootcamp": {
    title: "Foundational AI Workshop",
    summary:
      "Two-day hands-on workshop with High School and Freshman pathways — AI tools, prompting, creativity, and responsible use.",
    overview:
      "Foundational AI Workshop is a two-day hands-on workshop designed for learners with no prior AI experience. Campers choose a High School or Freshman pathway, then progress through shared modules on AI foundations, tools, prompt engineering, ethics, image generation, creator workflows, academic success, and career readiness.\n\n" +
      "Interactive lessons, knowledge checks, and reflections unlock the next stage of the journey. After the core curriculum, students tackle optional innovation capstone projects and a graduation showcase with certificates.\n\n" +
      "This Overview summarizes track scope, learning outcomes, live stats, and the faculty team supporting the workshop.",
    duration: "2 days",
    difficulty: "Beginner",
    audience: "High school (grades 9–12) and incoming / early college freshmen",
    format: "Interactive modules · knowledge checks · capstone projects · graduation showcase",
    outcomes: [
      "Explain what AI can and cannot do, and use tools responsibly",
      "Write effective prompts and verify AI-generated information",
      "Create with AI for images, presentations, and academic workflows",
      "Complete an innovation project and graduate with a certificate",
    ],
    tags: ["AI", "Prompting", "Ethics", "Creativity", "College Ready"],
  },
}

export function getTrainingMeta(slug: string): TrainingCatalogMeta {
  return (
    TRAINING_CATALOG[slug] ?? {
      title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      summary: "Summer Camp engineering training track.",
      overview:
        "This training is part of the Prairie View A&M University Summer Camp portfolio. " +
        "Use the Modules, Projects, and Discussions tabs to manage content and camper progress. " +
        "Detailed catalog metadata will appear here once this track is fully configured.",
      duration: "TBD",
      difficulty: "Intermediate",
      audience: "Summer Camp participants",
      format: "Modules · projects · mentorship",
      outcomes: ["Hands-on engineering skills", "Faculty mentorship", "Capstone project"],
      tags: ["Summer Camp"],
    }
  )
}
