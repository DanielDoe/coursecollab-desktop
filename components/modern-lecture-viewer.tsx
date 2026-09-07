"use client"

import { useState, useEffect, useMemo } from "react"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { CORA_NAME } from "@/lib/cora/constants"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  MessageCircle,
  Bookmark,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Code,
  Image as ImageIcon,
  Play,
  HelpCircle,
  X,
  Send,
  ThumbsUp,
  ThumbsDown,
  Menu,
  Home
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/lib/app-toast"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Slide {
  id: number
  slide_order: number
  title: string
  subtitle: string | null
  content_type: 'text' | 'code' | 'image' | 'video' | 'interactive' | 'quiz'
  content: any
  background_gradient: string
  ai_summary: string
  ai_keywords: string[]
}

interface Lecture {
  id: number
  week: number
  title: string
  description: string
  learning_objectives: string[]
  slides: Slide[]
}

interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ModernLectureViewerProps {
  lecture: Lecture
  studentId?: number
  isInstructor?: boolean
  /** When set (e.g. /student/dashboard-v2/lectures), back button and next-week nav use this base path */
  lecturesBasePath?: string
  /** 1-based slide index for AI assistant sync */
  onActiveSlideChange?: (slideNumber: number) => void
}

/** Roster id for APIs keyed by `students.student_id`. Prefer localStorage session (works in a fresh tab). */
function getLectureStudentIdString(): string | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const fromSession = session?.id?.trim()
  if (fromSession) return fromSession
  return sessionStorage.getItem("studentId")
}

