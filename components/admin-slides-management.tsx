"use client"

import { sanitizeUserHtml } from "@/lib/security/sanitize-html"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Upload,
  FileText,
  Image,
  Presentation,
  Code,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Copy,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
} from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  LECTURE_DIALOG_BODY,
  LECTURE_DIALOG_FOOTER,
  LECTURE_DIALOG_HEADER,
  LECTURE_DIALOG_SHELL,
  LECTURE_DIALOG_SHELL_WIDE,
} from "@/components/lecture-modal-shell"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CTA, PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"

const lecturesChrome = facultyEmbedChrome("lectures")
const fp = lecturesChrome.p

function getLectureSlidesHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = { ...buildInstructorApiHeaders() }
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("instructorSession")
    if (raw) h.authorization = raw
    const instructorId = localStorage.getItem("instructorId")
    const adminId = sessionStorage.getItem("adminId")
    if (!instructorId && adminId) {
      h["x-cc-legacy-admin"] = "1"
    }
  }
  if (json) h["Content-Type"] = "application/json"
  return h
}

interface Slide {
  id: number
  lecture_id: number
  content_type: string
  title: string
  subtitle?: string | null
  content: string | null
  file_url: string | null
  background_gradient?: string | null
  slide_order: number
  is_active: boolean
  ai_summary?: string | null
  ai_keywords?: string[] | null
  created_at: string
  updated_at: string
}

interface Lecture {
  id: number
  week: number
  title: string
  session: string
  description: string
}

interface AdminSlidesManagementProps {
  lectureId: number
  lectureTitle: string
  week: number
  onClose: () => void
}

