"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Tone {
  id: string
  label: string
}

const tones: Tone[] = [
  { id: "eli5", label: "ELI5" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "expert", label: "Expert" },
]

interface ToneSelectorProps {
  selectedTone?: string
  onSelect?: (toneId: string) => void
}

export function ToneSelector({ selectedTone = "beginner", onSelect }: ToneSelectorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-900">Tone & Explanation Mode</h4>
      <div className="flex flex-wrap gap-2">
        {tones.map((tone) => {
          const isSelected = selectedTone === tone.id
          return (
            <motion.button
              key={tone.id}
              onClick={() => onSelect?.(tone.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isSelected
                  ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {tone.label}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
