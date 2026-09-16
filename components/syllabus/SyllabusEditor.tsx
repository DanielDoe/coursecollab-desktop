"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { BookOpen, Loader2, Plus, Save, Send } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { SyllabusSectionEditor } from "@/components/syllabus/SyllabusSectionEditor"
import { SyllabusViewer } from "@/components/syllabus/SyllabusViewer"
import { SyllabusPdfUploadSection } from "@/components/syllabus/SyllabusPdfUploadSection"
import { SyllabusLogoUploadSection } from "@/components/syllabus/SyllabusLogoUploadSection"
import { SyllabusExchangePanel } from "@/components/syllabus/SyllabusExchangePanel"
import { SyllabusProvenanceBanner } from "@/components/syllabus/SyllabusProvenanceBanner"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { SyllabusAccentProvider } from "@/lib/syllabus/syllabus-accent"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { resolveUniversityBranding } from "@/lib/syllabus/university-branding"
import type { CourseSyllabus, SyllabusContentMode, SyllabusSection } from "@/lib/syllabus/types"
import type { SyllabusCourseInfo } from "@/lib/syllabus/syllabus-course-info"
import { getDefaultSyllabusTemplate } from "@/lib/syllabus/default-template"

export type SyllabusEditorPanel = "structured" | "pdf" | "branding" | "exchange"

type SyllabusEditorProps = {
  courseId: number
  courseInfo?: SyllabusCourseInfo | null
  fetchUrl: string
  saveUrl: string
  buildHeaders: () => Record<string, string>
  activePanel?: SyllabusEditorPanel
  onStatusChange?: (status: CourseSyllabus["status"] | null) => void
}

function SortableSection({
  section,
  index,
  defaultExpanded,
  onChange,
  onRemove,
  imageUploading,
  onImageUpload,
  onImageRemove,
  documentUploading,
  onDocumentUpload,
  onDocumentRemove,
}: {
  section: SyllabusSection
  index: number
  defaultExpanded?: boolean
  onChange: (section: SyllabusSection) => void
  onRemove?: () => void
  imageUploading?: boolean
  onImageUpload?: (file: File, caption?: string) => Promise<void>
  onImageRemove?: () => Promise<void>
  documentUploading?: boolean
  onDocumentUpload?: (file: File) => Promise<void>
  onDocumentRemove?: () => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.sectionId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SyllabusSectionEditor
        section={section}
        index={index}
        defaultExpanded={defaultExpanded}
        onChange={onChange}
        onRemove={onRemove}
        dragHandleProps={{ ...attributes, ...listeners }}
        imageUploading={imageUploading}
        onImageUpload={onImageUpload}
        onImageRemove={onImageRemove}
        documentUploading={documentUploading}
        onDocumentUpload={onDocumentUpload}
        onDocumentRemove={onDocumentRemove}
      />
    </div>
  )
}

