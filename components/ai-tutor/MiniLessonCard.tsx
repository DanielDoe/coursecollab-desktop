"use client"

import { motion } from "framer-motion"
import { BookOpen, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from "@/lib/utils"

interface MiniLessonCardProps {
  title: string
  concept: string
  example: string
  visual: string[]
  quizButton?: boolean
}

export function MiniLessonCard({ title, concept, example, visual, quizButton = true }: MiniLessonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-4 bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-md p-5 space-y-4 w-full"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-purple-600" />
        </div>
        <h3 className="font-semibold text-slate-900">Mini-Lesson: {title}</h3>
        <span className="text-lg">🌙</span>
      </div>

      <div className="space-y-3">
        {/* Concept */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-purple-600 min-w-[60px]">1. Concept:</span>
          <p className="text-sm text-slate-700 flex-1">{concept}</p>
          <ArrowRight className="w-4 h-4 text-slate-400 mt-0.5" />
        </div>

        {/* Example */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-purple-600 min-w-[60px]">2. Example:</span>
          <div className="flex-1">
            <SyntaxHighlighter
              language="cpp"
              style={vscDarkPlus}
              customStyle={{
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.75rem',
                margin: 0,
              }}
            >
              {example}
            </SyntaxHighlighter>
          </div>
        </div>

        {/* Visual */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-purple-600 min-w-[60px]">3. Visual:</span>
          <div className="flex-1 flex gap-2">
            {visual.map((value, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-16 h-16 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm",
                  idx === 0 && "bg-blue-400",
                  idx === 1 && "bg-green-400",
                  idx === 2 && "bg-purple-400"
                )}
              >
                {value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {quizButton && (
        <Button
          className="w-full mt-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md"
        >
          Take Practice Quiz <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </motion.div>
  )
}
