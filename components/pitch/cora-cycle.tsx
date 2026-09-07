"use client"

import { useState } from "react"
import { Bot, Sparkles } from "lucide-react"
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

const SIDES: ImmersiveItem[] = [
  {
    id: "students",
    title: "For students",
    line: "Cora Assistant · Course-aware help",
    detail:
      "Cora is not a generic chatbot pasted onto the LMS. It can use the student’s course — lectures, practice, and progress — to explain, work problems, and build study materials.",
    points: [
      "Understand concepts in the current unit",
      "Work through problems and debug code",
      "Practice the areas that are actually weak",
      "Create study materials and review progress",
    ],
    icon: Sparkles,
    web: web("web-cora-assistant.png", "Cora Assistant building study materials"),
    phone: phone("assistant-plan.png", "Cora building a study plan on mobile"),
  },
  {
    id: "faculty",
    title: "For faculty",
    line: "Cora Copilot · Teaching workspace",
    detail:
      "Cora Copilot drafts content, assessments, and communication inside the course. Faculty review and confirm. Nothing is published until the instructor says so.",
    points: [
      "Develop instructional content",
      "Create assessments and practice",
      "Support student communication",
      "Understand progress and reduce repetitive work",
    ],
    icon: Bot,
    web: web("web-cora-copilot.png", "Cora Copilot drafting faculty communication"),
    phone: phone("copilot-announcement.png", "Cora Copilot on mobile"),
  },
]

export function CoraCycle() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <SlideShell>
      {!active ? (
        <>
          <Eyebrow>The intelligence layer</Eyebrow>
          <SlideTitle>Cora is more than a chatbot.</SlideTitle>
          <Subhead>
            It is an AI assistant embedded within the academic environment. Select a side to go
            deeper.
          </Subhead>
        </>
      ) : null}
      <div className={active ? "flex min-h-0 flex-1 flex-col" : "mt-4 flex min-h-0 flex-1 flex-col"}>
        <ImmersiveShowcase
          items={SIDES}
          active={active}
          onChange={setActive}
          columns={2}
          backLabel="Both sides"
          thesis="General AI knows the student’s question. Cora can understand the student’s learning context."
        />
      </div>
    </SlideShell>
  )
}