export function ModernLectureViewer({ lecture, studentId, isInstructor = false, lecturesBasePath, onActiveSlideChange }: ModernLectureViewerProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [completedSlides, setCompletedSlides] = useState<number[]>([])
  const [bookmarked, setBookmarked] = useState(false)
  const [confused, setConfused] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [aiInput, setAiInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [progressHydrated, setProgressHydrated] = useState(false)

  const canTrackStudent = useMemo(() => {
    if (isInstructor) return false
    return !!getLectureStudentIdString()
  }, [isInstructor, lecture.id])

  const effectiveStudentDbId = useMemo(() => {
    if (studentId != null && Number.isFinite(studentId)) return studentId
    const raw = getStudentData()?.databaseId
    if (raw == null || raw === "") return undefined
    const n = parseInt(String(raw), 10)
    return Number.isFinite(n) ? n : undefined
  }, [studentId, lecture.id])

  const slidesSafe = lecture.slides ?? []

  const currentSlide = slidesSafe[currentSlideIndex]
  const progress = slidesSafe.length > 0 ? ((currentSlideIndex + 1) / slidesSafe.length) * 100 : 0

  // Load progress and track view on mount
  useEffect(() => {
    if (!canTrackStudent) return
    setProgressHydrated(false)
    loadProgress()
    trackLectureView()
  }, [canTrackStudent, lecture.id])

  // Save progress when slide or completion changes (includes slide 0 / single-slide lectures)
  useEffect(() => {
    if (!canTrackStudent || !progressHydrated || !currentSlide) return
    saveProgress()
  }, [currentSlideIndex, completedSlides, progressHydrated, canTrackStudent, lecture.id])

  useEffect(() => {
    onActiveSlideChange?.(currentSlideIndex + 1)
  }, [currentSlideIndex, onActiveSlideChange])

  const loadProgress = async () => {
    if (!canTrackStudent) return

    try {
      const studentIdString = getLectureStudentIdString()
      if (!studentIdString) {
        console.warn("[Lecture Viewer] Student ID string not found (login / studentSession)")
        return
      }

      const res = await studentApiFetch(`/api/student/lectures/${lecture.id}/progress?studentId=${studentIdString}`)
      if (res.ok) {
        const data = await res.json()
        if (data.progress?.last_viewed_slide_order) {
          setCurrentSlideIndex(data.progress.last_viewed_slide_order - 1 || 0) // Convert to 0-based index
        }
        if (data.progress?.completed_slides) {
          const completed = Array.isArray(data.progress.completed_slides)
            ? data.progress.completed_slides.map((s: any) => (typeof s === "number" ? s : parseInt(s)))
            : []
          setCompletedSlides(completed)
        }
        if (data.progress?.bookmarked_slides) {
          const bookmarkedSlides = Array.isArray(data.progress.bookmarked_slides)
            ? data.progress.bookmarked_slides.map((s: any) => (typeof s === "number" ? s : parseInt(s)))
            : []
          setBookmarked(bookmarkedSlides.includes(currentSlide?.id || 0))
        }
        if (data.progress?.confusion_flags) {
          const confusionFlags = Array.isArray(data.progress.confusion_flags)
            ? data.progress.confusion_flags.map((s: any) => (typeof s === "number" ? s : parseInt(s)))
            : []
          setConfused(confusionFlags.includes(currentSlide?.id || 0))
        }
        setNotes(data.progress?.notes || "")
      }
    } catch (error) {
      console.error("Failed to load progress:", error)
    } finally {
      setProgressHydrated(true)
    }
  }

  const trackLectureView = async () => {
    if (!canTrackStudent) return

    try {
      const studentIdString = getLectureStudentIdString()
      if (!studentIdString) {
        console.warn("[Lecture Viewer] Student ID string not found for view tracking")
        return
      }

      await studentApiFetch(`/api/lectures/${lecture.id}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentIdString,
        }),
      })
    } catch (error) {
      console.error("Failed to track lecture view:", error)
    }
  }

  const saveProgress = async () => {
    if (!canTrackStudent || !currentSlide) return

    try {
      const studentIdString = getLectureStudentIdString()
      if (!studentIdString) {
        console.warn("[Lecture Viewer] Student ID string not found for save")
        return
      }

      const slideOrder = currentSlide.slide_order ?? currentSlideIndex + 1
      const openedSlides = [...new Set([...completedSlides, slideOrder])]

      // Calculate time spent (rough estimate based on slide navigation)
      const timeSpent = Math.max(1, (currentSlideIndex + 1) * 30) // Estimate 30 seconds per slide

      await studentApiFetch(`/api/student/lectures/${lecture.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentIdString,
          current_slide: slideOrder,
          total_slides: slidesSafe.length,
          completed_slides: openedSlides,
          bookmarked,
          confused,
          time_spent_seconds: timeSpent,
          notes,
        }),
      })

      void fetch("/api/lecture-slides/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideId: currentSlide.id,
          studentId: studentIdString,
        }),
      }).catch(() => {})
    } catch (error) {
      console.error("Failed to save progress:", error)
    }
  }

  const nextSlide = () => {
    if (!currentSlide) return
    const slideOrder = currentSlide.slide_order ?? currentSlideIndex + 1
    if (currentSlideIndex < slidesSafe.length - 1) {
      setCompletedSlides(prev => [...new Set([...prev, slideOrder])])
      setCurrentSlideIndex(prev => prev + 1)
    } else {
      setCompletedSlides(prev => [...new Set([...prev, slideOrder])])
    }
  }

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1)
    }
  }

  const goToSlide = (index: number) => {
    setCurrentSlideIndex(index)
    setShowMenu(false)
  }

  const askAI = async () => {
    if (!aiInput.trim() || aiLoading) return

    const userMessage: AIMessage = {
      role: 'user',
      content: aiInput,
      timestamp: new Date()
    }
    
    setAiMessages(prev => [...prev, userMessage])
    setAiInput("")
    setAiLoading(true)

    try {
      const res = await fetch('/api/ai-lectures/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: effectiveStudentDbId,
          lecture_id: lecture.id,
          slide_id: currentSlide.id,
          question: aiInput,
          context: {
            slide_title: currentSlide.title,
            slide_content: currentSlide.content,
            ai_summary: currentSlide.ai_summary
          }
        })
      })

      if (res.ok) {
        const data = await res.json()
        const aiMessage: AIMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }
        setAiMessages(prev => [...prev, aiMessage])
        
        // Show warning if AI is not properly configured
        if (data.isConfigured === false) {
          toast.error(`${CORA_NAME} is not configured`, {
            description: "Please contact your instructor"
          })
        }
      } else {
        const errorData = await res.json()
        
        // Still show the error message to the user in the chat
        if (errorData.response) {
          const aiMessage: AIMessage = {
            role: 'assistant',
            content: errorData.response,
            timestamp: new Date()
          }
          setAiMessages(prev => [...prev, aiMessage])
        }
        
        toast.error(`${CORA_NAME} Error`, {
          description: errorData.error || "Failed to get AI response"
        })
      }
    } catch (error) {
      console.error("AI error:", error)
      
      // Show error message in chat
      const errorMessage: AIMessage = {
        role: 'assistant',
        content: "❌ I'm having trouble connecting right now. Please try again in a moment, or ask your question in the lecture comments section.",
        timestamp: new Date()
      }
      setAiMessages(prev => [...prev, errorMessage])
      
      toast.error("Connection Error", {
        description: `Failed to connect to ${CORA_NAME}`
      })
    } finally {
      setAiLoading(false)
    }
  }

  const toggleBookmark = () => {
    setBookmarked(!bookmarked)
    toast.success(bookmarked ? "Bookmark removed" : "Lecture bookmarked")
  }

  const toggleConfused = () => {
    setConfused(!confused)
    toast.info(confused ? "Confusion flag removed" : "Marked as confusing - instructor will be notified")
  }

  const renderSlideContent = () => {
    const content = currentSlide.content

    switch (currentSlide.content_type) {
      case 'text':
        return (
          <div className="space-y-8">
            {content.text && (
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl max-w-5xl mx-auto">
                <p className="text-2xl text-gray-100 leading-relaxed font-light">
                  {content.text}
                </p>
              </div>
            )}

            {content.callout && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-indigo-900/60 to-purple-900/60 backdrop-blur-sm border-2 border-indigo-500/50 rounded-2xl p-8 shadow-2xl max-w-3xl mx-auto mt-8"
              >
                <p className="text-xl font-bold text-indigo-300 mb-3">{content.callout.title}</p>
                <p className="text-lg text-gray-200 leading-relaxed">{content.callout.text}</p>
              </motion.div>
            )}

            {/* Image after text, before AI keywords */}
            {content.image && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center max-w-2xl mx-auto mt-8"
              >
                <img
                  src={content.image.url}
                  alt={content.image.alt}
                  className="rounded-xl shadow-2xl w-full h-auto border-2 border-slate-700/50"
                />
                {content.image.caption && (
                  <p className="text-gray-400 text-sm mt-4 italic text-center">
                    {content.image.caption}
                  </p>
                )}
              </motion.div>
            )}

            {content.note && (
              <p className="text-lg text-gray-400 italic mt-6 max-w-3xl mx-auto text-center">
                {typeof content.note === 'string' ? content.note : content.note.text}
              </p>
            )}

            {content.button && (
              <div className="flex justify-center mt-8">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (content.button.action === 'next_week') {
                      // Navigate to next week's lectures
                      const nextWeek = lecture.week + 1
                      window.location.href = isInstructor 
                        ? `/instructor/lectures` 
                        : (lecturesBasePath ? `${lecturesBasePath}/${nextWeek}` : `/student/lectures/${nextWeek}`)
                    } else {
                      nextSlide()
                    }
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white text-xl font-semibold shadow-lg hover:shadow-xl hover:shadow-indigo-500/50 transition-all"
                >
                  {content.button.text}
                </motion.button>
              </div>
            )}
            
            {content.items && (
              <ul className="space-y-5 max-w-4xl mx-auto">
                {content.items.map((item: any, idx: number) => (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-4 text-xl text-gray-100 bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 rounded-xl p-6 hover:bg-slate-800/60 hover:border-indigo-500/30 transition-all duration-300 shadow-lg"
                  >
                    <span className="text-3xl flex-shrink-0">{item.icon}</span>
                    <span className="font-medium">{item.text}</span>
                  </motion.li>
                ))}
              </ul>
            )}

            {content.languages && (
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {content.languages.map((lang: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.15 }}
                    className="p-8 bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-4xl">{lang.icon}</span>
                      <h3 className="text-2xl font-bold text-white">{lang.name}</h3>
                    </div>
                    <p className="text-lg text-gray-200 leading-relaxed">{lang.description}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {content.summary && (
              <div className="space-y-5 max-w-4xl mx-auto">
                {content.summary.map((item: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center gap-4 text-xl text-gray-100 bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 rounded-xl p-6 shadow-lg"
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <span className="font-medium">{item.text}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {content.grid && (
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {content.grid.map((item: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-8 bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-4xl">{item.icon}</span>
                      <h3 className="text-2xl font-bold text-indigo-400">{item.title}</h3>
                    </div>
                    <p className="text-lg text-gray-200 leading-relaxed">{item.description}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {content.categories && (
              <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {content.categories.map((cat: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-8 bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-4xl">{cat.icon}</span>
                      <h3 className="text-2xl font-bold text-indigo-400">{cat.name}</h3>
                    </div>
                    <p className="text-xl font-mono text-purple-300 mb-3">{cat.operators}</p>
                    <p className="text-lg text-gray-300">{cat.description}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {content.flow && (
              <div className="flex flex-wrap justify-center items-center gap-4 max-w-6xl mx-auto">
                {content.flow.map((step: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.15 }}
                    className="relative"
                  >
                    <div className="p-6 bg-gradient-to-br from-indigo-800/70 to-purple-800/70 backdrop-blur-sm border-2 border-indigo-500/50 rounded-2xl shadow-2xl min-w-[140px] text-center">
                      <div className="text-4xl mb-2">{step.icon}</div>
                      <h4 className="text-lg font-bold text-white mb-1">{step.name}</h4>
                      <p className="text-sm text-gray-300">{step.description}</p>
                    </div>
                    {idx < content.flow.length - 1 && (
                      <div className="hidden md:block absolute top-1/2 -right-8 transform -translate-y-1/2 text-4xl text-indigo-400">
                        →
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {content.pitfalls && (
              <div className="space-y-4 max-w-4xl mx-auto">
                {content.pitfalls.map((pitfall: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-start gap-4 p-6 rounded-2xl border-2 backdrop-blur-sm shadow-lg ${
                      pitfall.type === 'error'
                        ? 'bg-red-900/20 border-red-500/50 hover:bg-red-900/30'
                        : 'bg-green-900/20 border-green-500/50 hover:bg-green-900/30'
                    } transition-all duration-300`}
                  >
                    <span className="text-3xl flex-shrink-0">{pitfall.icon}</span>
                    <div>
                      <p className="text-xl text-gray-100 font-semibold mb-2">{pitfall.text}</p>
                      <p className="text-base text-gray-400 italic">{pitfall.consequence}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {content.visualization && content.visualization.type === 'memory_boxes' && content.visualization.items && (
              <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto mt-8">
                {content.visualization.items.map((item: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.15 }}
                    className={`p-8 rounded-2xl border-2 backdrop-blur-sm shadow-2xl min-w-[200px] ${
                      item.color === 'indigo'
                        ? 'bg-indigo-900/60 border-indigo-500/50'
                        : item.color === 'teal'
                        ? 'bg-teal-900/60 border-teal-500/50'
                        : 'bg-slate-800/60 border-slate-500/50'
                    }`}
                  >
                    <h4 className="text-xl font-bold text-white mb-3 font-mono">{item.name}</h4>
                    <p className="text-2xl text-indigo-300 font-mono mb-2">{item.value}</p>
                    <p className="text-sm text-gray-400">{item.size}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {content.flowchart && content.flowchart.steps && (
              <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto mt-8">
                {content.flowchart.steps.map((step: any, idx: number) => (
                  <div key={idx} className="flex flex-col items-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.2 }}
                      className={`p-6 rounded-2xl border-2 backdrop-blur-sm shadow-2xl min-w-[250px] text-center ${
                        step.shape === 'oval'
                          ? 'rounded-full bg-indigo-900/60 border-indigo-500/50'
                          : step.shape === 'parallelogram'
                          ? 'bg-teal-900/60 border-teal-500/50 transform skew-x-6'
                          : 'bg-slate-800/60 border-slate-500/50'
                      }`}
                    >
                      <p className="text-xl font-semibold text-white">{step.text}</p>
                    </motion.div>
                    {idx < content.flowchart.steps.length - 1 && (
                      <div className="text-4xl text-indigo-400 my-2">↓</div>
                    )}
                  </div>
                ))}
                {content.flowchart.description && (
                  <p className="text-lg text-gray-400 italic mt-4">{content.flowchart.description}</p>
                )}
              </div>
            )}

            {content.keywords && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 max-w-4xl mx-auto mt-8">
                {content.keywords.map((keyword: string, idx: number) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-slate-800/70 backdrop-blur-sm border border-slate-600/50 px-4 py-2 rounded-lg text-center text-base font-mono text-indigo-300 hover:bg-slate-700/70 hover:border-indigo-500/50 transition-all shadow-lg"
                  >
                    {keyword}
                  </motion.span>
                ))}
              </div>
            )}

            {content.next_week && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 bg-gradient-to-br from-indigo-900/60 to-purple-900/60 backdrop-blur-sm border-2 border-indigo-500/50 rounded-2xl max-w-3xl mx-auto mt-10 shadow-2xl shadow-indigo-500/20"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl">{content.next_week.icon}</span>
                  <h3 className="text-3xl font-bold text-white">Next Week</h3>
                </div>
                <p className="text-2xl text-indigo-100 font-semibold mb-3">{content.next_week.topic}</p>
                <p className="text-lg text-gray-200 leading-relaxed">{content.next_week.details}</p>
              </motion.div>
            )}
          </div>
        )

      case 'code':
        return (
          <div className="space-y-8 max-w-5xl mx-auto">
            {content.text && (
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                <p className="text-2xl text-gray-100 leading-relaxed font-light">{content.text}</p>
              </div>
            )}
            
            {content.code && (
              <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-500/30 hover:border-indigo-500/60 transition-all duration-300">
                <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 px-6 py-4 border-b border-indigo-500/30">
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    {content.code.title}
                  </p>
                </div>
                <SyntaxHighlighter
                  language={content.code.language || 'plaintext'}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '2rem',
                    fontSize: '1.1rem',
                    background: '#0f172a',
                    lineHeight: '1.8'
                  }}
                  showLineNumbers
                >
                  {content.code.code}
                </SyntaxHighlighter>
              </div>
            )}

            {content.problem && content.solution && (
              <div className="grid md:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-8 bg-gradient-to-br from-red-900/40 to-red-950/40 backdrop-blur-sm border-2 border-red-500/50 rounded-2xl shadow-2xl"
                >
                  <h3 className="text-2xl font-bold text-red-300 mb-4 flex items-center gap-2">
                    ❌ Problem
                  </h3>
                  <SyntaxHighlighter
                    language={content.problem.language}
                    style={vscDarkPlus}
                    customStyle={{ fontSize: '1rem', background: '#0f172a', borderRadius: '0.75rem', padding: '1.5rem' }}
                    showLineNumbers
                  >
                    {content.problem.code}
                  </SyntaxHighlighter>
                  <p className="text-base text-red-200 mt-4 font-medium">{content.problem.issue}</p>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-8 bg-gradient-to-br from-green-900/40 to-emerald-950/40 backdrop-blur-sm border-2 border-green-500/50 rounded-2xl shadow-2xl"
                >
                  <h3 className="text-2xl font-bold text-green-300 mb-4 flex items-center gap-2">
                    ✅ Solution
                  </h3>
                  <p className="text-lg text-green-100 mb-4 font-medium">{content.solution.text}</p>
                  {content.solution.corrected_code && (
                    <SyntaxHighlighter
                      language="cpp"
                      style={vscDarkPlus}
                      customStyle={{ fontSize: '1rem', background: '#0f172a', borderRadius: '0.75rem', padding: '1.5rem' }}
                      showLineNumbers
                    >
                      {content.solution.corrected_code}
                    </SyntaxHighlighter>
                  )}
                </motion.div>
              </div>
            )}

            {content.comparison && content.comparison.manual && content.comparison.ai_optimized && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6 bg-slate-800/50 border-slate-700">
                  <h3 className="text-lg font-semibold text-gray-300 mb-3">
                    {content.comparison.manual.label || "Manual Approach"}
                  </h3>
                  <SyntaxHighlighter
                    language="cpp"
                    style={vscDarkPlus}
                    customStyle={{ fontSize: '0.85rem' }}
                  >
                    {content.comparison.manual.code || ""}
                  </SyntaxHighlighter>
                  {content.comparison.manual.complexity && (
                    <Badge className="mt-2" variant="outline">{content.comparison.manual.complexity}</Badge>
                  )}
                </Card>
                
                <Card className="p-6 bg-indigo-900/30 border-indigo-700">
                  <h3 className="text-lg font-semibold text-indigo-300 mb-3">
                    {content.comparison.ai_optimized.label || "AI Optimized"}
                  </h3>
                  <SyntaxHighlighter
                    language="cpp"
                    style={vscDarkPlus}
                    customStyle={{ fontSize: '0.85rem' }}
                  >
                    {content.comparison.ai_optimized.code || ""}
                  </SyntaxHighlighter>
                  {content.comparison.ai_optimized.complexity && (
                    <Badge className="mt-2 bg-indigo-600">{content.comparison.ai_optimized.complexity}</Badge>
                  )}
                  {content.comparison.ai_optimized.note && (
                    <p className="text-sm text-gray-400 mt-2">{content.comparison.ai_optimized.note}</p>
                  )}
                </Card>
              </div>
            )}
          </div>
        )

      case 'image':
        return (
          <div className="space-y-6 max-w-4xl mx-auto">
            {content.text && (
              <p className="text-xl text-gray-300 mb-6">{content.text}</p>
            )}
            
            {content.image && (
              <div className="flex flex-col items-center">
                <img
                  src={content.image.url}
                  alt={content.image.alt}
                  className="rounded-xl shadow-2xl max-w-2xl w-full"
                />
                {content.image.caption && (
                  <p className="text-gray-400 mt-4 text-center italic">{content.image.caption}</p>
                )}
              </div>
            )}
          </div>
        )

      case 'interactive':
        return (
          <div className="space-y-6 max-w-4xl mx-auto">
            {content.intro && (
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl mb-6">
                <p className="text-2xl text-gray-100 leading-relaxed font-light">{content.intro}</p>
              </div>
            )}
            
            {content.exercises && (
              <div className="space-y-6">
                {content.exercises.map((exercise: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-8 bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all duration-300"
                  >
                    <h3 className="text-2xl font-bold text-indigo-400 mb-4">
                      {exercise.title}
                    </h3>
                    <p className="text-xl text-gray-200 mb-4">{exercise.description}</p>
                    {exercise.hint && (
                      <p className="text-lg text-gray-400 italic">{exercise.hint}</p>
                    )}
                    {exercise.formula && (
                      <p className="text-lg text-purple-300 font-mono mt-3">{exercise.formula}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {content.bonus && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 bg-gradient-to-r from-yellow-900/40 to-orange-900/40 backdrop-blur-sm border-2 border-yellow-500/50 rounded-2xl shadow-xl mt-6"
              >
                <p className="text-xl text-yellow-100">{content.bonus.text}</p>
              </motion.div>
            )}

            {content.exercise && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 backdrop-blur-sm border-2 border-indigo-500/50 rounded-2xl shadow-xl mt-6"
              >
                <p className="text-xl font-bold text-indigo-300 mb-2">{content.exercise.title}</p>
                <p className="text-lg text-gray-200">{content.exercise.text}</p>
              </motion.div>
            )}
          </div>
        )

      case 'table':
        return (
          <div className="space-y-8 max-w-5xl mx-auto">
            {content.text && (
              <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                <p className="text-2xl text-gray-100 leading-relaxed font-light">{content.text}</p>
              </div>
            )}

            {content.table && content.table.headers && content.table.rows && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border-2 border-slate-700/50 shadow-2xl backdrop-blur-sm"
              >
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80">
                    <tr>
                      {content.table.headers.map((header: string, idx: number) => (
                        <th key={idx} className="px-8 py-5 text-left text-xl font-bold text-indigo-200 border-b-2 border-indigo-500/50">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-slate-800/60">
                    {content.table.rows.map((row: string[], rowIdx: number) => (
                      <motion.tr
                        key={rowIdx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: rowIdx * 0.05 }}
                        className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors"
                      >
                        {row.map((cell: string, cellIdx: number) => (
                          <td key={cellIdx} className="px-8 py-5 text-lg text-gray-200 font-mono">
                            {cell}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}

            {content.note && (
              <p className="text-lg text-gray-400 italic text-center">
                {typeof content.note === 'string' ? content.note : content.note.text}
              </p>
            )}
          </div>
        )

      default:
        return (
          <p className="text-gray-400">Content type not supported: {currentSlide.content_type}</p>
        )
    }
  }

  if (slidesSafe.length === 0 || !currentSlide) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white">
        <div className="max-w-lg space-y-4 text-center">
          <p className="text-lg text-slate-200">No interactive HTML slides for this lecture.</p>
          <p className="text-sm text-slate-500">
            If your instructor provided a PDF deck, open the <strong className="text-slate-300">Slides PDF</strong>{" "}
            tab on the lecture page.
          </p>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-200"
            onClick={() => {
              window.location.href =
                lecturesBasePath ||
                (isInstructor ? "/instructor/dashboard-v2/content/lectures" : "/student/dashboard-v2/lectures")
            }}
          >
            Back to lectures
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 dark:border-slate-600 bg-slate-900/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.href = lecturesBasePath || (isInstructor ? '/instructor/lectures' : '/student/lectures')}
                className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 shrink-0 text-slate-300 dark:text-slate-400 hover:text-white dark:hover:text-white"
                title="Back to Lectures"
              >
                <Home className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl font-bold break-words">
                  <span className="sm:hidden">W{lecture.week}</span>
                  <span className="hidden sm:inline md:hidden">Week {lecture.week}</span>
                  <span className="hidden md:inline">Week {lecture.week}: {lecture.title}</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                  Slide {currentSlideIndex + 1} of {slidesSafe.length}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {!isInstructor && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleBookmark}
                    className={`h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 ${bookmarked ? "text-yellow-400 dark:text-yellow-300" : "text-slate-300 dark:text-slate-400 hover:text-white dark:hover:text-white"}`}
                    title={bookmarked ? "Remove bookmark" : "Bookmark"}
                  >
                    <Bookmark className="h-4 w-4 sm:h-5 sm:w-5" fill={bookmarked ? "currentColor" : "none"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleConfused}
                    className={`h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 ${confused ? "text-orange-400 dark:text-orange-300" : "text-slate-300 dark:text-slate-400 hover:text-white dark:hover:text-white"}`}
                    title={confused ? "Remove confusion flag" : "Mark as confusing"}
                  >
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAI(!showAI)}
                    className={`h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 ${showAI ? "text-indigo-400 dark:text-indigo-300" : "text-slate-300 dark:text-slate-400 hover:text-white dark:hover:text-white"}`}
                    title={CORA_NAME}
                  >
                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMenu(!showMenu)}
                className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 text-slate-300 dark:text-slate-400 hover:text-white dark:hover:text-white"
                title="Menu"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3 sm:mt-4 h-1 bg-slate-700 dark:bg-slate-600 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 dark:bg-indigo-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Main content */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlideIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={`min-h-[calc(100vh-180px)] sm:min-h-[calc(100vh-150px)] md:min-h-[calc(100vh-120px)] flex flex-col justify-center items-center px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12 bg-gradient-to-br ${currentSlide.background_gradient}`}
            >
              <div className="w-full max-w-6xl">
                {/* Slide header */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-4 sm:mb-6 md:mb-8"
                >
                  <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 bg-gradient-to-r from-white via-gray-100 to-gray-300 dark:from-gray-100 dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent drop-shadow-2xl leading-tight break-words px-2">
                    {currentSlide.title}
                  </h2>
                  {currentSlide.subtitle && (
                    <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-200 dark:text-gray-300 font-light max-w-4xl mx-auto leading-relaxed break-words px-2">
                      {currentSlide.subtitle}
                    </p>
                  )}
                </motion.div>

                {/* Slide content */}
                {renderSlideContent()}

                {/* AI Keywords */}
                {currentSlide.ai_keywords && currentSlide.ai_keywords.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-wrap gap-3 justify-center mt-16"
                  >
                    {currentSlide.ai_keywords.map((keyword, idx) => (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 + idx * 0.1 }}
                        onClick={() => {
                          if (!isInstructor) {
                            setShowAI(true)
                            setAiInput(`Can you explain ${keyword} in the context of this lecture?`)
                            toast.success(`Ask AI about: ${keyword}`)
                          }
                        }}
                        disabled={isInstructor}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:shadow-indigo-500/50 transition-all duration-300 cursor-pointer border-2 border-indigo-400/30 hover:border-indigo-400/60 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                      >
                        <span className="text-base flex items-center gap-2">
                          {keyword}
                          {!isInstructor && (
                            <Sparkles className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="border-t border-slate-700 dark:border-slate-600 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md sticky bottom-0 shadow-2xl">
            <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <Button
                  onClick={prevSlide}
                  disabled={currentSlideIndex === 0}
                  size="lg"
                  className="gap-1.5 sm:gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-800 dark:hover:to-purple-800 text-white font-semibold px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 rounded-lg sm:rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs sm:text-sm md:text-base w-full sm:w-auto h-9 sm:h-10 md:h-auto"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span className="sm:hidden">Prev</span>
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto max-w-full px-2">
                  {slidesSafe.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToSlide(idx)}
                      className={`h-2.5 sm:h-3 rounded-full transition-all duration-300 hover:scale-110 shrink-0 ${
                        idx === currentSlideIndex
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400 w-8 sm:w-10 md:w-12 shadow-lg shadow-indigo-500/50'
                          : completedSlides.includes(slidesSafe[idx].id)
                          ? 'bg-green-500 dark:bg-green-400 w-2.5 sm:w-3 shadow-md shadow-green-500/50'
                          : 'bg-slate-600 dark:bg-slate-500 w-2.5 sm:w-3 hover:bg-slate-500 dark:hover:bg-slate-400'
                      }`}
                      title={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
                
                <Button
                  onClick={nextSlide}
                  disabled={currentSlideIndex === slidesSafe.length - 1}
                  size="lg"
                  className="gap-1.5 sm:gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 hover:from-indigo-700 hover:to-purple-700 dark:hover:from-indigo-800 dark:hover:to-purple-800 text-white font-semibold px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 rounded-lg sm:rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs sm:text-sm md:text-base w-full sm:w-auto h-9 sm:h-10 md:h-auto"
                >
                  <span className="sm:hidden">Next</span>
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Sidebar */}
        <AnimatePresence>
          {showAI && !isInstructor && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "100%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="lg:border-l border-t lg:border-t-0 border-slate-700 dark:border-slate-600 bg-slate-900 dark:bg-slate-800 flex flex-col h-auto lg:h-full w-full lg:w-[400px] lg:max-w-full"
            >
              <div className="p-3 sm:p-4 border-b border-slate-700 dark:border-slate-600 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400 dark:text-indigo-300 shrink-0" />
                  <h3 className="font-semibold text-sm sm:text-base dark:text-slate-200">
                    <span className="sm:hidden">AI</span>
                    <span className="hidden sm:inline">{CORA_NAME}</span>
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAI(false)}
                  className="h-8 w-8 sm:h-9 sm:w-9 text-slate-300 dark:text-slate-400 hover:text-white dark:hover:text-white shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
                {aiMessages.length === 0 ? (
                  <div className="text-center text-gray-400 dark:text-gray-500 py-8 sm:py-12 px-2">
                    <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-indigo-400 dark:text-indigo-300" />
                    <p className="text-xs sm:text-sm break-words">
                      <span className="sm:hidden">Ask me anything!</span>
                      <span className="hidden sm:inline">Ask me anything about this lecture!</span>
                    </p>
                    <p className="text-[10px] sm:text-xs mt-2 break-words">
                      <span className="sm:hidden">I can explain concepts</span>
                      <span className="hidden sm:inline">I can explain concepts, provide examples, or clarify doubts.</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {aiMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <Card className={`p-2.5 sm:p-3 max-w-[85%] rounded-lg sm:rounded-xl ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 dark:bg-indigo-700'
                            : 'bg-slate-800 dark:bg-slate-700 border border-slate-700 dark:border-slate-600'
                        }`}>
                          {msg.role === 'assistant' ? (
                            <FormattedAIResponse content={msg.content} />
                          ) : (
                            <p className="text-xs sm:text-sm text-white break-words">{msg.content}</p>
                          )}
                        </Card>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex gap-2 sm:gap-3">
                        <Card className="p-2.5 sm:p-3 bg-slate-800 dark:bg-slate-700 rounded-lg sm:rounded-xl">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-100" />
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-200" />
                          </div>
                        </Card>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-4 border-t border-slate-700 dark:border-slate-600 shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        askAI()
                      }
                    }}
                    placeholder="Ask a question..."
                    className="resize-none text-xs sm:text-sm rounded-lg sm:rounded-xl bg-slate-800 dark:bg-slate-700 border-slate-700 dark:border-slate-600 text-white dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    rows={2}
                  />
                  <Button
                    onClick={askAI}
                    disabled={!aiInput.trim() || aiLoading}
                    size="icon"
                    className="shrink-0 h-9 sm:h-10 w-9 sm:w-10 rounded-lg sm:rounded-xl bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slide Menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "100%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="lg:border-l border-t lg:border-t-0 border-slate-700 dark:border-slate-600 bg-slate-900 dark:bg-slate-800 w-full lg:w-[320px] lg:max-w-full"
            >
              <div className="p-3 sm:p-4 border-b border-slate-700 dark:border-slate-600 flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm sm:text-base dark:text-slate-200">
                  <span className="sm:hidden">Overview</span>
                  <span className="hidden sm:inline">Lecture Overview</span>
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMenu(false)}
                  className="h-8 w-8 sm:h-9 sm:w-9 text-slate-300 dark:text-slate-400 hover:text-white dark:hover:text-white shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="h-[calc(100vh-180px)] sm:h-[calc(100vh-150px)] md:h-[calc(100vh-120px)]">
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {/* Learning Objectives */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 mb-2 break-words">
                      <span className="sm:hidden">Objectives</span>
                      <span className="hidden sm:inline">Learning Objectives</span>
                    </h4>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {lecture.learning_objectives.map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 sm:gap-2">
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 dark:text-green-400 shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm text-gray-300 dark:text-gray-400 break-words">{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator className="bg-slate-700 dark:bg-slate-600" />

                  {/* Slides */}
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 mb-2">Slides</h4>
                    <div className="space-y-1.5 sm:space-y-2">
                      {slidesSafe.map((slide, idx) => (
                        <button
                          key={slide.id}
                          onClick={() => goToSlide(idx)}
                          className={`w-full text-left p-2.5 sm:p-3 rounded-lg transition-colors break-words ${
                            idx === currentSlideIndex
                              ? 'bg-indigo-600 dark:bg-indigo-700'
                              : 'bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                            <span className="text-[10px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500 shrink-0">
                              {slide.slide_order}
                            </span>
                            {completedSlides.includes(slide.id) && (
                              <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500 dark:text-green-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-gray-200 dark:text-gray-300 break-words">{slide.title}</p>
                          {slide.ai_summary && (
                            <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 break-words">
                              {slide.ai_summary}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isInstructor && (
                    <>
                      <Separator />

                      {/* Notes */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-400 mb-2">My Notes</h4>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          onBlur={saveProgress}
                          placeholder="Add your notes here..."
                          className="resize-none text-sm"
                          rows={4}
                        />
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Formatted AI Response Component with markdown support
function FormattedAIResponse({ content }: { content: string }) {
  // Split content by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)
  
  return (
    <div className="text-sm text-gray-200 space-y-2">
      {parts.map((part, idx) => {
        // Check if it's a code block
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n([\s\S]*?)```/)
          if (match) {
            const language = match[1] || 'text'
            const code = match[2].trim()
            return (
              <div key={idx} className="my-2">
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    padding: '0.75rem'
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            )
          }
        }
        
        // Regular text with formatting
        return (
          <div key={idx} className="space-y-2">
            {part.split('\n\n').map((paragraph, pIdx) => {
              if (!paragraph.trim()) return null
              
              // Check for lists
              if (paragraph.includes('\n- ') || paragraph.includes('\n• ')) {
                const items = paragraph.split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
                return (
                  <ul key={pIdx} className="list-disc list-inside space-y-1 ml-2">
                    {items.map((item, iIdx) => (
                      <li key={iIdx} className="text-gray-300">
                        {item.replace(/^[-•]\s*/, '')}
                      </li>
                    ))}
                  </ul>
                )
              }
              
              // Check for numbered lists
              if (/^\d+\.\s/.test(paragraph)) {
                const items = paragraph.split('\n').filter(line => /^\d+\.\s/.test(line.trim()))
                return (
                  <ol key={pIdx} className="list-decimal list-inside space-y-1 ml-2">
                    {items.map((item, iIdx) => (
                      <li key={iIdx} className="text-gray-300">
                        {item.replace(/^\d+\.\s*/, '')}
                      </li>
                    ))}
                  </ol>
                )
              }
              
              // Check for headers
              if (paragraph.startsWith('### ')) {
                return <h4 key={pIdx} className="font-semibold text-indigo-300 mt-3 mb-1">{paragraph.replace('### ', '')}</h4>
              }
              if (paragraph.startsWith('## ')) {
                return <h3 key={pIdx} className="font-bold text-indigo-300 text-base mt-3 mb-1">{paragraph.replace('## ', '')}</h3>
              }
              if (paragraph.startsWith('# ')) {
                return <h2 key={pIdx} className="font-bold text-indigo-300 text-lg mt-3 mb-1">{paragraph.replace('# ', '')}</h2>
              }
              
              // Format inline code, bold, and italic
              let formatted = paragraph
              // Inline code
              formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-slate-700 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs">$1</code>')
              // Bold
              formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
              // Italic
              formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="italic text-gray-300">$1</em>')
              
              return (
                <p 
                  key={pIdx} 
                  className="text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatted }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

