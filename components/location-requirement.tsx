"use client"

import { MapPin, AlertTriangle, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"

interface LocationRequirementProps {
  show: boolean
  isVerifying: boolean
  error: string | null
  onVerifyLocation: () => void
}

export function LocationRequirement({
  show,
  isVerifying,
  error,
  onVerifyLocation,
}: LocationRequirementProps) {
  if (!show) return null

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
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md mx-4 border-2 border-amber-500 dark:border-amber-600"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="bg-amber-100 dark:bg-amber-900/30 rounded-full p-4">
            <MapPin className="h-12 w-12 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Location Verification Required
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              This assessment requires you to be within a specific location. Please verify your location to continue.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 w-full">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-900 dark:text-red-100 text-left">{error}</p>
              </div>
            </div>
          )}

          {/* Verify Button */}
          <Button
            onClick={onVerifyLocation}
            disabled={isVerifying}
            size="lg"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg py-6 disabled:opacity-70"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Verifying location...
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5 mr-2" />
                Verify My Location
              </>
            )}
          </Button>

          {/* Instructions */}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Allow location access when prompted by your browser</p>
            <p>• You must be within the designated area to continue</p>
            <p>• Ensure location services are enabled on your device</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
