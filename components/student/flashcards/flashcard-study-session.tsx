"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import confetti from "canvas-confetti"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import type { FlashcardCard, FlashcardDeck } from "@/lib/flashcards"
import {
  FLASHCARD_BOSS_BONUS,
  FLASHCARD_TIMED_BONUS,
  FLASHCARD_TIMED_SECONDS,
  resolveFlashcardLevel,
  type FlashcardStudyMode,
} from "@/lib/flashcard-gamification"
import { ENGAGEMENT_POINTS } from "@/lib/engagement-points-system"
import { buildFlashcardMcq, canUseFlashcardMcq, gradeFlashcardMcqChoice, type FlashcardMcq } from "@/lib/flashcard-quiz"
import {
  DEFAULT_FLASHCARD_BATCH_SIZE,
  splitFlashcardBatches,
  usesFlashcardBatchQuiz,
  type FlashcardBatchStudyPhase,
} from "@/lib/flashcard-batch-study"
import { WaterBreakDurationDialog, WaterBreakOverlay } from "@/components/quiz-water-break"
import { FlashcardMcqPanel } from "@/components/flashcards/flashcard-mcq-ui"
import { FlashcardWabiCard } from "@/components/student/flashcards/FlashcardWabiCard"
import {
  FlashcardAwardCelebration,
  useFlashcardAwardQueue,
} from "@/components/flashcards/flashcard-award-celebration"
import { FlashcardKnownCelebration, type FlashcardCelebrationPayload } from "@/components/student/flashcards/FlashcardKnownCelebration"
import {
  buildFlashcardAward,
  levelUpAward,
  shouldCelebrateDailyGoal,
} from "@/lib/flashcard-awards"
import { invalidateFlashcardMasteryCache } from "@/components/student/flashcards/use-flashcard-deck-mastery"
import { cn } from "@/lib/utils"
import {
  Lock,
  ArrowLeft,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  ListChecks,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Timer,
  Trophy,
  X,
  Zap,
  Crown,
} from "lucide-react"
import { toast } from "@/lib/app-toast"
import { useFlashcardChrome } from "@/hooks/use-flashcard-chrome"
import { FlashcardTierAccessBanner } from "@/components/student/flashcards/FlashcardTierAccessBanner"
import type { FlashcardTierAccessClient } from "@/lib/flashcard-study-policy"

