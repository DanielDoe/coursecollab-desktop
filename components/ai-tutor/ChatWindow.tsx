"use client"

"use client"

import { useState, useRef, useEffect } from "react"
import { X, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChatBubble } from "./ChatBubble"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EnhancedAIChat } from "@/components/enhanced-ai-chat"

interface Message {
  id: string
  role: "user" | "assistant"
  message: string
  timestamp: string
  modeTag?: string
  lessonCard?: {
    title: string
    concept: string
    example: string
    visual: string[]
  }
}

interface ChatWindowProps {
  messages?: Message[]
  modeTag?: string
  onClose?: () => void
  onSettingsClick?: () => void
  studentId?: string
  useEnhancedChat?: boolean
}

const sampleMessages: Message[] = [
  {
    id: "1",
    role: "user",
    message: "Can you explain how array indexing works?",
    timestamp: "11:24 AM",
  },
  {
    id: "2",
    role: "assistant",
    message: "Certainly! Array indexing is how you access individual elements in an array. Here's a quick overview.",
    timestamp: "11:24 AM",
    modeTag: "Mentor Mode",
    lessonCard: {
      title: "Array Indexing",
      concept: "Each element in an array has an **index** (a number starting from 0) that identifies its position.",
      example: `arr[0] = 5  // Accesses first element
arr[1] = 10 // Accesses second element`,
      visual: ["5", "10", "15"],
    },
  },
]

export function ChatWindow({ 
  messages = sampleMessages, 
  modeTag = "Mentor Mode", 
  onClose, 
  onSettingsClick,
  studentId,
  useEnhancedChat = true
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // If using enhanced chat, render the full component with custom styling
  if (useEnhancedChat && studentId) {
    return (
      <div className="flex flex-col flex-1 bg-[#F8F7FF] h-full relative">
        {/* Custom Header */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">AI Tutor Chat</h2>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200">
              {modeTag}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {onSettingsClick && (
              <Button variant="ghost" size="icon" onClick={onSettingsClick} className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Enhanced Chat Component - wrapped to match new design */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <EnhancedAIChat 
            studentId={studentId} 
            hideHeader={true}
            hideFooter={true}
            className="bg-[#F8F7FF]"
          />
        </div>
      </div>
    )
  }

  // Otherwise render the simple chat bubbles
  return (
    <div className="flex flex-col flex-1 bg-[#F8F7FF] h-full relative">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-900">AI Tutor Chat</h2>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">
            {modeTag}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {onSettingsClick && (
            <Button variant="ghost" size="icon" onClick={onSettingsClick} className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 px-8 py-6 pb-32">
        <div className="space-y-4">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              message={msg.message}
              timestamp={msg.timestamp}
              modeTag={msg.modeTag}
              lessonCard={msg.lessonCard}
            />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
