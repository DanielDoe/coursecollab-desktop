import type { ProjectResponseField, ProjectTemplateSection } from "@/lib/projects/project-template-types"
import { DEFAULT_SECTION_CONFIG } from "@/lib/projects/project-template-types"
import type { ProjectRubric } from "@/lib/projects/project-grading-types"

type SectionDraft = {
  title: string
  points: number
  instructions: string
  focus: string
  fields: ProjectResponseField[]
}

const SECTIONS: SectionDraft[] = [
  {
    title: "Cover Page",
    points: 1,
    instructions:
      "Provide a cover page that includes the project title, course number and name (ELEG 4325 – Computer Interfacing and Communications), semester, instructor name, and the full names of all group members. Clearly identify the group.",
    focus: "Completeness and clarity of the project title, course information, semester, and group-member names.",
    fields: [
      { id: "cover-title", label: "Project title", kind: "short_text", required: true },
      { id: "cover-course", label: "Course number and name", kind: "short_text", required: true },
      { id: "cover-term", label: "Semester", kind: "short_text", required: true },
      { id: "cover-instructor", label: "Instructor name", kind: "short_text", required: true },
      { id: "cover-members", label: "Group member full names", kind: "roster", required: true, track_typing: false },
    ],
  },
  {
    title: "Real-Life Problem and Project Need",
    points: 2,
    instructions:
      "Describe the real-life problem your project is intended to address. Identify the intended users or stakeholders, explain why the problem matters, and state the specific need or requirements your system is designed to satisfy. Describe the project's objectives and the expected benefits. Where relevant, identify design constraints such as cost, size, power consumption, reliability, safety, accessibility, or operating environment.",
    focus:
      "A clearly defined real-world problem; identifiable users or stakeholders; specific needs, objectives, and requirements; and a convincing explanation of the problem's significance.",
    fields: [
      { id: "need-problem", label: "Problem, users, and why it matters", kind: "long_text", required: true },
      { id: "need-requirements", label: "Objectives, requirements, and constraints", kind: "long_text", required: true },
    ],
  },
  {
    title: "ARM Microcontroller Background and Selection",
    points: 2,
    instructions:
      "Introduce the ARM microcontroller used in your project. Identify its manufacturer and specific model or development board. Explain relevant architectural features and capabilities, such as processor core, clock speed, memory, GPIO, timers, communication interfaces, analog/digital peripherals, and power features, as applicable. Explain why this microcontroller is appropriate for the application. Briefly discuss alternative platforms or design approaches considered and explain the basis for your selection. Support technical statements with appropriate references.",
    focus:
      "Accurate and relevant technical background; identification of the actual ARM device; connection between device capabilities and project requirements; and reasonable justification of the selection.",
    fields: [
      { id: "mcu-background", label: "Device, architecture, and why it was selected", kind: "long_text", required: true },
      { id: "mcu-source", label: "Datasheet or reference link", kind: "link", required: true },
    ],
  },
  {
    title: "System Design and Implementation",
    points: 3,
    instructions:
      "Explain how the embedded system is designed and implemented. Identify the hardware components, sensors, actuators, power supply, communication modules, and other major components used, as applicable. Describe the software structure, major functions, inputs, outputs, and control logic. Include a clearly labeled system block diagram and a flowchart showing the system's operation or program logic. Explain how the hardware and software work together. Identify important design decisions and component-selection reasons. Distinguish implemented features from planned or proposed features.",
    focus:
      "Completeness and technical clarity of the design; explanation of hardware/software integration; appropriate component choices; and inclusion and explanation of a system block diagram and operational flowchart.",
    fields: [
      { id: "design-narrative", label: "Design and implementation narrative", kind: "long_text", required: true },
      { id: "design-block", label: "System block diagram", kind: "image", required: true },
      { id: "design-flow", label: "Operational flowchart", kind: "image", required: true },
    ],
  },
  {
    title: "Results, Testing, and Analysis",
    points: 3,
    instructions:
      "Describe the prototype or model that was built and the tests that were performed. State the test setup, procedures, input conditions, and expected outcomes. Present actual results using relevant tables, graphs, figures, measurements, screenshots, or observations. Analyze what the results show and explain whether the system met the requirements stated in Section 2. Discuss unexpected results, errors, limitations, and possible sources of measurement uncertainty. If a working prototype or test results are not available, clearly report the current status and provide evidence of completed work; do not invent results.",
    focus:
      "Meaningful testing or clearly documented project status; relevant evidence and presentation of results; interpretation of results; and a reasoned assessment of whether project requirements were met.",
    fields: [
      { id: "results-narrative", label: "Tests, results, and analysis", kind: "long_text", required: true },
      { id: "results-figure", label: "Result figure, graph, or screenshot", kind: "image", required: false },
      { id: "results-file", label: "Raw data or extra evidence", kind: "file", required: false },
    ],
  },
  {
    title: "Impact on the Microcontroller/Microprocessor Industry",
    points: 3,
    instructions:
      "Discuss how the application addressed by your project relates to or may influence the microcontroller or microprocessor industry. Explain relevant industry trends, needs, or technology developments. Consider how the application could affect hardware capabilities, processor selection, embedded software, connectivity, power efficiency, security, cost, manufacturing, or future product development, as relevant. Support the discussion with specific examples or credible sources, and explain the connection between those examples and your project.",
    focus:
      "Relevant understanding of the industry; specific and technically reasonable discussion of potential influence; clear connection to the project application; and supporting examples or sources.",
    fields: [
      { id: "industry-discussion", label: "Industry impact discussion", kind: "long_text", required: true },
      { id: "industry-source", label: "Supporting source", kind: "link", required: true },
    ],
  },
  {
    title: "Conclusion",
    points: 2,
    instructions:
      "Summarize the project purpose, the proposed or implemented ARM-based solution, the major design features, and the most important results or current accomplishments. State whether the project objectives were met and identify the main limitations. Briefly describe realistic improvements or future work. The conclusion should synthesize the project rather than introduce substantial new technical information.",
    focus:
      "Concise and accurate summary; clear statement of accomplishments and outcomes; acknowledgment of limitations; and relevant future improvements.",
    fields: [{ id: "conclusion-body", label: "Conclusion", kind: "long_text", required: true }],
  },
  {
    title: "References",
    points: 1,
    instructions:
      "List the sources cited in the report. Include appropriate references for the ARM microcontroller or development board, component datasheets, technical documentation, software libraries, research papers, standards, and other information used. Use one consistent citation style. Ensure that sources cited in the report appear in this list and that listed references are actually used in the report.",
    focus:
      "Presence, relevance, and consistency of references; sufficient source information to identify the sources; and correspondence between in-text citations and the reference list.",
    fields: [{ id: "references-list", label: "Reference list", kind: "long_text", required: true }],
  },
  {
    title: "Presentation, Visual Aids, and Demonstration",
    points: 3,
    instructions:
      "Prepare a class presentation and system demonstration for Week 14. The presentation and demonstration must take no more than 10 minutes in total, including time for questions. In this report section, provide the presentation outline or slide-by-slide summary, identify the visual aids used (such as diagrams, flowcharts, photographs, tables, graphs, or screenshots), and describe what the demonstration will show or what it showed. Explain how the presentation communicates the problem, design, implementation, and results to the audience. Include links or embedded evidence when permitted by the instructor.",
    focus:
      "Logical and complete presentation structure; relevance and readability of visual aids; clear communication of the project; and a specific description or evidence of the system demonstration. The instructor may separately verify the live presentation, timing, and demonstration.",
    fields: [
      { id: "talk-outline", label: "Slide-by-slide outline", kind: "long_text", required: true },
      { id: "talk-slides", label: "Slides or visual aids", kind: "file", required: false },
      { id: "talk-demo", label: "What the demonstration shows", kind: "long_text", required: true },
    ],
  },
]

