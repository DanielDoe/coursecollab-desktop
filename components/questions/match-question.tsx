"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react"

interface MatchPair {
  left: string
  right: string
}

interface MatchQuestionProps {
  questionText: string
  pairs: MatchPair[] // Correct pairs
  onAnswer: (matches: Record<string, string>) => void
  showFeedback?: boolean
  isCorrect?: boolean
  disabled?: boolean
}

export function MatchQuestion({
  questionText,
  pairs,
  onAnswer,
  showFeedback = false,
  isCorrect = false,
  disabled = false,
}: MatchQuestionProps) {
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)

  const leftItems = pairs.map((p) => p.left)
  const rightItems = [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5) // Shuffle right items

  useEffect(() => {
    setMatches({})
    setSelectedLeft(null)
  }, [pairs])

  useEffect(() => {
    onAnswer(matches)
  }, [matches, onAnswer])

  const handleLeftClick = (item: string) => {
    if (disabled) return
    setSelectedLeft(item === selectedLeft ? null : item)
  }

  const handleRightClick = (item: string) => {
    if (disabled || !selectedLeft) return

    const newMatches = { ...matches }

    // Remove any existing match for this left item
    delete newMatches[selectedLeft]

    // Remove any existing match for this right item
    Object.keys(newMatches).forEach((key) => {
      if (newMatches[key] === item) {
        delete newMatches[key]
      }
    })

    // Add new match
    newMatches[selectedLeft] = item
    setMatches(newMatches)
    setSelectedLeft(null)
  }

  const getCorrectMatch = (leftItem: string): string => {
    return pairs.find((p) => p.left === leftItem)?.right || ""
  }

  const isMatchCorrect = (leftItem: string): boolean => {
    return matches[leftItem] === getCorrectMatch(leftItem)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-medium text-foreground leading-relaxed">{questionText}</h3>

      <p className="text-sm text-muted-foreground">
        Click a code snippet on the left, then click its matching output on the right:
      </p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column - Code Snippets */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Code Snippets</p>
          {leftItems.map((item, index) => {
            const isSelected = selectedLeft === item
            const hasMatch = !!matches[item]
            const matchIsCorrect = showFeedback && hasMatch && isMatchCorrect(item)
            const matchIsWrong = showFeedback && hasMatch && !isMatchCorrect(item)

            return (
              <motion.button
                key={item}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={!disabled ? { scale: 1.02 } : {}}
                whileTap={!disabled ? { scale: 0.98 } : {}}
                onClick={() => handleLeftClick(item)}
                disabled={disabled}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  matchIsCorrect
                    ? "border-green-500 bg-green-50"
                    : matchIsWrong
                      ? "border-red-500 bg-red-50"
                      : isSelected
                        ? "border-primary bg-primary/10"
                        : hasMatch
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-primary/50 bg-background"
                } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-foreground">{item}</code>
                  {hasMatch && (
                    <div className="flex items-center gap-2 text-sm">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <code className="font-mono text-accent">{matches[item]}</code>
                      {showFeedback && (
                        <span>
                          {matchIsCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Right Column - Outputs */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Outputs</p>
          {rightItems.map((item, index) => {
            const isMatched = Object.values(matches).includes(item)
            const canSelect = selectedLeft !== null

            return (
              <motion.button
                key={item}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={!disabled && canSelect ? { scale: 1.02 } : {}}
                whileTap={!disabled && canSelect ? { scale: 0.98 } : {}}
                onClick={() => handleRightClick(item)}
                disabled={disabled || !canSelect}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isMatched
                    ? "border-accent bg-accent/10 opacity-50"
                    : canSelect
                      ? "border-border hover:border-primary/50 bg-background cursor-pointer"
                      : "border-border bg-muted/30 cursor-not-allowed opacity-60"
                }`}
              >
                <code className="text-sm font-mono text-foreground">{item}</code>
              </motion.button>
            )
          })}
        </div>
      </div>

      {showFeedback && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-3 p-4 rounded-lg ${
            isCorrect ? "bg-green-50 border-2 border-green-500" : "bg-red-50 border-2 border-red-500"
          }`}
        >
          {isCorrect ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <span className="font-semibold text-green-700">Correct! All matches are perfect.</span>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold text-red-700">Incorrect. Check the correct matches above.</p>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
