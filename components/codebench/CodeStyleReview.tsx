"use client"

import { useState } from "react"
import { CheckCircle2, AlertTriangle, Info, Code2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { codebenchPanelTheme } from "@/lib/codebench-panel-theme"

interface StyleIssue {
  lineNumber: number
  code: string
  category: "naming" | "formatting" | "complexity" | "pattern" | "efficiency" | "comments"
  severity: "info" | "warning" | "error"
  issue: string
  suggestion: string
  principle?: string
  example?: string
}

interface CodeStyleReviewProps {
  issues: StyleIssue[]
  onHighlightLine: (lineNumber: number, highlight: boolean) => void
  theme?: "light" | "dark"
}

export function CodeStyleReview({ issues, onHighlightLine, theme = "dark" }: CodeStyleReviewProps) {
  const isLight = theme === "light"
  const t = codebenchPanelTheme(isLight)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedLine, setSelectedLine] = useState<number | null>(null)

  const categories = [
    { id: "all", label: "All Issues", count: issues.length },
    { id: "naming", label: "Naming", count: issues.filter((i) => i.category === "naming").length },
    { id: "formatting", label: "Formatting", count: issues.filter((i) => i.category === "formatting").length },
    { id: "complexity", label: "Complexity", count: issues.filter((i) => i.category === "complexity").length },
    { id: "pattern", label: "Patterns", count: issues.filter((i) => i.category === "pattern").length },
    { id: "efficiency", label: "Efficiency", count: issues.filter((i) => i.category === "efficiency").length },
    { id: "comments", label: "Comments", count: issues.filter((i) => i.category === "comments").length },
  ]

  const filteredIssues =
    selectedCategory === "all" ? issues : issues.filter((issue) => issue.category === selectedCategory)

  const handleSelectLine = (lineNumber: number) => {
    if (selectedLine === lineNumber) {
      setSelectedLine(null)
      onHighlightLine(lineNumber, false)
    } else {
      if (selectedLine !== null) {
        onHighlightLine(selectedLine, false)
      }
      setSelectedLine(lineNumber)
      onHighlightLine(lineNumber, true)
    }
  }

  const getSeverityColor = (severity: string) => {
    if (isLight) {
      switch (severity) {
        case "error":
          return "bg-red-100 text-red-800 border-red-300"
        case "warning":
          return "bg-amber-100 text-amber-900 border-amber-300"
        default:
          return "bg-sky-100 text-sky-800 border-sky-300"
      }
    }
    switch (severity) {
      case "error":
        return "bg-red-500/20 text-red-300 border-red-500/30"
      case "warning":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "naming":
        return "📝"
      case "formatting":
        return "✨"
      case "complexity":
        return "🧩"
      case "pattern":
        return "🏗️"
      case "efficiency":
        return "⚡"
      case "comments":
        return "💬"
      default:
        return "📋"
    }
  }

  return (
    <div className={cn("flex h-full flex-col", t.root)}>
      <div className={cn("border-b p-3", t.header)}>
        <div className="flex items-center gap-2">
          <Code2 className={cn("h-5 w-5", isLight ? "text-emerald-600" : "text-emerald-400")} />
          <div>
            <div className={cn("text-sm font-semibold", t.title)}>Code Style & Readability Review</div>
            <div className={cn("text-xs", t.subtitle)}>
              {issues.length} issue{issues.length !== 1 ? "s" : ""} found
            </div>
          </div>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex flex-1 flex-col">
        <TabsList className={cn("w-full justify-start rounded-none border-b p-1", t.tabsList)}>
          {categories.map((cat) => (
            <TabsTrigger
              key={cat.id}
              value={cat.id}
              className={cn(
                "text-xs",
                isLight
                  ? "data-[state=active]:bg-white data-[state=active]:text-emerald-800 data-[state=active]:shadow-sm"
                  : "data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300",
              )}
            >
              {cat.label} ({cat.count})
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value={selectedCategory} className="mt-0">
            {filteredIssues.length === 0 ? (
              <Card className={t.successBox}>
                <CardContent className="pt-6">
                  <div className="py-8 text-center">
                    <CheckCircle2 className={cn("mx-auto mb-4 h-16 w-16", isLight ? "text-emerald-600" : "text-green-400")} />
                    <div className={cn("mb-2 text-lg font-semibold", t.successTitle)}>Excellent Code Quality!</div>
                    <div className={cn("text-sm", t.successText)}>
                      No {selectedCategory === "all" ? "" : selectedCategory} issues found in this category.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredIssues.map((issue, idx) => (
                  <Card
                    key={idx}
                    className={cn(
                      "cursor-pointer transition-all",
                      t.card,
                      selectedLine === issue.lineNumber && (isLight ? "border-emerald-400 shadow-md" : "border-emerald-500/50 shadow-lg shadow-emerald-500/10"),
                    )}
                    onClick={() => handleSelectLine(issue.lineNumber)}
                  >
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getCategoryIcon(issue.category)}</span>
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity === "error" ? (
                                <AlertTriangle className="mr-1 h-3 w-3" />
                              ) : issue.severity === "warning" ? (
                                <AlertTriangle className="mr-1 h-3 w-3" />
                              ) : (
                                <Info className="mr-1 h-3 w-3" />
                              )}
                              {issue.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Line {issue.lineNumber}
                            </Badge>
                          </div>
                        </div>

                        <div className={cn("rounded border p-2", t.code)}>
                          <code className="font-mono text-xs">{issue.code}</code>
                        </div>

                        <div>
                          <div className={cn("mb-1 text-sm font-semibold", t.body)}>{issue.issue}</div>
                          <div className={cn("text-xs", t.muted)}>{issue.suggestion}</div>
                        </div>

                        {issue.principle ? (
                          <div className={cn("rounded border p-2", t.principleBox)}>
                            <div className={cn("mb-1 text-xs", t.principleLabel)}>Engineering Principle</div>
                            <div className={cn("text-xs", t.principleText)}>{issue.principle}</div>
                          </div>
                        ) : null}

                        {issue.example ? (
                          <div className={cn("rounded border p-2", t.code)}>
                            <div className={cn("mb-1 text-xs", t.muted)}>Example:</div>
                            <code className={cn("font-mono text-xs", t.exampleCode)}>{issue.example}</code>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