function shuffleCards(cards: FlashcardCard[]): FlashcardCard[] {
  const copy = [...cards]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function burstConfetti() {
  const end = Date.now() + 700
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: ["#f59e0b", "#8b5cf6", "#10b981", "#3b82f6"],
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: ["#f59e0b", "#8b5cf6", "#10b981", "#3b82f6"],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

function estimateKnownPoints(
  streak: number,
  firstInSession: boolean,
  bonusType?: "timed" | "boss",
): number {
  if (!firstInSession) return 0
  let points = ENGAGEMENT_POINTS.flashcardKnownPoints
  if (streak > 0 && streak % ENGAGEMENT_POINTS.flashcardStreakBonusEvery === 0) {
    points += ENGAGEMENT_POINTS.flashcardStreakBonusPoints
  }
  if (bonusType === "timed") points += FLASHCARD_TIMED_BONUS
  if (bonusType === "boss") points += FLASHCARD_BOSS_BONUS
  return points
}

function buildCelebrationPayload(
  data: {
    pointsEarned: number
    streakBonus?: number
    firstKnownThisWeek?: boolean
  },
  streak: number,
  bonusType?: "timed" | "boss",
): FlashcardCelebrationPayload {
  return {
    pointsEarned: data.pointsEarned,
    streakBonus: data.streakBonus ?? 0,
    streak,
    bonusType,
    firstKnownThisWeek: data.firstKnownThisWeek,
  }
}

type DeckStudySettings = {
  tierAccess: FlashcardTierAccessClient
  totalCards: number
  unlockedCards: number
}

type Props = {
  deckId: number
}

export function FlashcardStudySession({ deckId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const previewQuiz = searchParams.get("previewQuiz") === "1"
  const { study: SWATCH } = useFlashcardChrome()
  const sessionIdRef = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : `fc-${Date.now()}`)

  const [loading, setLoading] = useState(true)
  const [deck, setDeck] = useState<FlashcardDeck | null>(null)
  const [studySettings, setStudySettings] = useState<DeckStudySettings | null>(null)
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [queue, setQueue] = useState<FlashcardCard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionMastered, setSessionMastered] = useState<Set<number>>(new Set())
  const [priorMastered, setPriorMastered] = useState<Set<number>>(new Set())
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [sessionXp, setSessionXp] = useState(0)
  const [finished, setFinished] = useState(false)
  const [celebration, setCelebration] = useState<FlashcardCelebrationPayload | null>(null)
  const [xpPulseKey, setXpPulseKey] = useState(0)
  const [answerLocked, setAnswerLocked] = useState(false)
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null)
  const [immersive, setImmersive] = useState(false)
  const [studyMode, setStudyMode] = useState<FlashcardStudyMode>("normal")
  const [mcqFeedback, setMcqFeedback] = useState<"correct" | "incorrect" | null>(null)
  const [selectedMcqChoiceId, setSelectedMcqChoiceId] = useState<string | null>(null)
  const [mcqLocked, setMcqLocked] = useState(false)
  const [cardTimer, setCardTimer] = useState(FLASHCARD_TIMED_SECONDS)
  const [totalMasteredAtStart, setTotalMasteredAtStart] = useState(0)
  const [dailyProgressAtStart, setDailyProgressAtStart] = useState(0)
  const [batchIndex, setBatchIndex] = useState(0)
  const [studyPhase, setStudyPhase] = useState<FlashcardBatchStudyPhase>("learn")
  const [learnIndex, setLearnIndex] = useState(0)
  const [quizIndex, setQuizIndex] = useState(0)
  const [waterBreakPickerOpen, setWaterBreakPickerOpen] = useState(false)
  const [waterBreakSeconds, setWaterBreakSeconds] = useState(0)

  const { activeAward, pushAward, dismissAward, resetAwards } = useFlashcardAwardQueue()

  const recordStudy = useCallback(
    async (payload: {
      cardId?: number
      outcome: "known" | "learning" | "session_complete"
      streak?: number
      bonusType?: "timed" | "boss"
    }) => {
      try {
        const res = await studentApiFetch(`/api/student/flashcards/decks/${deckId}/study`, {
          method: "POST",
          headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            sessionId: sessionIdRef.current,
          }),
        })
        const data = await res.json()
        if (!res.ok) return null
        if (data.pointsEarned > 0) {
          setSessionXp((x) => x + data.pointsEarned)
          setXpPulseKey((k) => k + 1)
        }
        return data
      } catch {
        return null
      }
    },
    [deckId],
  )

  const resetBatchStudy = useCallback(() => {
    setBatchIndex(0)
    setStudyPhase("learn")
    setLearnIndex(0)
    setQuizIndex(0)
    setWaterBreakPickerOpen(false)
    setWaterBreakSeconds(0)
  }, [])

  const loadDeck = useCallback(async (signal?: AbortSignal) => {
    const fetchDeck = async () => {
      const headers = getStudentAuthHeaders()
      return Promise.all([
        studentApiFetch(`/api/student/flashcards/decks/${deckId}`, { headers, signal }),
        studentApiFetch(`/api/student/flashcards/decks/${deckId}/study`, { headers, signal }),
        studentApiFetch(`/api/student/flashcards/gamification`, { headers, signal }),
      ])
    }

    setLoading(true)
    try {
      let [deckRes, progressRes, profileRes] = await fetchDeck()
      if (!deckRes.ok && deckRes.status >= 500 && !signal?.aborted) {
        ;[deckRes, progressRes, profileRes] = await fetchDeck()
      }
      if (signal?.aborted) return

      const data = await deckRes.json()
      if (!deckRes.ok) throw new Error(data.error || "Failed to load deck")

      const loadedCards = (data.cards || []) as FlashcardCard[]
      const settings = data.studySettings as DeckStudySettings | undefined
      setDeck(data.deck)
      setStudySettings(
        settings?.tierAccess
          ? {
              tierAccess: settings.tierAccess,
              totalCards: Number(settings.totalCards) || loadedCards.length,
              unlockedCards: Number(settings.unlockedCards) || loadedCards.length,
            }
          : null,
      )
      setCards(loadedCards)
      setQueue(loadedCards)
      setIndex(0)
      setFlipped(false)
      setStreak(0)
      setBestStreak(0)
      setSessionXp(0)
      setFinished(false)
      setCelebration(null)
      resetBatchStudy()
      resetAwards()
      if (previewQuiz && usesFlashcardBatchQuiz(data.deck?.requireMcqValidation !== false, loadedCards.length)) {
        setStudyPhase("batch_quiz")
        setBatchIndex(0)
        setQuizIndex(0)
      }
      if (data.deck?.requireMcqValidation === false) {
        setStudyMode((m) => (m === "quiz" ? "normal" : m))
      }
      sessionIdRef.current = crypto.randomUUID()

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setTotalMasteredAtStart(Number(profileData.profile?.totalMastered) || 0)
        setDailyProgressAtStart(Number(profileData.profile?.dailyProgress) || 0)
      }

      if (progressRes.ok) {
        const progress = await progressRes.json()
        const ids = new Set<number>((progress.masteredCardIds || []) as number[])
        setPriorMastered(ids)
        setSessionMastered(new Set())
      }
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return
      toast.error("Could not load flashcards", {
        description: err instanceof Error ? err.message : undefined,
      })
      router.push("/student/dashboard-v2/flashcards")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [deckId, router, resetBatchStudy, resetAwards, previewQuiz])

  useEffect(() => {
    const ac = new AbortController()
    void loadDeck(ac.signal)
    return () => ac.abort()
  }, [loadDeck])

  const batches = useMemo(
    () => splitFlashcardBatches(cards, deck?.cardsBeforeQuiz ?? DEFAULT_FLASHCARD_BATCH_SIZE),
    [cards, deck?.cardsBeforeQuiz],
  )
  const batchMode =
    deck != null && usesFlashcardBatchQuiz(deck.requireMcqValidation !== false, cards.length)
  const currentBatch = batchMode ? (batches[batchIndex] ?? []) : []

  const current = batchMode
    ? studyPhase === "batch_quiz"
      ? currentBatch[quizIndex]
      : studyPhase === "learn"
        ? currentBatch[learnIndex]
        : undefined
    : queue[index]

  const cardPositionIndex = batchMode
    ? studyPhase === "batch_quiz"
      ? quizIndex
      : learnIndex
    : index
  const cardPositionTotal = batchMode ? currentBatch.length : queue.length

  const beginBatchQuiz = useCallback(() => {
    setStudyPhase("batch_quiz")
    setQuizIndex(0)
    setFlipped(false)
    setMcqFeedback(null)
    setMcqLocked(false)
  }, [])

  const totalCards = cards.length
  const inlineMcqEnabled =
    !batchMode && deck?.requireMcqValidation !== false && canUseFlashcardMcq(cards)
  const batchQuizActive = batchMode && studyPhase === "batch_quiz"
  const mcqEnabled = inlineMcqEnabled || batchQuizActive
  const currentMcq = useMemo((): FlashcardMcq | null => {
    if (!current || !mcqEnabled) return null
    return buildFlashcardMcq(current, cards)
  }, [cards, current, mcqEnabled])

  useEffect(() => {
    setMcqFeedback(null)
    setMcqLocked(false)
    setSelectedMcqChoiceId(null)
  }, [current?.id, cardPositionIndex, studyPhase])

  const allMasteredCount = new Set([...priorMastered, ...sessionMastered]).size
  const cardsLeft = finished
    ? 0
    : batchMode
      ? Math.max(
          0,
          totalCards -
            batches.slice(0, batchIndex).reduce((sum, batch) => sum + batch.length, 0) -
            (studyPhase === "learn"
              ? learnIndex
              : studyPhase === "batch_quiz"
                ? quizIndex
                : currentBatch.length),
        )
      : queue.length
  const progressPct = totalCards > 0 ? Math.round((allMasteredCount / totalCards) * 100) : 0

  const tierBlocked =
    !finished &&
    cards.length === 0 &&
    (studySettings?.totalCards ?? 0) > 0 &&
    studySettings?.tierAccess != null &&
    !studySettings.tierAccess.canStudyCourseDeck
  const deckEmpty =
    !finished && cards.length === 0 && !tierBlocked && (studySettings?.totalCards ?? 0) === 0

  const isBossCard = !batchMode && !finished && !tierBlocked && !deckEmpty && queue.length === 1 && current != null

  const restart = (shuffled = false) => {
    const next = shuffled ? shuffleCards(cards) : [...cards]
    setQueue(next)
    setIndex(0)
    setFlipped(false)
    setStreak(0)
    setSessionMastered(new Set())
    setCardTimer(FLASHCARD_TIMED_SECONDS)
    setFinished(false)
    setCelebration(null)
    resetBatchStudy()
    resetAwards()
    sessionIdRef.current = crypto.randomUUID()
  }

  const finishSession = useCallback(async (masteredThisSession?: number) => {
    setFinished(true)
    burstConfetti()
    invalidateFlashcardMasteryCache()
    const result = await recordStudy({ outcome: "session_complete" })
    const sessionCount = masteredThisSession ?? sessionMastered.size
    const newTotal = totalMasteredAtStart + sessionCount
    const oldLevel = resolveFlashcardLevel(totalMasteredAtStart)
    const newLevel = resolveFlashcardLevel(newTotal)
    if (result?.sessionCompleteBonus) {
      pushAward(
        buildFlashcardAward("deck_cleared", {
          subtitle: `+${result.pointsEarned} engagement points toward Trade Center`,
          xp: result.pointsEarned,
        }),
        { oncePerSession: true },
      )
    }
    if (newLevel.level > oldLevel.level) {
      pushAward(levelUpAward(newLevel), { oncePerSession: true })
    }
    if (shouldCelebrateDailyGoal(dailyProgressAtStart, sessionCount)) {
      pushAward(buildFlashcardAward("daily_goal"), { oncePerSession: true })
    }
  }, [
    recordStudy,
    sessionMastered.size,
    totalMasteredAtStart,
    dailyProgressAtStart,
    pushAward,
  ])

  const startNextBatchOrFinish = useCallback(
    async (masteredCount: number) => {
      const nextBatch = batchIndex + 1
      if (nextBatch >= batches.length) {
        await finishSession(masteredCount)
        return
      }
      setBatchIndex(nextBatch)
      setLearnIndex(0)
      setQuizIndex(0)
      setStudyPhase("learn")
      setFlipped(false)
      setExitDirection(null)
    },
    [batchIndex, batches.length, finishSession],
  )

  const completeLearnBatch = useCallback(() => {
    setFlipped(false)
    setExitDirection(null)
    setStudyPhase("water_break_picker")
    setWaterBreakPickerOpen(true)
  }, [])

  const advanceBatchQuiz = useCallback(
    async (correct: boolean) => {
      if (!current || !currentBatch.length || answerLocked) return
      setAnswerLocked(true)
      let masteredDelta = 0
      try {
        if (correct) {
          const nextStreak = streak + 1
          const firstInSession = !sessionMastered.has(current.id)
          const optimistic = estimateKnownPoints(nextStreak, firstInSession)
          if (optimistic > 0) {
            setCelebration(buildCelebrationPayload({ pointsEarned: optimistic }, nextStreak))
          }
          setStreak(nextStreak)
          setBestStreak((b) => Math.max(b, nextStreak))
          if (firstInSession) masteredDelta = 1
          setSessionMastered((prev) => new Set(prev).add(current.id))

          const nextQuiz = quizIndex + 1
          setMcqFeedback(null)
          setMcqLocked(false)
          setFlipped(false)
          if (nextQuiz >= currentBatch.length) {
            void recordStudy({
              cardId: current.id,
              outcome: "known",
              streak: nextStreak,
            }).then(async (data) => {
              const earned = data?.pointsEarned ?? 0
              if (earned > 0 && data) {
                setCelebration(buildCelebrationPayload(data, nextStreak))
              } else {
                setCelebration(null)
              }
            })
            pushAward(buildFlashcardAward("batch_quiz_cleared"))
            await startNextBatchOrFinish(sessionMastered.size + masteredDelta)
          } else {
            setQuizIndex(nextQuiz)
            void recordStudy({
              cardId: current.id,
              outcome: "known",
              streak: nextStreak,
            }).then((data) => {
              const earned = data?.pointsEarned ?? 0
              if (earned > 0 && data) {
                setCelebration(buildCelebrationPayload(data, nextStreak))
              } else {
                setCelebration(null)
              }
            })
          }
        } else {
          setStreak(0)
          setExitDirection("left")
          void recordStudy({ cardId: current.id, outcome: "learning" })
          const nextQuiz = quizIndex + 1
          setMcqFeedback(null)
          setMcqLocked(false)
          setFlipped(false)
          if (nextQuiz >= currentBatch.length) {
            pushAward(buildFlashcardAward("batch_quiz_cleared"))
            await startNextBatchOrFinish(sessionMastered.size + masteredDelta)
          } else {
            setQuizIndex(nextQuiz)
          }
        }
      } finally {
        setAnswerLocked(false)
        setExitDirection(null)
      }
    },
    [
      answerLocked,
      current,
      currentBatch.length,
      quizIndex,
      recordStudy,
      sessionMastered,
      streak,
      startNextBatchOrFinish,
      pushAward,
    ],
  )

  const advanceLearnBatch = useCallback(
    async (known: boolean) => {
      if (!current || !currentBatch.length || answerLocked) return
      setAnswerLocked(true)
      setExitDirection(known ? "right" : "left")
      try {
        if (known) {
          const nextStreak = streak + 1
          const firstInSession = !sessionMastered.has(current.id)
          const optimistic = estimateKnownPoints(nextStreak, firstInSession)
          if (optimistic > 0) {
            setCelebration(buildCelebrationPayload({ pointsEarned: optimistic }, nextStreak))
          }
          setStreak(nextStreak)
          setBestStreak((b) => Math.max(b, nextStreak))
          setSessionMastered((prev) => new Set(prev).add(current.id))
          const nextLearn = learnIndex + 1
          setFlipped(false)
          if (nextLearn >= currentBatch.length) {
            completeLearnBatch()
          } else {
            setLearnIndex(nextLearn)
          }
          void recordStudy({
            cardId: current.id,
            outcome: "known",
            streak: nextStreak,
          }).then((data) => {
            const earned = data?.pointsEarned ?? 0
            if (earned > 0 && data) {
              setCelebration(buildCelebrationPayload(data, nextStreak))
            } else {
              setCelebration(null)
            }
          })
        } else {
          setStreak(0)
          void recordStudy({ cardId: current.id, outcome: "learning" })
          const nextLearn = learnIndex + 1
          setFlipped(false)
          if (nextLearn >= currentBatch.length) {
            completeLearnBatch()
          } else {
            setLearnIndex(nextLearn)
          }
        }
      } finally {
        setAnswerLocked(false)
        setExitDirection(null)
      }
    },
    [answerLocked, completeLearnBatch, current, currentBatch.length, learnIndex, recordStudy, streak],
  )

  const goToIndex = (nextIndex: number) => {
    if (batchMode) {
      if (studyPhase !== "learn") return
      if (nextIndex < 0 || nextIndex >= currentBatch.length) return
      setFlipped(false)
      setLearnIndex(nextIndex)
      return
    }
    if (nextIndex < 0 || nextIndex >= queue.length) return
    setFlipped(false)
    setIndex(nextIndex)
  }

  const advance = async (known: boolean) => {
    if (!current || answerLocked) return
    if (batchMode && studyPhase === "learn") {
      await advanceLearnBatch(known)
      return
    }

    setAnswerLocked(true)
    setExitDirection(known ? "right" : "left")

    try {
      if (known) {
        const nextStreak = streak + 1
        const firstInSession = !sessionMastered.has(current.id)
        const isBoss = queue.length === 1
        const timedBonus = studyMode === "timed" && cardTimer > 0
        const bonusType = isBoss ? "boss" : timedBonus ? "timed" : undefined
        const optimistic = estimateKnownPoints(nextStreak, firstInSession, bonusType)
        if (optimistic > 0) {
          setCelebration(buildCelebrationPayload({ pointsEarned: optimistic }, nextStreak, bonusType))
        }

        setSessionMastered((prev) => new Set(prev).add(current.id))
        setStreak(nextStreak)
        setBestStreak((b) => Math.max(b, nextStreak))

        const newQueue = queue.filter((_, i) => i !== index)
        setQueue(newQueue)
        setFlipped(false)
        setCardTimer(FLASHCARD_TIMED_SECONDS)
        if (index >= newQueue.length && newQueue.length > 0) {
          setIndex(newQueue.length - 1)
        }

        const studyPromise = recordStudy({
          cardId: current.id,
          outcome: "known",
          streak: nextStreak,
          bonusType,
        })
        void studyPromise.then((data) => {
          const earned = data?.pointsEarned ?? 0
          if (earned > 0 && data) {
            setCelebration(buildCelebrationPayload(data, nextStreak, bonusType))
          } else {
            setCelebration(null)
          }
        })

        if (newQueue.length === 0) {
          await studyPromise
          await finishSession(sessionMastered.size + 1)
        }
      } else {
        setStreak(0)
        void recordStudy({ cardId: current.id, outcome: "learning" })
        const card = queue[index]
        const newQueue = [...queue.slice(0, index), ...queue.slice(index + 1), card]
        setQueue(newQueue)
        setFlipped(false)
        setCardTimer(FLASHCARD_TIMED_SECONDS)
        if (index >= newQueue.length) setIndex(Math.max(0, newQueue.length - 1))
      }
    } finally {
      setAnswerLocked(false)
      setExitDirection(null)
    }
  }

  const handleMcqAnswer = useCallback(
    (choiceId: string) => {
      if (mcqLocked || !currentMcq) return
      const choice = currentMcq.choices.find((c) => c.id === choiceId)
      if (!choice) return
      const isCorrect = gradeFlashcardMcqChoice(choice)
      setSelectedMcqChoiceId(choiceId)
      setMcqLocked(true)
      setMcqFeedback(isCorrect ? "correct" : "incorrect")
      window.setTimeout(() => {
        if (batchQuizActive) {
          void advanceBatchQuiz(isCorrect)
        } else {
          void advance(isCorrect)
        }
      }, isCorrect ? 280 : 900)
    },
    [advance, advanceBatchQuiz, batchQuizActive, currentMcq, mcqLocked],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || !current) return
      if (currentMcq && !mcqLocked) {
        const num = Number(e.key)
        if (num >= 1 && num <= currentMcq.choices.length) {
          e.preventDefault()
          handleMcqAnswer(currentMcq.choices[num - 1].id)
          return
        }
      }
      if (studyMode === "quiz" && !batchMode) return
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        setFlipped((f) => !f)
      }
      if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault()
        if (flipped && !currentMcq) void advance(false)
      }
      if (e.key === "ArrowRight" || e.key === "2") {
        e.preventDefault()
        if (flipped && !currentMcq) void advance(true)
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        goToIndex(index - 1)
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        goToIndex(index + 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    finished,
    current,
    currentMcq,
    mcqLocked,
    studyMode,
    flipped,
    index,
    queue.length,
    advance,
    goToIndex,
    handleMcqAnswer,
  ])

  useEffect(() => {
    if (finished || !current || studyMode !== "timed") return
    setCardTimer(FLASHCARD_TIMED_SECONDS)
  }, [current?.id, index, studyMode, finished, current])

  useEffect(() => {
    if (finished || !current || studyMode !== "timed") return
    const id = window.setInterval(() => {
      setCardTimer((t) => (t <= 1 ? 0 : t - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [current?.id, index, studyMode, finished, current])

  const backLabel = useMemo(
    () => (deck?.deckKind === "course" ? "Flashcards" : "My decks"),
    [deck?.deckKind],
  )

  useEffect(() => {
    if (!immersive) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.body.dataset.flashcardFocus = "true"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersive(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      delete document.body.dataset.flashcardFocus
      window.removeEventListener("keydown", onKey)
    }
  }, [immersive])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  if (!deck) return null

  const cardPositionLabel = `${cardPositionIndex + 1}/${cardPositionTotal}`
  const batchStatusLabel =
    batchMode && !finished
      ? studyPhase === "learn"
        ? `Batch ${batchIndex + 1}/${batches.length} · Learn ${cardPositionLabel}`
        : studyPhase === "batch_quiz"
          ? `Batch ${batchIndex + 1}/${batches.length} · Quiz ${cardPositionLabel}`
          : `Batch ${batchIndex + 1}/${batches.length} · Water break`
      : null

  const waterBreakUi = (
    <>
      <WaterBreakDurationDialog
        open={waterBreakPickerOpen}
        onOpenChange={(open) => {
          setWaterBreakPickerOpen(open)
          if (!open && studyPhase === "water_break_picker") {
            beginBatchQuiz()
          }
        }}
        description="Step away and hydrate before your batch quiz. You can skip anytime."
        skipLabel="Skip break"
        onStart={(minutes) => {
          setWaterBreakPickerOpen(false)
          setWaterBreakSeconds(minutes * 60)
          setStudyPhase("water_break")
        }}
      />
      {studyPhase === "water_break" ? (
        <WaterBreakOverlay
          totalSeconds={waterBreakSeconds}
          onResume={beginBatchQuiz}
          resumeLabel="Continue to quiz"
          activeHint="Take a breather — batch quiz questions are up next."
          completeHint="Ready for your batch quiz?"
          skipEarlyLabel="Skip break and start quiz"
        />
      ) : null}
    </>
  )

  const renderStudyBody = (focus: boolean) => (
    <>
      {batchStatusLabel && !focus ? (
        <p className="text-center text-sm font-medium text-[var(--cc-text-muted)]">
          {batchStatusLabel}
        </p>
      ) : null}
      {batchStatusLabel && focus ? (
        <p className="text-center text-xs font-medium uppercase tracking-wider text-cyan-200/80">
          {batchStatusLabel}
        </p>
      ) : null}
      {tierBlocked && studySettings?.tierAccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "rounded-2xl border p-6 text-center shadow-sm",
            focus
              ? "border-white/10 bg-white/5 text-white"
              : "border-[var(--border)] bg-[var(--card)]",
          )}
        >
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
              focus ? "bg-white/10 text-white/80" : "bg-[var(--muted)] text-[var(--cc-text-muted)]",
            )}
          >
            <Lock className="h-7 w-7" />
          </div>
          <h2 className={cn("mt-4 text-xl font-bold", focus ? "text-white" : "text-[var(--cc-text)]")}>
            Course deck locked
          </h2>
          <p className={cn("mt-1 text-sm", focus ? "text-white/60" : "text-[var(--cc-text-muted)]")}>
            This deck has {studySettings.totalCards} cards, but none are unlocked on your current membership.
          </p>
          {!focus ? (
            <>
              <FlashcardTierAccessBanner tierAccess={studySettings.tierAccess} className="mt-5 text-left" />
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button variant="outline" asChild className="h-10 rounded-full border-0 bg-[var(--muted)]/70">
                  <Link href="/student/dashboard-v2/flashcards">Back to decks</Link>
                </Button>
              </div>
            </>
          ) : null}
        </motion.div>
      ) : deckEmpty ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "rounded-2xl border p-6 text-center shadow-sm",
            focus
              ? "border-white/10 bg-white/5 text-white"
              : "border-[var(--border)] bg-[var(--card)]",
          )}
        >
          <h2 className={cn("text-xl font-bold", focus ? "text-white" : "text-[var(--cc-text)]")}>
            No cards yet
          </h2>
          <p className={cn("mt-1 text-sm", focus ? "text-white/60" : "text-[var(--cc-text-muted)]")}>
            Add flashcards to this deck before studying.
          </p>
          {!focus ? (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" asChild className="h-10 rounded-full border-0 bg-[var(--muted)]/70">
                <Link href="/student/dashboard-v2/flashcards">Back to decks</Link>
              </Button>
            </div>
          ) : null}
        </motion.div>
      ) : finished ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "rounded-2xl border p-6 text-center shadow-sm",
            focus
              ? "border-white/10 bg-white/5 text-white"
              : "border-[var(--border)] bg-[var(--card)]",
          )}
        >
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
              focus ? "bg-emerald-500/20 text-emerald-200" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            )}
          >
            <Trophy className="h-7 w-7" />
          </div>
          <h2 className={cn("mt-4 text-xl font-bold", focus ? "text-white" : "text-[var(--cc-text)]")}>
            Deck cleared!
          </h2>
          <p className={cn("mt-1 text-sm", focus ? "text-white/60" : "text-[var(--cc-text-muted)]")}>
            You mastered {sessionMastered.size} card{sessionMastered.size !== 1 ? "s" : ""} this round
            {priorMastered.size > 0 ? ` · ${priorMastered.size} already learned before` : ""}.
          </p>
          {!focus ? (
            <>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                  +{sessionXp} XP earned
                </span>
                {bestStreak >= 3 ? (
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 font-semibold text-rose-700 dark:text-rose-300">
                    Best streak: {bestStreak}
                  </span>
                ) : null}
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={() => restart(true)} className="h-10 gap-2 rounded-full bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-dark)]">
                  <Shuffle className="h-4 w-4" strokeWidth={1.75} />
                  Shuffle &amp; play again
                </Button>
                <Button variant="outline" asChild className="h-10 rounded-full border-0 bg-[var(--muted)]/70">
                  <Link href="/student/dashboard-v2/flashcards">Back to decks</Link>
                </Button>
                <Button variant="outline" asChild className="h-10 rounded-full border-0 bg-[var(--muted)]/70">
                  <Link href="/student/dashboard-v2/trade-center">Trade Center</Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => restart(true)}
                className="gap-2 bg-white/10 text-white hover:bg-white/15"
              >
                <Shuffle className="h-4 w-4" />
                Play again
              </Button>
              <Button
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={() => setImmersive(false)}
              >
                Exit focus
              </Button>
            </div>
          )}
        </motion.div>
      ) : current ? (
        <>
          {!focus && isBossCard ? (
            <div className="flex items-center justify-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-4 py-2 text-sm font-semibold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              <Crown className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              Boss card — master it for +3 bonus XP
            </div>
          ) : null}
          <div
            className={cn(
              "relative mx-auto w-full max-w-[560px]",
              currentMcq ? "" : "min-h-[380px] sm:min-h-[440px]",
            )}
          >
          {currentMcq ? (
            <FlashcardMcqPanel
              mcq={currentMcq}
              badge={`${batchQuizActive || studyMode === "quiz" ? "Quiz" : "Check"} · ${cardPositionLabel}`}
              variant={batchQuizActive || studyMode === "quiz" ? "quiz" : "check"}
              focus={focus}
              feedback={mcqFeedback}
              selectedChoiceId={selectedMcqChoiceId}
              locked={mcqLocked}
              onSelect={handleMcqAnswer}
              hint={
                focus
                  ? undefined
                  : batchQuizActive
                    ? "Answer each question to earn engagement points"
                    : studyMode === "quiz"
                      ? "Quiz mode — wrong answers send the card back into your queue"
                      : "Answer the check question to prove you know this card"
              }
            />
          ) : (
            <div className="relative h-full w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${current.id}-${cardPositionIndex}`}
                  initial={{ opacity: 0, x: exitDirection === "left" ? -40 : exitDirection === "right" ? 40 : 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{
                    opacity: 0,
                    x: exitDirection === "left" ? -120 : exitDirection === "right" ? 120 : 0,
                    rotate: exitDirection === "left" ? -6 : exitDirection === "right" ? 6 : 0,
                  }}
                  transition={{ duration: 0.22 }}
                  className="w-full"
                >
                  <FlashcardWabiCard
                    frontText={current.frontText}
                    backText={current.backText}
                    flipped={flipped}
                    onFlip={() => setFlipped((f) => !f)}
                    difficulty={current.difficulty}
                    badge={
                      <span className="inline-flex items-center gap-1">
                        {isBossCard ? <Crown className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                        {isBossCard ? "Boss · " : ""}Question · {cardPositionLabel}
                      </span>
                    }
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
          {celebration ? (
            <FlashcardKnownCelebration
              payload={celebration}
              onComplete={() => setCelebration(null)}
              focus={focus}
              accent={SWATCH.mango}
            />
          ) : null}
        </div>

          {!currentMcq ? (
          <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-3">
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={studySolidStyle(focus ? "rgba(255,255,255,0.16)" : SWATCH.magenta)}
              onClick={() => void advance(false)}
              disabled={!flipped || answerLocked}
            >
              <X className="h-4 w-4" fill="currentColor" strokeWidth={2} />
              Still learning
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={studySolidStyle(focus ? "#10B981" : SWATCH.mango)}
              onClick={() => void advance(true)}
              disabled={!flipped || answerLocked}
            >
              <Check className="h-4 w-4" fill="currentColor" strokeWidth={2} />
              Know it
            </button>
          </div>
          ) : null}
          {!currentMcq && !flipped && !focus ? (
            <p className="text-center text-xs text-[var(--cc-text-muted)]">Flip the card first, then rate yourself</p>
          ) : null}
        </>
      ) : null}
    </>
  )

  const studyUi = (
    <>
      {previewQuiz ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/90 px-3 py-2 text-center text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
          Quiz preview mode — add <code className="font-mono">?previewQuiz=1</code> to skip the learn batch. Remove the param for normal study.
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/student/dashboard-v2/flashcards"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text-muted)] transition-colors hover:text-[var(--cc-text)]"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-[var(--cc-text)] sm:text-base">{deck.title}</h1>
            {batchStatusLabel ? (
              <p className="mt-0.5 truncate text-[11px] text-[var(--cc-text-muted)]">{batchStatusLabel}</p>
            ) : deck.description ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--cc-text-muted)]">{deck.description}</p>
            ) : null}
          </div>

          <motion.div
            key={xpPulseKey}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/40 px-2.5 text-xs font-bold tabular-nums text-[var(--cc-text)]"
          >
            <Zap className="h-3.5 w-3.5 text-[var(--cc-accent)]" fill="currentColor" strokeWidth={1.75} />
            {sessionXp}
          </motion.div>

          <div
            className="flex w-full shrink-0 items-center justify-end gap-0.5 rounded-full border border-[var(--border)] bg-[var(--muted)]/30 p-0.5 sm:ml-0 sm:w-auto"
            role="toolbar"
            aria-label="Study options"
          >
            {inlineMcqEnabled ? (
              <StudyToolbarButton
                icon={ListChecks}
                label="Quiz mode"
                active={studyMode === "quiz"}
                onClick={() => {
                  setStudyMode((m) => (m === "quiz" ? "normal" : "quiz"))
                  setFlipped(false)
                }}
              />
            ) : null}
            <StudyToolbarButton
              icon={Timer}
              label="Timed mode"
              active={studyMode === "timed"}
              onClick={() => setStudyMode((m) => (m === "timed" ? "normal" : "timed"))}
            />
            <StudyToolbarButton
              icon={Maximize2}
              label="Focus mode"
              onClick={() => setImmersive(true)}
            />
            <StudyToolbarButton icon={Shuffle} label="Shuffle deck" onClick={() => restart(true)} />
            <StudyToolbarButton icon={RotateCcw} label="Restart session" onClick={() => restart(false)} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <div className="flex items-center gap-2">
            <div className="relative flex size-10 shrink-0 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-[var(--muted)]" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="transition-all duration-500"
                  style={{ color: SWATCH.mango }}
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPct / 100)}`}
                />
              </svg>
              <span className="text-[10px] font-bold tabular-nums text-[var(--cc-text)]">{progressPct}%</span>
            </div>
            <span className="text-xs text-[var(--cc-text-muted)]">Mastered</span>
          </div>

          <div className="ml-auto flex flex-wrap items-stretch justify-end gap-2">
            {studyMode === "timed" && !finished ? (
              <StudyStatChip
                icon={Timer}
                label="Timer"
                value={cardTimer}
                suffix="s"
                pulse={cardTimer > 0 && cardTimer <= 10}
              />
            ) : null}
            <StudyStatChip
              icon={Star}
              label="Learned"
              value={sessionMastered.size}
              detail={allMasteredCount > sessionMastered.size ? `${allMasteredCount} total` : undefined}
            />
            <StudyStatChip icon={Brain} label="Left" value={cardsLeft} />
            <StudyStatChip
              icon={Flame}
              label="Streak"
              value={streak}
              detail={bestStreak > streak ? `best ${bestStreak}` : undefined}
              pulse={streak > 0 && (streak === 3 || streak === 5 || streak === 10)}
            />
          </div>
        </div>
      </div>

      {!finished && (batchMode ? currentBatch.length > 0 && studyPhase === "learn" : queue.length > 0) ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={studySolidBtnClass()}
            style={studySolidStyle(SWATCH.teal)}
            disabled={batchMode ? cardPositionIndex <= 0 : index <= 0}
            onClick={() => goToIndex(batchMode ? cardPositionIndex - 1 : index - 1)}
            aria-label="Previous card"
          >
            <ChevronLeft className="h-4 w-4" fill="currentColor" strokeWidth={1.75} />
          </button>
          <div className="flex flex-1 justify-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
            {(batchMode ? currentBatch : queue).map((card, i) => {
              const state =
                i === cardPositionIndex
                  ? "current"
                  : sessionMastered.has(card.id) || priorMastered.has(card.id)
                    ? "done"
                    : "pending"
              return (
                <button
                  key={`${card.id}-${i}`}
                  type="button"
                  onClick={() => goToIndex(i)}
                  title={`Card ${i + 1}`}
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full transition-all",
                    state === "current" && "w-5",
                    state === "pending" && "bg-[var(--muted)] hover:opacity-80",
                  )}
                  style={
                    state === "current"
                      ? { backgroundColor: SWATCH.mango }
                      : state === "done"
                        ? { backgroundColor: SWATCH.gold }
                        : undefined
                  }
                />
              )
            })}
          </div>
          <button
            type="button"
            className={studySolidBtnClass()}
            style={studySolidStyle(SWATCH.teal)}
            disabled={batchMode ? cardPositionIndex >= cardPositionTotal - 1 : index >= queue.length - 1}
            onClick={() => goToIndex(batchMode ? cardPositionIndex + 1 : index + 1)}
            aria-label="Next card"
          >
            <ChevronRight className="h-4 w-4" fill="currentColor" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}

      {renderStudyBody(false)}
    </>
  )

  if (immersive && typeof document !== "undefined") {
    return createPortal(
      <>
      <div
        className="fixed inset-0 z-[9999] flex flex-col text-white"
        style={{ backgroundColor: SWATCH.navy }}
        role="dialog"
        aria-modal="true"
        aria-label={`Focus study: ${deck.title}`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(ellipse at 20% 20%, ${SWATCH.blue}55, transparent 50%), radial-gradient(ellipse at 80% 80%, ${SWATCH.cyan}40, transparent 45%)`,
          }}
        />

        <header className="relative z-10 flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setImmersive(false)}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-white"
          >
            <Minimize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
            <span className="text-white/30 sm:ml-1">· Esc</span>
          </button>
          <span className="text-sm tabular-nums text-white/60">
            {finished ? "Complete" : cardPositionLabel}
          </span>
          {studyMode === "timed" && !finished ? (
            <span className={cn("text-sm tabular-nums", cardTimer > 10 ? "text-white/50" : "text-rose-400")}>
              {cardTimer}s
            </span>
          ) : (
            <span className="w-8" aria-hidden />
          )}
        </header>

        <div className="relative z-10 mx-4 h-px bg-white/10 sm:mx-6">
          <div
            className="h-full bg-white/40 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-5 px-4 py-6 sm:px-6">
          {renderStudyBody(true)}
        </main>
      </div>
      {waterBreakUi}
      <FlashcardAwardCelebration
        award={activeAward}
        onDismiss={dismissAward}
        focus={immersive}
      />
      </>,
      document.body,
    )
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {studyUi}
      {waterBreakUi}
      <FlashcardAwardCelebration award={activeAward} onDismiss={dismissAward} />
    </div>
  )
}

