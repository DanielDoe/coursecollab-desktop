"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ThumbsUp, Heart, Laugh, Flame, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface ReactionBarProps {
  announcementId: number
  studentId: string
  currentReaction?: string | null
  reactionsBreakdown?: Record<string, number>
  onReactionChange?: (reaction: string | null) => void
}

const reactions = [
  { type: 'like', icon: ThumbsUp, label: 'Like', emoji: '👍' },
  { type: 'love', icon: Heart, label: 'Love', emoji: '❤️' },
  { type: 'laugh', icon: Laugh, label: 'Laugh', emoji: '😂' },
  { type: 'wow', icon: Sparkles, label: 'Wow', emoji: '😮' },
  { type: 'fire', icon: Flame, label: 'Fire', emoji: '🔥' },
]

export function ReactionBar({ 
  announcementId, 
  studentId, 
  currentReaction, 
  reactionsBreakdown = {},
  onReactionChange 
}: ReactionBarProps) {
  const { toast } = useToast()
  const [myReaction, setMyReaction] = useState<string | null>(currentReaction || null)
  const [breakdown, setBreakdown] = useState(reactionsBreakdown)
  const [loading, setLoading] = useState(false)
  const [animatingReaction, setAnimatingReaction] = useState<string | null>(null)

  const handleReaction = async (reactionType: string) => {
    if (loading) return

    setLoading(true)
    setAnimatingReaction(reactionType)

    try {
      const response = await studentApiFetch(`/api/announcements/${announcementId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId,
          reactionType
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to react')
      }

      // Update local state based on action
      const newBreakdown = { ...breakdown }
      
      // Remove old reaction count
      if (myReaction && newBreakdown[myReaction]) {
        newBreakdown[myReaction] = Math.max(0, newBreakdown[myReaction] - 1)
        if (newBreakdown[myReaction] === 0) {
          delete newBreakdown[myReaction]
        }
      }

      // Update new reaction
      if (data.action === 'removed') {
        setMyReaction(null)
        onReactionChange?.(null)
      } else {
        newBreakdown[reactionType] = (newBreakdown[reactionType] || 0) + 1
        setMyReaction(reactionType)
        onReactionChange?.(reactionType)
      }

      setBreakdown(newBreakdown)

      // Refresh counts from server for accuracy
      try {
        const refreshRes = await studentApiFetch(`/api/announcements/${announcementId}/react`)
        const refreshData = await refreshRes.json()
        if (refreshRes.ok && refreshData.reactions) {
          const serverBreakdown = Object.entries(refreshData.reactions).reduce(
            (acc, [type, info]) => {
              acc[type] = Number((info as { count: number }).count ?? 0)
              return acc
            },
            {} as Record<string, number>,
          )
          setBreakdown(serverBreakdown)
        }
      } catch {
        // keep optimistic breakdown
      }

      // Show brief animation
      setTimeout(() => setAnimatingReaction(null), 600)
    } catch (error) {
      console.error('Error reacting:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to react",
        variant: "destructive"
      })
      setAnimatingReaction(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:justify-start justify-items-center max-w-md sm:max-w-none mx-auto sm:mx-0">
      {reactions.map(({ type, label, emoji }) => {
        const count = breakdown[type] || 0
        const isActive = myReaction === type
        const isAnimating = animatingReaction === type

        return (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onClick={() => handleReaction(type)}
            disabled={loading}
            className={cn(
              "h-9 px-2 sm:px-3 transition-all justify-center",
              isAnimating && "scale-110 animate-bounce",
              isActive &&
                "bg-sky-600 hover:bg-sky-700 text-white border-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 dark:border-sky-600",
            )}
          >
            <span className="text-base sm:mr-1.5">{emoji}</span>
            <span className="hidden sm:inline">{label}</span>
            {count > 0 && (
              <span className={cn(
                "ml-1 text-xs font-semibold",
                isActive ? "text-white" : "text-muted-foreground"
              )}>
                {count}
              </span>
            )}
          </Button>
        )
      })}
    </div>
  )
}

