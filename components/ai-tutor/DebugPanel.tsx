"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Code, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DebugPanelProps {
  isOpen: boolean
  onClose: () => void
  onAnalyze: (code: string) => void
}

export function DebugPanel({ isOpen, onClose, onAnalyze }: DebugPanelProps) {
  const [code, setCode] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errors, setErrors] = useState<Array<{ line: number; type: string; message: string }>>([])
  const [suggestions, setSuggestions] = useState<string[]>([])

  const handleAnalyze = async () => {
    if (!code.trim()) return

    setIsAnalyzing(true)
    setErrors([])
    setSuggestions([])

    // Simulate analysis (in real implementation, this would call an API)
    setTimeout(() => {
      // Mock error detection
      const mockErrors = [
        { line: 5, type: "syntax", message: "Missing semicolon" },
        { line: 12, type: "logic", message: "Potential null pointer dereference" },
      ]
      const mockSuggestions = [
        "Add null check before dereferencing pointer",
        "Initialize variables before use",
        "Check array bounds before accessing",
      ]

      setErrors(mockErrors)
      setSuggestions(mockSuggestions)
      setIsAnalyzing(false)
    }, 1500)
  }

  const handleFix = () => {
    onAnalyze(code)
    onClose()
    setCode("")
    setErrors([])
    setSuggestions([])
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col w-[calc(100%-2rem)] sm:w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl dark:text-slate-200">
            <Code className="w-4 w-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400 shrink-0" />
            <span className="sm:hidden">Debug Code</span>
            <span className="hidden sm:inline">Debug My Code</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Code Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Paste your C++ code</Label>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="#include <iostream>&#10;using namespace std;&#10;&#10;int main() {&#10;  // Your code here&#10;  return 0;&#10;}"
              className="font-mono text-sm min-h-[300px] resize-none"
            />
          </div>

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!code.trim() || isAnalyzing}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 mr-2" />
                Detect Errors
              </>
            )}
          </Button>

          {/* Error Detection Results */}
          <AnimatePresence>
            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Detected Issues
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {errors.map((error, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-red-200 bg-red-50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive" className="text-xs">
                          Line {error.line}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {error.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{error.message}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggested Fixes */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Suggested Fixes
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-green-200 bg-green-50"
                    >
                      <p className="text-sm text-slate-700">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fix Button */}
          {errors.length > 0 && (
            <Button
              onClick={handleFix}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Get AI Explanation & Fixes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
