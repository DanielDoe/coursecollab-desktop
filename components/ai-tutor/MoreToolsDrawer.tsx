"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Code2, BarChart3, RefreshCw, GraduationCap, Users, Lightbulb, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MoreToolsDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSelectTool: (tool: string, options?: any) => void
}

const toolOptions = {
  "alternative-solutions": {
    icon: Code2,
    label: "Alternative Solutions",
    description: "Get different approaches to solve the same problem"
  },
  "complexity-analysis": {
    icon: BarChart3,
    label: "Complexity Analysis",
    description: "Analyze time and space complexity of your code"
  },
  "refactor-mode": {
    icon: RefreshCw,
    label: "Refactor Mode",
    description: "Improve code structure and readability"
  },
  "exam-prep-mode": {
    icon: GraduationCap,
    label: "Exam Prep Mode",
    description: "Practice questions similar to your exams"
  },
  "teaching-personality": {
    icon: Users,
    label: "Teaching Personality",
    description: "Choose how the AI explains concepts"
  },
  "explain-thinking": {
    icon: Lightbulb,
    label: "Explain My Thinking",
    description: "Get feedback on your problem-solving approach"
  },
  "code-translator": {
    icon: Languages,
    label: "Code Translator",
    description: "Convert code between languages (C++ → Python, etc.)"
  }
}

export function MoreToolsDrawer({ isOpen, onClose, onSelectTool }: MoreToolsDrawerProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [targetLanguage, setTargetLanguage] = useState("python")

  const handleToolSelect = (toolId: string) => {
    if (toolId === "code-translator" || toolId === "explain-thinking" || toolId === "complexity-analysis") {
      setSelectedTool(toolId)
    } else {
      onSelectTool(toolId)
      onClose()
    }
  }

  const handleSubmit = () => {
    if (!selectedTool) return

    const options: any = {}
    if (selectedTool === "code-translator") {
      options.code = code
      options.targetLanguage = targetLanguage
    } else if (selectedTool === "explain-thinking" || selectedTool === "complexity-analysis") {
      options.code = code
    }

    onSelectTool(selectedTool, options)
    onClose()
    setSelectedTool(null)
    setCode("")
    setTargetLanguage("python")
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        />

        {/* Drawer */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 overflow-y-auto"
        >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Additional Tools</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="overflow-y-auto">
                {!selectedTool ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(toolOptions).map(([id, tool]) => {
                      const Icon = tool.icon
                      return (
                        <motion.button
                          key={id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleToolSelect(id)}
                          className="p-4 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-100">
                              <Icon className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-900 mb-1">{tool.label}</h4>
                              <p className="text-sm text-slate-600">{tool.description}</p>
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-4 max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTool(null)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                      <h3 className="font-semibold text-lg">
                        {toolOptions[selectedTool as keyof typeof toolOptions]?.label}
                      </h3>
                    </div>

                    {selectedTool === "code-translator" && (
                      <>
                        <div className="space-y-2">
                          <Label>Source Code (C++)</Label>
                          <Textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Paste your C++ code here..."
                            className="font-mono text-sm min-h-[200px]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Target Language</Label>
                          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="python">Python</SelectItem>
                              <SelectItem value="java">Java</SelectItem>
                              <SelectItem value="javascript">JavaScript</SelectItem>
                              <SelectItem value="csharp">C#</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleSubmit} className="w-full">
                          Translate Code
                        </Button>
                      </>
                    )}

                    {(selectedTool === "explain-thinking" || selectedTool === "complexity-analysis") && (
                      <>
                        <div className="space-y-2">
                          <Label>Your Code</Label>
                          <Textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Paste your code here..."
                            className="font-mono text-sm min-h-[200px]"
                          />
                        </div>
                        <Button onClick={handleSubmit} className="w-full">
                          {selectedTool === "explain-thinking" ? "Analyze My Thinking" : "Analyze Complexity"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
      </>
    </AnimatePresence>
  )
}
