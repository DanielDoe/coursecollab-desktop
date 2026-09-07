"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
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

export type CreateDeckDraft = {
  title: string
  description: string
}

type Props = {
  open: boolean
  creating?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: CreateDeckDraft) => Promise<void>
}

export function CreateDeckDialog({ open, creating = false, onOpenChange, onSubmit }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New deck</DialogTitle>
          <DialogDescription>Name the deck and add a short description.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit({
              title: title.trim() || "My flashcards",
              description: description.trim(),
            })
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--cc-text-muted)]">Title</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Chapter 6 — Op-amps"
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--cc-text-muted)]">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should this deck cover?"
              rows={3}
              className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--cc-text)] outline-none placeholder:text-[var(--cc-text-muted)] focus-visible:border-[var(--cc-accent)]/40"
            />
          </label>
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
              Create deck
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
