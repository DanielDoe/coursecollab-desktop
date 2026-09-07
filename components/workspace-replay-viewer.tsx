"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react"
import {
  getWorkspaceAtTime,
  getWorkspaceReplayDuration,
  workspaceReplayHasEvents,
  type WorkspaceReplay,
} from "@/lib/workspace-replay"
import {
  ensureWorkspaceImagesLoaded,
  renderWorkspacePage,
} from "@/lib/circuit-workspace-render"
import {
  getWorkspacePaperDimensions,
  type WorkspacePaperTheme,
} from "@/lib/circuit-workspace"

const SPEEDS = [0.5, 1, 2, 4] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  replay: WorkspaceReplay | null | undefined
  paperTheme?: WorkspacePaperTheme
}

export function WorkspaceReplayViewer({
  open,
  onOpenChange,
  replay,
  paperTheme = "light",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(1)
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 1600 })

  const hasReplay = workspaceReplayHasEvents(replay)
  const totalMs = getWorkspaceReplayDuration(replay)

  const paint = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !replay) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const workspace = getWorkspaceAtTime(replay, currentMs)
    const page = workspace.pages[workspace.activePageIndex] ?? workspace.pages[0]
    if (!page) return
    const paper = getWorkspacePaperDimensions(workspace)
    if (canvas.width !== paper.width || canvas.height !== paper.height) {
      canvas.width = paper.width
      canvas.height = paper.height
      setCanvasSize(paper)
    }
    await ensureWorkspaceImagesLoaded(page)
    renderWorkspacePage(ctx, page, {
      theme: paperTheme,
      paperPattern: workspace.paperPattern ?? "ruled",
      width: paper.width,
      height: paper.height,
    })
  }, [replay, currentMs, paperTheme])

  useEffect(() => {
    void paint()
  }, [paint, open])

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

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${min}m ${s}s` : `${min}m`
  }

  const handlePlayPause = () => {
    if (currentMs >= totalMs) setCurrentMs(0)
    setIsPlaying((p) => !p)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Workspace Replay</DialogTitle>
        </DialogHeader>

        {!hasReplay ? (
          <p className="text-sm text-slate-500">No workspace activity was recorded for this submission.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 overflow-hidden flex justify-center">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="max-h-[55vh] w-auto"
                style={{ maxWidth: "100%" }}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="icon" onClick={handlePlayPause}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setCurrentMs(0); setIsPlaying(false) }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMs(Math.max(0, currentMs - 500))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMs(Math.min(totalMs, currentMs + 500))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300 min-w-[5rem]">
                {formatDuration(currentMs)} / {formatDuration(totalMs)}
              </span>
              <div className="flex gap-1 ml-auto">
                {SPEEDS.map((s, i) => (
                  <Button
                    key={s}
                    variant={speedIndex === i ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSpeedIndex(i)}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
            </div>

            <Slider
              value={[currentMs]}
              min={0}
              max={Math.max(totalMs, 1)}
              step={50}
              onValueChange={(v) => {
                setCurrentMs(v[0] ?? 0)
                if (isPlaying) setIsPlaying(false)
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
