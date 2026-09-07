"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  Layers,
  Maximize2,
  Minimize2,
  Presentation,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { CampModuleBlock } from "@/lib/summer-camp/types"
import type { ModuleLayoutItem } from "@/lib/summer-camp/group-module-blocks"
import { sectionDisplayLabel } from "@/lib/summer-camp/group-module-blocks"
import { CampPresentationContext } from "@/components/summer-camp/camp-presentation-context"
import { CAMP_PRESENTATION_SLIDE_BODY } from "@/lib/summer-camp/camp-presentation-styles"

type Slide = {
  id: string
  title: string
  subtitle?: string
  estimatedMinutes?: number
  kind: "section" | "knowledge_check"
  /** Opening cover hero — full-bleed visual behind module title */
  isCoverSlide?: boolean
  render: () => ReactNode
}

/** Keep presentation slides scannable — chunk dense sections at block boundaries. */
const MAX_BLOCKS_PER_SLIDE = 4
const MAX_CHARS_PER_SLIDE = 3200

function chunkSectionBlocks(blocks: CampModuleBlock[]): CampModuleBlock[][] {
  if (blocks.length <= MAX_BLOCKS_PER_SLIDE) {
    const size = blocks.reduce((n, b) => n + JSON.stringify(b.content ?? {}).length, 0)
    if (size <= MAX_CHARS_PER_SLIDE) return [blocks]
  }

  const chunks: CampModuleBlock[][] = []
  let current: CampModuleBlock[] = []
  let currentSize = 0

  const flush = () => {
    if (current.length === 0) return
    chunks.push(current)
    current = []
    currentSize = 0
  }

  for (const block of blocks) {
    const blockSize = JSON.stringify(block.content ?? {}).length
    const wouldOverflow =
      current.length >= MAX_BLOCKS_PER_SLIDE ||
      (current.length > 0 && currentSize + blockSize > MAX_CHARS_PER_SLIDE)

    if (wouldOverflow) flush()

    current.push(block)
    currentSize += blockSize
  }

  flush()
  return chunks.length > 0 ? chunks : [blocks]
}

function parsePartMeta(title: string): { label: string; subtitle?: string; minutes?: number } {
  const partMatch = title.match(/^Part ([IVXLC\d]+)\s*[—–-]\s*(.+)$/i)
  if (partMatch) {
    return { label: `Part ${partMatch[1]}`, subtitle: partMatch[2].trim() }
  }
  const sectionMatch = title.match(/^Section \d+\s*[—–-]\s*(.+)$/)
  if (sectionMatch) return { label: sectionDisplayLabel(title), subtitle: sectionMatch[1].trim() }
  return { label: sectionDisplayLabel(title) }
}

function slideListTitle(slide: Slide): string {
  if (slide.kind === "knowledge_check") return slide.title
  return slide.subtitle ?? slide.title
}

