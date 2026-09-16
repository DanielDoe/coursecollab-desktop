"use client"


import { studentApiFetch } from "@/lib/auth"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { openDesktopUrl } from "@/lib/desktop-open-url"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  BookOpen,
  FileText,
  MessageSquare,
  Loader2,
  Eye,
  Star,
  TrendingUp,
  ThumbsUp,
  Upload,
  ExternalLink,
  X,
  Presentation,
  Users,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Calendar,
  Sparkles,
  PenLine,
  type LucideIcon,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AdminSlidesManagement } from "@/components/admin-slides-management"
import { LectureDeckFormSection } from "@/components/lecture-deck-form-section"
import {
  LECTURE_DIALOG_BODY,
  LECTURE_DIALOG_BODY_FIT,
  LECTURE_DIALOG_FOOTER,
  LECTURE_DIALOG_FOOTER_INSET,
  LECTURE_DIALOG_HEADER,
  LECTURE_DIALOG_SHELL,
  LECTURE_DIALOG_SHELL_COMPACT,
  LECTURE_DIALOG_SHELL_DECK_PREVIEW,
} from "@/components/lecture-modal-shell"
import { LectureStatisticsTab } from "@/components/lecture-statistics-tab"
import { LectureSamplePracticeEditor } from "@/components/lecture-sample-practice-editor"
import { LectureWorkspacePanel } from "@/components/lecture-workspace-panel"
import { LectureWorkspaceEditor } from "@/components/lecture-workspace-editor"
import { formatLectureIndexLabel, isEleg130xLectureCourse } from "@/lib/lecture-index-label"
import Link from "next/link"

import { useAppConfirm } from "@/components/providers/app-confirm-provider"
const LecturePdfViewer = dynamic(
  () => import("@/components/lecture-pdf-viewer").then((m) => m.LecturePdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[280px] items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
  },
)
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { buildInstructorApiHeaders, usesInstructorScopedCourseApi, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { instructorLecturePreviewPath } from "@/lib/instructor-lecture-preview-path"
import {
  getInstructorSectionBadgeClass,
  createAllSessionAccess,
  sessionAccessFromStoredArray,
  storedArrayFromSessionAccess,
  getSectionColumnHeading,
  type SessionAccessState,
} from "@/lib/instructor-section-presets"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { InstructorModuleStudentActivityView } from "@/components/instructor/module-activity/InstructorModuleStudentActivityView"
import { LectureCard } from "@/components/instructor/lectures/lecture-card"
import { LectureCreatePanel } from "@/components/instructor/lectures/lecture-create-panel"
import { LectureDetailPanel } from "@/components/instructor/lectures/lecture-detail-panel"

interface Lecture {
  id: number
  week: number
  title: string
  session: string | null
  description: string
  materials_url: string | null
  created_at: string
  session_access: string[] | null
  is_published: boolean
  pdf_url?: string | null
  original_file_url?: string | null
  original_file_type?: string | null
  content_mode?: string | null
  allow_download?: boolean
}

interface Comment {
  id: number
  lecture_id: number
  student_id: number
  comment: string
  created_at: string
  first_name: string
  last_name: string
  email: string
  likes: number
}

interface Material {
  id: number
  lecture_id: number
  file_url: string
  title: string
  file_type: string
  view_count: number
  uploaded_at: string
}

interface EngagementData {
  topMaterial: Material | null
  topComment: Comment | null
  stats: {
    total_views: number
    total_comments: number
    total_bookmarks: number
  }
}

function LecturesTabPanel({
  embedInDashboard,
  children,
  scroll = false,
}: {
  embedInDashboard: boolean
  children: ReactNode
  scroll?: boolean
}) {
  if (!embedInDashboard) return <>{children}</>
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", scroll && "overflow-y-auto pr-1 sm:pr-2")}>
      {children}
    </div>
  )
}

function LecturesEmptyTabPanel({
  embedInDashboard,
  icon: Icon,
  title,
  description,
}: {
  embedInDashboard: boolean
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <LecturesTabPanel embedInDashboard={embedInDashboard}>
      <div
        className={cn(
          PORTAL_CARD,
          "text-center",
          embedInDashboard
            ? "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-4 py-10"
            : "p-8 sm:p-10",
        )}
      >
        <Icon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
        <h4 className={cn("mb-1 font-semibold", PORTAL_TEXT)}>{title}</h4>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{description}</p>
      </div>
    </LecturesTabPanel>
  )
}

