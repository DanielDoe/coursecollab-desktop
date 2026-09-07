"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Eye, Play, Square, StepForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DebugTraceModalProps {
  isOpen: boolean
  onClose: () => void
  onTrace: (code: string) => void
}

export function DebugTraceModal({ isOpen, onClose, onTrace }: DebugTraceModalProps) {
  const [code, setCode] = useState("")
  const [isTracing, setIsTracing] = useState(false)
  const [traceSteps, setTraceSteps] = useState<Array<{
    step: number
    line: number
    variable: string
    value: string
    description: string
  }>>([])
  const [currentStep, setCurrentStep] = useState(0)

  const handleTrace = async () => {
    if (!code.trim()) return

    setIsTracing(true)
    setTraceSteps([])
    setCurrentStep(0)

    // Simulate trace generation
    setTimeout(() => {
      const mockSteps = [
        { step: 1, line: 1, variable: "x", value: "undefined", description: "Variable x declared" },
        { step: 2, line: 2, variable: "x", value: "5", description: "x assigned value 5" },
        { step: 3, line: 3, variable: "y", value: "undefined", description: "Variable y declared" },
        { step: 4, line: 4, variable: "y", value: "10", description: "y assigned value 10" },
        { step: 5, line: 5, variable: "result", value: "15", description: "result = x + y = 15" },
      ]
      setTraceSteps(mockSteps)
      setIsTracing(false)
    }, 1500)
  }

  const handleVisualize = () => {
    onTrace(code)
    onClose()
    setCode("")
    setTraceSteps([])
    setCurrentStep(0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col w-[calc(100%-2rem)] sm:w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl dark:text-slate-200">
            <Eye className="w-4 w-4 sm:w-5 sm:h-5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="sm:hidden">Trace Visualizer</span>
            <span className="hidden sm:inline">Execution Trace Visualizer</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: Code Input */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Your C++ Code</Label>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="#include <iostream>&#10;using namespace std;&#10;&#10;int main() {&#10;  int x = 5;&#10;  int y = 10;&#10;  int result = x + y;&#10;  cout << result;&#10;  return 0;&#10;}"
                className="font-mono text-sm min-h-[400px] resize-none"
              />
            </div>
            <Button
              onClick={handleTrace}
              disabled={!code.trim() || isTracing}
              className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700"
            >
              {isTracing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Tracing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate Trace
                </>
              )}
            </Button>
          </div>

          {/* Right: Trace Visualization */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 border-l border-slate-200 pl-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Execution Timeline</h4>
              {traceSteps.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                  >
                    <Square className="w-3 h-3 mr-1" />
                    Prev
                  </Button>
                  <span className="text-xs text-slate-500">
                    Step {currentStep + 1} / {traceSteps.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(Math.min(traceSteps.length - 1, currentStep + 1))}
                    disabled={currentStep === traceSteps.length - 1}
                  >
                    Next
                    <StepForward className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {traceSteps.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Eye className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Enter code and click "Generate Trace" to see execution steps</p>
                </div>
              ) : (
                traceSteps.map((step, idx) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      idx === currentStep
                        ? "border-violet-500 bg-violet-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={idx === currentStep ? "default" : "outline"}>
                        Step {step.step}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Line {step.line}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-sm">
                        <span className="text-slate-600">{step.variable}</span>
                        <span className="text-slate-400"> = </span>
                        <span className="text-violet-600 font-semibold">{step.value}</span>
                      </div>
                      <p className="text-xs text-slate-500">{step.description}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {traceSteps.length > 0 && (
              <Button
                onClick={handleVisualize}
                className="w-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700"
              >
                <Eye className="w-4 h-4 mr-2" />
                Get Detailed Trace Explanation
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
