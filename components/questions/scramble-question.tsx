"use client"

import { useState, useEffect } from "react"
import { motion, Reorder } from "framer-motion"
import { GripVertical, CheckCircle2, XCircle } from "lucide-react"

interface ScrambleQuestionProps {
  questionText: string
  codeLines: string[]
  correctOrder: string[]
  onAnswer: (answer: string[]) => void
  showFeedback?: boolean
  isCorrect?: boolean
  disabled?: boolean
}

export function ScrambleQuestion({
  questionText,
  codeLines,
  correctOrder,
  onAnswer,
  showFeedback = false,
  isCorrect = false,
  disabled = false,
}: ScrambleQuestionProps) {
  const [items, setItems] = useState<string[]>(codeLines)

  useEffect(() => {
    setItems(codeLines)
  }, [codeLines])

  useEffect(() => {
    if (!disabled) {
      onAnswer(items)
    }
  }, [items, onAnswer, disabled])

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-medium text-foreground leading-relaxed">{questionText}</h3>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Drag the code lines into the correct order:</p>

        <Reorder.Group
          axis="y"
          values={items}
          onReorder={setItems}
          className="space-y-2"
          style={{ pointerEvents: disabled ? "none" : "auto" }}
        >
          {items.map((line, index) => {
            const isCorrectPosition = showFeedback && line === correctOrder[index]
            const isWrongPosition = showFeedback && line !== correctOrder[index]

            return (
              <Reorder.Item key={line} value={line} className="list-none">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 bg-background ${
                    isCorrectPosition
                      ? "border-green-500 bg-green-50"
                      : isWrongPosition
                        ? "border-red-500 bg-red-50"
                        : "border-border hover:border-primary/50"
                  } ${disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                >
                  <GripVertical
                    className={`h-5 w-5 flex-shrink-0 ${
                      isCorrectPosition ? "text-green-600" : isWrongPosition ? "text-red-600" : "text-muted-foreground"
                    }`}
                  />
                  <div className="flex-1 font-mono text-sm text-foreground whitespace-pre">{line}</div>
                  {showFeedback && (
                    <div className="flex-shrink-0">
                      {isCorrectPosition ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  )}
                </motion.div>
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
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
              <span className="font-semibold text-green-700">Correct! Perfect code order.</span>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-red-600" />
              <span className="font-semibold text-red-700">Incorrect. Check the correct order above.</span>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
