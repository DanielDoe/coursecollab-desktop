"use client"

import { useEffect, useState } from "react"
import { Loader2, NotebookPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NOTE_ICON_COLOR_CHOICES } from "@/lib/notes-list-theme"
import { ctaInkOnFill } from "@/lib/appearance/chrome-ink"
import { cn } from "@/lib/utils"

export type CreateNoteDraft = {
  title: string
  description: string
  iconColor: string
}

type Props = {
  open: boolean
  creating?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: CreateNoteDraft) => Promise<void>
}

export function CreateNoteDialog({ open, creating = false, onOpenChange, onSubmit }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [iconColor, setIconColor] = useState<string>(NOTE_ICON_COLOR_CHOICES[0])

  useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
    setIconColor(NOTE_ICON_COLOR_CHOICES[0])
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>Give it a title, a short description, and an icon color.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit({
              title: title.trim() || "Untitled note",
              description: description.trim(),
              iconColor,
            })
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--cc-text-muted)]">Title</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ECE 2202 Exam Prep"
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--cc-text-muted)]">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this note for?"
              rows={3}
              className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--cc-text)] outline-none placeholder:text-[var(--cc-text-muted)] focus-visible:border-[var(--cc-accent)]/40"
            />
          </label>
          <div className="space-y-2">
            <span className="text-xs font-medium text-[var(--cc-text-muted)]">Icon color</span>
            <div className="flex flex-wrap gap-2">
              {NOTE_ICON_COLOR_CHOICES.map((color) => {
                const selected = iconColor === color
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Icon color ${color}`}
                    aria-pressed={selected}
                    onClick={() => setIconColor(color)}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl border-2 transition-transform",
                      selected
                        ? "scale-105 border-[var(--cc-text)]"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color, color: ctaInkOnFill(color) }}
                  >
                    <NotebookPen className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating}
              className="border-0 bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create note
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
