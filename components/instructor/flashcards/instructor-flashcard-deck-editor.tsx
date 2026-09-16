"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { FlashcardCard, FlashcardDifficulty } from "@/lib/flashcards-types"
import { FLASHCARD_DIFFICULTY_LABELS, FLASHCARD_DIFFICULTY_VALUES } from "@/lib/flashcards-types"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { FacultyContentNavigator } from "@/components/instructor/dashboard-v2/FacultyContentNavigator"
import { cn } from "@/lib/utils"
import { Eye, EyeOff, Layers, ListChecks, Plus, Trash2, Zap, Pencil, ChevronUp, ChevronDown, Check, X } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { InstructorFlashcardQuizPreview } from "@/components/instructor/flashcards/instructor-flashcard-quiz-preview"
import { canUseFlashcardMcq } from "@/lib/flashcard-quiz"
import {
  DEFAULT_FLASHCARD_BATCH_SIZE,
  MAX_FLASHCARD_BATCH_SIZE,
  MIN_FLASHCARD_BATCH_SIZE,
} from "@/lib/flashcard-batch-study"

type ContentNavigation = {
  currentIndex: number
  total: number
  onPrevious: () => void
  onNext: () => void
}

type Props = {
  deckId: number | null
  topicNames?: string[]
  onReload: () => Promise<void>
  onDeleted?: () => void
  showCreatePrompt?: boolean
  onCreateDeck?: () => void
  navigation?: ContentNavigation
}

