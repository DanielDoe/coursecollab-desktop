"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Code, Image as ImageIcon, Video, HelpCircle, CheckCircle2, XCircle, Lightbulb } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LectureSlide as LectureSlideType } from "@/lib/types/lecture"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { LectureImageGenerator } from "@/components/lecture-image-generator"

interface LectureSlideProps {
  slide: LectureSlideType
  slideIndex: number
  lectureId?: number
  onQuizAnswer?: (isCorrect: boolean) => void
  onSlideComplete?: () => void
  onImageGenerated?: (imageUrl: string) => void
}

export function LectureSlide({ slide, slideIndex, lectureId, onQuizAnswer, onSlideComplete, onImageGenerated }: LectureSlideProps) {
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null)
  const [showQuizResult, setShowQuizResult] = useState(false)

  const handleQuizSubmit = (selectedOption: string) => {
    if (slide.quiz) {
      const isCorrect = selectedOption === slide.quiz.answer
      setQuizAnswer(selectedOption)
      setShowQuizResult(true)
      onQuizAnswer?.(isCorrect)
      
      // Mark slide as complete after quiz
      if (isCorrect) {
        setTimeout(() => {
          onSlideComplete?.()
        }, 2000)
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="h-full flex flex-col"
    >
      {/* Slide Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 px-3 py-1">
            Slide {slideIndex + 1}
          </Badge>
          {slide.type && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 px-3 py-1 capitalize">
              {slide.type}
            </Badge>
          )}
        </div>
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
          {slide.heading}
        </h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {/* Text Content */}
        {slide.content && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="prose prose-invert max-w-none"
          >
            <p className="text-lg text-gray-300 leading-relaxed whitespace-pre-wrap">
              {slide.content}
            </p>
          </motion.div>
        )}

        {/* Code Block */}
        {slide.code && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                <Code className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-mono text-gray-400">
                  {slide.codeLanguage || 'cpp'}
                </span>
              </div>
              <div className="p-4 overflow-x-auto">
                <SyntaxHighlighter
                  language={slide.codeLanguage || 'cpp'}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: 0,
                    background: 'transparent',
                    fontSize: '0.9rem'
                  }}
                  showLineNumbers
                >
                  {slide.code}
                </SyntaxHighlighter>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Image or AI Generator */}
        {slide.image ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-slate-900/30 border-slate-700/50 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                <ImageIcon className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-gray-400">
                  {(slide as any).ai_generated ? "AI Generated Diagram" : "Diagram"}
                </span>
              </div>
              <div className="p-4">
                <img 
                  src={slide.image} 
                  alt={slide.heading}
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </Card>
          </motion.div>
        ) : (slide as any).image_missing && lectureId ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <LectureImageGenerator
              lectureId={lectureId}
              slideIndex={slideIndex}
              slideHeading={slide.heading}
              slideContent={slide.content}
              onImageGenerated={onImageGenerated}
            />
          </motion.div>
        ) : null}

        {/* Video */}
        {slide.video && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-slate-900/30 border-slate-700/50 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                <Video className="h-4 w-4 text-pink-400" />
                <span className="text-sm text-gray-400">Video Content</span>
              </div>
              <div className="aspect-video">
                <video 
                  src={slide.video}
                  controls
                  className="w-full h-full"
                />
              </div>
            </Card>
          </motion.div>
        )}

        {/* Quiz */}
        {slide.quiz && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="h-5 w-5 text-purple-400" />
                  <h3 className="text-xl font-semibold text-white">Quick Check</h3>
                </div>
                
                <p className="text-lg text-gray-200 mb-4">{slide.quiz.question}</p>

                <div className="space-y-3">
                  {slide.quiz.options.map((option, index) => {
                    const isSelected = quizAnswer === option
                    const isCorrect = option === slide.quiz!.answer
                    const showResult = showQuizResult && isSelected

                    return (
                      <Button
                        key={index}
                        onClick={() => !showQuizResult && handleQuizSubmit(option)}
                        disabled={showQuizResult}
                        className={`w-full justify-start text-left p-4 h-auto transition-all ${
                          showResult
                            ? isCorrect
                              ? 'bg-green-500/20 border-green-500 text-green-100 hover:bg-green-500/20'
                              : 'bg-red-500/20 border-red-500 text-red-100 hover:bg-red-500/20'
                            : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 text-gray-200'
                        }`}
                        variant="outline"
                      >
                        <span className="flex-1">{option}</span>
                        {showResult && (
                          isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-green-400 ml-2" />
                          ) : isSelected ? (
                            <XCircle className="h-5 w-5 text-red-400 ml-2" />
                          ) : null
                        )}
                      </Button>
                    )
                  })}
                </div>

                {showQuizResult && slide.quiz.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-blue-300 mb-1">Explanation</p>
                        <p className="text-sm text-gray-300">{slide.quiz.explanation}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

