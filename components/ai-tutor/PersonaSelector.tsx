"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Persona {
  id: string
  name: string
  description: string
  avatar: string
  color: string
}

const personas: Persona[] = [
  {
    id: "mentor",
    name: "Mentor",
    description: "Wise and supportive",
    avatar: "👔",
    color: "blue",
  },
  {
    id: "debugging-expert",
    name: "Debugging Expert",
    description: "Technical specialist",
    avatar: "🔧",
    color: "purple",
  },
  {
    id: "friendly-buddy",
    name: "Friendly Buddy",
    description: "Casual and approachable",
    avatar: "😊",
    color: "green",
  },
  {
    id: "zen-tutor",
    name: "Zen Tutor",
    description: "Calm and patient",
    avatar: "🧘",
    color: "indigo",
  },
]

interface PersonaSelectorProps {
  selectedPersona?: string
  onSelect?: (personaId: string) => void
}

export function PersonaSelector({ selectedPersona = "mentor", onSelect }: PersonaSelectorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-900">Personas</h4>
      <div className="grid grid-cols-2 gap-3">
        {personas.map((persona) => {
          const isSelected = selectedPersona === persona.id
          return (
            <motion.button
              key={persona.id}
              onClick={() => onSelect?.(persona.id)}
              className={cn(
                "rounded-xl border-2 p-3 text-left transition-all duration-200",
                isSelected
                  ? "border-purple-400 bg-purple-50 shadow-sm"
                  : "border-slate-200 hover:border-purple-300 bg-white"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-xl">
                  {persona.avatar}
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-900">{persona.name}</p>
              <p className="text-xs text-slate-500">{persona.description}</p>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
