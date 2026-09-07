"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { clearGuestCoraContext } from "@/lib/cora/guest-cora-context-store"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EMBED_INNER_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  compact?: boolean
  onSaved?: () => void
}

export function GuestMasterResumePanel({ className, compact, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [resumeText, setResumeText] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/guest/career/resumes?studentDatabaseId=${encodeURIComponent(d.databaseId)}`)
      const json = await res.json()
      if (res.ok && json.masterResume) {
        setResumeText(json.masterResume.parsedText ?? "")
        setFileName(json.masterResume.originalFileName ?? null)
        setUpdatedAt(json.masterResume.updatedAt ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    const d = getStudentData()
    if (!d?.databaseId) return
    if (!resumeText.trim()) {
      setError("Paste or upload your résumé first.")
      return
    }
    setSaving(true)
    setError("")
    setSuccess(false)
    try {
      const res = await fetch("/api/guest/career/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: d.databaseId, parsedText: resumeText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Save failed")
      setUpdatedAt(json.resume?.updatedAt ?? new Date().toISOString())
      setSuccess(true)
      clearGuestCoraContext(d.databaseId)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function onFile(file: File | null) {
    if (!file) return
    setFileName(file.name)
    const text = await file.text().catch(() => "")
    if (text.trim()) setResumeText(text)
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-[var(--cc-text-muted)]", className)}>
        <Loader2 className="size-4 animate-spin" /> Loading résumé…
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-[var(--cc-text-muted)]">
        Your master résumé powers quick scans, cover letters, and Cora chat. Cora always re-reads the saved résumé —
        context is a summary only.
      </p>
      {updatedAt ? (
        <p className="text-xs font-medium text-violet-700">
          Saved {new Date(updatedAt).toLocaleDateString()}
          {fileName ? ` · ${fileName}` : ""}
        </p>
      ) : (
        <p className="text-xs font-medium text-amber-700">No master résumé yet — add one to unlock quick scan.</p>
      )}

      <div className={cn(!compact && EMBED_INNER_PANEL, compact ? "" : "p-3")}>
        <div className="mb-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => fileRef.current?.click()}>
            <FileUp className="mr-1.5 size-3.5" />
            Upload file
          </Button>
          <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" className="hidden" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
        </div>
        <Textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your résumé text here…"
          className={cn("rounded-xl font-mono text-xs", compact ? "min-h-[160px]" : "min-h-[220px]")}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600">Résumé saved — Cora context updated.</p> : null}

      <Button className="rounded-xl" disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        {saving ? "Saving…" : "Save master résumé"}
      </Button>
    </div>
  )
}
