"use client"

import { sanitizeUserHtml } from "@/lib/security/sanitize-html"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  Eye,
  Clock,
  FileText,
  Image,
  Presentation,
  X,
  Fullscreen,
  FullscreenExit,
} from "lucide-react"

interface Slide {
  id: number
  lecture_id: number
  slide_type: string
  title: string
  content: string | null
  file_url: string | null
  slide_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  lecture_title: string
  week: number
}

interface LectureSlidesViewerProps {
  lectureId: number
  lectureTitle: string
  week: number
  studentId: string
  onClose: () => void
}

export function LectureSlidesViewer({
  lectureId,
  lectureTitle,
  week,
  studentId,
  onClose,
}: LectureSlidesViewerProps) {
  const { toast } = useToast()
  const [slides, setSlides] = useState<Slide[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playInterval, setPlayInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchSlides()
  }, [lectureId])

  useEffect(() => {
    // Auto-play functionality
    if (isPlaying && slides.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
      }, 5000) // 5 seconds per slide
      setPlayInterval(interval)
    } else if (playInterval) {
      clearInterval(playInterval)
      setPlayInterval(null)
    }

    return () => {
      if (playInterval) {
        clearInterval(playInterval)
      }
    }
  }, [isPlaying, slides.length])

  const fetchSlides = async () => {
    try {
      const response = await fetch(`/api/lecture-slides?lectureId=${lectureId}&studentId=${studentId}`)
      const data = await response.json()
      
      if (response.ok) {
        setSlides(data.slides || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to load lecture slides",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch slides:", error)
      toast({
        title: "Error",
        description: "Failed to load lecture slides",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        prevSlide()
        break
      case "ArrowRight":
        nextSlide()
        break
      case " ":
        e.preventDefault()
        togglePlayPause()
        break
      case "Escape":
        if (isFullscreen) {
          setIsFullscreen(false)
        } else {
          onClose()
        }
        break
      case "f":
        toggleFullscreen()
        break
    }
  }

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  useEffect(() => {
    const slide = slides[currentSlideIndex]
    if (!slide?.id || !studentId) return

    void fetch("/api/lecture-slides/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slideId: slide.id,
        studentId,
      }),
    }).catch(() => {})
  }, [currentSlideIndex, slides, studentId])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Loading lecture slides...</p>
        </div>
      </div>
    )
  }

  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center max-w-md">
          <Presentation className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Slides Available</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            This lecture doesn't have any slides uploaded yet.
          </p>
          <Button onClick={onClose} className="bg-indigo-500 hover:bg-indigo-600">
            Close
          </Button>
        </div>
      </div>
    )
  }

  const currentSlide = slides[currentSlideIndex]
  const progress = ((currentSlideIndex + 1) / slides.length) * 100

  return (
    <div className={`fixed inset-0 z-50 ${isFullscreen ? "bg-black" : "bg-black/50 backdrop-blur-sm"}`}>
      <div className={`${isFullscreen ? "h-full" : "h-[90vh] mt-[5vh] mx-4"} bg-white dark:bg-slate-900 rounded-2xl overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold">{lectureTitle}</h2>
              <p className="text-indigo-100 text-sm">Week {week} • Slide {currentSlideIndex + 1} of {slides.length}</p>
            </div>
            <Badge className="bg-white/20 text-white border-white/30">
              {currentSlide.content_type?.toUpperCase() || 'SLIDE'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlayPause}
              className="text-white hover:bg-white/20"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Slide Content */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlideIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full flex items-center justify-center"
            >
              <Card className="w-full max-w-4xl h-full shadow-2xl border-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-3xl font-bold text-slate-800 dark:text-white">
                    {currentSlide.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-center p-8">
                  {currentSlide.slide_type === "html" && currentSlide.content ? (
                    <div 
                      className="w-full h-full prose prose-lg max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(currentSlide.content) }}
                    />
                  ) : currentSlide.slide_type === "pdf" && currentSlide.file_url ? (
                    <div className="w-full h-full">
                      <iframe
                        src={currentSlide.file_url}
                        className="w-full h-full rounded-lg"
                        title={currentSlide.title}
                      />
                    </div>
                  ) : currentSlide.slide_type === "pptx" && currentSlide.file_url ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Presentation className="h-24 w-24 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">PowerPoint Presentation</h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-4">
                          Click to view the presentation
                        </p>
                        <Button
                          onClick={() => window.open(currentSlide.file_url!, "_blank")}
                          className="bg-indigo-500 hover:bg-indigo-600"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Open Presentation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileText className="h-24 w-24 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Slide Content</h3>
                      <p className="text-slate-600 dark:text-slate-300">
                        {currentSlide.content || "No content available for this slide."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="bg-slate-50 dark:bg-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={prevSlide}
              disabled={currentSlideIndex === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentSlideIndex
                      ? "bg-indigo-500"
                      : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                  }`}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              onClick={nextSlide}
              disabled={currentSlideIndex === slides.length - 1}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Clock className="h-4 w-4" />
            <span>Use arrow keys or spacebar to navigate</span>
          </div>
        </div>
      </div>
    </div>
  )
}