export function InstructorFlashcardDeckEditor({
  deckId,
  topicNames = [],
  onReload,
  onDeleted,
  showCreatePrompt = true,
  onCreateDeck,
  navigation,
}: Props) {
  const chrome = facultyEmbedChrome("flashcards")
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [topic, setTopic] = useState("")
  const [isPublished, setIsPublished] = useState(false)
  const [showInPracticeHub, setShowInPracticeHub] = useState(false)
  const [requireMcqValidation, setRequireMcqValidation] = useState(true)
  const [cardsBeforeQuiz, setCardsBeforeQuiz] = useState(DEFAULT_FLASHCARD_BATCH_SIZE)
  const [previewCardId, setPreviewCardId] = useState<number | null>(null)
  const previewSectionRef = useRef<HTMLDivElement>(null)
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null)
  const [distractorDrafts, setDistractorDrafts] = useState<Record<number, string[]>>({})
  const [frontText, setFrontText] = useState("")
  const [backText, setBackText] = useState("")
  const [newCardDifficulty, setNewCardDifficulty] = useState<FlashcardDifficulty>("medium")
  const [editingCardId, setEditingCardId] = useState<number | null>(null)
  const [editDrafts, setEditDrafts] = useState<
    Record<number, { frontText: string; backText: string; difficulty: FlashcardDifficulty }>
  >({})
  const [savingCardId, setSavingCardId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadDeckDetail = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/flashcards/decks/${id}`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load deck")
      setTitle(data.deck.title)
      setDescription(data.deck.description || "")
      setTopic(data.deck.topic || "")
      setIsPublished(Boolean(data.deck.isPublished))
      setShowInPracticeHub(Boolean(data.deck.showInPracticeHub))
      setRequireMcqValidation(data.deck.requireMcqValidation !== false)
      setCardsBeforeQuiz(Number(data.deck.cardsBeforeQuiz) || DEFAULT_FLASHCARD_BATCH_SIZE)
      const loadedCards = (data.cards || []) as FlashcardCard[]
      setCards(loadedCards)
      setDistractorDrafts(
        Object.fromEntries(
          loadedCards.map((c) => [c.id, [...(c.customDistractors ?? []), "", "", ""].slice(0, 3)]),
        ),
      )
      setPreviewCardId(loadedCards[0]?.id ?? null)
    } catch (err: unknown) {
      toast.error("Could not load deck", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (deckId) void loadDeckDetail(deckId)
    else {
      setCards([])
      setTitle("")
      setDescription("")
      setTopic("")
    }
  }, [deckId, loadDeckDetail])

  const saveDeck = async () => {
    if (!deckId) return
    try {
      const res = await instructorApiFetch(`/api/instructor/flashcards/decks/${deckId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          title,
          description,
          topic: topic.trim() || null,
          showInPracticeHub: isPublished ? showInPracticeHub : false,
          isPublished,
          requireMcqValidation,
          cardsBeforeQuiz,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Save failed")
      }
      toast.success(isPublished ? "Deck published to students" : "Draft saved")
      await onReload()
    } catch (err: unknown) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const addCard = async () => {
    if (!deckId || !frontText.trim() || !backText.trim()) return
    try {
      const res = await instructorApiFetch(`/api/instructor/flashcards/decks/${deckId}/cards`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ frontText, backText, sortOrder: cards.length, difficulty: newCardDifficulty }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Add failed")
      setCards((prev) => [...prev, data.card])
      setDistractorDrafts((prev) => ({ ...prev, [data.card.id]: ["", "", ""] }))
      setFrontText("")
      setBackText("")
      await onReload()
    } catch (err: unknown) {
      toast.error("Add card failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const startEditCard = (card: FlashcardCard) => {
    setEditingCardId(card.id)
    setEditDrafts((prev) => ({
      ...prev,
      [card.id]: {
        frontText: card.frontText,
        backText: card.backText,
        difficulty: card.difficulty ?? "medium",
      },
    }))
    setExpandedCardId(card.id)
  }

  const cancelEditCard = (cardId: number) => {
    setEditingCardId((prev) => (prev === cardId ? null : prev))
    setEditDrafts((prev) => {
      const next = { ...prev }
      delete next[cardId]
      return next
    })
  }

  const saveCard = async (cardId: number) => {
    const draft = editDrafts[cardId]
    if (!draft?.frontText.trim() || !draft.backText.trim()) {
      toast.error("Front and back text required")
      return
    }
    const card = cards.find((c) => c.id === cardId)
    if (!card) return

    setSavingCardId(cardId)
    try {
      const res = await instructorApiFetch(`/api/instructor/flashcards/cards/${cardId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          frontText: draft.frontText,
          backText: draft.backText,
          difficulty: draft.difficulty,
          sortOrder: card.sortOrder,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setCards((prev) => prev.map((c) => (c.id === cardId ? data.card : c)))
      setEditingCardId(null)
      cancelEditCard(cardId)
      toast.success("Card updated")
      await onReload()
    } catch (err: unknown) {
      toast.error("Could not save card", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSavingCardId(null)
    }
  }

  const reorderCard = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= cards.length) return

    const current = cards[index]!
    const neighbor = cards[swapIndex]!
    const nextCards = [...cards]
    nextCards[index] = { ...neighbor, sortOrder: current.sortOrder }
    nextCards[swapIndex] = { ...current, sortOrder: neighbor.sortOrder }
    setCards(nextCards)

    try {
      await Promise.all([
        instructorApiFetch(`/api/instructor/flashcards/cards/${current.id}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ sortOrder: neighbor.sortOrder }),
        }),
        instructorApiFetch(`/api/instructor/flashcards/cards/${neighbor.id}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ sortOrder: current.sortOrder }),
        }),
      ])
      await onReload()
      if (deckId) await loadDeckDetail(deckId)
    } catch {
      toast.error("Could not reorder cards")
      if (deckId) await loadDeckDetail(deckId)
    }
  }

  const deleteCard = async (cardId: number) => {
    try {
      const res = await instructorApiFetch(`/api/instructor/flashcards/cards/${cardId}`, {
        method: "DELETE",
        headers: headers(),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Delete failed")
      }
      setCards((prev) => prev.filter((c) => c.id !== cardId))
      await onReload()
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const saveDistractors = async (cardId: number) => {
    const draft = distractorDrafts[cardId] ?? []
    const customDistractors = draft.map((t) => t.trim()).filter(Boolean).slice(0, 3)
    try {
      const res = await instructorApiFetch(`/api/instructor/flashcards/cards/${cardId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ customDistractors }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, customDistractors: data.card.customDistractors } : c)),
      )
      toast.success("Quiz distractors saved")
    } catch (err: unknown) {
      toast.error("Could not save distractors", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const jumpToPreviewCard = (cardId: number) => {
    setPreviewCardId(cardId)
    window.requestAnimationFrame(() => {
      previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  const deleteDeck = async () => {
    if (!deckId || !confirm("Move this deck to Deleted Items?")) return
    try {
      const res = await instructorApiFetch(`/api/instructor/flashcards/decks/${deckId}`, {
        method: "DELETE",
        headers: headers(),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Delete failed")
      }
      await onReload()
      onDeleted?.()
      toast.success("Deck moved to Deleted Items")
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  if (!deckId) {
    if (!showCreatePrompt) {
      return (
        <div className={cn(PORTAL_CARD, "flex min-h-[280px] items-center justify-center p-6 text-sm text-muted-foreground")}>
          Select a deck to view details and cards.
        </div>
      )
    }
    return (
      <div className={cn(PORTAL_CARD, "p-4 sm:p-5 min-w-0")}>
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
          <div className={cn("flex size-12 items-center justify-center rounded-2xl", chrome.p.softBg)}>
            <Layers className={cn("h-5 w-5", chrome.p.iconText)} />
          </div>
          <p className="mt-4 text-base font-semibold text-[var(--cc-text)]">Select or create a deck</p>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Choose a deck to edit cards, or create one for students to study in Flashcards.
          </p>
          {onCreateDeck ? (
            <Button size="sm" className={cn("mt-5", chrome.cta)} onClick={onCreateDeck}>
              <Plus className="mr-1.5 h-4 w-4" />
              New deck
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn(PORTAL_CARD, "flex min-h-[280px] items-center justify-center p-6")}>
        <p className="text-sm text-muted-foreground">Loading deck…</p>
      </div>
    )
  }

  return (
    <section className={cn(PORTAL_CARD, "p-4 sm:p-5 min-w-0 space-y-5")}>
      {navigation && navigation.total > 1 ? (
        <FacultyContentNavigator
          currentIndex={navigation.currentIndex}
          total={navigation.total}
          onPrevious={navigation.onPrevious}
          onNext={navigation.onNext}
          itemLabel="deck"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="deck-title" className="text-xs text-muted-foreground">
            Deck title
          </Label>
          <Input id="deck-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deck-topic" className="text-xs text-muted-foreground">
            Topic
          </Label>
          <Input
            id="deck-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            list="flashcard-topic-suggestions-editor"
            className="h-9"
          />
          <datalist id="flashcard-topic-suggestions-editor">
            {topicNames.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      </div>

      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description students see before studying"
        rows={2}
        className="resize-none"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3">
          <div className="flex min-w-0 items-center gap-2">
            {isPublished ? (
              <Eye className={cn("h-3.5 w-3.5 shrink-0", chrome.p.iconText)} />
            ) : (
              <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <Label htmlFor="published" className="cursor-pointer truncate text-sm font-normal">
              Available to students
            </Label>
          </div>
          <Switch
            id="published"
            checked={isPublished}
            onCheckedChange={setIsPublished}
            className={chrome.switchChecked}
          />
        </div>

        <div
          className={cn(
            "flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3",
            !isPublished && "opacity-50",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Zap className={cn("h-3.5 w-3.5 shrink-0", chrome.p.iconText)} />
            <Label htmlFor="practice-hub" className="cursor-pointer truncate text-sm font-normal">
              Practice Hub
            </Label>
          </div>
          <Switch
            id="practice-hub"
            checked={showInPracticeHub}
            onCheckedChange={setShowInPracticeHub}
            disabled={!isPublished}
            className={chrome.switchChecked}
          />
        </div>

        <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3">
          <div className="flex min-w-0 items-center gap-2">
            <ListChecks className={cn("h-3.5 w-3.5 shrink-0", chrome.p.iconText)} />
            <Label htmlFor="require-mcq" className="cursor-pointer truncate text-sm font-normal">
              Require quiz check
            </Label>
          </div>
          <Switch
            id="require-mcq"
            checked={requireMcqValidation}
            onCheckedChange={setRequireMcqValidation}
            className={chrome.switchChecked}
          />
        </div>

        {requireMcqValidation ? (
          <div className="flex h-9 items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3">
            <Label htmlFor="cards-before-quiz" className="shrink-0 text-sm font-normal">
              Cards before quiz
            </Label>
            <Input
              id="cards-before-quiz"
              type="number"
              min={MIN_FLASHCARD_BATCH_SIZE}
              max={MAX_FLASHCARD_BATCH_SIZE}
              value={cardsBeforeQuiz}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                if (!Number.isFinite(n)) return
                setCardsBeforeQuiz(
                  Math.min(MAX_FLASHCARD_BATCH_SIZE, Math.max(MIN_FLASHCARD_BATCH_SIZE, n)),
                )
              }}
              className="h-7 w-16 border-0 bg-transparent px-0 text-right tabular-nums shadow-none focus-visible:ring-0"
            />
          </div>
        ) : null}
      </div>

      {requireMcqValidation && canUseFlashcardMcq(cards) ? (
        <div ref={previewSectionRef} className="rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/10 p-3 sm:p-4">
          <InstructorFlashcardQuizPreview
            cards={cards}
            activeCardId={previewCardId ?? cards[0]?.id ?? null}
            onActiveCardIdChange={setPreviewCardId}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button className={chrome.cta} onClick={() => void saveDeck()}>
          {isPublished ? "Save & publish" : "Save draft"}
        </Button>
        <Button variant="outline" onClick={() => void deleteDeck()}>
          Delete deck
        </Button>
      </div>

      <div className="border-t border-[var(--border)] pt-5 space-y-3">
        <h3 className="text-sm font-semibold">Add card</h3>
        <Input
          value={frontText}
          onChange={(e) => setFrontText(e.target.value)}
          placeholder="Front"
          className="h-9"
        />
        <Textarea
          value={backText}
          onChange={(e) => setBackText(e.target.value)}
          placeholder="Back"
          rows={2}
          className="resize-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="new-card-difficulty" className="text-xs text-muted-foreground shrink-0">
              Difficulty
            </Label>
            <Select
              value={newCardDifficulty}
              onValueChange={(v) => setNewCardDifficulty(v as FlashcardDifficulty)}
            >
              <SelectTrigger id="new-card-difficulty" className="h-8 w-[8.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLASHCARD_DIFFICULTY_VALUES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {FLASHCARD_DIFFICULTY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => void addCard()} disabled={!frontText.trim() || !backText.trim()}>
            Add card
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Cards ({cards.length})</h3>
        {cards.length === 0 ? (
          <p className="text-xs text-muted-foreground">No cards in this deck yet.</p>
        ) : (
          cards.map((card, index) => {
            const drafts = distractorDrafts[card.id] ?? ["", "", ""]
            const expanded = expandedCardId === card.id
            const editing = editingCardId === card.id
            const editDraft = editDrafts[card.id]
            return (
            <div
              key={card.id}
              className="rounded-lg border border-[var(--border)] p-2.5 text-sm space-y-2"
            >
              <div className="group flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--sidebar-accent)]/50 text-[10px] font-medium">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                {editing && editDraft ? (
                  <>
                    <Input
                      value={editDraft.frontText}
                      onChange={(e) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [card.id]: { ...editDraft, frontText: e.target.value },
                        }))
                      }
                      placeholder="Front"
                      className="h-8 text-sm"
                    />
                    <Textarea
                      value={editDraft.backText}
                      onChange={(e) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [card.id]: { ...editDraft, backText: e.target.value },
                        }))
                      }
                      placeholder="Back"
                      rows={2}
                      className="resize-none text-sm"
                    />
                    <Select
                      value={editDraft.difficulty}
                      onValueChange={(v) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [card.id]: { ...editDraft, difficulty: v as FlashcardDifficulty },
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[8.5rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FLASHCARD_DIFFICULTY_VALUES.map((d) => (
                          <SelectItem key={d} value={d}>
                            {FLASHCARD_DIFFICULTY_LABELS[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <p className="whitespace-pre-wrap font-medium">{card.frontText}</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{card.backText}</p>
                    <Badge variant="secondary" className="sm:col-span-2 w-fit text-[10px] font-normal">
                      {FLASHCARD_DIFFICULTY_LABELS[card.difficulty ?? "medium"]}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === 0}
                  onClick={() => void reorderCard(index, "up")}
                  aria-label="Move card up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={index === cards.length - 1}
                  onClick={() => void reorderCard(index, "down")}
                  aria-label="Move card down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex shrink-0 gap-1">
                {editing ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={savingCardId === card.id}
                      onClick={() => void saveCard(card.id)}
                    >
                      <Check className={cn("h-4 w-4", chrome.p.iconText)} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => cancelEditCard(card.id)}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEditCard(card)}
                    aria-label="Edit card"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {requireMcqValidation && canUseFlashcardMcq(cards) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      jumpToPreviewCard(card.id)
                      setExpandedCardId(expanded ? null : card.id)
                    }}
                  >
                    Quiz
                  </Button>
                ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => void deleteCard(card.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
              </div>
              </div>
              {expanded && requireMcqValidation ? (
                <div className="ml-8 space-y-2 border-t border-[var(--border)] pt-2">
                  <p className="text-[11px] text-muted-foreground">
                    Optional wrong answers (up to 3). Other cards fill in the rest.
                  </p>
                  {drafts.map((value, di) => (
                    <Input
                      key={`${card.id}-d-${di}`}
                      value={value}
                      onChange={(e) => {
                        const next = [...drafts]
                        next[di] = e.target.value
                        setDistractorDrafts((prev) => ({ ...prev, [card.id]: next }))
                      }}
                      placeholder={`Custom distractor ${di + 1}`}
                      className="h-8 text-xs"
                    />
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void saveDistractors(card.id)}>
                      Save distractors
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => jumpToPreviewCard(card.id)}
                    >
                      Preview in navigator
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )})
        )}
      </div>
    </section>
  )
}
