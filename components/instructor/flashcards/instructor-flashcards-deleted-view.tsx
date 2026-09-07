"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { FlashcardDeck } from "@/lib/flashcards-types"
import {
  FacultyIntegratedToolbar,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { Loader2, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "@/lib/app-toast"

type DeletedCard = {
  id: number
  deckId: number
  frontText: string
  backText: string
  deckTitle: string
  deckTopic: string | null
  deletedAt: string
}

type Props = {
  onRestored: () => Promise<void>
}

export function InstructorFlashcardsDeletedView({ onRestored }: Props) {
  const [loading, setLoading] = useState(true)
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [cards, setCards] = useState<DeletedCard[]>([])
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "decks" | "cards">("all")

  const headers = () =>
    buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

  const loadDeleted = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/deleted", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load deleted items")
      setDecks(data.decks || [])
      setCards(data.cards || [])
    } catch (err: unknown) {
      toast.error("Could not load deleted items", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDeleted()
  }, [loadDeleted])

  const filteredDecks = useMemo(() => {
    if (typeFilter === "cards") return []
    const term = search.trim().toLowerCase()
    if (!term) return decks
    return decks.filter(
      (d) =>
        d.title.toLowerCase().includes(term) ||
        (d.topic ?? "").toLowerCase().includes(term),
    )
  }, [decks, search, typeFilter])

  const filteredCards = useMemo(() => {
    if (typeFilter === "decks") return []
    const term = search.trim().toLowerCase()
    if (!term) return cards
    return cards.filter(
      (c) =>
        c.frontText.toLowerCase().includes(term) ||
        c.backText.toLowerCase().includes(term) ||
        c.deckTitle.toLowerCase().includes(term),
    )
  }, [cards, search, typeFilter])

  const restoreDecks = async (deckIds: number[]) => {
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/deleted", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ deckIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Restore failed")
      }
      toast.success("Deck restored")
      await loadDeleted()
      await onRestored()
    } catch (err: unknown) {
      toast.error("Restore failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const restoreCards = async (cardIds: number[]) => {
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/deleted", {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ cardIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Restore failed")
      }
      toast.success("Card restored")
      await loadDeleted()
      await onRestored()
    } catch (err: unknown) {
      toast.error("Restore failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const permanentDeleteDecks = async (deckIds: number[]) => {
    if (!confirm("Permanently delete selected decks? This cannot be undone.")) return
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/deleted", {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ deckIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Delete failed")
      }
      toast.success("Permanently deleted")
      await loadDeleted()
      await onRestored()
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const permanentDeleteCards = async (cardIds: number[]) => {
    if (!confirm("Permanently delete selected cards? This cannot be undone.")) return
    try {
      const res = await instructorApiFetch("/api/instructor/flashcards/deleted", {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ cardIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Delete failed")
      }
      toast.success("Permanently deleted")
      await loadDeleted()
      await onRestored()
    } catch (err: unknown) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const isEmpty = !loading && decks.length === 0 && cards.length === 0
  const shownCount = filteredDecks.length + filteredCards.length

  return (
    <div className="space-y-3 min-w-0">
      <FacultyIntegratedToolbar
        moduleId="flashcards"
        search={search}
        onSearchChange={setSearch}
        onSearchClear={() => setSearch("")}
        searchPlaceholder="Search deleted items…"
        filters={
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className={facultyToolbarSelectTriggerClass(typeFilter !== "all")}>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="decks">Decks only</SelectItem>
              <SelectItem value="cards">Cards only</SelectItem>
            </SelectContent>
          </Select>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {shownCount} in trash
            {search.trim() && shownCount !== decks.length + cards.length
              ? ` · ${decks.length + cards.length} total`
              : ""}
          </p>
        }
      />

      {loading ? (
        <div className={cn(PORTAL_CARD, "flex min-h-[200px] items-center justify-center")}>
          <Loader2 className="h-6 w-6 animate-spin text-red-500" />
        </div>
      ) : isEmpty ? (
        <div className={cn(PORTAL_CARD, "px-4 py-10 text-center text-sm text-muted-foreground")}>
          No deleted flashcards.
        </div>
      ) : shownCount === 0 ? (
        <div className={cn(PORTAL_CARD, "px-4 py-10 text-center text-sm text-muted-foreground")}>
          No deleted items match your search.
        </div>
      ) : (
        <div className={cn(PORTAL_CARD, "p-4 sm:p-5 space-y-5")}>
          {filteredDecks.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decks</h3>
              {filteredDecks.map((deck) => (
                <div
                  key={deck.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200/50 bg-red-50/30 px-3 py-2.5 dark:border-red-500/20 dark:bg-red-500/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{deck.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {deck.topic ? (
                        <Badge variant="outline" className="text-[10px]">
                          {deck.topic}
                        </Badge>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground">{deck.cardCount} cards</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => void restoreDecks([deck.id])}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-600 hover:text-red-700"
                      onClick={() => void permanentDeleteDecks([deck.id])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {filteredCards.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cards</h3>
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 grid sm:grid-cols-2 gap-2 text-sm">
                    <p className="font-medium truncate">{card.frontText}</p>
                    <p className="text-muted-foreground truncate">{card.backText}</p>
                    <p className="sm:col-span-2 text-[10px] text-muted-foreground">
                      {card.deckTitle}
                      {card.deckTopic ? ` · ${card.deckTopic}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => void restoreCards([card.id])}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-600 hover:text-red-700"
                      onClick={() => void permanentDeleteCards([card.id])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
