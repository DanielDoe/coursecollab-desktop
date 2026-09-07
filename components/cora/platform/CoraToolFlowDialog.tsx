"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { BookOpen, Layers, Loader2, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  buildFlashcardPrompt,
  buildGlossaryPrompt,
  buildSummarizePrompt,
  buildQuizPrompt,
  type CoraToolFlowId,
  type FlashcardToolVariant,
  type QuizToolVariant,
} from "@/lib/cora/tool-flows"
import { cn } from "@/lib/utils"

type LectureRow = { id: number; title: string; description?: string | null }
type DeckRow = { id: number; title: string; card_count?: number }
type CardRow = { id: number; front_text: string; back_text: string }

type Props = {
  open: boolean
  toolId: CoraToolFlowId | null
  studentId: string
  onClose: () => void
  onLaunch: (payload: { toolId: CoraToolFlowId; prompt: string; label: string }) => void
}

export function CoraToolFlowDialog({ open, toolId, studentId, onClose, onLaunch }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lectures, setLectures] = useState<LectureRow[]>([])
  const [decks, setDecks] = useState<DeckRow[]>([])
  const [cards, setCards] = useState<CardRow[]>([])
  const [selectedDeck, setSelectedDeck] = useState<DeckRow | null>(null)
  const [variant, setVariant] = useState<string>("default")

  useEffect(() => {
    if (!open || !toolId || !studentId) return
    setError(null)
    setSelectedDeck(null)
    setCards([])
    setVariant(toolId === "flashcards" ? "explain" : toolId === "quiz" ? "coach" : "default")
    setLoading(true)

    void (async () => {
      try {
        if (toolId === "flashcards" || toolId === "quiz") {
          const res = await studentApiFetch("/api/student/flashcards/decks", {
            headers: { "x-student-id": studentId },
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || "Failed to load decks")
          setDecks((data.decks ?? data.items ?? []) as DeckRow[])
          setLectures([])
        } else {
          const res = await studentApiFetch("/api/lectures", {
            headers: { "x-student-id": studentId },
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || "Failed to load lectures")
          setLectures((data.lectures ?? data.items ?? []) as LectureRow[])
          setDecks([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course content")
      } finally {
        setLoading(false)
      }
    })()
  }, [open, toolId, studentId])

  const loadCards = async (deck: DeckRow) => {
    setSelectedDeck(deck)
    setLoading(true)
    setError(null)
    try {
      const res = await studentApiFetch(`/api/student/flashcards/decks/${deck.id}/cards`, {
        headers: { "x-student-id": studentId },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load cards")
      setCards((data.cards ?? []) as CardRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards")
    } finally {
      setLoading(false)
    }
  }

  const launchFromLecture = (lecture: LectureRow) => {
    if (!toolId) return
    const label = lecture.title
    const prompt =
      toolId === "glossary" ? buildGlossaryPrompt(label) : buildSummarizePrompt(label)
    onLaunch({ toolId, prompt, label })
    onClose()
  }

  const launchFromCard = (card: CardRow) => {
    if (!toolId || !selectedDeck) return
    const label = `${selectedDeck.title}: ${card.front_text}`
    const prompt =
      toolId === "flashcards"
        ? buildFlashcardPrompt(variant as FlashcardToolVariant, label)
        : buildQuizPrompt(variant as QuizToolVariant, selectedDeck.title)
    onLaunch({ toolId, prompt, label })
    onClose()
  }

  const launchFromDeckQuiz = (deck: DeckRow) => {
    if (!toolId) return
    const prompt = buildQuizPrompt(variant as QuizToolVariant, deck.title)
    onLaunch({ toolId, prompt, label: deck.title })
    onClose()
  }

  const title =
    toolId === "summarize"
      ? "Summarize a lecture"
      : toolId === "glossary"
        ? "Build a glossary"
        : toolId === "flashcards"
          ? "Study a flashcard"
          : toolId === "quiz"
            ? "Quiz coach"
            : "Course tool"

  const empty =
    !loading &&
    (((toolId === "flashcards" || toolId === "quiz") && decks.length === 0 && !selectedDeck) ||
      ((toolId === "summarize" || toolId === "glossary") && lectures.length === 0))

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick course material, then Cora opens Workspace with a guided prompt.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 p-3">
            {error ? <p className="px-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--cc-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : null}

            {!loading && (toolId === "flashcards" || toolId === "quiz") ? (
              <div className="mb-2 flex flex-wrap gap-2 px-1">
                {(toolId === "flashcards"
                  ? [
                      ["explain", "Explain"],
                      ["memorize", "Memorize"],
                      ["breakdown", "Break down"],
                      ["connect", "Connect"],
                    ]
                  : [
                      ["coach", "Guided"],
                      ["weak-areas", "Weak areas"],
                      ["rapid", "Rapid"],
                    ]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVariant(id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      variant === id
                        ? "bg-violet-600 text-white"
                        : "bg-[var(--muted)] text-[var(--cc-text-muted)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}

            {!loading && toolId !== "flashcards" && toolId !== "quiz"
              ? lectures.map((lecture) => (
                  <button
                    key={lecture.id}
                    type="button"
                    onClick={() => launchFromLecture(lecture)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--muted)]/40"
                  >
                    <BookOpen className="mt-0.5 h-4 w-4 text-[var(--cc-text-muted)]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--cc-text)]">{lecture.title}</span>
                      {lecture.description ? (
                        <span className="block text-xs text-[var(--cc-text-muted)] line-clamp-2">
                          {lecture.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))
              : null}

            {!loading && (toolId === "flashcards" || toolId === "quiz") && !selectedDeck
              ? decks.map((deck) => (
                  <button
                    key={deck.id}
                    type="button"
                    onClick={() =>
                      toolId === "quiz" ? launchFromDeckQuiz(deck) : void loadCards(deck)
                    }
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--muted)]/40"
                  >
                    <Layers className="mt-0.5 h-4 w-4 text-[var(--cc-text-muted)]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--cc-text)]">{deck.title}</span>
                      <span className="block text-xs text-[var(--cc-text-muted)]">
                        {deck.card_count != null ? `${deck.card_count} cards` : "Open deck"}
                      </span>
                    </span>
                  </button>
                ))
              : null}

            {!loading && toolId === "flashcards" && selectedDeck ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDeck(null)}>
                  ← Decks
                </Button>
                {cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => launchFromCard(card)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--muted)]/40"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 text-[var(--cc-text-muted)]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--cc-text)]">{card.front_text}</span>
                      <span className="block text-xs text-[var(--cc-text-muted)] line-clamp-2">
                        {card.back_text}
                      </span>
                    </span>
                  </button>
                ))}
              </>
            ) : null}

            {empty ? (
              <p className="px-2 py-8 text-center text-sm text-[var(--cc-text-muted)]">
                No course material found for this tool yet.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
