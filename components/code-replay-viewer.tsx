"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  getDocumentAtTime,
  analyzeReplayForSuspicion,
  getTimeSpentMs,
  getFinalDocumentLength,
  type TypingReplay,
} from "@/lib/typing-replay"

interface CodeReplayViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  replay: TypingReplay | null | undefined
  language?: string
}

const SPEEDS = [0.5, 1, 2, 4] as const

export function CodeReplayViewer({
  open,
  onOpenChange,
  replay,
  language = "cpp",
}: CodeReplayViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(1) // 1x default

  const hasReplay = replay?.events?.length
  const totalMs = hasReplay
    ? Math.max(...replay!.events.map((e) => e.t), 0) + 500
    : 0
  const suspicion = analyzeReplayForSuspicion(replay)
  const timeSpentMs = getTimeSpentMs(replay)
  const finalLen = getFinalDocumentLength(replay)

  const doc = getDocumentAtTime(replay, currentMs)

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${min}m ${s}s` : `${min}m`
  }

  const tick = useCallback(() => {
    setCurrentMs((prev) => {
      const next = prev + 50 * SPEEDS[speedIndex]
      if (next >= totalMs) {
        setIsPlaying(false)
        return totalMs
      }
      return next
    })
  }, [speedIndex, totalMs])

  useEffect(() => {
    if (!isPlaying || !hasReplay) return
    const id = setInterval(tick, 50)
    return () => clearInterval(id)
  }, [isPlaying, hasReplay, tick])


  const handlePlayPause = () => {
    if (currentMs >= totalMs) setCurrentMs(0)
    setIsPlaying((p) => !p)
  }

  const handleSliderChange = (v: number[]) => {
    setCurrentMs(v[0])
    if (isPlaying) setIsPlaying(false)
  }

  const handleReset = () => {
    setCurrentMs(0)
    setIsPlaying(false)
  }

  const stepBack = () => {
    const prev = Math.max(0, currentMs - 500)
    setCurrentMs(prev)
    if (isPlaying) setIsPlaying(false)
  }

  const stepForward = () => {
    const next = Math.min(totalMs, currentMs + 500)
    setCurrentMs(next)
    if (isPlaying && next >= totalMs) setIsPlaying(false)
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-4">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-lg">Typing Replay</DialogTitle>
            {hasReplay && (
              <p className="text-xs text-muted-foreground font-normal">
                Time spent: {formatDuration(timeSpentMs)} · {finalLen} chars
              </p>
            )}
          </div>
          {suspicion.flagged && (
            <Badge
              variant="destructive"
              className="flex items-center gap-1"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Flagged
            </Badge>
          )}
        </DialogHeader>

        {!hasReplay ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No replay data available for this answer.
          </p>
        ) : (
          <>
            {suspicion.flagged && suspicion.suspicionReasons.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 p-3 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Suspicious pattern detected
                </p>
                <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-0.5">
                  {suspicion.suspicionReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="font-mono text-sm bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-[320px] border border-slate-700">
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {doc || (
                    <span className="text-slate-500">(empty)</span>
                  )}
                </pre>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Slider
                    value={[currentMs]}
                    max={totalMs}
                    step={100}
                    onValueChange={handleSliderChange}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums w-20">
                    {Math.round(currentMs / 1000)}s / {Math.round(totalMs / 1000)}s
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={stepBack}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={stepForward}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1">
                    {SPEEDS.map((s, i) => (
                      <Button
                        key={s}
                        variant={speedIndex === i ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setSpeedIndex(i)}
                      >
                        {s}x
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
