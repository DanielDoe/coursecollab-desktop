"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FlashcardDifficultyBadge } from "@/components/student/flashcards/flashcard-difficulty-badge"
import { FlashcardDifficultyPicker } from "@/components/student/flashcards/flashcard-difficulty-picker"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import type { FlashcardCard, FlashcardDeck, FlashcardDifficulty } from "@/lib/flashcards"
import { flashcardDifficultyFaceStyle } from "@/lib/flashcard-difficulty-theme"
import { cn } from "@/lib/utils"
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

type Props = {
  deckId: number
}

function EditorFlipPreview({
  frontText,
  backText,
  difficulty,
}: {
  frontText: string
  backText: string
  difficulty: FlashcardDifficulty
}) {
  const [flipped, setFlipped] = useState(false)
  const face = flashcardDifficultyFaceStyle(difficulty)

  useEffect(() => {
    setFlipped(false)
  }, [frontText, backText, difficulty])

  return (
    <button
      type="button"
      className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-2xl"
      onClick={() => setFlipped((f) => !f)}
      aria-label={flipped ? "Show front" : "Show back"}
    >
      <div className="relative min-h-[180px] [perspective:1000px]">
        <div
          className="relative h-full min-h-[180px] transition-transform duration-300"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-between rounded-2xl border p-4",
              face.frontClass,
            )}
            style={{ backfaceVisibility: "hidden" }}
          >
            <div>
              <FlashcardDifficultyBadge difficulty={difficulty} compact />
              <p className="mt-3 text-base font-semibold leading-snug whitespace-pre-wrap">
                {frontText.trim() || "Front preview"}
              </p>
            </div>
            <p className="text-[11px] opacity-70">Tap to flip</p>
          </div>
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-between rounded-2xl border p-4",
              face.backClass,
            )}
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  face.backBadgeClass,
                )}
              >
                Answer
              </span>
              <p className="mt-3 text-base font-semibold leading-snug whitespace-pre-wrap">
                {backText.trim() || "Back preview"}
              </p>
            </div>
            <p className="text-[11px] opacity-70">Tap to flip</p>
          </div>
        </div>
      </div>
    </button>
  )
}

export function FlashcardDeckEditor({ deckId }: Props) {
  const router = useRouter()
  const { confirm } = useAppConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deck, setDeck] = useState<FlashcardDeck | null>(null)
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [topic, setTopic] = useState("")
  const [frontText, setFrontText] = useState("")
  const [backText, setBackText] = useState("")
  const [cardDifficulty, setCardDifficulty] = useState<FlashcardDifficulty>("medium")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await studentApiFetch(`/api/student/flashcards/decks/${deckId}`, {
        headers: getStudentAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load deck")
      if (!data.deck?.canEdit) {
        toast.error("This deck cannot be edited")
        router.replace(`/student/dashboard-v2/flashcards/${deckId}`)
        return
      }
      setDeck(data.deck)
      setTitle(data.deck.title)
      setDescription(data.deck.description || "")
      setTopic(data.deck.topic || "")
      setCards(data.cards || [])
    } catch (err: unknown) {
      toast.error("Could not load deck", {
        description: err instanceof Error ? err.message : undefined,
      })
      router.push("/student/dashboard-v2/flashcards")
    } finally {
      setLoading(false)
    }
  }, [deckId, router])

  useEffect(() => {
    void load()
  }, [load])

  const saveDeckMeta = async () => {
    setSaving(true)
    try {
      const res = await studentApiFetch(`/api/student/flashcards/decks/${deckId}`, {
        method: "PATCH",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, topic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setDeck(data.deck)
      toast.success("Deck saved")
    } catch (err: unknown) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const addCard = async () => {
    if (!frontText.trim() || !backText.trim()) {
      toast.error("Enter front and back text")
      return
    }
    try {
      const res = await studentApiFetch(`/api/student/flashcards/decks/${deckId}/cards`, {
        method: "POST",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          frontText,
          backText,
          sortOrder: cards.length,
          difficulty: cardDifficulty,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Add failed")
      setCards((prev) => [...prev, data.card])
      setFrontText("")
      setBackText("")
      setCardDifficulty("medium")
      setDeck((d) => (d ? { ...d, cardCount: d.cardCount + 1 } : d))
    } catch (err: unknown) {
      toast.error("Could not add card", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const deleteCard = async (cardId: number) => {
    try {
      const res = await studentApiFetch(`/api/student/flashcards/cards/${cardId}`, {
        method: "DELETE",
        headers: getStudentAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      setCards((prev) => prev.filter((c) => c.id !== cardId))
      setDeck((d) => (d ? { ...d, cardCount: Math.max(0, d.cardCount - 1) } : d))
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const deleteDeck = async () => {
    const ok = await confirm({
      title: "Delete this deck?",
      description: "All cards in this deck will be deleted.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    })
    if (!ok) return
    try {
      const res = await studentApiFetch(`/api/student/flashcards/decks/${deckId}`, {
        method: "DELETE",
        headers: getStudentAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      router.push("/student/dashboard-v2/flashcards")
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!deck) return null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link href="/student/dashboard-v2/flashcards">
            <ArrowLeft className="h-4 w-4" />
            Flashcards
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/student/dashboard-v2/flashcards/${deckId}`}>Study</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void deleteDeck()}>
            Delete deck
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deck title" />
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional)" />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
        />
        <Button onClick={() => void saveDeckMeta()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save deck info
        </Button>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <h2 className="font-semibold">Add card</h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-3">
            <Input
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              placeholder="Front (question / term)"
            />
            <Textarea
              value={backText}
              onChange={(e) => setBackText(e.target.value)}
              placeholder="Back (answer / definition)"
              rows={3}
            />
            <FlashcardDifficultyPicker value={cardDifficulty} onChange={setCardDifficulty} />
            <Button onClick={() => void addCard()} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add card
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Live preview
            </p>
            <EditorFlipPreview
              frontText={frontText}
              backText={backText}
              difficulty={cardDifficulty}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Cards ({cards.length})</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-slate-500">No cards yet. Add your first card above.</p>
        ) : (
          cards.map((card) => (
            <div
              key={card.id}
              className="rounded-xl border border-slate-200/70 p-3 dark:border-white/[0.08] flex gap-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <FlashcardDifficultyBadge difficulty={card.difficulty} compact />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Front</p>
                    <p className="text-sm whitespace-pre-wrap">{card.frontText}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-slate-500">Back</p>
                    <p className="text-sm whitespace-pre-wrap">{card.backText}</p>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void deleteCard(card.id)}
                aria-label="Delete card"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
