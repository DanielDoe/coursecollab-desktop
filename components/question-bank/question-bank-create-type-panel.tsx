"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import type { CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import {
  questionBankSectionClass,
  questionBankSectionHeaderClass,
} from "@/lib/question-bank-ui"
import { Loader2, Sparkles, Save } from "lucide-react"

export function QuestionBankCreateTypePanel({
  onSaved,
  onCancel,
}: {
  onSaved: (type: CustomQuestionTypeDraft) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [suggestedName, setSuggestedName] = useState("")
  const [description, setDescription] = useState("")
  const [draft, setDraft] = useState<CustomQuestionTypeDraft | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const patchDraft = (partial: Partial<CustomQuestionTypeDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  const handleGenerate = async () => {
    if (description.trim().length < 20) {
      toast({
        title: "More detail needed",
        description: "Describe how students answer, how it is graded, and what fields instructors need.",
        variant: "destructive",
      })
      return
    }

    setGenerating(true)
    try {
      const res = await instructorApiFetch("/api/instructor/question-bank/custom-types/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ description, suggestedName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")
      setDraft(data.draft as CustomQuestionTypeDraft)
      toast({ title: "Type schema ready", description: "Review and save to your question types." })
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Could not generate type schema",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/question-bank/custom-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({ title: "Question type saved", description: `${draft.label} is now available in your type list.` })
      onSaved(data.type as CustomQuestionTypeDraft)
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save question type",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!draft) {
    return (
      <section className={questionBankSectionClass}>
        <div className={questionBankSectionHeaderClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Create a new question type
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
            Describe the format to AI — it builds the schema and saves it as a reusable template.
          </p>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type name (optional)</Label>
            <Input
              value={suggestedName}
              onChange={(e) => setSuggestedName(e.target.value)}
              placeholder="e.g. Diagram labeling"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Describe this question type</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Students see a circuit diagram and label nodes A–D. Manual grading. Instructor uploads the diagram image, sets the correct labels, and optional partial credit rubric."
              className="text-sm resize-y"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={onCancel}>
              Back to types
            </Button>
            <Button type="button" size="sm" className="h-9" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating schema…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate type schema
                </>
              )}
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <section className={questionBankSectionClass}>
        <div className={questionBankSectionHeaderClass}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Review type schema</h3>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Display name</Label>
              <Input value={draft.label} onChange={(e) => patchDraft({ label: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Type id</Label>
              <Input value={draft.typeId} onChange={(e) => patchDraft({ typeId: e.target.value })} className="h-9 font-mono text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea value={draft.description} onChange={(e) => patchDraft({ description: e.target.value })} rows={2} className="text-sm" />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={draft.requiresOptions} onCheckedChange={(c) => patchDraft({ requiresOptions: c === true })} />
              Uses answer options
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={draft.usesCodeEditor} onCheckedChange={(c) => patchDraft({ usesCodeEditor: c === true })} />
              Uses code editor
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.usesGradingGuidelines}
                onCheckedChange={(c) => patchDraft({ usesGradingGuidelines: c === true })}
              />
              AI / rubric grading
            </label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Authoring fields</Label>
            <div className="rounded-md border border-slate-200/80 dark:border-white/[0.06] divide-y divide-slate-200/80 dark:divide-white/[0.06]">
              {draft.schema.fields.map((field, idx) => (
                <div key={`${field.key}-${idx}`} className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{field.label}</span>
                  <span className="text-slate-400"> · {field.kind}</span>
                  {field.description ? <p className="mt-0.5">{field.description}</p> : null}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">AI question template prompt</Label>
            <Textarea
              value={draft.aiQuestionPrompt}
              onChange={(e) => patchDraft({ aiQuestionPrompt: e.target.value })}
              rows={3}
              className="text-sm font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setDraft(null)} disabled={saving}>
              Regenerate
            </Button>
            <Button type="button" size="sm" className="h-9" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save question type
                </>
              )}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
