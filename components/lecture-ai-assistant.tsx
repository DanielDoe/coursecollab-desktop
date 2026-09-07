"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Brain, Lightbulb, HelpCircle, BookOpen, Sparkles, 
  MessageSquare, Loader2, ChevronRight, Code, FileText 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { LectureSlide } from "@/lib/types/lecture"

interface LectureAIAssistantProps {
  lectureTitle: string
  currentSlide: LectureSlide
  previousSlides: LectureSlide[]
  onXPEarned?: (xp: number) => void
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function LectureAIAssistant({ 
  lectureTitle, 
  currentSlide, 
  previousSlides,
  onXPEarned 
}: LectureAIAssistantProps) {
  const [loading, setLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState("")
  const [activeView, setActiveView] = useState<"actions" | "chat">("actions")

  const handleAIAction = async (action: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/ai-lectures/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lecture_title: lectureTitle,
          current_slide: currentSlide,
          previous_slides: previousSlides,
        }),
      })

      const data = await response.json()
      
      // Add to chat
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date()
        }
      ])
      
      setActiveView("chat")
      
      // Award XP for using AI features
      onXPEarned?.(5)
    } catch (error) {
      console.error("AI action failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleChatSubmit = async () => {
    if (!userInput.trim()) return

    const userMessage: ChatMessage = {
      role: "user",
      content: userInput,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setUserInput("")
    setLoading(true)

    try {
      const response = await fetch("/api/ai-lectures/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          lecture_title: lectureTitle,
          current_slide: currentSlide,
          previous_slides: previousSlides,
          user_question: userInput,
        }),
      })

      const data = await response.json()
      
      setChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date()
        }
      ])
      
      onXPEarned?.(5)
    } catch (error) {
      console.error("Chat failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const aiActions = [
    {
      id: "explain",
      label: "Explain Concept",
      icon: Brain,
      description: "Simplify this topic",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30"
    },
    {
      id: "example",
      label: "Generate Examples",
      icon: Lightbulb,
      description: "Show more examples",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30"
    },
    {
      id: "quiz",
      label: "Create Quiz",
      icon: HelpCircle,
      description: "Test my understanding",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30"
    },
    {
      id: "summarize",
      label: "Summarize Lecture",
      icon: FileText,
      description: "Recap everything so far",
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30"
    },
    {
      id: "simplify",
      label: "Explain Like I'm New",
      icon: BookOpen,
      description: "Use simpler terms",
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      borderColor: "border-pink-500/30"
    },
    {
      id: "code_explain",
      label: "Explain Code",
      icon: Code,
      description: "Line-by-line breakdown",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30"
    },
  ]

  return (
    <aside className="w-96 border-l border-white/10 flex flex-col bg-slate-900/50 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI Assistant</h3>
            <p className="text-xs text-gray-400">Your lecture copilot</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mt-3">
          <Button
            variant={activeView === "actions" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("actions")}
            className={`flex-1 ${
              activeView === "actions"
                ? "bg-purple-500 hover:bg-purple-600"
                : "bg-slate-800/50 border-slate-700 hover:bg-slate-700/50"
            }`}
          >
            <Brain className="h-4 w-4 mr-2" />
            Actions
          </Button>
          <Button
            variant={activeView === "chat" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("chat")}
            className={`flex-1 ${
              activeView === "chat"
                ? "bg-purple-500 hover:bg-purple-600"
                : "bg-slate-800/50 border-slate-700 hover:bg-slate-700/50"
            }`}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
            {chatMessages.length > 0 && (
              <Badge className="ml-2 bg-blue-500 text-white px-1.5 py-0.5 text-xs">
                {chatMessages.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeView === "actions" ? (
            <motion.div
              key="actions"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <ScrollArea className="h-full p-4">
                <div className="space-y-3">
                  {aiActions.map((action) => (
                    <motion.div
                      key={action.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        onClick={() => handleAIAction(action.id)}
                        disabled={loading}
                        className={`w-full justify-start h-auto p-4 ${action.bgColor} ${action.borderColor} border hover:bg-opacity-20 transition-all`}
                        variant="outline"
                      >
                        <action.icon className={`h-5 w-5 ${action.color} mr-3 flex-shrink-0`} />
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-white text-sm">{action.label}</p>
                          <p className="text-xs text-gray-400">{action.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-500 ml-2" />
                      </Button>
                    </motion.div>
                  ))}
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                    <span className="text-sm text-purple-300">AI is thinking...</span>
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col"
            >
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">
                        Ask me anything about this lecture!
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <Card className={`max-w-[85%] p-3 ${
                          msg.role === "user"
                            ? "bg-purple-500/20 border-purple-500/30"
                            : "bg-slate-800/50 border-slate-700/50"
                        }`}>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </Card>
                      </motion.div>
                    ))
                  )}
                  {loading && (
                    <div className="flex justify-start">
                      <Card className="bg-slate-800/50 border-slate-700/50 p-3">
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleChatSubmit()
                      }
                    }}
                    placeholder="Ask about this slide..."
                    className="flex-1 min-h-[60px] bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-500 resize-none"
                    disabled={loading}
                  />
                  <Button
                    onClick={handleChatSubmit}
                    disabled={loading || !userInput.trim()}
                    className="bg-purple-500 hover:bg-purple-600 self-end"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  )
}


