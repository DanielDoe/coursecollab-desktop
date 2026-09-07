"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle } from "lucide-react"

interface DragDropQuestionProps {
  questionText: string
  template: string // Template with ___ for blanks
  codeBank: string[] // Available options to drag
  correctAnswers: string[] // Correct answers in order
  onAnswer: (answers: string[]) => void
  showFeedback?: boolean
  isCorrect?: boolean
  disabled?: boolean
}

export function DragDropQuestion({
  questionText,
  template,
  codeBank,
  correctAnswers,
  onAnswer,
  showFeedback = false,
  isCorrect = false,
  disabled = false,
}: DragDropQuestionProps) {
  const blanks = template.split("___").length - 1
  const [selectedAnswers, setSelectedAnswers] = useState<(string | null)[]>(Array(blanks).fill(null))
  const [availableOptions, setAvailableOptions] = useState<string[]>(codeBank)

  useEffect(() => {
    setSelectedAnswers(Array(blanks).fill(null))
    setAvailableOptions(codeBank)
  }, [codeBank, blanks])

  useEffect(() => {
    onAnswer(selectedAnswers.filter((a): a is string => a !== null))
  }, [selectedAnswers, onAnswer])

  const handleDrop = (blankIndex: number, option: string) => {
    if (disabled) return

    const newAnswers = [...selectedAnswers]
    const oldAnswer = newAnswers[blankIndex]

    // If blank already has an answer, return it to available options
    if (oldAnswer) {
      setAvailableOptions([...availableOptions, oldAnswer])
    }

    // Set new answer
    newAnswers[blankIndex] = option
    setSelectedAnswers(newAnswers)

    // Remove from available options
    setAvailableOptions(availableOptions.filter((o) => o !== option))
  }

  const handleRemove = (blankIndex: number) => {
    if (disabled) return

    const answer = selectedAnswers[blankIndex]
    if (!answer) return

    const newAnswers = [...selectedAnswers]
    newAnswers[blankIndex] = null
    setSelectedAnswers(newAnswers)

    setAvailableOptions([...availableOptions, answer])
  }

  const templateParts = template.split("___")

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-medium text-foreground leading-relaxed">{questionText}</h3>

      {/* Code Bank */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Drag items from the code bank into the blanks:</p>
        <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg border-2 border-dashed border-border min-h-[60px]">
          {availableOptions.map((option, index) => (
            <motion.button
              key={`${option}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const firstEmptyBlank = selectedAnswers.findIndex((a) => a === null)
                if (firstEmptyBlank !== -1) {
                  handleDrop(firstEmptyBlank, option)
                }
              }}
              disabled={disabled}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-mono text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {option}
            </motion.button>
          ))}
          {availableOptions.length === 0 && <p className="text-sm text-muted-foreground italic">All items used</p>}
        </div>
      </div>

      {/* Code Template with Blanks */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Complete the code:</p>
        <div className="p-4 bg-background rounded-lg border-2 border-border font-mono text-sm whitespace-pre-wrap">
          {templateParts.map((part, index) => (
            <span key={index}>
              {part}
              {index < blanks && (
                <span className="inline-flex items-center">
                  {selectedAnswers[index] ? (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => handleRemove(index)}
                      disabled={disabled}
                      className={`px-3 py-1 mx-1 rounded-md font-mono text-sm transition-colors ${
                        showFeedback
                          ? selectedAnswers[index] === correctAnswers[index]
                            ? "bg-green-500 text-white border-2 border-green-600"
                            : "bg-red-500 text-white border-2 border-red-600"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {selectedAnswers[index]}
                      {showFeedback && (
                        <span className="ml-2">{selectedAnswers[index] === correctAnswers[index] ? "✓" : "✗"}</span>
                      )}
                    </motion.button>
                  ) : (
                    <span className="inline-block w-24 h-8 mx-1 border-2 border-dashed border-border rounded-md bg-muted/30" />
                  )}
                </span>
              )}
            </span>
          ))}
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
              <span className="font-semibold text-green-700">Correct! All blanks filled correctly.</span>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold text-red-700">Incorrect. Correct answers:</p>
                <p className="text-sm text-red-600 font-mono mt-1">{correctAnswers.join(", ")}</p>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
