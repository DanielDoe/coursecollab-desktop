"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MiniLessonDrawerProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (options: {
    difficulty: string
    includeExamples: boolean
    autoQuiz: boolean
    topic?: string
  }) => void
}

export function MiniLessonDrawer({ isOpen, onClose, onGenerate }: MiniLessonDrawerProps) {
  const [difficulty, setDifficulty] = useState("intermediate")
  const [includeExamples, setIncludeExamples] = useState(true)
  const [autoQuiz, setAutoQuiz] = useState(false)
  const [topic, setTopic] = useState("")

  const handleGenerate = () => {
    onGenerate({
      difficulty,
      includeExamples,
      autoQuiz,
      topic: topic.trim() || undefined
    })
    onClose()
    // Reset form
    setDifficulty("intermediate")
    setIncludeExamples(true)
    setAutoQuiz(false)
    setTopic("")
  }

  return (
    <AnimatePresence>
      {isOpen && (
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
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Generate Mini Lesson</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Topic Input */}
              <div className="space-y-2">
                <Label htmlFor="topic">Topic (Optional)</Label>
                <input
                  id="topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., pointers, loops, recursion..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-500">
                  Leave empty for AI to suggest based on your learning profile
                </p>
              </div>

              {/* Difficulty Selector */}
              <div className="space-y-2">
                <Label>Lesson Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Include Examples Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <Label htmlFor="examples" className="text-base">Include Examples</Label>
                  <p className="text-sm text-slate-500">Add code examples to illustrate concepts</p>
                </div>
                <Switch
                  id="examples"
                  checked={includeExamples}
                  onCheckedChange={setIncludeExamples}
                />
              </div>

              {/* Auto-Quiz Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-quiz" className="text-base">Auto-Quiz</Label>
                  <p className="text-sm text-slate-500">Generate quiz questions after lesson</p>
                </div>
                <Switch
                  id="auto-quiz"
                  checked={autoQuiz}
                  onCheckedChange={setAutoQuiz}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Mini Lesson
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
