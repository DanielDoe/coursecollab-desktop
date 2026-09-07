"use client"

import { useState } from "react"
import { ArrowLeft, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarNavigation } from "@/components/ai-tutor/SidebarNavigation"
import { ChatWindow } from "@/components/ai-tutor/ChatWindow"
import { BottomToolBar } from "@/components/ai-tutor/BottomToolBar"
import { TutorSettingsDrawer } from "@/components/ai-tutor/TutorSettingsDrawer"
import Link from "next/link"

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

export default function AITutorPage() {
  const [activeSidebarItem, setActiveSidebarItem] = useState("chat")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
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
  ])
  const [persona, setPersona] = useState("mentor")
  const [tone, setTone] = useState("beginner")
  const [chatModes, setChatModes] = useState({
    socratic: true,
    "deep-reasoning": true,
    "debug-explain": true,
    "step-by-step": true,
  })
  const [learningMemory, setLearningMemory] = useState({
    "remember-gaps": true,
    "detect-confusion": true,
  })

  const handleSendMessage = (message: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, newMessage])

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        message: "I understand your question. Let me help you with that!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modeTag: "Mentor Mode",
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 1000)
  }

  const handleQuickAction = (action: string) => {
    const actionMessages: Record<string, string> = {
      concept: "Explain the core concept",
      "mini-lesson": "Create a mini-lesson",
      debug: "Help me debug this code",
      "debug-trace": "Show me a debug trace",
      "doc-generator": "Generate documentation",
    }
    handleSendMessage(actionMessages[action] || action)
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8F7FF]">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">AI Learning Assistant</h1>
            <p className="text-xs text-slate-500">Your personal C++ mentor, Daniel Doe • Powered by GPT-4</p>
          </div>
        </div>
        <Link href="/student/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SidebarNavigation
          activeItem={activeSidebarItem}
          onItemClick={setActiveSidebarItem}
        />

        {/* Chat Window */}
        <div className="flex-1 flex flex-col relative">
          <ChatWindow 
            messages={messages} 
            modeTag="Mentor Mode" 
            onSettingsClick={() => setIsSettingsOpen(true)}
          />
          <BottomToolBar
            onSendMessage={handleSendMessage}
            onQuickAction={handleQuickAction}
          />
        </div>

        {/* Settings Drawer */}
        <TutorSettingsDrawer
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          learningMemory={learningMemory}
          onLearningMemoryChange={(id, value) => setLearningMemory((prev) => ({ ...prev, [id]: value }))}
        />
      </div>

    </div>
  )
}
