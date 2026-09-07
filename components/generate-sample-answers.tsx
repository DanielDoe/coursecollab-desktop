"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Sparkles, Code, CheckCircle, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

interface SampleAnswer {
  approach: string
  description: string
  code: string
}

interface GenerateSampleAnswersProps {
  questionId: number
  questionText: string
  questionType: string
  correctAnswer?: string
  hint?: string
  onGenerated?: (sampleAnswers: SampleAnswer[]) => void
}

export function GenerateSampleAnswers({
  questionId,
  questionText,
  questionType,
  correctAnswer,
  hint,
  onGenerated
}: GenerateSampleAnswersProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAnswers, setGeneratedAnswers] = useState<SampleAnswer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const aiGradableTypes = ['code_write', 'code_explain', 'code_problem', 'debug_code', 'code_debug']
  const isAiGradable = aiGradableTypes.includes(questionType.toLowerCase())

  const handleGenerate = async () => {
    if (!isAiGradable) {
      toast({
        title: "Not Supported",
        description: "Sample answers can only be generated for AI-gradable question types.",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedAnswers(null)

    try {
      const response = await fetch('/api/ai/generate-sample-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          questionText,
          questionType,
          correctAnswer,
          hint
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate sample answers')
      }

      setGeneratedAnswers(data.sampleAnswers)
      onGenerated?.(data.sampleAnswers)

      toast({
        title: "Sample Answers Generated!",
        description: `Successfully generated ${data.sampleAnswers.length} sample answers.`,
        variant: "default"
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate sample answers'
      setError(errorMessage)
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isAiGradable) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Sample Answers Not Available
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Sample answers can only be generated for AI-gradable question types: {aiGradableTypes.join(', ')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          AI Sample Answers Generator
        </CardTitle>
        <CardDescription>
          Generate sample answers for this AI-gradable question to help students learn from different approaches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {questionType}
            </Badge>
            <span className="text-sm text-slate-600 dark:text-slate-400">Question ID: {questionId}</span>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Sample Answers
              </>
            )}
          </Button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Generation Failed</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {generatedAnswers && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-800 dark:text-green-200">
                Successfully generated {generatedAnswers.length} sample answers!
              </span>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Code className="h-4 w-4" />
                Generated Sample Answers
              </h4>
              {generatedAnswers.map((answer, index) => (
                <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-slate-900 dark:text-slate-100">
                        {answer.approach}
                      </h5>
                      <Badge variant="outline" className="text-xs">
                        Approach {index + 1}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {answer.description}
                    </p>
                  </div>
                  <div className="p-4">
                    <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded border">
                      {answer.code}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