export const ELEG4325_FINAL_PROJECT_TITLE = "ELEG 4325 Final Project — ARM Embedded System"

export const ELEG4325_FINAL_PROJECT_DESCRIPTION =
  "Students work alone or in a group of up to three to design an embedded system on an ARM microcontroller for a real-life need, with both hardware and software. One written report of at least three pages, excluding the cover, in 12-point font and single spacing. Due Monday of Week 14. Presentation and demonstration are 10 minutes, including questions."

export const ELEG4325_FINAL_PROJECT_INSTRUCTIONS =
  "Write each of the nine sections under its own heading. Do not combine sections. Describe work you actually completed. If a prototype or test is incomplete, say what is done and what is not; do not present planned work as completed work."

export function eleg4325FinalProjectSections(): ProjectTemplateSection[] {
  return SECTIONS.map((s, i) => ({
    section_key: `eleg4325-s${i + 1}`,
    sort_order: i,
    title: `Section ${i + 1}. ${s.title} (${s.points} ${s.points === 1 ? "point" : "points"})`,
    instructions: s.instructions,
    config: {
      ...DEFAULT_SECTION_CONFIG(),
      points: s.points,
      required: true,
      expected_content: s.focus,
      rubric_criterion_ids: [`eleg4325-s${i + 1}`],
      response_fields: s.fields.map((field) => ({
        ...field,
        track_typing: field.kind === "long_text" && !field.id.startsWith("cover-"),
      })),
    },
  }))
}

export function eleg4325FinalProjectRubric(): ProjectRubric {
  const total = SECTIONS.reduce((n, s) => n + s.points, 0)
  return {
    type: "analytic",
    overall_comment_enabled: true,
    criteria: SECTIONS.map((s, i) => ({
      id: `eleg4325-s${i + 1}`,
      title: s.title,
      description: `Worth ${s.points} ${s.points === 1 ? "point" : "points"} of ${total}. ${s.focus}`,
      weight_percent: Math.round((s.points / total) * 1000) / 10,
    })),
  }
}
