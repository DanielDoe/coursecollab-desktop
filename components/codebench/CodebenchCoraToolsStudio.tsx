"use client"

import { useMemo, useState } from "react"
import {
  BookOpen,
  Bug,
  ClipboardCheck,
  MessageSquare,
  Search,
  Sparkles,
  Target,
  Wand2,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AIToolsSlidePanel } from "@/components/ai-tutor/AIToolsSlidePanel"
import { CodebenchChallengeCoraDrawer } from "@/components/codebench/CodebenchChallengeCoraDrawer"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { codebenchChromeKpi } from "@/lib/codebench-chrome-theme"
import { isStudioToolChat } from "@/lib/cora/studio-tool-chat"
import { cn } from "@/lib/utils"

export type CodebenchCoraToolDef = {
  id: string
  title: string
  description: string
  eta: string
  icon: LucideIcon
  /** Studio chat drawer id, or "ask-cora" for the Ask Cora panel drawer. */
  drawer: "ask-cora" | string
}

export const CODEBENCH_CORA_TOOLS: CodebenchCoraToolDef[] = [
  {
    id: "ask-cora",
    title: "Ask Cora",
    description: "Chat about your code, attach files, or import a course question.",
    eta: "≈ now",
    icon: MessageSquare,
    drawer: "ask-cora",
  },
  {
    id: "walkthrough",
    title: "Walkthrough",
    description: "Step-by-step explanation of a concept or snippet with Cora.",
    eta: "≈3 min",
    icon: BookOpen,
    drawer: "mini-lesson",
  },
  {
    id: "debug",
    title: "Debug",
    description: "Find bugs, explain root causes, and get a clear fix path.",
    eta: "≈2 min",
    icon: Bug,
    drawer: "smart-debugger",
  },
  {
    id: "improve",
    title: "Improve",
    description: "Code quality review — strengths, issues, and concrete upgrades.",
    eta: "≈2 min",
    icon: Wand2,
    drawer: "code-quality",
  },
  {
    id: "practice",
    title: "Practice",
    description: "Generate a short coding practice set from a topic or your weak spots.",
    eta: "≈1 min",
    icon: Target,
    drawer: "quiz-generator",
  },
  {
    id: "evaluate",
    title: "Evaluate",
    description: "Review a solution against requirements and get scored feedback.",
    eta: "≈2 min",
    icon: ClipboardCheck,
    drawer: "homework-review",
  },
]

type Props = {
  studentId: string | null
  className?: string
}

export function CodebenchCoraToolsStudio({ studentId, className }: Props) {
  const { soft, mid, accent, roles } = useCodebenchChrome()
  const [query, setQuery] = useState("")
  const [askOpen, setAskOpen] = useState(false)
  const [drawerToolId, setDrawerToolId] = useState<string | null>(null)

  const tools = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CODEBENCH_CORA_TOOLS
    return CODEBENCH_CORA_TOOLS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.includes(q),
    )
  }, [query])

  const openTool = (tool: CodebenchCoraToolDef) => {
    if (tool.drawer === "ask-cora") {
      setAskOpen(true)
      return
    }
    if (isStudioToolChat(tool.drawer)) {
      setDrawerToolId(tool.drawer)
    }
  }

  return (
    <div className={cn("space-y-5", className)}>
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage: `radial-gradient(ellipse at 0% 0%, ${soft}90, transparent 55%), radial-gradient(ellipse at 100% 0%, ${mid}40, transparent 50%), radial-gradient(ellipse at 50% 100%, ${accent}18, transparent 45%)`,
          }}
        />
        <div className="relative space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
              CodeBench · Cora Studio
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--cc-text)] sm:text-2xl">
              Debug, improve, practice & evaluate
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-[var(--cc-text-secondary)]">
              Coding tools open in a right-side drawer — same Studio pattern as AI Tutor.
            </p>
          </div>
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search CodeBench Cora tools…"
              className="h-11 rounded-2xl border-[var(--border)] bg-[var(--background)]/70 pl-10 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CODEBENCH_CORA_TOOLS.slice(0, 4).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => openTool(chip)}
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-text-secondary)] transition-colors hover:border-[var(--cc-accent)]/40 hover:text-[var(--cc-text)]"
              >
                {chip.title}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Featured tools</h3>
          {query.trim() ? (
            <p className="text-xs text-[var(--cc-text-muted)]">{tools.length} results</p>
          ) : null}
        </div>
        {tools.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--cc-text-muted)]">
            No tools match that search.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool, index) => {
              const Icon = tool.icon
              const thumb = codebenchChromeKpi(index, roles)
              return (
                <div
                  key={tool.id}
                  className="group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:border-[var(--cc-accent)]/35 hover:shadow-sm"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      backgroundImage: `radial-gradient(ellipse at 0% 0%, ${thumb.fill}22, transparent 55%)`,
                    }}
                  />
                  <div className="relative flex items-start justify-between gap-2">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ background: thumb.fill, color: thumb.icon }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <Sparkles className="h-4 w-4 text-[var(--cc-text-muted)] opacity-60" />
                  </div>
                  <h4 className="relative mt-4 text-base font-semibold text-[var(--cc-text)]">{tool.title}</h4>
                  <p className="relative mt-1.5 text-xs leading-relaxed text-[var(--cc-text-muted)]">
                    {tool.description}
                  </p>
                  <div className="relative mt-4 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--cc-text-muted)]">{tool.eta}</span>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openTool(tool)}>
                      Open →
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <CodebenchChallengeCoraDrawer
        open={askOpen}
        onClose={() => setAskOpen(false)}
        challenge={{
          id: "ask-cora",
          title: "CodeBench chat",
          description: "Ask Cora about your code, a bug, or a concept from class.",
        }}
        studentId={studentId}
        mode="general"
      />

      {drawerToolId && studentId ? (
        <AIToolsSlidePanel
          toolId={drawerToolId}
          onClose={() => setDrawerToolId(null)}
          studentId={studentId}
          autoStart={false}
        />
      ) : null}
    </div>
  )
}
