"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { CODEBENCH_LANGUAGES, type CodebenchLanguageId } from "@/lib/codebench-languages"
import {
  INSTRUCTOR_LIBRARY_CATEGORIES,
  INSTRUCTOR_LIBRARY_CATEGORY_LABELS,
  defaultLibraryFileForLanguage,
  upsertLibraryItem,
  type InstructorLibraryCategory,
  type InstructorLibraryItem,
} from "@/lib/codebench-instructor-library"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InstructorLibraryItem | null
  onSaved?: (item: InstructorLibraryItem) => void
}

function emptyDraft(languageId: CodebenchLanguageId = "cpp") {
  const file = defaultLibraryFileForLanguage(languageId)
  return {
    title: "",
    description: "",
    category: "examples" as InstructorLibraryCategory,
    languageId,
    topic: "",
    week: "",
    difficulty: "" as "" | "beginner" | "intermediate" | "advanced",
    tags: "",
    code: file.content,
    filePath: file.path,
  }
}

export function InstructorTeachingLibraryItemDialog({ open, onOpenChange, item, onSaved }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(() => emptyDraft())

  const isEdit = Boolean(item?.id)

  useEffect(() => {
    if (!open) return
    if (item) {
      const primary = item.files[0]
      setDraft({
        title: item.title,
        description: item.description,
        category: item.category,
        languageId: item.languageId,
        topic: item.topic,
        week: item.week ?? "",
        difficulty: item.difficulty ?? "",
        tags: item.tags.join(", "),
        code: primary?.content ?? defaultLibraryFileForLanguage(item.languageId).content,
        filePath: primary?.path ?? defaultLibraryFileForLanguage(item.languageId).path,
      })
    } else {
      setDraft(emptyDraft())
    }
  }, [open, item])

  const languageOptions = useMemo(() => CODEBENCH_LANGUAGES.map((lang) => lang.id), [])

  const handleLanguageChange = (languageId: CodebenchLanguageId) => {
    setDraft((current) => {
      const file = defaultLibraryFileForLanguage(languageId)
      const keepCustomCode = current.code.trim() && current.code !== defaultLibraryFileForLanguage(current.languageId).content
      return {
        ...current,
        languageId,
        filePath: file.path,
        code: keepCustomCode ? current.code : file.content,
      }
    })
  }

  const handleSave = () => {
    const title = draft.title.trim()
    if (!title) {
      toast({
        title: "Title required",
        description: "Give this snippet a title so you can find it in the library.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const tags = draft.tags
        .split(/[,;]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
      const saved = upsertLibraryItem({
        id: item?.id,
        title,
        description: draft.description.trim() || "Teaching snippet",
        category: draft.category,
        languageId: draft.languageId,
        topic: draft.topic.trim() || "General",
        week: draft.week.trim() || undefined,
        difficulty: draft.difficulty || undefined,
        tags,
        files: [{ path: draft.filePath.trim() || defaultLibraryFileForLanguage(draft.languageId).path, content: draft.code }],
        courseId: item?.courseId ?? null,
      })
      toast({
        title: isEdit ? "Snippet updated" : "Snippet added",
        description: `"${saved.title}" is in your teaching library on this device.`,
      })
      onSaved?.(saved)
      onOpenChange(false)
    } catch {
      toast({
        title: "Could not save",
        description: "Your browser may be out of storage. Try removing old snippets.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit teaching snippet" : "New teaching snippet"}</DialogTitle>
          <DialogDescription>
            Saved locally in this browser for CodeBench demos. Use Open in IDE to edit code in the full editor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="lib-title">Title</Label>
            <Input
              id="lib-title"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Loop walkthrough starter"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lib-desc">Description</Label>
            <Textarea
              id="lib-desc"
              rows={2}
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="What you'll demonstrate in class"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="lib-category">Category</Label>
              <select
                id="lib-category"
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    category: event.target.value as InstructorLibraryCategory,
                  }))
                }
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
              >
                {INSTRUCTOR_LIBRARY_CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {INSTRUCTOR_LIBRARY_CATEGORY_LABELS[entry]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lib-lang">Language</Label>
              <select
                id="lib-lang"
                value={draft.languageId}
                onChange={(event) => handleLanguageChange(event.target.value as CodebenchLanguageId)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
              >
                {languageOptions.map((id) => (
                  <option key={id} value={id}>
                    {CODEBENCH_LANGUAGES.find((lang) => lang.id === id)?.label ?? id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="lib-topic">Topic</Label>
              <Input
                id="lib-topic"
                value={draft.topic}
                onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))}
                placeholder="Loops, Arrays, …"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lib-week">Week (optional)</Label>
              <Input
                id="lib-week"
                value={draft.week}
                onChange={(event) => setDraft((current) => ({ ...current, week: event.target.value }))}
                placeholder="Week 4"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="lib-difficulty">Difficulty</Label>
              <select
                id="lib-difficulty"
                value={draft.difficulty}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    difficulty: event.target.value as typeof draft.difficulty,
                  }))
                }
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
              >
                <option value="">Not set</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lib-tags">Tags</Label>
              <Input
                id="lib-tags"
                value={draft.tags}
                onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                placeholder="for-loop, demo"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lib-code">Starter code</Label>
            <Textarea
              id="lib-code"
              rows={10}
              value={draft.code}
              onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {isEdit ? "Save changes" : "Add snippet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