function SlideNavigatorList({
  slides,
  activeIndex,
  onSelect,
}: {
  slides: Slide[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="max-h-[min(60vh,420px)] overflow-y-auto space-y-1 pr-1">
      {slides.map((s, i) => {
        const isActive = i === activeIndex
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
              isActive
                ? "bg-[#582c83] text-white shadow-md"
                : "hover:bg-violet-50 dark:hover:bg-violet-950/40 text-slate-800 dark:text-slate-200",
            )}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{slideListTitle(s)}</p>
                {s.kind === "section" && s.subtitle ? (
                  <p className={cn("text-xs mt-0.5 leading-snug", isActive ? "text-violet-100" : "text-slate-500 dark:text-slate-400")}>
                    {s.title}
                  </p>
                ) : null}
                {s.kind === "knowledge_check" ? (
                  <p className={cn("text-[10px] font-bold uppercase tracking-wide mt-1", isActive ? "text-amber-100" : "text-amber-700 dark:text-amber-400")}>
                    Knowledge check
                  </p>
                ) : null}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  layoutItems: ModuleLayoutItem[]
  renderSectionBlock: (
    block: CampModuleBlock,
    omitLeadingSectionHeading: boolean,
  ) => ReactNode
  shouldOmitLeadingSectionHeading: (block: CampModuleBlock, groupTitle: string) => boolean
  renderKnowledgeCheck: (block: CampModuleBlock) => ReactNode
  /** Instructor lecture deck — content-only slides, no student assessments. */
  mode?: "student" | "lecture"
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

export function CampPresentationModuleLayout({
  layoutItems,
  renderSectionBlock,
  shouldOmitLeadingSectionHeading,
  renderKnowledgeCheck,
  mode = "student",
  isFullscreen = false,
  onToggleFullscreen,
}: Props) {
  const isLecture = mode === "lecture"
  const slides = useMemo(() => {
    const out: Slide[] = []
    for (const item of layoutItems) {
      if (item.type === "knowledge_check") {
        out.push({
          id: `kc-${item.block.id}`,
          title: String((item.block.content as { title?: string }).title ?? "Knowledge Check"),
          kind: "knowledge_check",
          render: () => (
            <CampPresentationContext.Provider value={true}>{renderKnowledgeCheck(item.block)}</CampPresentationContext.Provider>
          ),
        })
        continue
      }
      const group = item.group
      const meta = parsePartMeta(group.title)
      const coverHero = group.blocks.find(
        (b) =>
          b.block_type === "hero" &&
          String((b.content as { variant?: string } | null)?.variant ?? "") === "cover",
      )
      const blockChunks = chunkSectionBlocks(group.blocks)

      blockChunks.forEach((chunkBlocks, chunkIndex) => {
        const multiChunk = blockChunks.length > 1
        out.push({
          id: multiChunk ? `${group.id}-chunk-${chunkIndex}` : group.id,
          title: meta.label,
          subtitle: multiChunk
            ? `${meta.subtitle ?? sectionDisplayLabel(group.title)} (${chunkIndex + 1}/${blockChunks.length})`
            : meta.subtitle,
          kind: "section",
          isCoverSlide: Boolean(coverHero) && chunkIndex === 0,
          render: () => (
            <CampPresentationContext.Provider value={true}>
              <div className={coverHero && chunkIndex === 0 ? "space-y-0" : "space-y-4 sm:space-y-5"}>
                {chunkBlocks.map((block, blockIndex) => {
                  const node = renderSectionBlock(
                    block,
                    blockIndex === 0 &&
                      chunkIndex === 0 &&
                      shouldOmitLeadingSectionHeading(block, group.title),
                  )
                  const isHero = block.block_type === "hero"
                  const isCoverChunk = Boolean(coverHero) && chunkIndex === 0

                  if (isHero) {
                    return <div key={block.id}>{node}</div>
                  }
                  if (isCoverChunk) {
                    return (
                      <div
                        key={block.id}
                        className="px-4 sm:px-6 py-3 sm:py-4 first-of-type:pt-4 sm:first-of-type:pt-5 last:pb-5 sm:last:pb-6"
                      >
                        <div className={CAMP_PRESENTATION_SLIDE_BODY}>{node}</div>
                      </div>
                    )
                  }
                  return (
                    <div key={block.id}>
                      <div className={CAMP_PRESENTATION_SLIDE_BODY}>{node}</div>
                    </div>
                  )
                })}
              </div>
            </CampPresentationContext.Provider>
          ),
        })
      })
    }
    return out
  }, [layoutItems, renderKnowledgeCheck, renderSectionBlock, shouldOmitLeadingSectionHeading])

  const [index, setIndex] = useState(0)
  const [navOpen, setNavOpen] = useState(false)
  const activePillRef = useRef<HTMLButtonElement>(null)
  const slide = slides[index]
  const total = slides.length

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.min(Math.max(next, 0), Math.max(total - 1, 0)))
    },
    [total],
  )

  const go = useCallback(
    (delta: number) => {
      goTo(index + delta)
    },
    [goTo, index],
  )

  useEffect(() => {
    activePillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1)
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1)
      if (e.key === "Home") goTo(0)
      if (e.key === "End") goTo(total - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, goTo, total])

  if (!slide || total === 0) return null

  const selectSlide = (i: number) => {
    goTo(i)
    setNavOpen(false)
  }

  const progressPct = total > 1 ? (index / (total - 1)) * 100 : 100

  return (
    <div className={cn("space-y-4", isLecture && isFullscreen && "space-y-3")}>
      <Dialog open={navOpen} onOpenChange={setNavOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-slate-200/80">
            <DialogTitle className="text-base">Jump to any slide</DialogTitle>
          </DialogHeader>
          <div className="p-2">
            <SlideNavigatorList slides={slides} activeIndex={index} onSelect={selectSlide} />
          </div>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "rounded-xl border px-3 sm:px-4 py-3 pb-4 space-y-3 overflow-visible",
          isLecture
            ? isFullscreen
              ? "border-white/10 bg-white/5"
              : "border-indigo-500/25 bg-indigo-500/8 dark:border-indigo-400/20 dark:bg-indigo-950/30"
            : "border-violet-500/20 bg-violet-500/5 dark:border-violet-400/15 dark:bg-violet-950/20",
        )}
      >
        {isLecture ? (
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 via-indigo-400 to-sky-400"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className={cn(
              "flex items-center gap-2 text-xs sm:text-sm",
              isLecture
                ? isFullscreen
                  ? "text-violet-100"
                  : "text-indigo-900 dark:text-indigo-200"
                : "text-violet-800 dark:text-violet-200",
            )}
          >
            {isLecture ? (
              <Presentation className="h-4 w-4 shrink-0" />
            ) : (
              <Layers className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">{isLecture ? "Lecture mode" : "Presentation mode"}</span>
            <span
              className={cn(
                "hidden sm:inline",
                isLecture
                  ? isFullscreen
                    ? "text-violet-200/70"
                    : "text-indigo-700/70 dark:text-indigo-300/80"
                  : "text-violet-600/70 dark:text-violet-300/70",
              )}
            >
              · ← → navigate · Home/End jump
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLecture && onToggleFullscreen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleFullscreen}
                className={cn(
                  "gap-1.5",
                  isFullscreen
                    ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                    : "border-indigo-300/60 bg-white/80 text-indigo-900 hover:bg-indigo-50 dark:border-indigo-400/30 dark:bg-indigo-950/50 dark:text-indigo-100 dark:hover:bg-indigo-900/40",
                )}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-4 w-4" />
                    Exit fullscreen
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4" />
                    Fullscreen
                  </>
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNavOpen(true)}
              className={cn(
                "gap-1.5",
                isLecture
                  ? isFullscreen
                    ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                    : "border-indigo-300/60 bg-white/80 text-indigo-900 hover:bg-indigo-50"
                  : "border-violet-300/60 bg-white/80 text-violet-900 hover:bg-violet-50 dark:border-violet-400/30 dark:bg-violet-950/40 dark:text-violet-100",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Slide {index + 1} of {total}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-visible py-1.5 pb-2.5 -mx-1 px-1 [scrollbar-width:thin]">
          {slides.map((s, i) => (
            <button
              key={s.id}
              ref={i === index ? activePillRef : undefined}
              type="button"
              aria-label={`Slide ${i + 1}: ${slideListTitle(s)}`}
              aria-current={i === index ? "step" : undefined}
              title={slideListTitle(s)}
              onClick={() => goTo(i)}
              className={cn(
                "size-7 sm:size-8 shrink-0 rounded-lg text-[10px] sm:text-xs font-bold transition-all",
                i === index
                  ? "bg-[#582c83] text-white shadow-md ring-2 ring-violet-300/50"
                  : s.kind === "knowledge_check"
                    ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                    : "bg-[#582c83]/12 text-violet-900 hover:bg-[#582c83]/25 dark:text-violet-100 dark:bg-white/10",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={slide.id}
          initial={{ opacity: 0, x: isLecture ? 48 : 24, scale: isLecture ? 0.985 : 1 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: isLecture ? -48 : -24, scale: isLecture ? 0.985 : 1 }}
          transition={{ duration: isLecture ? 0.38 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative overflow-hidden rounded-2xl sm:rounded-3xl border shadow-xl",
            isLecture ? "border-white/10" : "border-violet-500/25 dark:border-violet-400/20",
            slide.kind === "knowledge_check"
              ? "bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-950/40 dark:via-slate-900 dark:to-orange-950/30"
              : slide.isCoverSlide
                ? "bg-slate-950"
                : isLecture
                  ? "bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#020617]"
                  : "bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#0f172a]",
          )}
        >
        {!slide.isCoverSlide ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_15%_20%,#a78bfa_0%,transparent_45%),radial-gradient(circle_at_85%_75%,#38bdf8_0%,transparent_40%)]"
            aria-hidden
          />
        ) : null}

        {!slide.isCoverSlide ? (
          <header className="relative z-10 border-b border-white/10 px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[10px] sm:text-xs font-semibold uppercase tracking-widest",
                    slide.kind === "knowledge_check"
                      ? "text-amber-200"
                      : "text-violet-200",
                  )}
                >
                  {slide.kind === "knowledge_check" ? "Assessment" : slide.title}
                </p>
                <h2 className="mt-1 text-lg sm:text-2xl md:text-3xl font-bold leading-tight break-words text-white">
                  {slide.kind === "knowledge_check" ? slide.title : slide.subtitle ?? slide.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors hover:ring-2 hover:ring-white/20",
                    slide.kind === "knowledge_check"
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      : "bg-white/10 text-violet-100",
                  )}
                >
                  {index + 1} / {total}
                </button>
                {slide.estimatedMinutes ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-violet-100">
                    <Clock className="h-3 w-3" />
                    ~{slide.estimatedMinutes} min
                  </span>
                ) : null}
              </div>
            </div>
          </header>
        ) : (
          <div className="absolute top-4 right-4 z-20">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white/90 hover:bg-black/55 transition-colors"
            >
              {index + 1} / {total}
            </button>
          </div>
        )}

        <div
          className={cn(
            "relative z-10 w-full min-w-0",
            slide.isCoverSlide ? "px-0 py-0" : "px-4 sm:px-6 py-4 sm:py-6",
          )}
        >
          <div className={cn(slide.isCoverSlide && "p-0")}>{slide.render()}</div>
        </div>
        </motion.article>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={index === 0}
          onClick={() => go(-1)}
          className="gap-1 shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-center hover:text-violet-700 dark:hover:text-violet-300 transition-colors min-w-0 px-2"
        >
          <span className="font-semibold text-violet-800 dark:text-violet-300">
            Slide {index + 1} of {total}
          </span>
          <span className="hidden sm:block truncate max-w-[min(100%,28rem)] mx-auto mt-0.5">
            {slideListTitle(slide)}
          </span>
        </button>
        <Button
          type="button"
          size="sm"
          disabled={index >= total - 1}
          onClick={() => go(1)}
          className={cn(
            "gap-1 shrink-0 text-white",
            isLecture ? "bg-indigo-600 hover:bg-indigo-500" : "bg-[#582c83] hover:bg-[#6d3a9e]",
          )}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
