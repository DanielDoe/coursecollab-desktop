"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface LectureImageGeneratorProps {
  lectureId: number
  slideIndex: number
  slideHeading: string
  slideContent: string
  onImageGenerated?: (imageUrl: string) => void
}

export function LectureImageGenerator({
  lectureId,
  slideIndex,
  slideHeading,
  slideContent,
  onImageGenerated
}: LectureImageGeneratorProps) {
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const { toast } = useToast()

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch("/api/ai-lectures/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lecture_id: lectureId,
          slide_index: slideIndex,
          slide_heading: slideHeading,
          slide_content: slideContent,
          style: "simple vector diagram"
        })
      })

      const data = await response.json()

      if (response.ok) {
        setImageUrl(data.imageUrl)
        setGenerated(true)
        onImageGenerated?.(data.imageUrl)
        
        toast({
          title: "✨ Image Generated!",
          description: "AI has created a visual for this slide",
          duration: 3000
        })
      } else {
        throw new Error(data.error || "Failed to generate image")
      }
    } catch (error) {
      console.error("Image generation failed:", error)
      toast({
        title: "❌ Generation Failed",
        description: "Could not generate image. Please try again.",
        variant: "destructive"
      })
    } finally {
      setGenerating(false)
    }
  }

  if (generated && imageUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <Card className="bg-slate-900/30 border-slate-700/50 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/30">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-sm text-green-300">AI Generated Illustration</span>
          </div>
          <div className="p-4">
            <img 
              src={imageUrl} 
              alt={slideHeading}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-purple-500/30 backdrop-blur-sm">
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4">
            <ImageIcon className="h-8 w-8 text-purple-400" />
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-2">
            No Image Provided
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Let AI generate a visual illustration for this slide
          </p>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Illustration
              </>
            )}
          </Button>

          {generating && (
            <p className="text-xs text-gray-500 mt-3">
              This may take 10-30 seconds...
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  )
}


