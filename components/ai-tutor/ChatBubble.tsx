"use client"

"use client"

import { motion } from "framer-motion"
import { Bot, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { MiniLessonCard } from "./MiniLessonCard"
import { cn } from "@/lib/utils"

interface ChatBubbleProps {
  role: "user" | "assistant"
  message: string
  timestamp: string
  modeTag?: string
  lessonCard?: {
    title: string
    concept: string
    example: string
    visual: string[]
    quizButton?: boolean
  }
}

export function ChatBubble({ role, message, timestamp, modeTag, lessonCard }: ChatBubbleProps) {
  const isUser = role === "user"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 mb-6",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}

      <div className={cn("flex flex-col max-w-[75%]", isUser ? "items-end" : "items-start")}>
        {!isUser && modeTag && (
          <Badge className="mb-1 bg-purple-100 text-purple-700 border-purple-200 text-xs">
            {modeTag}
          </Badge>
        )}

        <div
          className={cn(
            "rounded-2xl px-5 py-4 shadow-md",
            isUser
              ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white"
              : "bg-purple-50 border border-purple-100 text-slate-800"
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>

        {lessonCard && <MiniLessonCard {...lessonCard} />}

        <span className="text-xs text-slate-400 mt-1 px-2">{timestamp}</span>
      </div>

      {isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </motion.div>
  )
}