export function LecturesManagement({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const facultyTheme = getFacultyModuleTheme("lectures")
  const fp = facultyTheme.page
  const chrome = facultyEmbedChrome("lectures")

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast} = useToast()
  const { confirm } = useAppConfirm()
  const { courseScopeVersion, basePath, setPageBreadcrumbTail } = useInstructorDashboardV2()
  const { codes, accessRows, selectOptions, defaultCode, labelByCode } = useSessionCatalog()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const scopeCourseCode = useMemo(() => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem("instructorSession")
      if (!raw) return null
      const s = JSON.parse(raw) as {
        selectedCatalogCourseCode?: string | null
        selectedCourseCode?: string | null
      }
      return s.selectedCatalogCourseCode ?? s.selectedCourseCode ?? null
    } catch {
      return null
    }
  }, [courseScopeVersion])
  const useLectureNumberLabels = isEleg130xLectureCourse(scopeCourseCode, lectures[0]?.title)
  const indexFilterLabel = useLectureNumberLabels ? "Lecture" : "Week"
  const indexFilterAllLabel = useLectureNumberLabels ? "All lectures" : "All weeks"
  const indexCoverageLabel = useLectureNumberLabels ? "lectures" : "weeks covered"
  const labelForIndex = (n: number, title?: string) =>
    formatLectureIndexLabel(n, { courseCode: scopeCourseCode, title: title ?? lectures[0]?.title })
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [lectureToDelete, setLectureToDelete] = useState<Lecture | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [lectureToEdit, setLectureToEdit] = useState<Lecture | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false)
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)

  const [materials, setMaterials] = useState<Record<number, Material[]>>({})
  const [engagement, setEngagement] = useState<Record<number, EngagementData>>({})
  const [materialsDialogOpen, setMaterialsDialogOpen] = useState(false)
  const [newMaterial, setNewMaterial] = useState({ title: "", fileUrl: "", fileType: "pdf" })
  const [uploadingMaterial, setUploadingMaterial] = useState(false)
  const [slidesDialogOpen, setSlidesDialogOpen] = useState(false)
  const [selectedLectureForSlides, setSelectedLectureForSlides] = useState<Lecture | null>(null)
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false)
  const [lectureForDocument, setLectureForDocument] = useState<Lecture | null>(null)
  const [documentUploading, setDocumentUploading] = useState(false)
  const [samplePracticeOpen, setSamplePracticeOpen] = useState(false)
  const [lectureForSamplePractice, setLectureForSamplePractice] = useState<Lecture | null>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [lectureForWorkspace, setLectureForWorkspace] = useState<Lecture | null>(null)
  const [workspaceEditorOpen, setWorkspaceEditorOpen] = useState(false)
  const [lectureForWorkspaceEditor, setLectureForWorkspaceEditor] = useState<Lecture | null>(null)

  /** Create-tab: new lecture + PDF/PPT upload (instructor only; matches row-level deck API) */
  const [deckQuickForm, setDeckQuickForm] = useState({
    week: "",
    title: "",
    description: "",
    published: true,
    allowDownload: false,
  })
  const [deckQuickFile, setDeckQuickFile] = useState<File | null>(null)
  const [deckQuickUploading, setDeckQuickUploading] = useState(false)
  const [deckQuickFileInputKey, setDeckQuickFileInputKey] = useState(0)

  // Active tab for side menu
  const [activeTab, setActiveTab] = useState<string>("lectures")
  const [openedLecture, setOpenedLecture] = useState<Lecture | null>(null)
  const [creating, setCreating] = useState(false)
  const [savedLectures, setSavedLectures] = useState<Lecture[]>([])
  const [deletedItems, setDeletedItems] = useState<any[]>([])
  const [loadingDeleted, setLoadingDeleted] = useState(false)
  const [openIssuesCount, setOpenIssuesCount] = useState(0)

  // Filters
  const [sessionFilter, setSessionFilter] = useState<string>("all")
  const [weekFilter, setWeekFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [lecturesPage, setLecturesPage] = useState(1)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [lectureStats, setLectureStats] = useState<{
    total_lectures: number
    total_slides: number
    total_comments: number
    total_views: number
    avg_engagement: number
    weekly_activity?: {
      week: number
      lectures: number
      views: number
      comments: number
    }[]
    session_stats?: {
      session: string | null
      lectures: number
      slides: number
      comments: number
      views: number
    }[]
    engagement_trends?: {
      week_start: string
      comments: number
      avg_rating: number
    }[]
    top_lectures?: {
      id: number
      title: string
      week: number
      session: string | null
      views: number
      comments: number
      avg_rating: number
    }[]
  } | null>(null)
  const LECTURES_PER_PAGE = 6

  const [formData, setFormData] = useState({
    week: "",
    title: "",
    session: "",
    description: "",
  })

  const [formDeckFile, setFormDeckFile] = useState<File | null>(null)
  const [formDeckInputKey, setFormDeckInputKey] = useState(0)
  const [formDeckAllowDownload, setFormDeckAllowDownload] = useState(false)
  const [formDeckPublished, setFormDeckPublished] = useState(true)
  const [formSaving, setFormSaving] = useState(false)

  const [sessionAccess, setSessionAccess] = useState<SessionAccessState>({ all: true })

  useEffect(() => {
    if (codes.length === 0) return
    setSessionAccess(createAllSessionAccess(codes, true))
  }, [codes])

  useEffect(() => {
    if (!defaultCode) return
    setFormData((fd) => (fd.session ? fd : { ...fd, session: defaultCode }))
  }, [defaultCode])

  const openLecturePreview = (lecture: Lecture) => {
    const path = usesInstructorScopedCourseApi()
      ? window.location.pathname.startsWith("/faculty/dashboard")
        ? `/faculty/dashboard/content/lectures/${lecture.id}`
        : instructorLecturePreviewPath(lecture.id)
      : `/student/dashboard-v2/lectures/${lecture.week}?lectureId=${lecture.id}`
    // Stay in the same desktop window — never spawn a popup BrowserWindow.
    router.push(path)
  }

  const getApiBasePath = () => {
    return usesInstructorScopedCourseApi() ? "/api/instructor" : "/api"
  }

  const getAuthHeaders = (): Record<string, string> => {
    if (!usesInstructorScopedCourseApi()) return {}
    const h = buildInstructorApiHeaders()
    const raw = localStorage.getItem("instructorSession")
    if (raw) h.authorization = raw
    return h
  }

  const lecturesListPath = embedInDashboard ? `${basePath}/content/lectures` : null

  const syncLectureRoute = (opts: { view?: "new"; lectureId?: number | null }) => {
    if (!lecturesListPath) return
    if (opts.view === "new") {
      router.replace(`${lecturesListPath}?view=new`, { scroll: false })
      return
    }
    if (opts.lectureId) {
      router.replace(`${lecturesListPath}?lecture=${opts.lectureId}`, { scroll: false })
      return
    }
    router.replace(lecturesListPath, { scroll: false })
  }

  const showLectureList = () => {
    setCreating(false)
    setOpenedLecture(null)
    syncLectureRoute({})
  }

  const showNewLecture = () => {
    setOpenedLecture(null)
    setCreating(true)
    syncLectureRoute({ view: "new" })
  }

  const showLectureDetail = (lecture: Lecture) => {
    setCreating(false)
    setOpenedLecture(lecture)
    syncLectureRoute({ lectureId: lecture.id })
  }

  useEffect(() => {
    if (!embedInDashboard || !lecturesListPath) return
    const view = searchParams.get("view")
    const lectureParam = searchParams.get("lecture")
    if (view === "new") {
      setCreating(true)
      setOpenedLecture(null)
      return
    }
    if (lectureParam) {
      const id = Number.parseInt(lectureParam, 10)
      if (Number.isFinite(id)) {
        const found = lectures.find((l) => l.id === id)
        if (found) {
          setOpenedLecture(found)
          setCreating(false)
        }
      }
      return
    }
    setCreating(false)
    setOpenedLecture(null)
  }, [searchParams, lectures, embedInDashboard, lecturesListPath])

  useEffect(() => {
    if (!embedInDashboard) return
    if (creating) setPageBreadcrumbTail("New lecture")
    else if (openedLecture) setPageBreadcrumbTail(openedLecture.title)
    else setPageBreadcrumbTail(null)
    return () => setPageBreadcrumbTail(null)
  }, [creating, openedLecture, embedInDashboard, setPageBreadcrumbTail])

  useEffect(() => {
    const closeNested = () => {
      setCreating(false)
      setOpenedLecture(null)
    }
    window.addEventListener("instructor-breadcrumb-module-home", closeNested)
    return () => window.removeEventListener("instructor-breadcrumb-module-home", closeNested)
  }, [])

  const handleJsonLectureUpload = async () => {
    const jsonInput = document.getElementById("json-file") as HTMLInputElement
    const imagesInput = document.getElementById("image-files") as HTMLInputElement

    const jsonFile = jsonInput?.files?.[0]
    if (!jsonFile) {
      toast({
        title: "JSON file required",
        description: "Please select a JSON file to upload",
        variant: "destructive",
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append("json", jsonFile)

      if (imagesInput?.files) {
        Array.from(imagesInput.files).forEach((file) => {
          formData.append("images", file)
        })
      }

      const jsonText = await jsonFile.text()
      const jsonData = JSON.parse(jsonText)
      formData.append("title", jsonData.title || "Untitled Lecture")

      const response = await fetch(`${getApiBasePath()}/lectures/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Lecture uploaded successfully!",
          description: `Created "${result.lecture.title}" with ${result.uploadedImages} images`,
        })
        jsonInput.value = ""
        if (imagesInput) imagesInput.value = ""
        fetchLectures()
        showLectureList()
      } else {
        throw new Error(result.error || "Upload failed")
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please check your JSON format",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    // Check for both admin and instructor authentication
    const adminId = sessionStorage.getItem("adminId")
    const instructorId = localStorage.getItem("instructorId")
    
    if (!adminId && !instructorId) {
      const path = window.location.pathname
      if (path.startsWith("/faculty")) {
        router.push("/faculty/login")
      } else if (path.includes("/instructor")) {
        router.push("/instructor/login")
      } else {
        router.push("/admin/login")
      }
      return
    }

    fetchLectures()
  }, [router, courseScopeVersion])

  const fetchLectures = async () => {
    try {
      const [lecturesRes, statsRes] = await Promise.all([
        fetch(`${getApiBasePath()}/lectures`, { headers: getAuthHeaders() }),
        usesInstructorScopedCourseApi()
          ? instructorApiFetch("/api/instructor/lecture-stats", { headers: getAuthHeaders() }).catch(() => null)
          : Promise.resolve(null),
      ])
      const lecturesData = await lecturesRes.json()
      if (lecturesRes.ok) {
        setLectures(lecturesData.lectures || [])
      }
      if (statsRes?.ok) {
        const statsData = await statsRes.json()
        if (statsData?.stats) {
          setLectureStats(statsData.stats)
        }
      }
    } catch (error) {
      console.error("Failed to fetch lectures:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async (lectureId: number) => {
    setLoadingComments(true)
    try {
      const response = await studentApiFetch(`/api/lectures/comments?lecture_id=${lectureId}`)
      const data = await response.json()

      if (response.ok) {
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error)
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      })
    } finally {
      setLoadingComments(false)
    }
  }

  const fetchMaterials = async (lectureId: number) => {
    try {
      const response = await studentApiFetch(`/api/lectures/materials?lectureId=${lectureId}`)
      const data = await response.json()
      if (response.ok) {
        setMaterials((prev) => ({ ...prev, [lectureId]: data || [] }))
      }
    } catch (error) {
      console.error("Failed to fetch materials:", error)
    }
  }

  const fetchEngagement = async (lectureId: number) => {
    try {
      const response = await studentApiFetch(`/api/lectures/engagement?lectureId=${lectureId}`)
      const data = await response.json()
      if (response.ok) {
        setEngagement((prev) => ({ ...prev, [lectureId]: data }))
      }
    } catch (error) {
      console.error("Failed to fetch engagement:", error)
    }
  }

  const handleAddMaterial = async () => {
    if (!selectedLecture || !newMaterial.title || !newMaterial.fileUrl) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" })
      return
    }

    setUploadingMaterial(true)
    try {
      const response = await studentApiFetch("/api/lectures/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lectureId: selectedLecture.id,
          fileUrl: newMaterial.fileUrl,
          title: newMaterial.title,
          fileType: newMaterial.fileType,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Material added successfully" })
        setNewMaterial({ title: "", fileUrl: "", fileType: "pdf" })
        await fetchMaterials(selectedLecture.id)
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error || "Failed to add material", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to add material:", error)
      toast({ title: "Error", description: "Failed to add material", variant: "destructive" })
    } finally {
      setUploadingMaterial(false)
    }
  }

  const handleDeleteMaterial = async (materialId: number, lectureId: number) => {
    try {
      const response = await studentApiFetch(`/api/lectures/materials/${materialId}`, { method: "DELETE" })
      if (response.ok) {
        toast({ title: "Material deleted" })
        await fetchMaterials(lectureId)
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error || "Failed to delete material", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to delete material:", error)
      toast({ title: "Error", description: "Failed to delete material", variant: "destructive" })
    }
  }

  const handleResetViews = async (materialId: number, lectureId: number) => {
    try {
      const response = await studentApiFetch(`/api/lectures/materials/${materialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-views" }),
      })
      if (response.ok) {
        toast({ title: "View count reset" })
        await fetchMaterials(lectureId)
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error || "Failed to reset views", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to reset views:", error)
      toast({ title: "Error", description: "Failed to reset views", variant: "destructive" })
    }
  }

  const openMaterialsDialog = async (lecture: Lecture) => {
    setSelectedLecture(lecture)
    setMaterialsDialogOpen(true)
    await fetchMaterials(lecture.id)
    await fetchEngagement(lecture.id)
  }

  const openSlidesDialog = (lecture: Lecture) => {
    setSelectedLectureForSlides(lecture)
    setSlidesDialogOpen(true)
  }

  const openSamplePracticeDialog = (lecture: Lecture) => {
    setLectureForSamplePractice(lecture)
    setSamplePracticeOpen(true)
  }

  const openWorkspaceDialog = (lecture: Lecture) => {
    setLectureForWorkspace(lecture)
    setWorkspaceOpen(true)
  }

  const openWorkspaceEditorDialog = (lecture: Lecture) => {
    setLectureForWorkspaceEditor(lecture)
    setWorkspaceEditorOpen(true)
  }

  const openDocumentDialog = (lecture: Lecture) => {
    setLectureForDocument(lecture)
    setDocumentDialogOpen(true)
  }

  const patchDeckLecture = async (lecture: Lecture, body: Record<string, boolean>) => {
    try {
      const response = await fetch(`${getApiBasePath()}/lectures/${lecture.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Update failed")
      }
      toast({ title: "Saved" })
      await fetchLectures()
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      })
    }
  }

  const uploadDeckToLecture = async (lectureId: number, file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    const response = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/document`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: fd,
    })
    const data = (await response.json()) as { error?: string; details?: string }
    if (!response.ok) {
      throw new Error(typeof data.details === "string" ? data.details : data.error || "Upload failed")
    }
  }

  const uploadLectureDocument = async (file: File | undefined) => {
    if (!file || !lectureForDocument) return
    setDocumentUploading(true)
    try {
      await uploadDeckToLecture(lectureForDocument.id, file)
      toast({
        title: "Slide deck uploaded",
        description: "Students see the PDF viewer when a deck is attached.",
      })
      await fetchLectures()
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Could not upload file",
        variant: "destructive",
      })
    } finally {
      setDocumentUploading(false)
    }
  }

  const deleteLectureDocument = async () => {
    if (!lectureForDocument) return
    const ok = await confirm({
      title: "Remove uploaded slide deck?",
      description: "Interactive HTML slides are not deleted.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      variant: "destructive",
    })
    if (!ok) return
    setDocumentUploading(true)
    try {
      const response = await instructorApiFetch(`/api/instructor/lectures/${lectureForDocument.id}/document`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to remove deck")
      }
      toast({ title: "Slide deck removed" })
      await fetchLectures()
    } catch (e) {
      toast({
        title: "Could not remove deck",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      })
    } finally {
      setDocumentUploading(false)
    }
  }

  const handleCreateLecture = async () => {
    setFormSaving(true)
    try {
      const sessionAccessArray = storedArrayFromSessionAccess(sessionAccess, codes)
      const weekNum = Number.parseInt(formData.week, 10)
      const payload = usesInstructorScopedCourseApi()
        ? {
            title: formData.title.trim(),
            week: weekNum,
            description: formData.description ?? "",
            objectives: [] as string[],
            slides: [] as unknown[],
            session_access: sessionAccessArray,
            is_published: formDeckPublished,
          }
        : {
            week: weekNum,
            title: formData.title.trim(),
            session: formData.session || null,
            description: formData.description ?? "",
            session_access: sessionAccessArray.length ? sessionAccessArray : null,
            is_published: formDeckPublished,
          }

      const response = await fetch(`${getApiBasePath()}/lectures`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Failed to create lecture",
          description: data.error || "An error occurred.",
          variant: "destructive",
        })
        return
      }

      const newId = data.lecture?.id as number | undefined
      if (usesInstructorScopedCourseApi() && newId) {
        if (formDeckFile) {
          await uploadDeckToLecture(newId, formDeckFile)
        }
        if (formDeckAllowDownload) {
          await fetch(`${getApiBasePath()}/lectures/${newId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ allow_download: true }),
          })
        }
      }

      toast({
        title: "Lecture created",
        description: formDeckFile
          ? "Lecture saved and slide deck uploaded."
          : "The lecture has been added successfully.",
      })
      setCreateDialogOpen(false)
      resetForm()
      fetchLectures()
    } catch (error) {
      console.error("Failed to create lecture:", error)
      toast({
        title: "Failed to create lecture",
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setFormSaving(false)
    }
  }

  const handleCreateLectureWithDeck = async () => {
    if (!usesInstructorScopedCourseApi()) {
      toast({
        title: "Not available",
        description: "Slide deck upload is available from the instructor dashboard.",
        variant: "destructive",
      })
      return
    }
    const weekNum = Number.parseInt(deckQuickForm.week, 10)
    if (!deckQuickForm.week || !Number.isFinite(weekNum) || !deckQuickForm.title.trim() || !deckQuickFile) {
      toast({
        title: "Missing fields",
        description: "Week, title, and a PDF or PowerPoint file are required.",
        variant: "destructive",
      })
      return
    }

    setDeckQuickUploading(true)
    try {
      const sessionAccessArray = storedArrayFromSessionAccess(sessionAccess, codes)
      const createRes = await fetch(`${getApiBasePath()}/lectures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          title: deckQuickForm.title.trim(),
          week: weekNum,
          description: deckQuickForm.description.trim() || "",
          objectives: [],
          slides: [],
          session_access: sessionAccessArray,
          is_published: deckQuickForm.published,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to create lecture")
      }
      const newId = createData.lecture?.id as number | undefined
      if (!newId) throw new Error("No lecture id returned")

      if (deckQuickForm.allowDownload) {
        const patchRes = await fetch(`${getApiBasePath()}/lectures/${newId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ allow_download: true }),
        })
        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}))
          throw new Error(err.error || "Could not set download permission")
        }
      }

      const fd = new FormData()
      fd.append("file", deckQuickFile)
      const docRes = await instructorApiFetch(`/api/instructor/lectures/${newId}/document`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: fd,
      })
      const docData = await docRes.json().catch(() => ({}))
      if (!docRes.ok) {
        throw new Error(docData.details || docData.error || "Slide deck upload failed")
      }

      toast({
        title: "Lecture created",
        description: "Your slide deck was attached successfully.",
      })
      setDeckQuickForm({
        week: "",
        title: "",
        description: "",
        published: true,
        allowDownload: false,
      })
      setDeckQuickFile(null)
      setDeckQuickFileInputKey((k) => k + 1)
      await fetchLectures()
      showLectureList()
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not create lecture with deck",
        description: e instanceof Error ? e.message : "Please try again.",
      })
    } finally {
      setDeckQuickUploading(false)
    }
  }

  const handleUpdateLecture = async () => {
    if (!lectureToEdit) return

    setFormSaving(true)
    try {
      const sessionAccessArray = storedArrayFromSessionAccess(sessionAccess, codes)
      const weekNum = Number.parseInt(formData.week, 10)

      const patchBody = usesInstructorScopedCourseApi()
        ? {
            title: formData.title.trim(),
            week: weekNum,
            description: formData.description ?? "",
            session_access: sessionAccessArray,
            is_published: formDeckPublished,
            allow_download: formDeckAllowDownload,
          }
        : {
            ...formData,
            week: weekNum,
            session_access: sessionAccessArray,
            is_published: formDeckPublished,
          }

      const response = await fetch(`${getApiBasePath()}/lectures/${lectureToEdit.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(patchBody),
      })

      const data = await response.json()

      if (!response.ok) {
        toast({
          title: "Failed to update lecture",
          description: data.error || "An error occurred.",
          variant: "destructive",
        })
        return
      }

      if (usesInstructorScopedCourseApi() && formDeckFile) {
        await uploadDeckToLecture(lectureToEdit.id, formDeckFile)
      }

      toast({
        title: "Lecture updated",
        description: formDeckFile ? "Details saved and slide deck updated." : "The lecture has been updated successfully.",
      })
      setEditDialogOpen(false)
      setLectureToEdit(null)
      resetForm()
      fetchLectures()
    } catch (error) {
      console.error("Failed to update lecture:", error)
      toast({
        title: "Failed to update lecture",
        description: error instanceof Error ? error.message : "An error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setFormSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!lectureToDelete) return

    setDeleting(true)

    try {
      const response = await instructorApiFetch(`/api/instructor/lectures?id=${lectureToDelete.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        toast({
          title: "Lecture deleted",
          description: `${lectureToDelete.title} has been removed.`,
        })
        fetchLectures()
      } else {
        toast({
          title: "Failed to delete lecture",
          description: "An error occurred. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete lecture:", error)
      toast({
        title: "Failed to delete lecture",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      if (openedLecture?.id === lectureToDelete?.id) showLectureList()
      setLectureToDelete(null)
    }
  }

  const openEditDialog = (lecture: Lecture) => {
    setLectureToEdit(lecture)
    setFormData({
      week: lecture.week.toString(),
      title: lecture.title,
      session: lecture.session || defaultCode || "",
      description: lecture.description,
    })
    setFormDeckFile(null)
    setFormDeckInputKey((k) => k + 1)
    setFormDeckAllowDownload(Boolean(lecture.allow_download))
    setFormDeckPublished(lecture.is_published !== false)
    setSessionAccess(sessionAccessFromStoredArray(lecture.session_access, codes))
    setEditDialogOpen(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setCreateDialogOpen(true)
  }

  const openCommentsDialog = async (lecture: Lecture) => {
    setSelectedLecture(lecture)
    setCommentsDialogOpen(true)
    await fetchComments(lecture.id)
  }

  const resetForm = () => {
    setFormData({
      week: "",
      title: "",
      session: defaultCode || "",
      description: "",
    })
    setFormDeckFile(null)
    setFormDeckInputKey((k) => k + 1)
    setFormDeckAllowDownload(false)
    setFormDeckPublished(true)
    setSessionAccess(codes.length ? createAllSessionAccess(codes, true) : { all: true })
  }

  // Filter lectures
  const filteredLectures = lectures.filter((lecture) => {
    if (sessionFilter !== "all" && lecture.session !== sessionFilter) return false
    if (weekFilter !== "all" && lecture.week !== Number.parseInt(weekFilter)) return false
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        lecture.title.toLowerCase().includes(query) ||
        lecture.description.toLowerCase().includes(query) ||
        `week ${lecture.week}`.includes(query)
      )
    }
    return true
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setLecturesPage(1)
  }, [sessionFilter, weekFilter, searchQuery])

  // Sorted lectures for display
  const sortedFilteredLectures = [...filteredLectures].sort((a, b) => a.week - b.week)
  const totalLecturesPages = Math.max(1, Math.ceil(sortedFilteredLectures.length / LECTURES_PER_PAGE))
  const paginatedLectures = sortedFilteredLectures.slice(
    (lecturesPage - 1) * LECTURES_PER_PAGE,
    lecturesPage * LECTURES_PER_PAGE
  )

  // Group by session
  const lecturesBySession = filteredLectures.reduce(
    (acc, lecture) => {
      const session = lecture.session ?? "unknown"
      if (!acc[session]) {
        acc[session] = []
      }
      acc[session].push(lecture)
      return acc
    },
    {} as Record<string, Lecture[]>,
  )

  const sessions = Object.keys(lecturesBySession).sort()

  const documentLectureId = lectureForDocument?.id
  useEffect(() => {
    if (!documentDialogOpen || documentLectureId == null) return
    const fresh = lectures.find((l) => l.id === documentLectureId)
    if (fresh) setLectureForDocument(fresh)
  }, [lectures, documentDialogOpen, documentLectureId])

  const editingLecture =
    lectureToEdit && editDialogOpen ? lectures.find((l) => l.id === lectureToEdit.id) ?? lectureToEdit : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const menuItems = [
    { id: "lectures", label: "All Lectures", icon: BookOpen, badge: lectures.length },
    { id: "saved", label: "Saved Templates", icon: Star, badge: savedLectures.length },
    { id: "deleted", label: "Deleted Items", icon: Trash2, badge: deletedItems.length, tone: "destructive" as const },
    { id: "issues", label: "Issues & Comments", icon: MessageSquare, badge: openIssuesCount },
    { id: "stats", label: "Lecture Stats", icon: TrendingUp },
    { id: "student-activity", label: "Student Activity", icon: Users },
  ]

  return (
    <div
      className={
        embedInDashboard
          ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
          : "w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6"
      }
    >
      {!embedInDashboard && (
        <div className="flex justify-end mb-4">
          <Link href={usesInstructorScopedCourseApi() ? basePath : "/admin/dashboard"}>
            <Button variant="outline" className="gap-2 rounded-xl border-slate-200 dark:border-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      )}

      <FacultyModuleSplitLayout
        scrollMode={embedInDashboard ? "panel" : "page"}
        className={embedInDashboard ? "min-h-0 flex-1" : undefined}
        menu={
          <FacultyModuleSideMenu
            moduleId="lectures"
            title="Lectures"
            activeId={activeTab}
            onSelect={(id) => {
              showLectureList()
              setActiveTab(id)
            }}
            items={menuItems}
          />
        }
      >
        <div
          className={
            embedInDashboard
              ? "flex min-h-0 min-w-0 flex-1 flex-col gap-6"
              : "min-w-0 flex-1 space-y-6"
          }
        >
          {creating ? (
            <div className={embedInDashboard ? "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2" : undefined}>
            <LectureCreatePanel
              chrome={chrome}
              fp={fp}
              showDeckUpload={usesInstructorScopedCourseApi()}
              onManualCreate={openCreateDialog}
              deckForm={deckQuickForm}
              setDeckForm={setDeckQuickForm}
              deckFile={deckQuickFile}
              setDeckFile={setDeckQuickFile}
              deckFileInputKey={deckQuickFileInputKey}
              deckUploading={deckQuickUploading}
              onCreateWithDeck={handleCreateLectureWithDeck}
              sessionAccess={sessionAccess}
              setSessionAccess={setSessionAccess}
              accessRows={accessRows}
              codes={codes}
              onJsonUpload={() => void handleJsonLectureUpload()}
            />
            </div>
          ) : null}

          {activeTab === "lectures" && !creating && openedLecture ? (
            <div className={embedInDashboard ? "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2" : undefined}>
            <LectureDetailPanel
              lecture={openedLecture}
              chrome={chrome}
              onBack={showLectureList}
              onPreview={() => openLecturePreview(openedLecture)}
              onSlideDeck={() => openDocumentDialog(openedLecture)}
              onSlides={() => openSlidesDialog(openedLecture)}
              onWorkspace={() => openWorkspaceDialog(openedLecture)}
              onMaterials={() => openMaterialsDialog(openedLecture)}
              onComments={() => void openCommentsDialog(openedLecture)}
              onEdit={() => openEditDialog(openedLecture)}
              onSamplePractice={() => openSamplePracticeDialog(openedLecture)}
              onDelete={() => {
                setLectureToDelete(openedLecture)
                setDeleteDialogOpen(true)
              }}
            />
            </div>
          ) : activeTab === "lectures" && !creating ? (
            <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-6" : "space-y-6"}>
              <div className={embedInDashboard ? "shrink-0" : undefined}>
              <FacultyIntegratedToolbar
                moduleId="lectures"
                search={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by title, week, or description…"
                viewMode={openedLecture ? undefined : viewMode}
                onViewModeChange={openedLecture ? undefined : setViewMode}
                trailing={
                  <Button
                    size="sm"
                    className={cn("h-9 shrink-0 gap-1.5", chrome.cta)}
                    onClick={showNewLecture}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">New lecture</span>
                  </Button>
                }
                filters={
                  <>
                    <Select value={sessionFilter} onValueChange={setSessionFilter}>
                      <SelectTrigger
                        className={cn(
                          facultyToolbarFilterButtonClass(sessionFilter !== "all"),
                          "h-9 w-auto min-w-[7.5rem] gap-1.5 border-0 shadow-none focus:ring-1 focus:ring-[var(--cc-accent)]/35",
                        )}
                      >
                        <SelectValue placeholder="Session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sessions</SelectItem>
                        {accessRows.map(({ code, label, dotClass }) => (
                          <SelectItem key={code} value={code}>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${dotClass}`} />
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={weekFilter} onValueChange={setWeekFilter}>
                      <SelectTrigger
                        className={cn(
                          facultyToolbarFilterButtonClass(weekFilter !== "all"),
                          "h-9 w-auto min-w-[6.5rem] gap-1.5 border-0 shadow-none focus:ring-1 focus:ring-[var(--cc-accent)]/35",
                        )}
                      >
                        <SelectValue placeholder={indexFilterLabel} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        <SelectItem value="all">{indexFilterAllLabel}</SelectItem>
                        {Array.from({ length: 16 }, (_, i) => i + 1).map((week) => (
                          <SelectItem key={week} value={week.toString()}>
                            {labelForIndex(week)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                }
                meta={
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="text-xs text-[var(--cc-text-muted)]">
                      {filteredLectures.length === lectures.length ? (
                        <>
                          <span className="font-medium text-[var(--cc-text-secondary)] tabular-nums">
                            {lectures.length}
                          </span>
                          {" "}lecture{lectures.length === 1 ? "" : "s"}
                          {lectures.length > 0 ? (
                            <>
                              {" "}·{" "}
                              <span className="tabular-nums">
                                {new Set(lectures.map((l) => l.week)).size}
                              </span>
                              {" "}{indexCoverageLabel}
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          Showing{" "}
                          <span className="font-medium text-[var(--cc-text-secondary)] tabular-nums">
                            {filteredLectures.length}
                          </span>
                          {" "}of{" "}
                          <span className="tabular-nums">{lectures.length}</span>
                        </>
                      )}
                    </p>
                    {(searchQuery || sessionFilter !== "all" || weekFilter !== "all") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("")
                          setSessionFilter("all")
                          setWeekFilter("all")
                        }}
                        className="h-7 px-2 text-xs text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                }
                chips={
                  sessionFilter !== "all" || weekFilter !== "all" ? (
                    <>
                      {sessionFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className={cn("h-6 gap-1 rounded-md pl-2 pr-1 text-xs font-normal", fp.softBg, fp.iconText)}
                        >
                          {getSectionColumnHeading(sessionFilter, labelByCode)}
                          <button
                            type="button"
                            onClick={() => setSessionFilter("all")}
                            className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                            aria-label="Remove session filter"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                      {weekFilter !== "all" && (
                        <Badge
                          variant="secondary"
                          className={cn("h-6 gap-1 rounded-md pl-2 pr-1 text-xs font-normal", fp.softBg, fp.iconText)}
                        >
                          {labelForIndex(Number(weekFilter))}
                          <button
                            type="button"
                            onClick={() => setWeekFilter("all")}
                            className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
                            aria-label="Remove week filter"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      )}
                    </>
                  ) : undefined
                }
              />
              </div>

      {/* Lectures List */}
      <div className={embedInDashboard ? "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2" : undefined}>
      {lectures.length === 0 ? (
                <div className={cn(PORTAL_CARD, "p-8 sm:p-10 text-center")}>
                  <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <h3 className={cn("mb-2 font-semibold", PORTAL_TEXT)}>No lectures yet</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                    Get started by creating your first lecture for this course. After it appears in the list, use{" "}
                    <strong className="text-slate-700 dark:text-slate-300">Deck</strong> (or the menu item{" "}
                    <strong className="text-slate-700 dark:text-slate-300">Slide deck (PDF/PPT)</strong>) on that row to
                    upload your PDF or PowerPoint—students see the PDF as the main lecture material.
                  </p>
                  <Button
                    className={cn("gap-2", fp.cta)}
                    onClick={openCreateDialog}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Lecture
                  </Button>
                </div>
      ) : (
                <div className="space-y-4">
                  {filteredLectures.length === 0 ? (
                    <div className={cn(PORTAL_CARD, "p-8 sm:p-10 text-center")}>
                      <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                      <h4 className={cn("mb-1 font-semibold", PORTAL_TEXT)}>No lectures found</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {searchQuery || sessionFilter !== "all" || weekFilter !== "all"
                          ? "Try adjusting your filters"
                          : "Create a lecture to get started"}
                      </p>
                    </div>
              ) : (
                    <div className="space-y-4">
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {paginatedLectures.map((lecture, index) => {
                        const lectureEngagement = engagement[lecture.id]
                        return (
                          <LectureCard
                            key={lecture.id}
                            index={index}
                            id={lecture.id}
                            title={lecture.title}
                            week={lecture.week}
                            session={lecture.session}
                            description={lecture.description}
                            isPublished={lecture.is_published}
                            hasDeck={Boolean(lecture.pdf_url)}
                            views={lectureEngagement?.stats.total_views}
                            comments={lectureEngagement?.stats.total_comments}
                            viewMode="grid"
                            onSelect={() => showLectureDetail(lecture)}
                          />
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {(() => {
                        const byWeek = paginatedLectures.reduce(
                          (acc, l) => {
                            const w = l.week
                            if (!acc[w]) acc[w] = []
                            acc[w].push(l)
                            return acc
                          },
                          {} as Record<number, Lecture[]>,
                        )
                        const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b)
                        return weeks.map((week) => (
                          <section key={week} className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                              <Calendar className={cn("h-4 w-4", chrome.p.iconText)} />
                              <h3 className={cn("text-sm font-semibold uppercase tracking-wider", PORTAL_TEXT_MUTED)}>
                                {labelForIndex(week)}
                              </h3>
                              <div className="h-px flex-1 bg-[var(--border)]" />
                              <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                                {byWeek[week].length} lecture{byWeek[week].length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className={cn(PORTAL_CARD, "overflow-hidden divide-y divide-[var(--border)]")}>
                              {byWeek[week].map((lecture) => {
                                const lectureEngagement = engagement[lecture.id]
                                const cardIndex = paginatedLectures.findIndex((l) => l.id === lecture.id)
                                return (
                                  <LectureCard
                                    key={lecture.id}
                                    index={cardIndex >= 0 ? cardIndex : 0}
                                    id={lecture.id}
                                    title={lecture.title}
                                    week={lecture.week}
                                    session={lecture.session}
                                    description={lecture.description}
                                    isPublished={lecture.is_published}
                                    hasDeck={Boolean(lecture.pdf_url)}
                                    views={lectureEngagement?.stats.total_views}
                                    comments={lectureEngagement?.stats.total_comments}
                                    viewMode="list"
                                    onSelect={() => showLectureDetail(lecture)}
                                  />
                                )
                              })}
                            </div>
                          </section>
                        ))
                      })()}
                    </div>
                  )}

                  {sortedFilteredLectures.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Showing {(lecturesPage - 1) * LECTURES_PER_PAGE + 1}-{Math.min(lecturesPage * LECTURES_PER_PAGE, sortedFilteredLectures.length)} of {sortedFilteredLectures.length} lectures
                      </p>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                if (lecturesPage > 1) setLecturesPage(lecturesPage - 1)
                              }}
                              className={lecturesPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              aria-disabled={lecturesPage <= 1}
                            />
                          </PaginationItem>
                          {Array.from({ length: totalLecturesPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault()
                                  setLecturesPage(page)
                                }}
                                isActive={lecturesPage === page}
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
                                if (lecturesPage < totalLecturesPages) setLecturesPage(lecturesPage + 1)
                              }}
                              className={lecturesPage >= totalLecturesPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              aria-disabled={lecturesPage >= totalLecturesPages}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                    </div>
                  )}
                </div>
              )}
      </div>
            </div>
          ) : null}

          {activeTab === "saved" && (
            <LecturesEmptyTabPanel
              embedInDashboard={Boolean(embedInDashboard)}
              icon={Star}
              title="No saved templates"
              description="Save lecture templates for quick reuse"
            />
          )}

          {activeTab === "deleted" && (
            <LecturesEmptyTabPanel
              embedInDashboard={Boolean(embedInDashboard)}
              icon={Trash2}
              title="No deleted items"
              description="Deleted lectures will appear here"
            />
          )}

          {activeTab === "issues" && (
            <LecturesEmptyTabPanel
              embedInDashboard={Boolean(embedInDashboard)}
              icon={MessageSquare}
              title="No issues reported"
              description="Student issues will appear here"
            />
          )}

          {activeTab === "stats" && (
            <LecturesTabPanel embedInDashboard={Boolean(embedInDashboard)} scroll>
              <LectureStatisticsTab
                initialStats={lectureStats}
                lectureCountFallback={lectures.length}
              />
            </LecturesTabPanel>
          )}

          {activeTab === "student-activity" && (
            <LecturesTabPanel embedInDashboard={Boolean(embedInDashboard)} scroll>
              <InstructorModuleStudentActivityView module="lectures" moduleId="lectures" />
            </LecturesTabPanel>
          )}
        </div>
      </FacultyModuleSplitLayout>

      <Dialog open={materialsDialogOpen} onOpenChange={setMaterialsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Materials & Engagement - {selectedLecture?.title}
            </DialogTitle>
            <DialogDescription>
              Week {selectedLecture?.week} - Manage materials and view engagement statistics
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Left Column - Materials Management */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-secondary" />
                  Course Materials
                </h4>

                {/* Add Material Form */}
                <Card className="mb-4 border-2 border-dashed">
                  <CardContent className="pt-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Material title"
                        value={newMaterial.title}
                        onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                      />
                      <Select
                        value={newMaterial.fileType}
                        onValueChange={(value) => setNewMaterial({ ...newMaterial, fileType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="pptx">PowerPoint</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="link">Link</SelectItem>
                          <SelectItem value="file">Other File</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      placeholder="File URL"
                      value={newMaterial.fileUrl}
                      onChange={(e) => setNewMaterial({ ...newMaterial, fileUrl: e.target.value })}
                    />
                    <Button
                      onClick={handleAddMaterial}
                      disabled={uploadingMaterial}
                      className="w-full bg-gradient-to-r from-primary to-secondary"
                    >
                      {uploadingMaterial ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Material
                    </Button>
                  </CardContent>
                </Card>

                {/* Materials List */}
                <div className="space-y-2">
                  {materials[selectedLecture?.id || 0]?.length === 0 || !materials[selectedLecture?.id || 0] ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No materials uploaded yet</p>
                    </div>
                  ) : (
                    materials[selectedLecture?.id || 0]?.map((material) => (
                      <Card key={material.id} className="border-2">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{material.title}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    {material.view_count} views
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {material.file_type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void openDesktopUrl(material.file_url)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResetViews(material.id, selectedLecture?.id || 0)}
                              >
                                Reset
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMaterial(material.id, selectedLecture?.id || 0)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Engagement Stats */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Engagement
              </h4>

              {/* Stats Cards */}
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Eye className="h-4 w-4" />
                        <span className="text-sm">Total Views</span>
                      </div>
                      <span className="text-2xl font-bold text-primary">
                        {engagement[selectedLecture?.id || 0]?.stats.total_views || 0}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-sm">Comments</span>
                      </div>
                      <span className="text-2xl font-bold text-secondary">
                        {engagement[selectedLecture?.id || 0]?.stats.total_comments || 0}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Star className="h-4 w-4" />
                        <span className="text-sm">Bookmarks</span>
                      </div>
                      <span className="text-2xl font-bold text-accent">
                        {engagement[selectedLecture?.id || 0]?.stats.total_bookmarks || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Material */}
              {engagement[selectedLecture?.id || 0]?.topMaterial && (
                <Card className="border-2 border-secondary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-secondary" />
                      Most Viewed Material
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 rounded-lg bg-secondary/10">
                      <p className="font-medium text-sm mb-1">
                        {engagement[selectedLecture?.id || 0]?.topMaterial?.title}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {engagement[selectedLecture?.id || 0]?.topMaterial?.view_count} views
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Comment */}
              {engagement[selectedLecture?.id || 0]?.topComment && (
                <Card className="border-2 border-accent/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-accent" />
                      Top Comment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 rounded-lg bg-accent/10">
                      <p className="font-medium text-sm mb-1">
                        {engagement[selectedLecture?.id || 0]?.topComment?.first_name}{" "}
                        {engagement[selectedLecture?.id || 0]?.topComment?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                        {engagement[selectedLecture?.id || 0]?.topComment?.comment}
                      </p>
                      <div className="flex items-center gap-1 text-accent">
                        <ThumbsUp className="h-3 w-3" />
                        <span className="text-xs font-medium">
                          {engagement[selectedLecture?.id || 0]?.topComment?.likes} likes
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false)
            setEditDialogOpen(false)
            setLectureToEdit(null)
            resetForm()
          }
        }}
      >
        <DialogContent className={LECTURE_DIALOG_SHELL}>
          <DialogHeader className={LECTURE_DIALOG_HEADER}>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl pr-0">
              {lectureToEdit ? (
                <>
                  <Edit className={cn("h-5 w-5  shrink-0", fp.iconText)} />
                  Edit lecture
                </>
              ) : (
                <>
                  <Plus className={cn("h-5 w-5  shrink-0", fp.iconText)} />
                  Create new lecture
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed max-w-3xl">
              {lectureToEdit
                ? "Update week details, section access, and slide deck. Changes apply immediately for students in allowed sections."
                : "Add a weekly topic and optionally attach a PDF or PowerPoint slide deck in one step."}
            </DialogDescription>
          </DialogHeader>

          <div className={LECTURE_DIALOG_BODY}>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">
              <div className="xl:col-span-5 space-y-5 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="week">Week number</Label>
                    <Input
                      id="week"
                      type="number"
                      min="1"
                      max="16"
                      value={formData.week}
                      onChange={(e) => setFormData({ ...formData, week: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session">Session label</Label>
                    <Select
                      value={formData.session}
                      onValueChange={(value) => setFormData({ ...formData, session: value })}
                    >
                      <SelectTrigger id="session" className="w-full">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectOptions.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Lecture title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Introduction to Programming Concepts"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Course intro, syllabus review, learning objectives for this week."
                    rows={5}
                    className="resize-y min-h-[120px] max-h-[240px]"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] p-4">
                  <div>
                    <Label className="text-sm font-semibold">Session access</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Which sections can see this lecture
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="all-sessions"
                      checked={sessionAccess.all}
                      onCheckedChange={(checked) => {
                        setSessionAccess(codes.length ? createAllSessionAccess(codes, !!checked) : { all: !!checked })
                      }}
                    />
                    <Label htmlFor="all-sessions" className="text-sm font-normal leading-snug cursor-pointer">
                      All sessions in this course
                    </Label>
                  </div>
                  {!sessionAccess.all && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.08]">
                      {accessRows.map(({ code, label, dotClass }) => (
                        <div key={code} className="flex items-center space-x-2 min-w-0">
                          <Checkbox
                            id={`session-access-${code}`}
                            checked={!!sessionAccess[code]}
                            onCheckedChange={(checked) =>
                              setSessionAccess({ ...sessionAccess, [code]: !!checked })
                            }
                          />
                          <Label
                            htmlFor={`session-access-${code}`}
                            className="text-sm font-normal leading-snug cursor-pointer flex items-center gap-2 min-w-0"
                          >
                            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
                            <span className="truncate">{label}</span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {usesInstructorScopedCourseApi() ? (
                <div className="xl:col-span-7 min-w-0">
                  <LectureDeckFormSection
                    week={formData.week ? Number.parseInt(formData.week, 10) : undefined}
                    lectureTitle={formData.title || undefined}
                    pdfUrl={editingLecture?.pdf_url}
                    contentMode={editingLecture?.content_mode}
                    selectedFile={formDeckFile}
                    onSelectedFileChange={setFormDeckFile}
                    fileInputKey={formDeckInputKey}
                    allowDownload={formDeckAllowDownload}
                    onAllowDownloadChange={setFormDeckAllowDownload}
                    published={formDeckPublished}
                    onPublishedChange={setFormDeckPublished}
                    uploading={formSaving}
                    className="h-full"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className={LECTURE_DIALOG_FOOTER}>
            <Button
              variant="outline"
              disabled={formSaving}
              onClick={() => {
                setCreateDialogOpen(false)
                setEditDialogOpen(false)
                setLectureToEdit(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button disabled={formSaving} onClick={lectureToEdit ? handleUpdateLecture : handleCreateLecture}>
              {formSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : lectureToEdit ? (
                formDeckFile ? "Save & update deck" : "Save changes"
              ) : formDeckFile ? (
                "Create & upload deck"
              ) : (
                "Create lecture"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Comments</DialogTitle>
            <DialogDescription>
              {selectedLecture?.title} - {selectedLecture ? labelForIndex(selectedLecture.week, selectedLecture.title) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {loadingComments ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No comments yet for this lecture.</p>
              </div>
            ) : (
              comments.map((comment) => (
                <Card key={comment.id} className="bg-muted/50 border-2">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">
                          {comment.first_name} {comment.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">{comment.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-accent">
                          <ThumbsUp className="h-4 w-4" />
                          <span className="text-sm font-medium">{comment.likes || 0}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed mt-3">{comment.comment}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Delete Lecture</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{lectureToDelete?.title}</span>?
              <br />
              <br />
              This will permanently delete the lecture and all associated comments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Lecture"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={documentDialogOpen}
        onOpenChange={(o) => {
          setDocumentDialogOpen(o)
          if (!o) setLectureForDocument(null)
        }}
      >
        <DialogContent
          className={
            lectureForDocument?.pdf_url ? LECTURE_DIALOG_SHELL_DECK_PREVIEW : LECTURE_DIALOG_SHELL_COMPACT
          }
        >
          <DialogHeader className={LECTURE_DIALOG_HEADER}>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl pr-0">
              <Presentation className={cn("h-5 w-5  shrink-0", fp.iconText)} />
              Manage slide deck
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Upload or replace the PDF/PowerPoint students see in the lecture viewer. Legacy HTML slides are managed separately.
            </DialogDescription>
          </DialogHeader>
          {lectureForDocument ? (
            <>
              <div
                className={
                  lectureForDocument.pdf_url ? LECTURE_DIALOG_BODY : LECTURE_DIALOG_BODY_FIT
                }
              >
                <div
                  className={
                    lectureForDocument.pdf_url
                      ? "grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start"
                      : "space-y-4"
                  }
                >
                  {lectureForDocument.pdf_url ? (
                    <div className="space-y-3 min-w-0 lg:sticky lg:top-0">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm font-semibold">Live preview</Label>
                        <Badge variant="outline" className="text-[11px] shrink-0">
                          Student PDF viewer
                        </Badge>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-950 overflow-hidden min-h-[280px] max-h-[min(52vh,520px)]">
                        <LecturePdfViewer
                          pdfUrl={lectureForDocument.pdf_url}
                          title={lectureForDocument.title}
                          allowDownload={Boolean(lectureForDocument.allow_download)}
                          lectureId={lectureForDocument.id}
                          studentIdString={null}
                          useInstructorPdfProxy
                          className="h-[min(52vh,520px)] min-h-[280px] rounded-none border-0 shadow-none"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-4 min-w-0">
                    <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-3 sm:p-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Week {lectureForDocument.week}
                        </Badge>
                        {lectureForDocument.is_published ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">Published</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Draft</Badge>
                        )}
                        {lectureForDocument.pdf_url ? (
                          <Badge className={cn("text-xs", fp.cta)}>Deck attached</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">No deck yet</Badge>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white text-base leading-snug break-words">
                        {lectureForDocument.title}
                      </p>
                    </div>

                    <LectureDeckFormSection
                      pdfUrl={lectureForDocument.pdf_url}
                      contentMode={lectureForDocument.content_mode}
                      selectedFile={null}
                      onSelectedFileChange={(file) => {
                        if (file) void uploadLectureDocument(file)
                      }}
                      allowDownload={Boolean(lectureForDocument.allow_download)}
                      onAllowDownloadChange={(v) => void patchDeckLecture(lectureForDocument, { allow_download: v })}
                      published={Boolean(lectureForDocument.is_published)}
                      onPublishedChange={(v) => void patchDeckLecture(lectureForDocument, { is_published: v })}
                      uploading={documentUploading}
                      showVisibilityControls
                      canRemoveExisting={Boolean(lectureForDocument.pdf_url)}
                      onRemoveExisting={() => void deleteLectureDocument()}
                      compact={!lectureForDocument.pdf_url}
                    />
                  </div>
                </div>
              </div>
              <div className={LECTURE_DIALOG_FOOTER_INSET}>
                <p className="text-xs text-muted-foreground sm:mr-auto text-center sm:text-left">
                  Drop a file to upload instantly · PPT converts to PDF when the server supports it
                </p>
                <Button type="button" variant="outline" onClick={() => setDocumentDialogOpen(false)}>
                  Done
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Slides Management */}
      {slidesDialogOpen && selectedLectureForSlides && (
        <AdminSlidesManagement
          lectureId={selectedLectureForSlides.id}
          lectureTitle={selectedLectureForSlides.title}
          week={selectedLectureForSlides.week}
          onClose={() => {
            setSlidesDialogOpen(false)
            setSelectedLectureForSlides(null)
          }}
        />
      )}

      {lectureForSamplePractice ? (
        <LectureSamplePracticeEditor
          lectureId={lectureForSamplePractice.id}
          lectureTitle={lectureForSamplePractice.title}
          open={samplePracticeOpen}
          onOpenChange={(open) => {
            setSamplePracticeOpen(open)
            if (!open) setLectureForSamplePractice(null)
          }}
        />
      ) : null}

      {lectureForWorkspace ? (
        <LectureWorkspacePanel
          lectureId={lectureForWorkspace.id}
          open={workspaceOpen}
          onOpenChange={(open) => {
            setWorkspaceOpen(open)
            if (!open) setLectureForWorkspace(null)
          }}
          mode="instructor"
        />
      ) : null}

      {lectureForWorkspaceEditor ? (
        <LectureWorkspaceEditor
          lectureId={lectureForWorkspaceEditor.id}
          lectureTitle={lectureForWorkspaceEditor.title}
          open={workspaceEditorOpen}
          onOpenChange={(open) => {
            setWorkspaceEditorOpen(open)
            if (!open) setLectureForWorkspaceEditor(null)
          }}
        />
      ) : null}
    </div>
  )
}
