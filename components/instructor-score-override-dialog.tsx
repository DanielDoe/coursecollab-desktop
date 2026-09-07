"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import type { InstructorOverrideAssessmentKind } from "@/lib/instructor-score-override"

type Props = {
  attemptId: number
  studentName: string
  assessmentTitle: string
  currentScore: number
  totalPoints: number
  assessmentType: InstructorOverrideAssessmentKind
  /** Mid-semester or section-weighted mid/final: enter 0–100 (course %), not raw quiz points */
  usesPercentageScale: boolean
  completedAt: string | null
  onSaved: () => void | Promise<void>
}

export function InstructorScoreOverrideButton({
  attemptId,
  studentName,
  assessmentTitle,
  currentScore,
  totalPoints,
  assessmentType,
  usesPercentageScale,
  completedAt,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  if (!completedAt) return null

  const openDialog = () => {
    setDraft(String(currentScore))
    setOpen(true)
  }

  const save = async () => {
    const parsed = parseFloat(draft)
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({ title: "Invalid score", description: "Enter a valid number.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/results/override-total-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: localStorage.getItem("instructorSession") || "",
          "x-instructor-id": localStorage.getItem("instructorId") || "",
        },
        body: JSON.stringify({
          attemptId,
          score: parsed,
          assessmentType,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: "Could not update score",
          description: typeof data.error === "string" ? data.error : "Request failed",
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Score updated",
        description: `${studentName}: ${data.percentage != null ? `${data.percentage}%` : "saved"}`,
      })
      setOpen(false)
      await onSaved()
    } catch {
      toast({ title: "Could not update score", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        aria-label="Edit total score"
        onClick={openDialog}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override total score</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {studentName}
              <span className="text-slate-400 dark:text-slate-500"> · </span>
              {assessmentTitle}
            </p>
            <div className="space-y-2">
              <Label htmlFor={`instructor-score-override-${attemptId}`}>
                {usesPercentageScale
                  ? "Score (0–100, weighted course %)"
                  : `Points (max ${totalPoints})`}
              </Label>
              <Input
                id={`instructor-score-override-${attemptId}`}
                type="number"
                step="0.01"
                min={0}
                max={usesPercentageScale ? 100 : totalPoints}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
