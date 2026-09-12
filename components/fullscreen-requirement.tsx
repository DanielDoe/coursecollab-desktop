"use client"

import { Maximize2, AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { isMobileDevice } from "@/lib/device-utils"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

interface FullscreenRequirementProps {
  show: boolean
  onEnterFullscreen: () => void
}

export function FullscreenRequirement({
  show,
  onEnterFullscreen,
}: FullscreenRequirementProps) {
  const { alert } = useAppConfirm()

  // Don't show fullscreen requirement on mobile devices
  // Mobile devices can't run multiple tabs or Gemini concurrently, so fullscreen isn't needed
  if (!show || isMobileDevice()) return null

  const handleEnterFullscreen = async () => {
    try {
      const element = document.documentElement
      
      // Try all browser prefixes
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen()
      } else if ((element as any).mozRequestFullscreen) {
        await (element as any).mozRequestFullscreen()
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen()
      } else {
        await alert({
          title: "Fullscreen not supported",
          description: "Please use a modern browser that supports fullscreen mode.",
        })
      }
    } catch (error) {
      console.error("Failed to enter fullscreen:", error)
      await alert({
        title: "Could not enter fullscreen",
        description: "Please allow fullscreen permissions and try again.",
      })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[10000] flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md mx-4 border-2 border-yellow-500 dark:border-yellow-600"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-4">
            <AlertTriangle className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Fullscreen Mode Required
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              To ensure assessment integrity and prevent AI tool overlays, you must enter fullscreen mode to continue.
            </p>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 w-full">
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>Important:</strong> You cannot continue the assessment until fullscreen mode is enabled. 
              If you exit fullscreen during the assessment, you will be blocked until you restore it.
            </p>
          </div>

          {/* Enter Fullscreen Button */}
          <Button
            onClick={handleEnterFullscreen}
            size="lg"
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white text-lg py-6"
          >
            <Maximize2 className="h-5 w-5 mr-2" />
            Enter Fullscreen Mode
          </Button>

          {/* Instructions */}
            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>• Click the button above to enter fullscreen</p>
            <p>• Press ESC to exit fullscreen (you will be blocked until you restore it)</p>
            <p>• Fullscreen is required to prevent AI tool overlays</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
