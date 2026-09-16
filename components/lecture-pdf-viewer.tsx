"use client"


import { studentApiFetch } from "@/lib/auth"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  AlertCircle,
  PenLine,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchLecturePdfDocument, type LecturePdfDocument } from "@/lib/lecture-pdf-document"
import { withInstructorApiInit } from "@/lib/instructor-api-headers"
import { lecturePdfDownloadName, buildLecturePdfProxyUrl } from "@/lib/resolve-lecture-pdf-url"
import { cn } from "@/lib/utils"

export type LecturePdfViewerHandle = {
  getActivePage: () => number
  scrollToPage: (page: number) => void
}

export type LecturePdfViewerProps = {
  pdfUrl: string
  title?: string
  allowDownload: boolean
  lectureId: number
  studentIdString: string | null
  /** Load PDF via same-origin proxy with instructor course headers (no student session). */
  useInstructorPdfProxy?: boolean
  /** Match faculty portal surfaces (--cc-accent, --card, --border). */
  facultyChrome?: boolean
  className?: string
  fillHeight?: boolean
  viewerCaptureRef?: React.RefObject<HTMLDivElement | null>
  onActivePageChange?: (page: number) => void
  workspaceEnabled?: boolean
  workspaceLabel?: string
  workspaceQuestionCount?: number
  onOpenWorkspace?: () => void
}

function PdfPageCanvas({
  pdf,
  pageNumber,
  width,
  scrollRoot,
}: {
  pdf: LecturePdfDocument
  pageNumber: number
  width: number
  scrollRoot: React.RefObject<HTMLDivElement | null>
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shouldRender, setShouldRender] = useState(false)
  const [height, setHeight] = useState(480)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const root = scrollRoot.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setShouldRender(true)
      },
      { root: root ?? null, rootMargin: "320px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    if (!shouldRender || width < 40) return
    let cancelled = false
    let renderTask: { cancel?: () => void; promise: Promise<void> } | null = null

    ;(async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = width / base.width
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) return
        const pixelWidth = Math.floor(viewport.width)
        const pixelHeight = Math.floor(viewport.height)
        canvas.width = pixelWidth
        canvas.height = pixelHeight
        canvas.style.width = `${pixelWidth}px`
        canvas.style.height = `${pixelHeight}px`
        setHeight(pixelHeight)
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        renderTask = page.render({ canvas, canvasContext: ctx, viewport })
        await renderTask.promise
      } catch (err) {
        if (cancelled) return
        console.warn("[PdfPageCanvas]", pageNumber, err)
      }
    })()

    return () => {
      cancelled = true
      renderTask?.cancel?.()
    }
  }, [shouldRender, pdf, pageNumber, width])

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="mx-auto w-full max-w-full bg-white shadow-sm ring-1 ring-slate-200/80 dark:bg-white dark:ring-white/10"
      style={{ minHeight: height }}
    >
      <canvas ref={canvasRef} className="mx-auto block max-w-full" />
    </div>
  )
}

