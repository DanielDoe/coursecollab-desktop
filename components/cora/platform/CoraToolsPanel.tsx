"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Search, Sparkles, Star, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AIToolsSlidePanel } from "@/components/ai-tutor/AIToolsSlidePanel"
import { useCoraOptional } from "@/components/cora/CoraProvider"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"
import {
  deriveStudioRecommendations,
  featuredTools,
  loadStudioIdList,
  newAiFeatures,
  popularThisWeek,
  resolveStudioDrawerToolId,
  saveStudioIdList,
  searchStudioTools,
  STUDIO_FAVORITES_KEY,
  STUDIO_GENERATED_KEY,
  STUDIO_PROMPT_CHIPS,
  STUDIO_RECENT_KEY,
  STUDIO_TEMPLATES,
  STUDIO_TOOL_ICONS,
  STUDIO_WORKFLOWS,
  STUDIO_WORKSPACES,
  toolsByWorkspace,
  type StudioLaunch,
  type StudioTool,
  type StudioWorkspaceId,
} from "@/lib/cora/studio-workspace"
import { isStudioToolChat } from "@/lib/cora/studio-tool-chat"

type Props = {
  studentId: string
  studentDatabaseId?: number | null
  studentFirstName?: string
  studentContext?: CoraStudentContextPayload | null
  initialToolId?: string | null
  onNavigate?: (tab: CoraPlatformTab) => void
}