export function SyllabusEditor({
  courseId,
  courseInfo,
  fetchUrl,
  saveUrl,
  buildHeaders,
  activePanel: controlledPanel,
  onStatusChange,
}: SyllabusEditorProps) {
  const [syllabus, setSyllabus] = useState<CourseSyllabus | null>(null)
  const [title, setTitle] = useState("")
  const [term, setTerm] = useState("")
  const [sections, setSections] = useState<SyllabusSection[]>([])
  const [contentMode, setContentMode] = useState<SyllabusContentMode>("structured")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoFileName, setLogoFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pdfUploading, setPdfUploading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [imageUploadingSection, setImageUploadingSection] = useState<string | null>(null)
  const [documentUploadingSection, setDocumentUploadingSection] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [internalPanel, setInternalPanel] = useState<SyllabusEditorPanel>("structured")
  const activePanel = controlledPanel ?? internalPanel
  const panelControlledRef = useRef(controlledPanel != null)
  panelControlledRef.current = controlledPanel != null

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const loadSyllabus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(fetchUrl, { headers: buildHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load syllabus")
      const s = data.syllabus as CourseSyllabus
      setSyllabus(s)
      setTitle(s.title)
      setTerm(s.term)
      setSections(s.sections)
      setContentMode(s.contentMode ?? "structured")
      setPdfUrl(s.pdfUrl ?? null)
      setPdfFileName(s.pdfFileName ?? null)
      setLogoUrl(s.logoUrl ?? null)
      setLogoFileName(s.logoFileName ?? null)
      if (!panelControlledRef.current) {
        setInternalPanel((s.contentMode ?? "structured") === "pdf" ? "pdf" : "structured")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load syllabus")
    } finally {
      setLoading(false)
    }
  }, [fetchUrl, buildHeaders])

  useEffect(() => {
    void loadSyllabus()
  }, [loadSyllabus, courseId])

  useEffect(() => {
    onStatusChange?.(syllabus?.status ?? null)
  }, [onStatusChange, syllabus?.status])

  useEffect(() => {
    if (activePanel === "structured") setContentMode("structured")
    if (activePanel === "pdf") setContentMode("pdf")
  }, [activePanel])

  const reorderSections = (next: SyllabusSection[]) =>
    next.map((section, index) => ({ ...section, order: index + 1 }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.sectionId === active.id)
    const newIndex = sections.findIndex((s) => s.sectionId === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setSections(reorderSections(arrayMove(sections, oldIndex, newIndex)))
  }

  const updateSection = (sectionId: string, updated: SyllabusSection) => {
    setSections((prev) => prev.map((s) => (s.sectionId === sectionId ? updated : s)))
  }

  const removeSection = (sectionId: string) => {
    setSections((prev) => reorderSections(prev.filter((s) => s.sectionId !== sectionId)))
  }

  const addOptionalSection = () => {
    const id = `custom-${Date.now()}`
    setSections((prev) =>
      reorderSections([
        ...prev,
        {
          sectionId: id,
          title: "Additional Section",
          order: prev.length + 1,
          type: "text",
          content: { markdown: "Add content here..." },
          isRequired: false,
          isVisible: true,
          isEditable: true,
        },
      ]),
    )
  }

  const resetToTemplate = () => {
    const template = getDefaultSyllabusTemplate()
    setTitle(template.title)
    setTerm(template.term)
    setSections(template.sections)
    toast.message("Template loaded", { description: "Review and save when ready." })
  }

  const save = async (action: "draft" | "publish") => {
    setSaving(true)
    try {
      const res = await fetch(saveUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...buildHeaders() },
        body: JSON.stringify({
          title,
          term,
          contentMode,
          sections: reorderSections(sections),
          action: action === "publish" ? "publish" : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save syllabus")
      setSyllabus(data.syllabus)
      setSections(data.syllabus.sections)
      setContentMode(data.syllabus.contentMode ?? contentMode)
      setPdfUrl(data.syllabus.pdfUrl ?? pdfUrl)
      setPdfFileName(data.syllabus.pdfFileName ?? pdfFileName)
      toast.success(action === "publish" ? "Syllabus published" : "Draft saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save syllabus")
    } finally {
      setSaving(false)
    }
  }

  const uploadPdf = async (file: File) => {
    setPdfUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await instructorApiFetch("/api/instructor/syllabus/document", {
        method: "POST",
        headers: buildHeaders(),
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to upload PDF")
      const s = data.syllabus as CourseSyllabus
      setSyllabus(s)
      setContentMode("pdf")
      setPdfUrl(s.pdfUrl ?? data.pdfUrl ?? null)
      setPdfFileName(s.pdfFileName ?? file.name)
      toast.success("Syllabus PDF uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload PDF")
    } finally {
      setPdfUploading(false)
    }
  }

  const removePdf = async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/syllabus/document", {
        method: "DELETE",
        headers: buildHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to remove PDF")
      const s = data.syllabus as CourseSyllabus
      setSyllabus(s)
      setContentMode("structured")
      setPdfUrl(null)
      setPdfFileName(null)
      toast.success("PDF removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove PDF")
    }
  }

  const applySyllabusFromServer = (s: CourseSyllabus) => {
    setSyllabus(s)
    setSections(s.sections)
    setTitle(s.title)
    setTerm(s.term)
    setContentMode(s.contentMode ?? "structured")
    setPdfUrl(s.pdfUrl ?? null)
    setPdfFileName(s.pdfFileName ?? null)
    setLogoUrl(s.logoUrl ?? null)
    setLogoFileName(s.logoFileName ?? null)
    setActivePanel((s.contentMode ?? "structured") === "pdf" ? "pdf" : "structured")
  }

  const uploadSectionImage = async (sectionId: string, file: File, caption?: string) => {
    setImageUploadingSection(sectionId)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("sectionId", sectionId)
      if (caption) fd.append("caption", caption)
      const res = await instructorApiFetch("/api/instructor/syllabus/section-image", {
        method: "POST",
        headers: buildHeaders(),
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to upload image")
      if (data.syllabus) applySyllabusFromServer(data.syllabus as CourseSyllabus)
      toast.success(
        sectionId === "instructor-info" ? "Instructor photo uploaded" : "Textbook image uploaded",
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image")
    } finally {
      setImageUploadingSection(null)
    }
  }

  const removeSectionImage = async (sectionId: string) => {
    setImageUploadingSection(sectionId)
    try {
      const res = await fetch(
        `/api/instructor/syllabus/section-image?sectionId=${encodeURIComponent(sectionId)}`,
        { method: "DELETE", headers: buildHeaders() },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to remove image")
      if (data.syllabus) applySyllabusFromServer(data.syllabus as CourseSyllabus)
      toast.success("Image removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove image")
    } finally {
      setImageUploadingSection(null)
    }
  }

  const uploadSectionDocument = async (sectionId: string, file: File) => {
    setDocumentUploadingSection(sectionId)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("sectionId", sectionId)
      const res = await instructorApiFetch("/api/instructor/syllabus/section-document", {
        method: "POST",
        headers: buildHeaders(),
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to upload document")
      if (data.syllabus) applySyllabusFromServer(data.syllabus as CourseSyllabus)
      toast.success("Curriculum vitae uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload document")
    } finally {
      setDocumentUploadingSection(null)
    }
  }

  const removeSectionDocument = async (sectionId: string) => {
    setDocumentUploadingSection(sectionId)
    try {
      const res = await fetch(
        `/api/instructor/syllabus/section-document?sectionId=${encodeURIComponent(sectionId)}`,
        { method: "DELETE", headers: buildHeaders() },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to remove document")
      if (data.syllabus) applySyllabusFromServer(data.syllabus as CourseSyllabus)
      toast.success("Curriculum vitae removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove document")
    } finally {
      setDocumentUploadingSection(null)
    }
  }

  const uploadLogo = async (file: File) => {
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await instructorApiFetch("/api/instructor/syllabus/logo", {
        method: "POST",
        headers: buildHeaders(),
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to upload logo")
      if (data.syllabus) applySyllabusFromServer(data.syllabus as CourseSyllabus)
      toast.success("University logo uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload logo")
    } finally {
      setLogoUploading(false)
    }
  }

  const removeLogo = async () => {
    setLogoUploading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/syllabus/logo", {
        method: "DELETE",
        headers: buildHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to remove logo")
      if (data.syllabus) applySyllabusFromServer(data.syllabus as CourseSyllabus)
      toast.success("Custom logo removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove logo")
    } finally {
      setLogoUploading(false)
    }
  }

  const universityBranding = resolveUniversityBranding(courseInfo?.university)
  const defaultLogoUrl = universityBranding.logoUrl

  const previewSyllabus: CourseSyllabus | null = syllabus
    ? {
        ...syllabus,
        title,
        term,
        sections: reorderSections(sections),
        contentMode,
        pdfUrl,
        pdfFileName,
        logoUrl,
        logoFileName,
      }
    : null

  const chrome = facultyEmbedChrome("syllabus")

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    )
  }

  const saveActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        className={cn("rounded-lg", chrome.quiet)}
        onClick={() => save("draft")}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save draft
      </Button>
      <Button
        type="button"
        size="sm"
        className={cn("rounded-lg", chrome.solid)}
        onClick={() => save("publish")}
        disabled={saving}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Publish
      </Button>
    </div>
  )

  if (previewMode && previewSyllabus) {
    return (
      <div className="space-y-4">
        <FacultyIntegratedToolbar
          moduleId="syllabus"
          trailing={
            <Button
              type="button"
              size="sm"
              className={cn("rounded-lg", chrome.quiet)}
              onClick={() => setPreviewMode(false)}
            >
              Back to editor
            </Button>
          }
        />
        <SyllabusAccentProvider accent="portal">
          <SyllabusViewer syllabus={previewSyllabus} courseInfo={courseInfo} showStatusBadge />
        </SyllabusAccentProvider>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
        Create and manage your course syllabus using the reusable template. Publish when ready for students.
      </p>

      {syllabus?.templateProvenance ? (
        <SyllabusProvenanceBanner provenance={syllabus.templateProvenance} />
      ) : null}

      <div className="space-y-4">
        <div className={cn(PORTAL_CARD, "grid gap-3 p-3 sm:grid-cols-2 sm:p-4")}>
          <div className="space-y-1.5">
            <Label htmlFor="syllabus-title" className={cn("text-xs", PORTAL_TEXT)}>
              Syllabus title
            </Label>
            <Input
              id="syllabus-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-lg border-0 bg-[var(--muted)] shadow-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="syllabus-term" className={cn("text-xs", PORTAL_TEXT)}>
              Term
            </Label>
            <Input
              id="syllabus-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="h-9 rounded-lg border-0 bg-[var(--muted)] shadow-none"
            />
          </div>
        </div>

        {activePanel === "structured" ? (
          <>
            <FacultyIntegratedToolbar
              moduleId="syllabus"
              meta={<span className={PORTAL_TEXT_MUTED}>{sections.length} sections</span>}
              trailing={
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" className={cn("rounded-lg", chrome.solid)} onClick={addOptionalSection}>
                    <Plus className="h-3.5 w-3.5" />
                    Add section
                  </Button>
                  <Button type="button" size="sm" className={cn("rounded-lg", chrome.quiet)} onClick={resetToTemplate}>
                    Load template
                  </Button>
                  <Button type="button" size="sm" className={cn("rounded-lg", chrome.quiet)} onClick={() => setPreviewMode(true)}>
                    Preview
                  </Button>
                  {saveActions}
                </div>
              }
            />

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map((s) => s.sectionId)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sections.length === 0 ? (
                    <div className={cn(PORTAL_CARD, "flex flex-col items-center px-6 py-14 text-center")}>
                      <div className={cn("mb-3", chrome.iconBadge())}>
                        <BookOpen className="h-5 w-5 !text-white" />
                      </div>
                      <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>No sections yet</p>
                      <p className={cn("mt-1 max-w-sm text-xs", PORTAL_TEXT_MUTED)}>
                        Add a custom section or load the course template to get started.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button type="button" size="sm" className={cn("rounded-lg", chrome.solid)} onClick={addOptionalSection}>
                          <Plus className="h-3.5 w-3.5" />
                          Add section
                        </Button>
                        <Button type="button" size="sm" className={cn("rounded-lg", chrome.quiet)} onClick={resetToTemplate}>
                          Load template
                        </Button>
                      </div>
                    </div>
                  ) : (
                    sections.map((section, index) => (
                      <SortableSection
                        key={section.sectionId}
                        section={section}
                        index={index}
                        defaultExpanded={index === 0}
                        onChange={(updated) => updateSection(section.sectionId, updated)}
                        onRemove={!section.isRequired ? () => removeSection(section.sectionId) : undefined}
                        imageUploading={imageUploadingSection === section.sectionId}
                        onImageUpload={
                          section.sectionId === "required-materials" ||
                          section.sectionId === "instructor-info"
                            ? (file, caption) => uploadSectionImage(section.sectionId, file, caption)
                            : undefined
                        }
                        onImageRemove={
                          section.sectionId === "required-materials" ||
                          section.sectionId === "instructor-info"
                            ? () => removeSectionImage(section.sectionId)
                            : undefined
                        }
                        documentUploading={documentUploadingSection === section.sectionId}
                        onDocumentUpload={
                          section.sectionId === "curriculum-vitae"
                            ? (file) => uploadSectionDocument(section.sectionId, file)
                            : undefined
                        }
                        onDocumentRemove={
                          section.sectionId === "curriculum-vitae"
                            ? () => removeSectionDocument(section.sectionId)
                            : undefined
                        }
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </>
        ) : null}

        {activePanel === "pdf" ? (
          <>
            <FacultyIntegratedToolbar
              moduleId="syllabus"
              meta={<span className={PORTAL_TEXT_MUTED}>{pdfUrl ? "PDF attached" : "No PDF uploaded"}</span>}
              trailing={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className={cn("rounded-lg", chrome.quiet)}
                    onClick={() => setPreviewMode(true)}
                    disabled={!pdfUrl}
                  >
                    Preview
                  </Button>
                  {saveActions}
                </div>
              }
            />
            <SyllabusPdfUploadSection
              pdfUrl={pdfUrl}
              pdfFileName={pdfFileName}
              title={title}
              uploading={pdfUploading}
              onUpload={uploadPdf}
              onRemove={pdfUrl ? removePdf : undefined}
            />
          </>
        ) : null}

        {activePanel === "branding" ? (
          <>
            <FacultyIntegratedToolbar moduleId="syllabus" trailing={saveActions} />
            <SyllabusLogoUploadSection
              logoUrl={logoUrl}
              logoFileName={logoFileName}
              fallbackLogoUrl={defaultLogoUrl}
              universityName={universityBranding.displayName}
              primaryColor={universityBranding.primaryColor}
              secondaryColor={universityBranding.secondaryColor}
              uploading={logoUploading}
              onUpload={uploadLogo}
              onRemove={logoUrl ? removeLogo : undefined}
            />
          </>
        ) : null}

        {activePanel === "exchange" ? (
          <SyllabusExchangePanel buildHeaders={buildHeaders} onApplied={applySyllabusFromServer} />
        ) : null}
      </div>
    </div>
  )
}