export function AdminSlidesManagement({
  lectureId,
  lectureTitle,
  week,
  onClose,
}: AdminSlidesManagementProps) {
  const { toast } = useToast()
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [slideToEdit, setSlideToEdit] = useState<Slide | null>(null)
  const [slideToDelete, setSlideToDelete] = useState<Slide | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [slidesPage, setSlidesPage] = useState(1)
  const SLIDES_PER_PAGE = 8

  const [formData, setFormData] = useState({
    slideType: "html",
    title: "",
    content: "",
    fileUrl: "",
    slideOrder: 1,
  })

  useEffect(() => {
    fetchSlides()
    setSlidesPage(1)
  }, [lectureId])

  const totalSlidesPages = Math.max(1, Math.ceil(slides.length / SLIDES_PER_PAGE))
  const paginatedSlides = slides
    .sort((a, b) => a.slide_order - b.slide_order)
    .slice((slidesPage - 1) * SLIDES_PER_PAGE, slidesPage * SLIDES_PER_PAGE)

  const fetchSlides = async () => {
    try {
      const response = await fetch(`/api/lecture-slides?lectureId=${lectureId}`, {
        headers: getLectureSlidesHeaders(),
      })
      const data = await response.json()
      
      if (response.ok) {
        setSlides(data.slides || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to load slides",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch slides:", error)
      toast({
        title: "Error",
        description: "Failed to load slides",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSlide = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Slide title is required",
        variant: "destructive",
      })
      return
    }

    if (formData.slideType === "html" && !formData.content.trim()) {
      toast({
        title: "Error",
        description: "HTML content is required for HTML slides",
        variant: "destructive",
      })
      return
    }

    if ((formData.slideType === "pdf" || formData.slideType === "pptx") && !formData.fileUrl.trim()) {
      toast({
        title: "Error",
        description: "File URL is required for PDF/PPT slides",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/lecture-slides", {
        method: "POST",
        headers: getLectureSlidesHeaders(true),
        body: JSON.stringify({
          lectureId,
          slideType: formData.slideType,
          title: formData.title,
          content: formData.slideType === "html" ? formData.content : null,
          fileUrl: formData.slideType !== "html" ? formData.fileUrl : null,
          slideOrder: formData.slideOrder,
          createdBy: 1, // Admin user ID
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Slide created successfully",
        })
        setCreateDialogOpen(false)
        resetForm()
        fetchSlides()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to create slide",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to create slide:", error)
      toast({
        title: "Error",
        description: "Failed to create slide",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSlide = async () => {
    if (!slideToEdit || !formData.title.trim()) {
      toast({
        title: "Error",
        description: "Slide title is required",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/lecture-slides", {
        method: "PATCH",
        headers: getLectureSlidesHeaders(true),
        body: JSON.stringify({
          slideId: slideToEdit.id,
          title: formData.title,
          content: formData.slideType === "html" ? formData.content : null,
          fileUrl: formData.slideType !== "html" ? formData.fileUrl : null,
          slideOrder: formData.slideOrder,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Slide updated successfully",
        })
        setEditDialogOpen(false)
        setSlideToEdit(null)
        resetForm()
        fetchSlides()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to update slide",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to update slide:", error)
      toast({
        title: "Error",
        description: "Failed to update slide",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSlide = async () => {
    if (!slideToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/lecture-slides?slideId=${slideToDelete.id}`, {
        method: "DELETE",
        headers: getLectureSlidesHeaders(),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Slide deleted successfully",
        })
        setDeleteDialogOpen(false)
        setSlideToDelete(null)
        setSlidesPage(1)
        fetchSlides()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to delete slide",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete slide:", error)
      toast({
        title: "Error",
        description: "Failed to delete slide",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const openEditDialog = (slide: Slide) => {
    setSlideToEdit(slide)
    setFormData({
      slideType: slide.content_type,
      title: slide.title,
      content: slide.content || "",
      fileUrl: slide.file_url || "",
      slideOrder: slide.slide_order,
    })
    setEditDialogOpen(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setFormData(prev => ({ ...prev, slideOrder: slides.length + 1 }))
    setCreateDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      slideType: "html",
      title: "",
      content: "",
      fileUrl: "",
      slideOrder: 1,
    })
  }

  const moveSlide = async (slideId: number, direction: "up" | "down") => {
    const slideIndex = slides.findIndex(s => s.id === slideId)
    if (slideIndex === -1) return

    const newIndex = direction === "up" ? slideIndex - 1 : slideIndex + 1
    if (newIndex < 0 || newIndex >= slides.length) return

    const newSlides = [...slides]
    const [movedSlide] = newSlides.splice(slideIndex, 1)
    newSlides.splice(newIndex, 0, movedSlide)

    // Update slide orders
    const updatedSlides = newSlides.map((slide, index) => ({
      ...slide,
      slide_order: index + 1,
    }))

    setSlides(updatedSlides)

    // Update in database
    try {
      await Promise.all(
        updatedSlides.map(slide =>
          fetch("/api/lecture-slides", {
            method: "PATCH",
            headers: getLectureSlidesHeaders(true),
            body: JSON.stringify({
              slideId: slide.id,
              slideOrder: slide.slide_order,
            }),
          })
        )
      )
      toast({
        title: "Success",
        description: "Slide order updated",
      })
    } catch (error) {
      console.error("Failed to update slide order:", error)
      toast({
        title: "Error",
        description: "Failed to update slide order",
        variant: "destructive",
      })
    }
  }

  const getSlideIcon = (slideType: string) => {
    switch (slideType) {
      case "html":
        return <Code className="h-5 w-5" />
      case "pdf":
        return <FileText className="h-5 w-5" />
      case "pptx":
        return <Presentation className="h-5 w-5" />
      case "image":
        return <Image className="h-5 w-5" />
      default:
        return <FileText className="h-5 w-5" />
    }
  }

  const getSlideTypeColor = (slideType: string) => {
    switch (slideType) {
      case "html":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
      case "pdf":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
      case "pptx":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
      case "image":
        return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
    }
  }

  const slideFormDialog = (
    <Dialog
      open={createDialogOpen || editDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false)
          setEditDialogOpen(false)
          setSlideToEdit(null)
          resetForm()
        }
      }}
    >
      <DialogContent className={LECTURE_DIALOG_SHELL}>
        <DialogHeader className={LECTURE_DIALOG_HEADER}>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl pr-0">
            {slideToEdit ? (
              <>
                <Edit className={cn("h-5 w-5 shrink-0", fp.iconText)} />
                Edit slide
              </>
            ) : (
              <>
                <Plus className={cn("h-5 w-5 shrink-0", fp.iconText)} />
                Add slide
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed max-w-2xl">
            {slideToEdit
              ? "Update title, order, and content for this legacy HTML slide."
              : "Build an optional interactive HTML slide. Primary lecture materials stay in the PDF/PPT deck."}
          </DialogDescription>
        </DialogHeader>

        <div className={LECTURE_DIALOG_BODY}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
            <div className="space-y-2">
              <Label htmlFor="slideType">Slide type</Label>
              <Select
                value={formData.slideType}
                onValueChange={(value) => setFormData({ ...formData, slideType: value })}
              >
                <SelectTrigger id="slideType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML content</SelectItem>
                  <SelectItem value="pdf">PDF file URL</SelectItem>
                  <SelectItem value="pptx">PowerPoint URL</SelectItem>
                  <SelectItem value="image">Image URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="slideOrder">Order</Label>
              <Input
                id="slideOrder"
                type="number"
                min="1"
                value={formData.slideOrder}
                onChange={(e) => setFormData({ ...formData, slideOrder: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="space-y-2 mt-5 max-w-3xl">
            <Label htmlFor="title">Slide title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Introduction to programming"
            />
          </div>

          {formData.slideType === "html" ? (
            <div className="space-y-2 mt-5">
              <Label htmlFor="content">HTML content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="<div class='slide'><h1>Your slide content here</h1></div>"
                rows={12}
                className="font-mono text-sm resize-y min-h-[200px] max-h-[min(40vh,360px)]"
              />
              <p className="text-xs text-muted-foreground">
                Inline CSS is supported. Keep layouts simple for mobile student viewers.
              </p>
            </div>
          ) : (
            <div className="space-y-2 mt-5 max-w-3xl">
              <Label htmlFor="fileUrl">File URL</Label>
              <Input
                id="fileUrl"
                value={formData.fileUrl}
                onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                placeholder="https://example.com/slide.pdf"
              />
              <p className="text-xs text-muted-foreground">
                Host the file externally and paste a direct link students can open.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className={LECTURE_DIALOG_FOOTER}>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              setCreateDialogOpen(false)
              setEditDialogOpen(false)
              setSlideToEdit(null)
              resetForm()
            }}
          >
            Cancel
          </Button>
          <Button onClick={slideToEdit ? handleUpdateSlide : handleCreateSlide} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {slideToEdit ? "Save changes" : "Create slide"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (loading) {
    return (
      <>
        <Dialog open onOpenChange={(open) => !open && onClose()}>
          <DialogContent className={cn(LECTURE_DIALOG_SHELL_WIDE, "flex items-center justify-center min-h-[220px]")}>
            <DialogHeader className="sr-only">
              <DialogTitle>Loading legacy HTML slides</DialogTitle>
              <DialogDescription>Please wait while slides are loaded for this lecture.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className={cn("h-10 w-10 animate-spin", facultyModuleSpinnerClass("lectures"))} />
              <p className="text-sm text-muted-foreground">Loading slides…</p>
            </div>
          </DialogContent>
        </Dialog>
        {slideFormDialog}
      </>
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={LECTURE_DIALOG_SHELL_WIDE}>
          <DialogHeader className={cn(LECTURE_DIALOG_HEADER, "space-y-3")}>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl pr-0">
              <Presentation className={cn("h-5 w-5 shrink-0", fp.iconText)} />
              Legacy HTML slides
            </DialogTitle>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <DialogDescription className="text-sm leading-relaxed flex-1 min-w-0 mb-0">
                Optional interactive slides alongside the main PDF/PPT deck. Reorder, preview, and edit each slide below.
              </DialogDescription>
              <Button
                onClick={openCreateDialog}
                className={cn("shrink-0 w-full sm:w-auto self-start sm:self-center", PORTAL_CTA)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add slide
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Week {week}
              </Badge>
              <Badge variant="secondary" className="text-xs max-w-full truncate">
                {lectureTitle}
              </Badge>
              <Badge className={cn("text-xs", fp.badge)}>
                {slides.length} slide{slides.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </DialogHeader>

          <div className={LECTURE_DIALOG_BODY}>
            {slides.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 px-4">
                <div className={cn("rounded-2xl p-5 mb-4", fp.iconBg)}>
                  <Presentation className={cn("h-12 w-12", fp.iconText)} />
                </div>
                <h3 className="text-lg font-semibold mb-2">No slides yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Legacy HTML slides are optional. Add one when you need custom interactive content beyond the uploaded deck.
                </p>
                <Button onClick={openCreateDialog} className={PORTAL_CTA}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create first slide
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {paginatedSlides.map((slide, index) => {
                  const globalIndex = (slidesPage - 1) * SLIDES_PER_PAGE + index
                  return (
                    <Card key={slide.id} className={cn("overflow-hidden shadow-sm", PORTAL_CARD)}>
                      <CardContent className="p-0">
                        <div className="flex flex-col gap-4 p-4 sm:p-5">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                                fp.iconBg,
                                fp.iconText,
                              )}
                            >
                              {slide.slide_order}
                            </div>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sidebar-accent)] text-[var(--cc-text-muted)]">
                              {getSlideIcon(slide.content_type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-base leading-snug break-words">{slide.title}</h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <Badge className={cn("text-[10px] uppercase tracking-wide", getSlideTypeColor(slide.content_type))}>
                                  {slide.content_type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(slide.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
                            <div className="flex items-center gap-1 mr-auto">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => moveSlide(slide.id, "up")}
                                disabled={globalIndex === 0}
                                aria-label="Move slide up"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => moveSlide(slide.id, "down")}
                                disabled={globalIndex === slides.length - 1}
                                aria-label="Move slide down"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(slide)}>
                              <Edit className="h-4 w-4 mr-1.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSlideToDelete(slide)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </div>

                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--muted)]/40 px-4 sm:px-5 py-2.5 text-left text-sm font-medium text-[var(--cc-text)] hover:bg-[var(--sidebar-accent)] transition-colors"
                            >
                              <span className="flex items-center gap-2">
                                <Eye className={cn("h-4 w-4", fp.iconText)} />
                                Preview content
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-60 [[data-state=open]_&]:rotate-180 transition-transform" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-[var(--border)] p-4 sm:p-5 bg-[var(--card)] max-h-[min(280px,35vh)] overflow-auto">
                              {slide.content_type === "html" && slide.content ? (
                                <div
                                  className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-mt-20"
                                  dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(slide.content) }}
                                />
                              ) : slide.file_url ? (
                                <div className="flex items-start gap-2 text-sm text-muted-foreground break-all">
                                  {getSlideIcon(slide.content_type)}
                                  <span>{slide.file_url}</span>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">No preview available</p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {slides.length > 0 ? (
            <div className={cn(LECTURE_DIALOG_FOOTER, "sm:justify-between sm:items-center")}>
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {(slidesPage - 1) * SLIDES_PER_PAGE + 1}–
                {Math.min(slidesPage * SLIDES_PER_PAGE, slides.length)} of {slides.length}
              </p>
              {totalSlidesPages > 1 ? (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (slidesPage > 1) setSlidesPage(slidesPage - 1)
                        }}
                        className={slidesPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        aria-disabled={slidesPage <= 1}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalSlidesPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setSlidesPage(page)
                          }}
                          isActive={slidesPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (slidesPage < totalSlidesPages) setSlidesPage(slidesPage + 1)
                        }}
                        className={slidesPage >= totalSlidesPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        aria-disabled={slidesPage >= totalSlidesPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {slideFormDialog}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Delete Slide</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{slideToDelete?.title}</span>?
              <br />
              <br />
              This action cannot be undone and will permanently remove the slide from this lecture.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSlide}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Slide"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

