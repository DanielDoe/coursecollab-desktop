"use client"

import { studentApiFetch, getStudentAuthHeaders } from "@/lib/auth"
import { useCallback, useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"

type BriefData = {
  opportunity_title?: string | null
  program_name?: string | null
  highlight_topics?: string | null
  relationship_context?: string | null
  brief_markdown?: string
  generated_at?: string | null
}

type Props = {
  requestId: string
  studentKey: string
  disabled?: boolean
  onGenerated?: () => void
}

export function RecommendationBriefPanel({
  requestId,
  studentKey,
  disabled,
  onGenerated,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [brief, setBrief] = useState<BriefData | null>(null)
  const [opportunityTitle, setOpportunityTitle] = useState("")
  const [programName, setProgramName] = useState("")
  const [highlightTopics, setHighlightTopics] = useState("")
  const [relationshipContext, setRelationshipContext] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(
        `/api/student/recommendations/${requestId}/brief?studentDatabaseId=${encodeURIComponent(studentKey)}`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load brief")
      setBrief(data.brief ?? null)
      setOpportunityTitle(String(data.brief?.opportunity_title ?? ""))
      setProgramName(String(data.brief?.program_name ?? ""))
      setHighlightTopics(String(data.brief?.highlight_topics ?? ""))
      setRelationshipContext(String(data.brief?.relationship_context ?? ""))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load brief")
    } finally {
      setLoading(false)
    }
  }, [requestId, studentKey])

  useEffect(() => {
    void load()
  }, [load])

  async function saveAndGenerate() {
    setBusy(true)
    setError("")
    try {
      const res = await studentApiFetch(`/api/student/recommendations/${requestId}/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: studentKey,
          opportunityTitle,
          programName,
          highlightTopics,
          relationshipContext,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not generate brief")
      setBrief(data.brief)
      onGenerated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate brief")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <CardWrapper delay={0} hover={false} className="p-6 flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
        <Loader2 className="size-4 animate-spin" />
        Loading recommendation brief…
      </CardWrapper>
    )
  }

  return (
    <CardWrapper delay={0} hover={false} className="p-4 sm:p-6 space-y-4 scroll-mt-28" id="rec-section-brief">
      <div>
        <h2 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-[var(--cc-text)]">
          <Sparkles className="h-5 w-5 text-[var(--cc-accent-dark)] shrink-0" />
          Recommendation preparation brief
        </h2>
        <p className="text-xs sm:text-sm text-[var(--cc-text-muted)] mt-1">
          Prepare an evidence package for your instructor. Cora helps organize your materials — your
          instructor writes and owns the final recommendation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brief-opportunity">Opportunity</Label>
          <Input
            id="brief-opportunity"
            value={opportunityTitle}
            onChange={(e) => setOpportunityTitle(e.target.value)}
            placeholder="e.g. NSF Graduate Research Fellowship"
            disabled={disabled || busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief-program">Program / school</Label>
          <Input
            id="brief-program"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            placeholder="e.g. Ph.D. Electrical Engineering"
            disabled={disabled || busy}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="brief-highlights">Topics to highlight</Label>
        <Textarea
          id="brief-highlights"
          value={highlightTopics}
          onChange={(e) => setHighlightTopics(e.target.value)}
          placeholder="Research, leadership, coursework strengths…"
          disabled={disabled || busy}
          className="min-h-[88px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brief-relationship">Relevant work with this instructor</Label>
        <Textarea
          id="brief-relationship"
          value={relationshipContext}
          onChange={(e) => setRelationshipContext(e.target.value)}
          placeholder="Courses, projects, research, or mentoring context"
          disabled={disabled || busy}
          className="min-h-[88px]"
        />
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <Button type="button" disabled={disabled || busy} onClick={() => void saveAndGenerate()} className="rounded-xl">
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
        {brief?.brief_markdown ? "Regenerate brief" : "Generate brief with Cora"}
      </Button>

      {brief?.brief_markdown ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)] mb-2">
            Brief preview {brief.generated_at ? `· ${new Date(brief.generated_at).toLocaleString()}` : ""}
          </p>
          <pre className="whitespace-pre-wrap text-sm text-[var(--cc-text)] font-sans leading-relaxed">
            {brief.brief_markdown}
          </pre>
        </div>
      ) : null}
    </CardWrapper>
  )
}
