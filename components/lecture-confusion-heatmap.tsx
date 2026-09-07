"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Presentation, AlertCircle, MessageSquare, Eye, 
  Flame, TrendingUp, Lightbulb, Loader2, ChevronRight
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SlideConfusion {
  slide_id: number
  lecture_id: number
  lecture_title: string
  week: number
  slide_title: string
  slide_order: number
  question_count: number
  student_count: number
  questions: Array<{
    id: number
    student_name: string
    message: string
    timestamp: string
  }>
  confusion_level: 'low' | 'medium' | 'high' | 'critical'
}

interface ImprovementSuggestion {
  slide_id: number
  suggestions: string[]
  generated_at: string
}

export function LectureConfusionHeatmap() {
  const [confusionData, setConfusionData] = useState<SlideConfusion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlide, setSelectedSlide] = useState<SlideConfusion | null>(null)
  const [showQuestions, setShowQuestions] = useState(false)
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion | null>(null)
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false)

  useEffect(() => {
    fetchConfusionData()
  }, [])

  const fetchConfusionData = async () => {
    try {
      const response = await instructorApiFetch('/api/instructor/ai-tutor/lecture-confusion')
      const data = await response.json()
      
      if (response.ok) {
        setConfusionData(data.slides || [])
      }
    } catch (error) {
      console.error('Failed to fetch confusion data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateImprovementSuggestions = async (slide: SlideConfusion) => {
    setGeneratingSuggestions(true)
    try {
      const response = await instructorApiFetch('/api/instructor/ai-tutor/slide-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideId: slide.slide_id,
          questions: slide.questions.map(q => q.message)
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setSuggestions(data.suggestions)
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error)
    } finally {
      setGeneratingSuggestions(false)
    }
  }

  const getConfusionColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-white'
      case 'low': return 'bg-green-500 text-white'
      default: return 'bg-slate-500 text-white'
    }
  }

  const getConfusionBorder = (level: string) => {
    switch (level) {
      case 'critical': return 'border-red-500 ring-2 ring-red-200'
      case 'high': return 'border-orange-500 ring-2 ring-orange-200'
      case 'medium': return 'border-yellow-500 ring-2 ring-yellow-200'
      case 'low': return 'border-green-500'
      default: return 'border-slate-300'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Analyzing lecture confusion patterns...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
        <div className="flex items-center gap-3 mb-2">
          <Flame className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Confusing Slide Heatmap</h2>
        </div>
        <p className="text-orange-100">
          Visual analysis of which lecture slides generate the most AI questions
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Confusion Level:</span>
        <Badge className="bg-green-500 text-white">Low (1-2 Q's)</Badge>
        <Badge className="bg-yellow-500 text-white">Medium (3-5 Q's)</Badge>
        <Badge className="bg-orange-500 text-white">High (6-10 Q's)</Badge>
        <Badge className="bg-red-500 text-white">Critical (10+ Q's)</Badge>
      </div>

      {/* Heatmap Grid */}
      {confusionData.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="text-center py-16">
            <Presentation className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              No Confusion Data Yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Data will appear as students ask AI questions during lectures
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Group by lecture/week */}
          {Object.entries(
            confusionData.reduce((acc, slide) => {
              const key = `Week ${slide.week}: ${slide.lecture_title}`
              if (!acc[key]) acc[key] = []
              acc[key].push(slide)
              return acc
            }, {} as Record<string, SlideConfusion[]>)
          ).map(([lectureKey, slides]) => (
            <div key={lectureKey} className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Presentation className="h-5 w-5 text-indigo-600" />
                {lectureKey}
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {slides.map((slide, index) => (
                  <motion.div
                    key={slide.slide_id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all",
                      getConfusionBorder(slide.confusion_level),
                      "hover:shadow-lg"
                    )}
                    onClick={() => {
                      setSelectedSlide(slide)
                      setShowQuestions(true)
                      setSuggestions(null)
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={cn("text-xs", getConfusionColor(slide.confusion_level))}>
                        {slide.confusion_level.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-slate-500">#{slide.slide_order}</span>
                    </div>

                    <div className="mb-3">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 mb-1">
                        {slide.slide_title || `Slide ${slide.slide_order}`}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <MessageSquare className="w-3 h-3" />
                        <span>{slide.question_count} questions</span>
                      </div>
                    </div>

                    {slide.question_count >= 6 && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                        <Flame className="w-3 h-3" />
                        <span>Hot Slide</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide Questions Dialog */}
      <Dialog open={showQuestions} onOpenChange={setShowQuestions}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Presentation className="h-6 w-6 text-indigo-600" />
              {selectedSlide?.slide_title || `Slide ${selectedSlide?.slide_order}`}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">{selectedSlide?.lecture_title}</Badge>
              <Badge className={cn(getConfusionColor(selectedSlide?.confusion_level || 'low'))}>
                {selectedSlide?.confusion_level.toUpperCase()}
              </Badge>
              <Badge variant="secondary">
                {selectedSlide?.question_count} questions from {selectedSlide?.student_count} students
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* AI Improvement Suggestions */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-purple-600" />
                  AI-Generated Improvement Suggestions
                </h4>
                <Button
                  size="sm"
                  onClick={() => selectedSlide && generateImprovementSuggestions(selectedSlide)}
                  disabled={generatingSuggestions}
                  className="bg-purple-600 hover:bg-purple-700 rounded-full"
                >
                  {generatingSuggestions ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              {suggestions ? (
                <div className="space-y-2">
                  {suggestions.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-white/50 dark:bg-slate-800/50">
                      <ChevronRight className="w-4 h-4 text-purple-600 mt-0.5" />
                      <p className="text-sm text-purple-900 dark:text-purple-100">{suggestion}</p>
                    </div>
                  ))}
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-3">
                    💡 Generated {new Date(suggestions.generated_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  Click "Generate" to get AI-powered suggestions for improving this slide based on student questions
                </p>
              )}
            </div>

            {/* Questions List */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                Student Questions ({selectedSlide?.questions.length || 0})
              </h4>

              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {selectedSlide?.questions.map((question, index) => (
                    <motion.div
                      key={question.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                          {question.student_name}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {question.timestamp}
                        </span>
                      </div>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        "{question.message}"
                      </p>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Navigation to Slide */}
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-full"
                onClick={() => {
                  // Navigate to lecture slide editor
                  window.location.href = `/instructor/lectures?editSlide=${selectedSlide?.slide_id}`
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                View & Edit Slide
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

