"use client"

import { useState } from "react"
import { BookOpen, Bot, ClipboardList, Code2, LineChart, Sparkles } from "lucide-react"
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

const STAGES: ImmersiveItem[] = [
  {
    id: "learn",
    title: "Learn",
    line: "01 · Lectures, notes, and course materials",
    detail:
      "Students start inside the course — not a separate note app. Lectures, notes, and AI Notetaker sit together so the first encounter with the material is already structured for review.",
    points: [
      "Lectures and notes in the course workspace",
      "AI Notetaker summaries and definitions",
      "Flashcards from the same lecture",
      "Nothing exported to start studying",
    ],
    icon: BookOpen,
    web: web("web-ai-notetaker.png", "Lecture study guide"),
    phone: phone("notetaker-home.png", "AI Notetaker on mobile"),
  },
  {
    id: "understand",
    title: "Understand",
    line: "02 · Ask Cora for course-aware explanations",
    detail:
      "When a concept is unclear, Cora can use the student’s course context — not a generic prompt — to explain, work an example, and point back to the lecture.",
    points: [
      "Course-aware explanations",
      "Worked examples from the current unit",
      "Follow-up questions without leaving the page",
      "Study plans built from the same material",
    ],
    icon: Bot,
    web: web("web-cora-assistant.png", "Cora Assistant"),
    phone: phone("assistant-home.png", "Cora on iPhone"),
  },
  {
    id: "practice",
    title: "Practice",
    line: "03 · Targeted problems, flashcards, and activities",
    detail:
      "Practice Hub turns the lecture into attempts. Students see topic progress, accuracy, and recent sessions, then take another set instead of scrolling notes again.",
    points: [
      "Topic-level practice from the question bank",
      "Accuracy, streaks, and recent sessions",
      "Flashcards and classroom activities",
      "A clear next attempt, not a new tool",
    ],
    icon: Sparkles,
    web: web("web-practice-hub.png", "Practice Hub"),
    phone: phone("practice-hub.png", "Practice on mobile"),
  },
  {
    id: "apply",
    title: "Apply",
    line: "04 · CodeBench, projects, groups, and labs",
    detail:
      "Application stays in the course. CodeBench, projects, and labs give students a place to write, debug, and ship work with Cora as a walkthrough — not a replacement for the assignment.",
    points: [
      "CodeBench IDE in the course",
      "Cora walkthroughs on the student’s code",
      "Projects and group work",
      "Labs without a separate platform hop",
    ],
    icon: Code2,
    web: web("web-codebench-python.png", "CodeBench IDE"),
    phone: phone("codebench-editor.png", "CodeBench on mobile"),
  },
  {
    id: "assess",
    title: "Assess",
    line: "05 · Quizzes, homework, and examinations",
    detail:
      "Assessment is the same environment — quizzes, homework, and exams with immediate results and section breakdowns that feed the next review.",
    points: [
      "Quizzes, homework, and exams in-course",
      "Instant scores and section breakdowns",
      "Question-level feedback",
      "Results that reopen practice, not a PDF",
    ],
    icon: ClipboardList,
    web: web("web-quizzes.png", "Quiz results"),
    phone: phone("quiz-review.png", "Quiz review on mobile"),
  },
  {
    id: "improve",
    title: "Improve",
    line: "06 · Review progress and close the gaps",
    detail:
      "Progress reviews close the loop. Students see strengths, focus areas, and category scores, then return to the lecture or practice set that addresses the gap.",
    points: [
      "AI progress reviews",
      "Category scores and focus areas",
      "A path back to the weak topic",
      "One cycle: learn, practice, assess, improve",
    ],
    icon: LineChart,
    web: web("web-progress-review.png", "Progress review"),
    phone: phone("progress-review.png", "Progress review on mobile"),
  },
]

export function StudentCycle() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <SlideShell>
      {!active ? (
        <>
          <Eyebrow>For students</Eyebrow>
          <SlideTitle>The Student Experience</SlideTitle>
          <Subhead>
            CourseCollab moves students from simply accessing course materials to actively engaging
            with them. Select a stage to step inside it.
          </Subhead>
        </>
      ) : null}
      <div className={active ? "flex min-h-0 flex-1 flex-col" : "mt-4 flex min-h-0 flex-1 flex-col"}>
        <ImmersiveShowcase
          items={STAGES}
          active={active}
          onChange={setActive}
          backLabel="All stages"
          thesis="Select a stage. One continuous learning cycle within the student’s actual course environment."
        />
      </div>
    </SlideShell>
  )
}
