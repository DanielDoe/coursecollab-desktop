"use client"

import { useState } from "react"
import { Bot, ClipboardList, LineChart, LifeBuoy, Presentation, Send } from "lucide-react"
import { type DeviceShot } from "@/components/landing/device-frames"
import { ImmersiveShowcase, type ImmersiveItem } from "@/components/pitch/immersive-showcase"
import { Eyebrow, SlideShell, SlideTitle, Subhead } from "@/components/pitch/pitch-ui"

const web = (file: string, alt: string): DeviceShot => ({
  src: `/images/landing/web/${file}`,
  alt,
  width: 1600,
  height: 1000,
})
const phone = (file: string, alt: string): DeviceShot => ({
  src: `/images/landing/cora/${file}`,
  alt,
  width: 640,
  height: 1314,
})

const ROLES: ImmersiveItem[] = [
  {
    id: "develop",
    title: "Develop",
    line: "Lectures · Notes · Practice · Question Banks · Assessments",
    detail:
      "Faculty build the course once, in one workspace. Lectures, notes, practice sets, and assessments are authored together so students never meet a disconnected packet of files.",
    points: [
      "Lectures and notes in the same environment",
      "Question banks that feed practice and exams",
      "Assessments written beside the content",
      "Reusable materials across sections",
    ],
    icon: Presentation,
    web: web("web-ai-notetaker.png", "Lecture and notes workspace"),
    phone: phone("notetaker-home.png", "Course materials on mobile"),
  },
  {
    id: "deliver",
    title: "Deliver",
    line: "Announcements · Activities · Projects · Discussions · Resources",
    detail:
      "Delivery is the same workspace. Announcements, activities, and resources go out with Cora Copilot drafting and the instructor confirming — not a side email tool.",
    points: [
      "Announcements from inside the course",
      "Activities, projects, and discussions",
      "Cora Copilot drafts; faculty approve",
      "Resources attached to the unit, not a drive",
    ],
    icon: Send,
    web: web("web-cora-copilot.png", "Cora Copilot drafting an announcement"),
    phone: phone("copilot-announcement.png", "Cora Copilot on mobile"),
  },
  {
    id: "evaluate",
    title: "Evaluate",
    line: "Quizzes · Homework · Exams · Classroom Activities · Results",
    detail:
      "Evaluation stays on the same path students already use. Quizzes, homework, and exams grade in place and return section-level results faculty can act on.",
    points: [
      "Quizzes, homework, and exams in-course",
      "Classroom activities with immediate results",
      "Section and question breakdowns",
      "No export to start the next review",
    ],
    icon: ClipboardList,
    web: web("web-quizzes.png", "Quiz results for a section"),
    phone: phone("quiz-review.png", "Quiz review on mobile"),
  },
  {
    id: "understand",
    title: "Understand",
    line: "Progress · Analytics · Attendance · Engagement · Reviews",
    detail:
      "Faculty see the course as a whole: who is progressing, who has gone quiet, and which topics are stalling the section — early enough to intervene.",
    points: [
      "Progress and category scores",
      "Attendance and engagement signals",
      "AI reviews of student learning",
      "A section-level view, not a gradebook dump",
    ],
    icon: LineChart,
    web: web("web-progress-review.png", "Student analytics and progress"),
    phone: phone("progress-review.png", "Progress review on mobile"),
  },
  {
    id: "support",
    title: "Support",
    line: "Office Hours · Messages · Feedback · Student Support",
    detail:
      "Support is lighter when the context is already in the course. Messages, feedback, and office hours sit next to the student’s work instead of a separate inbox.",
    points: [
      "Messages tied to the student’s course work",
      "Feedback on the attempt, not a detached email",
      "Office hours without a third calendar",
      "Cora can draft; faculty send",
    ],
    icon: LifeBuoy,
    web: web("web-cora-copilot.png", "Faculty support with Cora Copilot"),
    phone: phone("copilot-home.png", "Cora Copilot home"),
  },
  {
    id: "automate",
    title: "Automate with Cora",
    line: "Content · Assessment · Communication · Analysis · Workflows",
    detail:
      "Cora Copilot reduces the effort of using the tools faculty already have — drafting content, assessments, and communication, then waiting for confirmation before anything saves.",
    points: [
      "Draft instructional content",
      "Build practice and assessments",
      "Support student communication",
      "Confirm before any action is saved",
    ],
    icon: Bot,
    web: web("web-cora-copilot.png", "Cora Copilot faculty workspace"),
    phone: phone("copilot-home.png", "Cora Copilot on mobile"),
  },
]

export function FacultyCycle() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <SlideShell>
      {!active ? (
        <>
          <Eyebrow>For faculty</Eyebrow>
          <SlideTitle>The Faculty Experience</SlideTitle>
          <Subhead>
            CourseCollab also functions as an intelligent teaching workspace. Select a role to see
            the product around it.
          </Subhead>
        </>
      ) : null}
      <div className={active ? "flex min-h-0 flex-1 flex-col" : "mt-4 flex min-h-0 flex-1 flex-col"}>
        <ImmersiveShowcase
          items={ROLES}
          active={active}
          onChange={setActive}
          backLabel="All roles"
          thesis="Select a role. The goal is not more tools — it is less effort to use them well."
        />
      </div>
    </SlideShell>
  )
}
