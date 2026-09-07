"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"
import { BookOpen, Loader2, Sparkles } from "lucide-react"
import { toast } from "@/lib/app-toast"

type ContentTopic = {
  name: string
  question_count: number
  deck_count?: number
  card_count?: number
  note_count?: number
  availability: Record<string, { is_available: boolean; configured: boolean }>
}

type Props = {
  module: "flashcards" | "course_notes"
  session: string
  onSessionChange: (session: string) => void
  onTopicSelect?: (topicName: string) => void
  onDeckGenerated?: (deckId: number) => void
}

const PANEL_SURFACE =
  "rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white/90 to-slate-50/40 shadow-sm dark:border-white/[0.08] dark:from-slate-950/50 dark:to-slate-950/20"

export function InstructorContentTopicsPanel({
  module,
  session,
  onSessionChange,
  onTopicSelect,
  onDeckGenerated,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState<ContentTopic[]>([])
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const topicsPath =
    module === "flashcards"
      ? "/api/instructor/flashcards/topics"
      : "/api/instructor/course-notes/topics"
  const togglePath =
    module === "flashcards"
      ? "/api/instructor/flashcards/topics/toggle"
      : "/api/instructor/course-notes/topics/toggle"

  const loadTopics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${topicsPath}?session=${encodeURIComponent(session)}`, {
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load topics")
      setTopics(data.topics || [])
    } catch (err: unknown) {
      toast.error("Could not load question bank topics", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [session, topicsPath])

  useEffect(() => {
    void loadTopics()
  }, [loadTopics])

  const toggleTopic = async (topicName: string, currentValue: boolean) => {
    try {
      const res = await fetch(togglePath, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          topicName,
          session,
          isAvailable: !currentValue,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Toggle failed")
      }
      await loadTopics()
    } catch (err: unknown) {
      toast.error("Could not update topic", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const generateDeck = async (topicName: string) => {
    if (module !== "flashcards") return
    setGeneratingTopic(topicName)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/generate-from-bank", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ topicName, session: session === "ALL" ? null : session }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generate failed")
      toast.success(`Added ${data.cardsAdded} cards`, {
        description:
          data.skipped > 0 ? `${data.skipped} duplicates skipped` : `Deck ready for ${topicName}`,
      })
      await loadTopics()
      if (data.deckId) onDeckGenerated?.(data.deckId)
    } catch (err: unknown) {
      toast.error("Generate failed", { description: err instanceof Error ? err.message : undefined })
    } finally {
      setGeneratingTopic(null)
    }
  }

  const enabledCount = topics.filter((t) => t.availability[session]?.is_available ?? true).length

  return (
    <section className={cn(PANEL_SURFACE, "p-4 sm:p-5 space-y-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Question bank topics</h2>
              <p className="text-xs text-muted-foreground">
                {enabledCount} of {topics.length || 0} enabled for students
              </p>
            </div>
          </div>
        </div>
        <Select value={session} onValueChange={onSessionChange}>
          <SelectTrigger className="h-9 w-[148px] rounded-xl border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
            <SelectValue placeholder="Session" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sections</SelectItem>
            <SelectItem value="ECE2202">ECE2202</SelectItem>
            <SelectItem value="ECE2203">ECE2203</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex min-h-[140px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/60 px-4 py-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-sm text-muted-foreground">
            No question bank topics yet. Add questions in Assessments → Question Bank first.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 max-h-[min(420px,50vh)] overflow-y-auto pr-0.5">
          {topics.map((topic) => {
            const avail = topic.availability[session]
            const isAvailable = avail?.is_available ?? true
            return (
              <div
                key={topic.name}
                className={cn(
                  "group flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                  isAvailable
                    ? "border-slate-200/80 bg-white/70 hover:border-violet-300/50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-violet-500/30"
                    : "border-slate-200/60 bg-muted/20 opacity-70",
                )}
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="font-medium text-sm text-left leading-snug hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    onClick={() => onTopicSelect?.(topic.name)}
                  >
                    {topic.name}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      className="h-5 rounded-md px-1.5 text-[10px] font-normal bg-slate-100/80 dark:bg-white/[0.06]"
                    >
                      {topic.question_count} QB
                    </Badge>
                    {module === "flashcards" ? (
                      <Badge
                        variant="secondary"
                        className="h-5 rounded-md px-1.5 text-[10px] font-normal bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      >
                        {topic.deck_count ?? 0} decks · {topic.card_count ?? 0} cards
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="h-5 rounded-md px-1.5 text-[10px] font-normal bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      >
                        {topic.note_count ?? 0} notes
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {module === "flashcards" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg border-violet-200/80 bg-violet-50/50 hover:bg-violet-100/60 dark:border-violet-500/25 dark:bg-violet-500/10 dark:hover:bg-violet-500/20"
                      disabled={generatingTopic === topic.name}
                      onClick={() => void generateDeck(topic.name)}
                    >
                      {generatingTopic === topic.name ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-violet-600 dark:text-violet-400" />
                      )}
                      From bank
                    </Button>
                  ) : null}
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={() => void toggleTopic(topic.name, isAvailable)}
                    aria-label={`Toggle ${topic.name}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