/** PDF.js scroll viewer — tracks active page for AI assistant (native iframe PDF does not expose page). */
export const LecturePdfViewer = forwardRef<LecturePdfViewerHandle, LecturePdfViewerProps>(
  function LecturePdfViewer(
    {
      pdfUrl,
      title,
      allowDownload,
      lectureId,
      studentIdString,
      useInstructorPdfProxy = false,
      facultyChrome = false,
      className,
      fillHeight = false,
      viewerCaptureRef,
      onActivePageChange,
      workspaceEnabled = false,
      workspaceLabel = "Workspace",
      workspaceQuestionCount,
      onOpenWorkspace,
    },
    ref,
  ) {
    const fileUrl = useMemo(() => {
      if (studentIdString) {
        return buildLecturePdfProxyUrl(lectureId, { studentId: studentIdString })
      }
      if (useInstructorPdfProxy) {
        return buildLecturePdfProxyUrl(lectureId)
      }
      if (typeof window === "undefined") return pdfUrl
      if (!pdfUrl.startsWith("http://") && !pdfUrl.startsWith("https://")) {
        return `${window.location.origin}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`
      }
      return pdfUrl
    }, [pdfUrl, lectureId, studentIdString, useInstructorPdfProxy])

    const downloadUrl = useMemo(
      () =>
        studentIdString
          ? buildLecturePdfProxyUrl(lectureId, { studentId: studentIdString, download: true })
          : useInstructorPdfProxy
            ? buildLecturePdfProxyUrl(lectureId, { download: true })
            : fileUrl,
      [fileUrl, lectureId, studentIdString, useInstructorPdfProxy],
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
    const activePageRef = useRef(1)
    const pdfRef = useRef<LecturePdfDocument | null>(null)
    const viewedPagesRef = useRef<Set<number>>(new Set([1]))
    const pendingScrollPageRef = useRef<number | null>(null)
    const [progressHydrated, setProgressHydrated] = useState(false)

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isFs, setIsFs] = useState(false)
    const [pdf, setPdf] = useState<LecturePdfDocument | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageInput, setPageInput] = useState("1")
    const [viewerWidth, setViewerWidth] = useState(960)

    const publishActivePage = useCallback(
      (page: number, force = false) => {
        const next = Math.max(1, Math.min(numPages || page, page))
        if (!force && activePageRef.current === next) return
        activePageRef.current = next
        viewedPagesRef.current.add(next)
        setCurrentPage(next)
        setPageInput(String(next))
        onActivePageChange?.(next)
      },
      [numPages, onActivePageChange],
    )

    const scrollToPage = useCallback(
      (page: number) => {
        const target = Math.max(1, Math.min(numPages || 1, page))
        const el = pageRefs.current.get(target)
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        publishActivePage(target, true)
      },
      [numPages, publishActivePage],
    )

    useImperativeHandle(
      ref,
      () => ({
        getActivePage: () => activePageRef.current,
        scrollToPage,
      }),
      [scrollToPage],
    )

    useEffect(() => {
      setLoading(true)
      setLoadError(null)
      setPdf(null)
      setNumPages(0)
      pdfRef.current = null
      activePageRef.current = 1
      setCurrentPage(1)
      setPageInput("1")
    }, [fileUrl])

    useEffect(() => {
      let cancelled = false
      ;(async () => {
        try {
          const doc = await fetchLecturePdfDocument(
            fileUrl,
            useInstructorPdfProxy ? withInstructorApiInit({ cache: "no-store" }) : undefined,
          )
          if (cancelled) return
          pdfRef.current = doc
          setPdf(doc)
          setNumPages(doc.numPages)
          publishActivePage(1)
        } catch (err) {
          if (!cancelled) {
            setLoadError(err instanceof Error ? err.message : "Could not load PDF")
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [fileUrl, publishActivePage, useInstructorPdfProxy])

    useEffect(() => {
      const onFs = () => setIsFs(Boolean(document.fullscreenElement))
      document.addEventListener("fullscreenchange", onFs)
      return () => document.removeEventListener("fullscreenchange", onFs)
    }, [])

    useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const measure = () => setViewerWidth(Math.max(320, el.clientWidth - 24))
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [loading, numPages])

    const updateActivePageFromScroll = useCallback(() => {
      const root = scrollRef.current
      if (!root || numPages < 1) return
      const rootRect = root.getBoundingClientRect()
      const centerY = rootRect.top + rootRect.height * 0.35

      let bestPage = 1
      let bestDistance = Number.POSITIVE_INFINITY

      for (let page = 1; page <= numPages; page++) {
        const el = pageRefs.current.get(page)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        const pageCenter = rect.top + rect.height / 2
        const distance = Math.abs(pageCenter - centerY)
        if (distance < bestDistance) {
          bestDistance = distance
          bestPage = page
        }
      }

      publishActivePage(bestPage)
      viewedPagesRef.current.add(bestPage)
    }, [numPages, publishActivePage])

    useEffect(() => {
      const root = scrollRef.current
      if (!root || numPages < 1) return

      updateActivePageFromScroll()
      let raf = 0
      const onScroll = () => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(updateActivePageFromScroll)
      }
      root.addEventListener("scroll", onScroll, { passive: true })
      return () => {
        root.removeEventListener("scroll", onScroll)
        cancelAnimationFrame(raf)
      }
    }, [numPages, updateActivePageFromScroll])

    useEffect(() => {
      if (!studentIdString || !lectureId) return

      const loadProgress = async () => {
        try {
          const res = await fetch(
            `/api/student/lectures/${lectureId}/progress?studentId=${encodeURIComponent(studentIdString)}`,
          )
          if (!res.ok) return
          const data = await res.json()
          const completed = Array.isArray(data.progress?.completed_slides)
            ? data.progress.completed_slides.map((v: unknown) => Number(v)).filter((n: number) => n > 0)
            : []
          if (completed.length > 0) {
            viewedPagesRef.current = new Set(completed)
          }
          const lastPage = Number(data.progress?.last_viewed_slide_order)
          if (Number.isFinite(lastPage) && lastPage > 0) {
            viewedPagesRef.current.add(lastPage)
            activePageRef.current = lastPage
            setCurrentPage(lastPage)
            setPageInput(String(lastPage))
            pendingScrollPageRef.current = lastPage
          }
        } catch {
          /* ignore */
        } finally {
          setProgressHydrated(true)
        }
      }

      void loadProgress()
    }, [lectureId, studentIdString])

    useEffect(() => {
      if (!studentIdString || !lectureId || numPages < 1 || !progressHydrated) return

      const saveProgress = () => {
        const completedSlides = [...viewedPagesRef.current].sort((a, b) => a - b)
        studentApiFetch(`/api/student/lectures/${lectureId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id: studentIdString,
            current_slide: activePageRef.current,
            total_slides: numPages,
            completed_slides: completedSlides,
            bookmarked: false,
            confused: false,
            time_spent_seconds: 30,
            notes: "",
          }),
        }).catch(() => {})
      }

      saveProgress()
      const interval = window.setInterval(saveProgress, 45_000)
      return () => window.clearInterval(interval)
    }, [lectureId, studentIdString, numPages, currentPage, progressHydrated])

    useEffect(() => {
      if (!progressHydrated || numPages < 1) return
      const page = pendingScrollPageRef.current
      if (!page || page <= 1) return
      pendingScrollPageRef.current = null
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToPage(page))
      })
      return () => cancelAnimationFrame(raf)
    }, [progressHydrated, numPages, scrollToPage])

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault()
          scrollToPage(activePageRef.current - 1)
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault()
          scrollToPage(activePageRef.current + 1)
        }
      }
      window.addEventListener("keydown", onKeyDown)
      return () => window.removeEventListener("keydown", onKeyDown)
    }, [scrollToPage])

    const toggleFullscreen = async () => {
      const el = containerRef.current
      if (!el) return
      try {
        if (!document.fullscreenElement) await el.requestFullscreen()
        else await document.exitFullscreen()
      } catch {
        /* ignore */
      }
    }

    const goPrev = () => scrollToPage(activePageRef.current - 1)
    const goNext = () => scrollToPage(activePageRef.current + 1)

    const commitPageInput = () => {
      const parsed = Number.parseInt(pageInput, 10)
      if (Number.isFinite(parsed)) scrollToPage(parsed)
      else setPageInput(String(currentPage))
    }

    if (loadError) {
      return (
        <div
          className={cn(
            "flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10",
            className,
          )}
        >
          <AlertCircle className="h-10 w-10 text-red-500 dark:text-red-400" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Could not load PDF</p>
            <p className="mt-1 text-sm text-red-600/90 dark:text-red-300/80">{loadError}</p>
          </div>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              Open PDF in new tab
            </a>
          </Button>
        </div>
      )
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          "flex w-full min-w-0 flex-col overflow-hidden rounded-xl shadow-sm sm:rounded-2xl",
          facultyChrome
            ? "border border-[var(--border)] bg-[var(--card)]"
            : "border border-slate-200/90 bg-white dark:border-white/[0.08] dark:bg-slate-900/80",
          fillHeight && "h-full min-h-0 flex-1",
          className,
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-between gap-2 px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2",
            facultyChrome ? "border-b border-[var(--border)]" : "border-b border-slate-200/80 dark:border-white/[0.06]",
          )}
        >
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={goPrev}
              disabled={loading || currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 text-xs sm:gap-1.5 sm:text-sm">
              <Input
                className="h-8 w-11 px-1 text-center sm:w-14 sm:px-2"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitPageInput()
                  }
                }}
                disabled={loading || numPages < 1}
                aria-label="PDF page"
              />
              <span className="text-muted-foreground whitespace-nowrap tabular-nums">/ {numPages || "—"}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={goNext}
              disabled={loading || currentPage >= numPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 sm:hidden" asChild>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" aria-label="Open PDF in new tab">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" className="hidden h-8 gap-1.5 px-2.5 sm:inline-flex" asChild>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                Open
              </a>
            </Button>
            {workspaceEnabled && onOpenWorkspace ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 sm:hidden"
                  onClick={onOpenWorkspace}
                  aria-label={workspaceLabel}
                >
                  <PenLine className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hidden h-8 gap-1.5 px-2.5 sm:inline-flex"
                  onClick={onOpenWorkspace}
                >
                  <PenLine className="h-3.5 w-3.5 shrink-0" />
                  {workspaceLabel}
                  {workspaceQuestionCount != null && workspaceQuestionCount > 0 ? (
                    <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1 text-[10px]">
                      {workspaceQuestionCount}
                    </Badge>
                  ) : null}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={toggleFullscreen}
              aria-label={isFs ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            {allowDownload ? (
              <>
                <Button
                  variant="default"
                  size="icon"
                  className={cn(
                    "h-8 w-8 shrink-0 sm:hidden",
                    facultyChrome
                      ? "bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white border-0"
                      : "bg-primary hover:bg-primary/90 shadow-purple",
                  )}
                  asChild
                >
                  <a
                    href={downloadUrl}
                    download={lecturePdfDownloadName(title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Download PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className={cn(
                    "hidden h-8 gap-1.5 px-2.5 sm:inline-flex",
                    facultyChrome
                      ? "bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white border-0"
                      : "bg-primary hover:bg-primary/90 shadow-purple",
                  )}
                  asChild
                >
                  <a
                    href={downloadUrl}
                    download={lecturePdfDownloadName(title)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    Download
                  </a>
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div
          ref={(node) => {
            scrollRef.current = node
            if (viewerCaptureRef) {
              ;(viewerCaptureRef as React.MutableRefObject<HTMLDivElement | null>).current = node
            }
          }}
          className={cn(
            "relative overflow-y-auto overscroll-contain touch-pan-y",
            facultyChrome ? "bg-[var(--muted)]" : "bg-slate-100 dark:bg-slate-950",
            fillHeight ? "h-0 min-h-0 flex-1" : "max-h-[min(70vh,720px)] min-h-[min(60vh,640px)]",
          )}
          tabIndex={-1}
          aria-label="PDF slide scroll area"
        >
          {loading ? (
            <div
              className={cn(
                "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
                facultyChrome ? "bg-[var(--card)]/80" : "bg-white/80 dark:bg-slate-950/70",
              )}
            >
              <Loader2
                className={cn(
                  "h-9 w-9 animate-spin",
                  facultyChrome ? "text-[var(--cc-accent)]" : "text-primary",
                )}
              />
              <p
                className={cn(
                  "text-sm",
                  facultyChrome ? "text-[var(--cc-text-muted)]" : "text-slate-500 dark:text-slate-400",
                )}
              >
                Loading slides…
              </p>
            </div>
          ) : null}

          {pdf && numPages > 0 ? (
            <div className="flex flex-col gap-3 p-2 sm:gap-4 sm:p-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
                <div
                  key={pageNumber}
                  ref={(el) => {
                    if (el) pageRefs.current.set(pageNumber, el)
                    else pageRefs.current.delete(pageNumber)
                  }}
                >
                  <PdfPageCanvas
                    pdf={pdf}
                    pageNumber={pageNumber}
                    width={viewerWidth}
                    scrollRoot={scrollRef}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  },
)
