"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { cn } from "@/lib/utils"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "@/lib/app-toast"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated: (deckId: number) => Promise<void>
}

export function InstructorFlashcardGenerateDialog({ open, onOpenChange, onGenerated }: Props) {
  const chrome = facultyEmbedChrome("flashcards")
  const [topicName, setTopicName] = useState("")
  const [topicNames, setTopicNames] = useState<string[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadTopics = useCallback(async () => {
    setLoadingTopics(true)
    try {
      const res = await instructorApiFetch("/api/instructor/practice/topics?session=ALL", {
        headers: buildInstructorAuthorizedApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load topics")
      const names = (data.topics || []).map((t: { name: string }) => t.name).filter(Boolean)
      setTopicNames(names)
      setTopicName(names[0] ?? "")
    } catch (err: unknown) {
      toast.error("Could not load question bank topics", {
        description: err instanceof Error ? err.message : undefined,
      })
      setTopicNames([])
      setTopicName("")
    } finally {
      setLoadingTopics(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadTopics()
  }, [open, loadTopics])

  const generate = async () => {
    if (!topicName.trim()) {
      toast.error("Select a question bank topic")
      return
    }
    setGenerating(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/generate-from-bank", {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ topicName: topicName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generate failed")
      toast.success(`Added ${data.cardsAdded} cards`, {
        description:
          data.skipped > 0 ? `${data.skipped} duplicates skipped` : `Deck ready for ${topicName}`,
      })
      onOpenChange(false)
      if (data.deckId) await onGenerated(Number(data.deckId))
    } catch (err: unknown) {
      toast.error("Generate failed", { description: err instanceof Error ? err.message : undefined })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className={cn("h-4 w-4", chrome.p.iconText)} />
            Generate from question bank
          </DialogTitle>
          <DialogDescription>
            Creates a course deck with up to 20 cards from questions in the selected topic.
          </DialogDescription>
        </DialogHeader>

        {loadingTopics ? (
          <div className="flex min-h-[4rem] items-center justify-center">
            <Loader2 className={cn("h-5 w-5 animate-spin", chrome.p.iconText)} />
          </div>
        ) : topicNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add questions in Assessments → Question Bank first.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="generate-topic">Question bank topic</Label>
            <Select value={topicName} onValueChange={setTopicName}>
              <SelectTrigger id="generate-topic" className="h-9">
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {topicNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button
            className={chrome.cta}
            onClick={() => void generate()}
            disabled={generating || loadingTopics || topicNames.length === 0 || !topicName}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate deck"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