export function CoraToolsPanel({
  studentId,
  studentDatabaseId,
  studentFirstName,
  studentContext = null,
  initialToolId = null,
  onNavigate,
}: Props) {
  const { cta, soft, mid, accent, tone } = useCoraContentPalette()
  const cora = useCoraOptional()
  const [query, setQuery] = useState("")
  const [workspace, setWorkspace] = useState<StudioWorkspaceId>("learn")
  const [selectedTool, setSelectedTool] = useState<string | null>(initialToolId)
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [generated, setGenerated] = useState<string[]>([])

  useEffect(() => {
    setFavorites(loadStudioIdList(STUDIO_FAVORITES_KEY))
    setRecent(loadStudioIdList(STUDIO_RECENT_KEY))
    setGenerated(
      loadStudioIdList(STUDIO_GENERATED_KEY).length
        ? loadStudioIdList(STUDIO_GENERATED_KEY)
        : ["Lecture 5 Summary", "Flashcards", "Practice Quiz", "Formula Sheet", "Study Plan"],
    )
  }, [])

  useEffect(() => {
    if (initialToolId) setSelectedTool(initialToolId)
  }, [initialToolId])

  const recs = useMemo(() => deriveStudioRecommendations(studentContext), [studentContext])
  const featured = useMemo(() => featuredTools(), [])
  const workspaceTools = useMemo(() => {
    if (query.trim()) return searchStudioTools(query)
    return toolsByWorkspace(workspace)
  }, [query, workspace])
  const popular = useMemo(() => popularThisWeek(), [])
  const newest = useMemo(() => newAiFeatures(), [])

  const resolveTool = (id: string) => searchStudioTools("").find((t) => t.id === id)

  const openDrawerTool = (toolId: string) => {
    setRecent((prev) => {
      const next = [toolId, ...prev.filter((x) => x !== toolId)].slice(0, 8)
      saveStudioIdList(STUDIO_RECENT_KEY, next)
      return next
    })
    setSelectedTool(toolId)
  }

  const runLaunch = (launch: StudioLaunch, toolId?: string) => {
    const drawerId = resolveStudioDrawerToolId(launch) ?? toolId ?? null
    if (drawerId && isStudioToolChat(drawerId)) {
      openDrawerTool(drawerId)
      return
    }

    if (toolId) {
      setRecent((prev) => {
        const next = [toolId, ...prev.filter((x) => x !== toolId)].slice(0, 8)
        saveStudioIdList(STUDIO_RECENT_KEY, next)
        return next
      })
    }

    if (launch.kind === "tool") {
      // Unknown tool id — still try drawer if registered, else ignore modal fallback
      if (isStudioToolChat(launch.toolId)) {
        openDrawerTool(launch.toolId)
        return
      }
      setSelectedTool(launch.toolId)
      return
    }
    if (launch.kind === "tab") {
      onNavigate?.(launch.tab)
      return
    }
    if (launch.kind === "href") {
      window.location.href = launch.href
      return
    }
    if (launch.kind === "prompt") {
      setGenerated((prev) => {
        const next = [launch.title, ...prev.filter((x) => x !== launch.title)].slice(0, 8)
        saveStudioIdList(STUDIO_GENERATED_KEY, next)
        return next
      })
      // Prefer Study Notes / matching drawer over Cora modal whenever possible
      const mapped = resolveStudioDrawerToolId(launch)
      if (mapped && isStudioToolChat(mapped)) {
        openDrawerTool(mapped)
        return
      }
      if (cora) {
        cora.openCora(
          coraContextFromQuestion({
            source: "custom",
            domain: "generic",
            title: `Studio · ${launch.title}`,
            questionText: launch.prompt,
            studentDatabaseId: studentDatabaseId ?? (studentId ? Number(studentId) : null),
          }),
        )
        return
      }
      onNavigate?.("workspace")
    }
  }

  const openTool = (tool: StudioTool) => {
    const drawerId = resolveStudioDrawerToolId(tool.launch) ?? tool.id
    if (isStudioToolChat(drawerId) || tool.launch.kind === "tool") {
      runLaunch(tool.launch, tool.id)
      return
    }
    runLaunch(tool.launch, tool.id)
  }

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 12)
      saveStudioIdList(STUDIO_FAVORITES_KEY, next)
      return next
    })
  }

  return (
    <div className="relative space-y-6 pb-8">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage: `radial-gradient(ellipse at 0% 0%, ${soft}40, transparent 55%), radial-gradient(ellipse at 100% 0%, ${mid}28, transparent 50%), radial-gradient(ellipse at 50% 100%, ${accent}16, transparent 45%)`,
          }}
        />
        <div className="relative space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cc-text-muted)]">
              Cora Studio
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
              Create, analyze, generate & automate
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--cc-text-secondary)]">
              Everything Cora can create, analyze, generate, and automate — in one AI workspace.
            </p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like Cora to help you create today?"
              className="h-12 rounded-2xl border-[var(--border)] bg-[var(--background)]/60 pl-10 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STUDIO_PROMPT_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() =>
                  runLaunch(
                    chip.launch,
                    chip.launch.kind === "tool" ? chip.launch.toolId : undefined,
                  )
                }
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-text-secondary)] transition-colors hover:border-[var(--cc-accent)]/40 hover:text-[var(--cc-text)]"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Featured */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">Featured tools</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((tool, i) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              favorited={favorites.includes(tool.id)}
              onOpen={() => openTool(tool)}
              onFavorite={() => toggleFavorite(tool.id)}
              accent={tone(i).fill}
              onFill={tone(i).icon}
            />
          ))}
        </div>
      </section>

      {/* Workspaces */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Workspaces</h3>
          {query.trim() ? (
            <p className="text-xs text-[var(--cc-text-muted)]">{workspaceTools.length} results</p>
          ) : null}
        </div>
        {!query.trim() ? (
          <div className="flex flex-wrap gap-2">
            {STUDIO_WORKSPACES.map((w, i) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkspace(w.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  workspace === w.id
                    ? "text-white"
                    : "border border-[var(--border)] text-[var(--cc-text-secondary)] hover:border-[var(--cc-accent)]/40",
                )}
                style={
                  workspace === w.id
                    ? { backgroundColor: tone(i).fill, color: tone(i).icon }
                    : undefined
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaceTools.map((tool, i) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              favorited={favorites.includes(tool.id)}
              onOpen={() => openTool(tool)}
              onFavorite={() => toggleFavorite(tool.id)}
              accent={tone(i + 2).fill}
              onFill={tone(i + 2).icon}
            />
          ))}
          {workspaceTools.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--cc-text-muted)]">
              No tools match that search. Try “flashcards”, “formula”, or “quiz”.
            </p>
          ) : null}
        </div>
      </section>

      {/* Workflows */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-[var(--cc-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">AI workflows</h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {STUDIO_WORKFLOWS.map((wf) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => runLaunch(wf.launch)}
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 text-left transition-all hover:border-[var(--cc-accent)]/35 hover:shadow-sm"
            >
              <p className="text-base font-semibold text-[var(--cc-text)]">{wf.title}</p>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{wf.description}</p>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--cc-text-secondary)]">
                {wf.steps.join(" → ")}
              </p>
              <span className="mt-3 inline-block text-xs font-semibold text-[var(--cc-accent)]">Launch workflow →</span>
            </button>
          ))}
        </div>
      </section>

      {/* Recommended */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--cc-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--cc-text)]">Recommended for you</h3>
        </div>
        <p className="mb-4 text-sm text-[var(--cc-text-secondary)]">
          You struggled with <span className="font-semibold text-[var(--cc-text)]">{recs.topic}</span>. Start here:
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {recs.actions.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => openTool(tool)}
              className="min-w-[200px] shrink-0 rounded-2xl border border-[var(--border)] px-4 py-3 text-left hover:border-[var(--cc-accent)]/40"
            >
              <p className="text-sm font-semibold text-[var(--cc-text)]">{tool.title}</p>
              <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">{tool.eta}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Recent / Favorites / Generated */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Rail
          title="Continue where you left off"
          empty="Open a tool to build your recent list."
          items={recent
            .map((id) => resolveTool(id))
            .filter((t): t is StudioTool => Boolean(t))
            .map((t) => ({ id: t.id, label: t.title, onClick: () => openTool(t) }))}
        />
        <Rail
          title="My favorites"
          empty="Star tools to pin them here."
          items={favorites
            .map((id) => resolveTool(id))
            .filter((t): t is StudioTool => Boolean(t))
            .map((t) => ({ id: t.id, label: `⭐ ${t.title}`, onClick: () => openTool(t) }))}
        />
        <Rail
          title="Recently generated"
          empty="Generated artifacts appear here."
          items={generated.map((label, i) => ({
            id: `g-${i}`,
            label,
            onClick: () =>
              runLaunch({
                kind: "prompt",
                title: label,
                prompt: `Continue working on: ${label}`,
              }),
          }))}
        />
      </div>

      {/* Templates */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">Templates</h3>
        <div className="flex flex-wrap gap-2">
          {STUDIO_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                runLaunch({
                  kind: "prompt",
                  title: t,
                  prompt: `Start the "${t}" learning workflow using my CourseCollab profile.`,
                })
              }
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--cc-text-secondary)] hover:border-[var(--cc-accent)]/40"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Explore more */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">Explore more</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Popular this week
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {popular.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => openTool(tool)}
                  className="min-w-[160px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left text-sm font-medium text-[var(--cc-text)]"
                >
                  {tool.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              New AI features
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {newest.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => openTool(tool)}
                  className="min-w-[160px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left text-sm font-medium text-[var(--cc-text)]"
                >
                  {tool.title}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--cc-text-muted)]">Coming soon · Python live viz · Collaborative workflows · Saved custom pipelines</p>
      </section>

      {/* Quick actions strip */}
      <div className="flex flex-wrap gap-2">
        {STUDIO_PROMPT_CHIPS.slice(0, 6).map((chip) => (
          <Button
            key={`qa-${chip.id}`}
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() =>
              runLaunch(
                chip.launch,
                chip.launch.kind === "tool" ? chip.launch.toolId : undefined,
              )
            }
          >
            {chip.label}
          </Button>
        ))}
        <Button
          size="sm"
          className="rounded-full"
          style={{ background: cta.fill, color: cta.icon }}
          onClick={() => onNavigate?.("workspace")}
        >
          Ask Cora
        </Button>
      </div>

      <AnimatePresence>
        {selectedTool ? (
          <motion.div key={selectedTool} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AIToolsSlidePanel
              toolId={selectedTool}
              onClose={() => setSelectedTool(null)}
              studentId={studentId}
              studentDatabaseId={studentDatabaseId}
              studentFirstName={studentFirstName}
              studentContext={studentContext}
              onNavigate={onNavigate}
              autoStart
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function ToolCard({
  tool,
  favorited,
  onOpen,
  onFavorite,
  accent,
  onFill = "#FFFFFF",
}: {
  tool: StudioTool
  favorited: boolean
  onOpen: () => void
  onFavorite: () => void
  accent: string
  onFill?: string
}) {
  const Icon = STUDIO_TOOL_ICONS[tool.id] || Sparkles
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 transition-all hover:border-[var(--cc-accent)]/35 hover:shadow-sm">
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          backgroundImage: `radial-gradient(ellipse at 0% 0%, ${accent}18, transparent 55%)`,
        }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: accent, color: onFill }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <button
          type="button"
          aria-label={favorited ? "Remove favorite" : "Add favorite"}
          onClick={onFavorite}
          className="rounded-full p-1.5 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]"
        >
          <Star className={cn("h-4 w-4", favorited && "fill-amber-400 text-amber-400")} />
        </button>
      </div>
      <h4 className="relative mt-4 text-base font-semibold text-[var(--cc-text)]">{tool.title}</h4>
      <p className="relative mt-1.5 text-xs leading-relaxed text-[var(--cc-text-muted)]">{tool.description}</p>
      <div className="relative mt-4 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--cc-text-muted)]">
          {"★".repeat(Math.min(5, Math.round(tool.popularity / 20)))}
          <span className="ml-2">{tool.eta}</span>
        </span>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onOpen}>
          Open →
        </Button>
      </div>
    </div>
  )
}

function Rail({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: Array<{ id: string; label: string; onClick: () => void }>
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="mb-3 text-sm font-semibold text-[var(--cc-text)]">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--cc-text-muted)]">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={item.onClick}
                className="w-full rounded-2xl border border-[var(--border)] px-3 py-2 text-left text-sm text-[var(--cc-text)] hover:border-[var(--cc-accent)]/40"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
