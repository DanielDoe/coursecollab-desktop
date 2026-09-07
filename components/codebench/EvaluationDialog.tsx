"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

interface Question {
  question: string
  type: "multiple_choice" | "short_answer"
  options?: string[]
  correctAnswer: string
  explanation: string
}

interface EvaluationDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (answers: string[]) => void
  questions: Question[]
  isLoading: boolean
}

export function EvaluationDialog({
  open,
  onClose,
  onSubmit,
  questions,
  isLoading,
}: EvaluationDialogProps) {
  const [answers, setAnswers] = useState<string[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  useEffect(() => {
    if (open && questions.length > 0) {
      setAnswers(new Array(questions.length).fill(""))
      setCurrentQuestionIndex(0)
    }
  }, [open, questions])

  const handleAnswerChange = (value: string) => {
    const newAnswers = [...answers]
    newAnswers[currentQuestionIndex] = value
    setAnswers(newAnswers)
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleSubmit = () => {
    if (answers.every((a) => a.trim() !== "")) {
      onSubmit(answers)
    }
  }

  // Early return if no questions - prevent any rendering that could cause errors
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return null // Don't render dialog at all if no questions
  }

  const currentQuestion = questions[currentQuestionIndex]
  const allAnswered = answers.every((a) => a.trim() !== "")

  // Additional safety check for current question
  if (!currentQuestion || typeof currentQuestion !== 'object' || !currentQuestion.question) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto w-[calc(100%-2rem)] sm:w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="text-lg sm:text-xl font-semibold dark:text-slate-200">
            <span className="sm:hidden">Evaluation</span>
            <span className="hidden sm:inline">Code Comprehension Evaluation</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm dark:text-slate-400">
            Answer {questions.length} questions to demonstrate your understanding of the code.
            <br className="hidden sm:inline" />
            <span className="sm:hidden"> </span>
            Question {currentQuestionIndex + 1} of {questions.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-3 sm:py-4 px-4 sm:px-6">
          <div className="space-y-3 sm:space-y-4">
            <h3 className="font-semibold text-base sm:text-lg dark:text-slate-200 break-words">{currentQuestion?.question || "Question"}</h3>

            {currentQuestion?.type === "multiple_choice" ? (
              <RadioGroup
                value={answers[currentQuestionIndex] || ""}
                onValueChange={handleAnswerChange}
                className="space-y-2 sm:space-y-3"
              >
                {currentQuestion?.options?.map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2 sm:space-x-3">
                    <RadioGroupItem value={option} id={`option-${idx}`} className="shrink-0" />
                    <Label htmlFor={`option-${idx}`} className="cursor-pointer text-sm sm:text-base dark:text-slate-300 break-words flex-1">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Input
                value={answers[currentQuestionIndex] || ""}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Type your answer..."
                className="w-full text-sm sm:text-base dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10 dark:border-slate-600 dark:text-slate-300"
            >
              Previous
            </Button>

            <div className="flex gap-1.5 sm:gap-2">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                    idx === currentQuestionIndex
                      ? "bg-blue-500 dark:bg-blue-400"
                      : answers[idx]
                      ? "bg-green-500 dark:bg-green-400"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              ))}
            </div>

            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={handleNext} disabled={!answers[currentQuestionIndex]} className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!allAnswered || isLoading}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600 hover:from-indigo-600 hover:to-purple-600 dark:hover:from-indigo-700 dark:hover:to-purple-700 text-white w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                    <span className="sm:hidden">Submitting</span>
                    <span className="hidden sm:inline">Submitting...</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Submit</span>
                    <span className="hidden sm:inline">Submit Answers</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

