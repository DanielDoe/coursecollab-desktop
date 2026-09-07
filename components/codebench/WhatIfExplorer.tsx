"use client"

import { useState } from "react"
import { Sparkles, Play, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { codebenchPanelTheme } from "@/lib/codebench-panel-theme"

interface Scenario {
  id: string
  question: string
  change: string
  outcome: string
  explanation: string
  codeSnippet?: string
  variables?: { [key: string]: any }
  warnings?: string[]
}

interface WhatIfExplorerProps {
  code: string
  onSimulate: (scenario: string) => Promise<Scenario[]>
  theme?: "light" | "dark"
}

export function WhatIfExplorer({ code, onSimulate, theme = "dark" }: WhatIfExplorerProps) {
  const isLight = theme === "light"
  const t = codebenchPanelTheme(isLight)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(false)
  const [userQuestion, setUserQuestion] = useState("")
  const [activeTab, setActiveTab] = useState("ask")

  const predefinedQuestions = [
    "What if I changed this while loop to a for loop?",
    "What if n = 0?",
    "What if I pass a negative number?",
    "What if the array is empty?",
    "What if I remove this condition?",
  ]

  const handleSimulate = async (question: string) => {
    setLoading(true)
    try {
      const results = await onSimulate(question)
      setScenarios(results)
      setActiveTab("results")
    } catch (error) {
      console.error("Simulation error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex h-full flex-col", t.root)}>
      <div className={cn("shrink-0 border-b p-3", t.header)}>
        <div className="flex items-center gap-2">
          <Sparkles className={cn("h-5 w-5", isLight ? "text-cyan-600" : "text-cyan-400")} />
          <div>
            <div className={cn("text-sm font-semibold", t.title)}>What If? Code Explorer</div>
            <div className={cn("text-xs", t.subtitle)}>Simulate code changes and explore outcomes</div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className={cn("w-full shrink-0 rounded-none border-b", t.tabsList)}>
          <TabsTrigger
            value="ask"
            className={cn("text-xs", isLight ? "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-700" : "data-[state=active]:bg-slate-700/50 data-[state=active]:text-white data-[state=inactive]:text-slate-200 hover:text-white")}
          >
            Ask Question
          </TabsTrigger>
          <TabsTrigger
            value="results"
            className={cn("text-xs", isLight ? "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-700" : "data-[state=active]:bg-slate-700/50 data-[state=active]:text-white data-[state=inactive]:text-slate-200 hover:text-white")}
            disabled={scenarios.length === 0}
          >
            Results ({scenarios.length})
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="ask" className="mt-0">
            <Card className={t.card}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <label className={cn("mb-2 block text-sm font-semibold", t.body)}>
                      Ask your own "What if?" question:
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={userQuestion}
                        onChange={(e) => setUserQuestion(e.target.value)}
                        placeholder='e.g., "What if I changed this while loop to a for loop?"'
                        className={cn(isLight ? "border-slate-300 bg-white text-slate-900" : "border-slate-600 bg-slate-900/50 text-slate-200")}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && userQuestion.trim()) {
                            handleSimulate(userQuestion)
                          }
                        }}
                      />
                      <Button
                        onClick={() => handleSimulate(userQuestion)}
                        disabled={!userQuestion.trim() || loading}
                        className={cn(isLight ? "border-cyan-400 bg-cyan-100 text-cyan-900 hover:bg-cyan-200" : "border-cyan-500/30 bg-cyan-500/20 hover:bg-cyan-500/30")}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Simulate
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className={cn("mb-2 block text-sm font-semibold", t.body)}>
                      Or try a predefined question:
                    </label>
                    <div className="space-y-2">
                      {predefinedQuestions.map((question, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          className={cn(
                            "h-auto w-full justify-start py-3 text-left",
                            isLight ? "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100" : "border-slate-600/50 bg-slate-700/30 text-slate-300 hover:bg-slate-700/50",
                          )}
                          onClick={() => handleSimulate(question)}
                          disabled={loading}
                        >
                          <Sparkles className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span className="text-xs">{question}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="mt-0">
            {loading ? (
              <div className={cn("py-12 text-center", t.muted)}>
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                <div>Simulating scenarios...</div>
              </div>
            ) : scenarios.length === 0 ? (
              <Card className={t.card}>
                <CardContent className="pt-6">
                  <div className={cn("py-8 text-center", t.muted)}>
                    <Sparkles className="mx-auto mb-2 h-12 w-12 opacity-50" />
                    <div>No scenarios yet</div>
                    <div className="mt-2 text-xs">Ask a "What if?" question to see simulations</div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {scenarios.map((scenario) => (
                  <Card key={scenario.id} className={t.card}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <div className={cn("mb-1 text-sm font-semibold", isLight ? "text-cyan-700" : "text-cyan-300")}>{scenario.question}</div>
                          <Badge variant="outline" className="text-xs">
                            Change: {scenario.change}
                          </Badge>
                        </div>

                        <div className={cn("rounded-lg border p-3", t.infoBox)}>
                          <div className="mb-2 flex items-center gap-2">
                            <CheckCircle2 className={cn("h-4 w-4", isLight ? "text-sky-700" : "text-blue-400")} />
                            <div className={cn("text-xs font-semibold uppercase tracking-wide", t.infoLabel)}>Outcome</div>
                          </div>
                          <div className={cn("text-sm", t.infoText)}>{scenario.outcome}</div>
                        </div>

                        <div>
                          <div className={cn("mb-1 text-xs font-semibold uppercase tracking-wide", t.muted)}>Explanation</div>
                          <div className={cn("text-sm leading-relaxed", t.body)}>{scenario.explanation}</div>
                        </div>

                        {scenario.codeSnippet ? (
                          <div className={cn("rounded border p-3", t.code)}>
                            <div className={cn("mb-2 text-xs", t.muted)}>Modified Code:</div>
                            <code className={cn("block whitespace-pre-wrap font-mono text-xs", t.exampleCode)}>{scenario.codeSnippet}</code>
                          </div>
                        ) : null}

                        {scenario.variables && Object.keys(scenario.variables).length > 0 ? (
                          <div>
                            <div className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", t.muted)}>Variable Values</div>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(scenario.variables).map(([key, value]) => (
                                <div key={key} className={cn("rounded border p-2", isLight ? "border-slate-200 bg-slate-50" : "border-slate-600/50 bg-slate-700/50")}>
                                  <div className={cn("text-xs", t.muted)}>{key}</div>
                                  <div className={cn("font-mono text-sm", isLight ? "text-emerald-700" : "text-green-400")}>{String(value)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {scenario.warnings && scenario.warnings.length > 0 ? (
                          <div className={cn("rounded-lg border p-3", t.warnBox)}>
                            <div className="mb-2 flex items-center gap-2">
                              <AlertTriangle className={cn("h-4 w-4", isLight ? "text-amber-700" : "text-yellow-400")} />
                              <div className={cn("text-xs font-semibold uppercase tracking-wide", t.warnLabel)}>Warnings</div>
                            </div>
                            <ul className="space-y-1">
                              {scenario.warnings.map((warning, idx) => (
                                <li key={idx} className={cn("text-xs", t.warnText)}>• {warning}</li>
                              ))}
                            </ul>
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


