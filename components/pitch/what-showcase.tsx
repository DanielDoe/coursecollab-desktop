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

const CAPS: ImmersiveItem[] = [
  {
    id: "teach",
    title: "Teach & Learn",
    line: "Lectures · Notes · Flashcards · AI Notetaker",
    detail:
      "Course materials live in the same environment students use to study. Faculty publish lectures; AI Notetaker turns them into summaries, definitions, and review guides.",
    points: [
      "Lectures and course notes in one workspace",
      "Flashcards generated from lecture content",
      "AI Notetaker summaries and study guides",
      "Cora available on the same page",
    ],
    icon: BookOpen,
    web: web("web-ai-notetaker.png", "AI Notetaker lecture study guide"),
    phone: phone("notetaker-home.png", "AI Notetaker on mobile"),
  },
  {
    id: "practice",
    title: "Practice & Build",
    line: "Practice Hub · CodeBench · Playground · Projects",
    detail:
      "Students do not leave the course to practice. Practice Hub, CodeBench, and live playground sessions sit next to lectures so application happens in context.",
    points: [
      "Targeted practice from the question bank",
      "CodeBench IDE with Cora walkthroughs",
      "Live playground sessions",
      "Projects and applied coursework",
    ],
    icon: Code2,
    web: web("web-codebench-python.png", "CodeBench IDE with a Python walkthrough"),
    phone: phone("codebench-editor.png", "CodeBench on mobile"),
  },
  {
    id: "assess",
    title: "Assess",
    line: "Quizzes · Homework · Exams · Finals",
    detail:
      "Quizzes, homework, and examinations run inside the same course workspace — with instant grading, section breakdowns, and results that feed Cora and progress reviews.",
    points: [
      "Auto-graded quizzes and homework",
      "Mid-semester and final exams",
      "Question-level feedback",
      "Results that inform the next practice session",
    ],
    icon: ClipboardList,
    web: web("web-quizzes.png", "Quiz results with a section breakdown"),
    phone: phone("quiz-review.png", "Quiz review on mobile"),
  },
  {
    id: "hub",
    title: "Practice Hub",
    line: "Topics · Sessions · Leaderboard",
    detail:
      "Practice Hub shows topic progress, accuracy, and recent sessions so students can see where they are strong and where they need another attempt.",
    points: [
      "Topic-level progress and accuracy",
      "Recent practice sessions",
      "Streaks and leaderboard",
      "Direct path back into another attempt",
    ],
    icon: Sparkles,
    web: web("web-practice-hub.png", "Practice Hub with topic progress"),
    phone: phone("practice-hub.png", "Practice Hub on mobile"),
  },
  {
    id: "understand",
    title: "Understand",
    line: "Progress · Analytics · Reviews",
    detail:
      "Progress reviews turn grades and practice into a narrative: strengths, focus areas, and category scores faculty and students can act on.",
    points: [
      "AI progress reviews",
      "Category scores and focus areas",
      "Attendance and engagement signals",
      "Early indicators for student support",
    ],
    icon: LineChart,
    web: web("web-progress-review.png", "Progress review with category scores"),
    phone: phone("progress-review.png", "Progress review on mobile"),
  },
  {
    id: "ai",
    title: "AI Assistance",
    line: "Cora Assistant · Cora Copilot · Support",
    detail:
      "Cora is embedded in the academic environment. It can use course context to help students learn and faculty teach — not a generic chatbot at the edge of the LMS.",
    points: [
      "Course-aware student assistance",
      "Faculty copilot for content and communication",
      "Confirmation before actions save",
      "Works across CourseCollab tools",
    ],
    icon: Bot,
    web: web("web-cora-assistant.png", "Cora Assistant creating a flashcard deck"),
    phone: phone("assistant-home.png", "Cora Assistant on mobile"),
  },
]

export function WhatShowcase() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <SlideShell>
      {!active ? (
        <>
          <Eyebrow>The platform</Eyebrow>
          <SlideTitle>What Is CourseCollab?</SlideTitle>
          <Subhead>
            A unified environment built around the complete teaching and learning cycle. Select a
            capability — the rest recede so you can sit with the product.
          </Subhead>
        </>
      ) : null}
      <div className={active ? "flex min-h-0 flex-1 flex-col" : "mt-4 flex min-h-0 flex-1 flex-col"}>
        <ImmersiveShowcase
          items={CAPS}
          active={active}
          onChange={setActive}
          backLabel="All capabilities"
          thesis="Select a capability. Instead of adding AI to the edge of an LMS, CourseCollab integrates AI throughout the learning environment."
        />
      </div>
    </SlideShell>
  )
}
