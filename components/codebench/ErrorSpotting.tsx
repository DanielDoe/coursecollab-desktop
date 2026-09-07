"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { codebenchPanelTheme } from "@/lib/codebench-panel-theme"

interface SuspiciousLine {
  lineNumber: number
  code: string
  issue: string
  question: string
  options: {
    id: string
    text: string
    correct: boolean
    explanation: string
  }[]
  explanation: string
}

interface ErrorSpottingProps {
  suspiciousLines: SuspiciousLine[]
  onHighlightLine: (lineNumber: number, highlight: boolean) => void
  onMarkResolved: (lineNumber: number) => void
  onToggleDebug?: () => void
  showDebug?: boolean
  theme?: "light" | "dark"
}

export function ErrorSpotting({
  suspiciousLines,
  onHighlightLine,
  onMarkResolved,
  onToggleDebug,
  showDebug,
  theme = "dark",
}: ErrorSpottingProps) {
  const isLight = theme === "light"
  const t = codebenchPanelTheme(isLight)
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())
  const [answers, setAnswers] = useState<{ [lineNumber: number]: string }>({})
  const [showExplanations, setShowExplanations] = useState<{ [lineNumber: number]: boolean }>({})

  const handleSelectLine = (lineNumber: number) => {
    const newSelected = new Set(selectedLines)
    if (newSelected.has(lineNumber)) {
      newSelected.delete(lineNumber)
      onHighlightLine(lineNumber, false)
    } else {
      newSelected.add(lineNumber)
      onHighlightLine(lineNumber, true)
    }
    setSelectedLines(newSelected)
  }

  const handleAnswer = (lineNumber: number, optionId: string) => {
    setAnswers({ ...answers, [lineNumber]: optionId })
    const line = suspiciousLines.find((l) => l.lineNumber === lineNumber)
    const option = line?.options.find((o) => o.id === optionId)
    if (option?.correct) {
      setTimeout(() => {
        setShowExplanations({ ...showExplanations, [lineNumber]: true })
      }, 500)
    }
  }

  const handleResolve = (lineNumber: number) => {
    onMarkResolved(lineNumber)
    setSelectedLines((prev) => {
      const newSet = new Set(prev)
      newSet.delete(lineNumber)
      return newSet
    })
    onHighlightLine(lineNumber, false)
  }

  const unresolvedLines = suspiciousLines.filter((line) => !showExplanations[line.lineNumber])

  return (
    <div className={cn("flex h-full flex-col", t.root)}>
      <div className={cn("border-b p-3", t.header)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className={cn("h-5 w-5", isLight ? "text-red-600" : "text-red-400")} />
            <div>
              <div className={cn("text-sm font-semibold", t.title)}>Find My Bugs</div>
              <div className={cn("text-xs", t.subtitle)}>
                {unresolvedLines.length} suspicious line{unresolvedLines.length !== 1 ? "s" : ""} found
              </div>
            </div>
          </div>
          {onToggleDebug ? (
            <button
              onClick={onToggleDebug}
              className={cn(
                "whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs transition-all",
                isLight
                  ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                  : "border-red-500/30 bg-red-500/20 text-red-300 hover:bg-red-500/30",
              )}
            >
              {showDebug ? "Show Bugs" : "Show Debug"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {unresolvedLines.length === 0 ? (
          <Card className={t.successBox}>
            <CardContent className="pt-6">
              <div className="py-8 text-center">
                <CheckCircle2 className={cn("mx-auto mb-4 h-16 w-16", isLight ? "text-emerald-600" : "text-green-400")} />
                <div className={cn("mb-2 text-lg font-semibold", t.successTitle)}>Great Job!</div>
                <div className={cn("text-sm", t.successText)}>
                  You've identified all potential issues. Your code looks good!
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          unresolvedLines.map((line) => {
            const isSelected = selectedLines.has(line.lineNumber)
            const answer = answers[line.lineNumber]
            const selectedOption = line.options.find((o) => o.id === answer)
            const isCorrect = selectedOption?.correct || false
            const showExplanation = showExplanations[line.lineNumber]

            return (
              <Card
                key={line.lineNumber}
                className={cn("transition-all", t.card, isSelected && t.cardSelected)}
              >
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="destructive"
                          className={cn(
                            isLight ? "border-red-300 bg-red-100 text-red-800" : "border-red-500/30 bg-red-500/20 text-red-300",
                          )}
                        >
                          Line {line.lineNumber}
                        </Badge>
                        <code className={cn("rounded px-2 py-1 font-mono text-sm", t.code)}>{line.code}</code>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectLine(line.lineNumber)}
                        className={isSelected ? (isLight ? "border-red-400 bg-red-50" : "border-red-500/50 bg-red-500/20") : undefined}
                      >
                        {isSelected ? "Hide" : "Show"}
                      </Button>
                    </div>

                    <div className={cn("rounded-lg border p-3", t.warnBox)}>
                      <div className={cn("mb-1 text-xs", t.warnLabel)}>Potential Issue</div>
                      <div className={cn("text-sm", t.warnText)}>{line.issue}</div>
                    </div>

                    <div>
                      <div className={cn("mb-3 text-sm font-semibold", t.body)}>{line.question}</div>
                      <RadioGroup
                        value={answer}
                        onValueChange={(value) => handleAnswer(line.lineNumber, value)}
                        disabled={showExplanation}
                      >
                        {line.options.map((option) => (
                          <div key={option.id} className="mb-2 flex items-start space-x-2">
                            <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                            <Label
                              htmlFor={option.id}
                              className={cn(
                                "flex-1 cursor-pointer rounded border p-2 transition-all",
                                answer === option.id
                                  ? isCorrect
                                    ? t.optionCorrect
                                    : t.optionWrong
                                  : t.option,
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {answer === option.id ? (
                                  isCorrect ? (
                                    <CheckCircle2 className={cn("h-4 w-4", isLight ? "text-emerald-600" : "text-green-400")} />
                                  ) : (
                                    <XCircle className={cn("h-4 w-4", isLight ? "text-red-600" : "text-red-400")} />
                                  )
                                ) : null}
                                <span className={cn("text-sm", t.optionText)}>{option.text}</span>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    {showExplanation ? (
                      <div className={cn("rounded-lg border p-3", t.infoBox)}>
                        <div className={cn("mb-1 text-xs", t.infoLabel)}>Explanation</div>
                        <div className={cn("text-sm", t.infoText)}>{selectedOption?.explanation || line.explanation}</div>
                      </div>
                    ) : null}

                    {showExplanation ? (
                      <Button onClick={() => handleResolve(line.lineNumber)} className={cn("w-full border", t.resolveBtn)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark as Understood
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