function studySolidBtnClass() {
  return "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-35"
}

function studySolidStyle(backgroundColor: string, color = "#FFFFFF") {
  return { backgroundColor, color }
}

function StudyToolbarButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof Star
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-[var(--cc-accent)] text-white"
          : "text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/80 hover:text-[var(--cc-text)]",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  )
}

function StudyStatChip({
  icon: Icon,
  label,
  value,
  suffix,
  detail,
  pulse,
}: {
  icon: typeof Star
  label: string
  value: number
  suffix?: string
  detail?: string
  pulse?: boolean
}) {
  return (
    <div className="flex h-[3.25rem] min-w-[4.75rem] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-2.5 text-center">
      <div className="flex items-center gap-1">
        <Icon
          className={cn("h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]", pulse && "animate-pulse text-[var(--cc-accent)]")}
          strokeWidth={1.75}
        />
        <motion.span
          key={value}
          initial={pulse ? { scale: 1.15 } : false}
          animate={{ scale: 1 }}
          className="text-sm font-bold tabular-nums leading-none text-[var(--cc-text)]"
        >
          {value}
          {suffix ? <span className="text-[10px] font-semibold text-[var(--cc-text-muted)]">{suffix}</span> : null}
        </motion.span>
      </div>
      <span className="mt-1 whitespace-nowrap text-[10px] leading-none text-[var(--cc-text-muted)]">
        {label}
        {detail ? <span className="text-[var(--cc-text-muted)]/65"> · {detail}</span> : null}
      </span>
    </div>
  )
}
