"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Layers } from "lucide-react"
import { FlashcardsHome } from "@/components/student/flashcards/flashcards-home"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"

type Props = {
  /** dashboard-v2 uses CardWrapper; legacy uses shadcn Card */
  variant?: "dashboard-v2" | "legacy"
  /** Topic search from Practice Hub (filters deck title/topic/description) */
  searchQuery?: string
}

function FlashcardsSectionBody({
  variant,
  searchQuery = "",
}: {
  variant: "dashboard-v2" | "legacy"
  searchQuery?: string
}) {
  const router = useRouter()

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3
          className={
            variant === "legacy"
              ? "text-base sm:text-lg font-semibold flex items-center gap-2 dark:text-slate-200"
              : "font-semibold text-[var(--cc-text)] flex items-center gap-2"
          }
        >
          <Layers
            className={
              variant === "legacy"
                ? "h-4 w-4 sm:h-5 sm:w-5 text-[var(--cc-accent-dark)] shrink-0"
                : "h-4 w-4 text-[var(--cc-accent-dark)]"
            }
          />
          Flashcard decks
        </h3>
        <p
          className={
            variant === "legacy"
              ? "text-xs sm:text-sm text-muted-foreground dark:text-slate-400 mt-0.5"
              : "text-sm text-[var(--cc-text-muted)] mt-0.5"
          }
        >
          Course decks your instructor flagged for Practice Hub
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className={variant === "legacy" ? "rounded-full shrink-0" : "rounded-xl shrink-0"}
        onClick={() => router.push("/student/dashboard-v2/flashcards")}
      >
        All flashcards
      </Button>
    </div>
  )

  if (variant === "legacy") {
    return (
      <Card className="shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <CardHeader className="p-4 sm:p-6 pb-2 space-y-0">{header}</CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2">
          <FlashcardsHome practiceHubOnly embedded externalSearch={searchQuery} />
        </CardContent>
      </Card>
    )
  }

  return (
    <CardWrapper variant="inner" delay={0.25}>
      <div className="p-6 space-y-4">
        {header}
        <FlashcardsHome practiceHubOnly embedded />
      </div>
    </CardWrapper>
  )
}

export function PracticeHubFlashcardsSection({
  variant = "dashboard-v2",
  searchQuery = "",
}: Props) {
  return <FlashcardsSectionBody variant={variant} searchQuery={searchQuery} />
}
