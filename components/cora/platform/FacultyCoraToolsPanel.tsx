"use client"

import Link from "next/link"
import { ExternalLink, Library, Megaphone, Layers, ClipboardList, Presentation } from "lucide-react"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { Button } from "@/components/ui/button"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import {
  setFacultyCoraPending,
} from "@/lib/cora/faculty-cora-pending"

const TOOLS = [
  {
    id: "question-bank",
    label: "Question Bank",
    description: "Draft and publish assessment items. Use Workspace to generate drafts, then review here.",
    href: `${FACULTY_DASHBOARD_BASE}/assessments/quizzes/question-bank`,
    icon: Library,
    seed: () =>
      setFacultyCoraPending({
        kind: "question_bank_drafts",
        drafts: [],
        createdAt: new Date().toISOString(),
      }),
  },
  {
    id: "quizzes",
    label: "Quizzes & Homework",
    description: "Open the assessment editors to assemble quizzes or homework from bank items.",
    href: `${FACULTY_DASHBOARD_BASE}/assessments/quizzes`,
    icon: ClipboardList,
    seed: () =>
      setFacultyCoraPending({
        kind: "quiz_create",
        title: "Cora draft quiz",
        createdAt: new Date().toISOString(),
      }),
  },
  {
    id: "flashcards",
    label: "Flashcards",
    description: "Create or review decks after lectures. Automate post-lecture generation from Automate.",
    href: `${FACULTY_DASHBOARD_BASE}/content/flashcards`,
    icon: Layers,
    seed: () =>
      setFacultyCoraPending({
        kind: "flashcard_topic",
        topicName: "Cora topic",
        createdAt: new Date().toISOString(),
      }),
  },
  {
    id: "announcements",
    label: "Announcements",
    description: "Publish weekly updates drafted with Cora Copilot.",
    href: `${FACULTY_DASHBOARD_BASE}/communication/announcements`,
    icon: Megaphone,
    seed: () =>
      setFacultyCoraPending({
        kind: "announcement_draft",
        title: "Weekly update",
        content: "",
        createdAt: new Date().toISOString(),
      }),
  },
  {
    id: "lectures",
    label: "Lectures",
    description: "Jump to lecture materials for review prompts and coverage checks.",
    href: `${FACULTY_DASHBOARD_BASE}/content/lectures`,
    icon: Presentation,
  },
]

export function FacultyCoraToolsPanel({ onOpenWorkspace }: { onOpenWorkspace: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--cc-text)]">Teaching tools</h2>
          <p className="text-sm text-[var(--cc-text-muted)]">
            Cora drafts in chat; you review and publish in the module editors. Opening a tool seeds a pending Cora handoff.
          </p>
        </div>
        <Button type="button" className="rounded-xl" onClick={onOpenWorkspace}>
          Open workspace
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <CardWrapper key={tool.id} variant="inner" hover={false}>
              <div className="flex h-full flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--muted)]">
                    <Icon className="h-4 w-4 text-[var(--cc-text)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--cc-text)]">{tool.label}</p>
                    <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{tool.description}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button asChild type="button" variant="outline" size="sm" className="rounded-xl">
                    <Link
                      href={tool.href}
                      onClick={() => tool.seed?.()}
                    >
                      Open module
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardWrapper>
          )
        })}
      </div>
    </div>
  )
}
