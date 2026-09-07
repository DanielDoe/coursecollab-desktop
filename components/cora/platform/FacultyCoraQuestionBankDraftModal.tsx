"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { CoraLogo } from "@/components/cora/CoraLogo"
import { QuestionBankDraftReviewPanel } from "@/components/question-bank/question-bank-draft-review-panel"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

type Props = {
  open: boolean
  drafts: DraftQuestionBankItem[]
  onClose: () => void
  onSaved?: () => void
}

export function FacultyCoraQuestionBankDraftModal({ open, drafts, onClose, onSaved }: Props) {
  const { toast } = useToast()
  const [localDrafts, setLocalDrafts] = useState(drafts)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLocalDrafts(drafts)
    setSelected(Object.fromEntries(drafts.map((d) => [d.draftId, true])))
  }, [open, drafts])

  const updateDraft = (draftId: string, partial: Partial<DraftQuestionBankItem>) => {
    setLocalDrafts((prev) => prev.map((d) => (d.draftId === draftId ? { ...d, ...partial } : d)))
  }

  const handleConfirm = async () => {
    const toCreate = localDrafts.filter((d) => selected[d.draftId])
    if (!toCreate.length) {
      toast({ title: "Select at least one draft", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/question-bank/bulk-create", {
        method: "POST",
        headers: buildInstructorApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ questions: toCreate }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not save drafts")
      }
      toast({
        title: "Added to Question Bank",
        description: `${toCreate.length} question${toCreate.length === 1 ? "" : "s"} saved.`,
      })
      onSaved?.()
      onClose()
    } catch (error) {
      toast({
        title: "Could not save",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CoraLogo size="sm" />
            <DialogTitle>Review drafts</DialogTitle>
          </div>
          <DialogDescription>
            Review Cora-generated questions before adding them to your bank.
          </DialogDescription>
        </DialogHeader>
        <QuestionBankDraftReviewPanel
          drafts={localDrafts}
          selected={selected}
          onSelectedChange={setSelected}
          onUpdateDraft={updateDraft}
          onBack={onClose}
          onConfirm={() => void handleConfirm()}
          saving={saving}
          backLabel="Discard"
          subtitle="Edit anything, then confirm to publish into Question Bank."
        />
      </DialogContent>
    </Dialog>
  )
}
