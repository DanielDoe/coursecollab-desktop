"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
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
} from "lucide-react"
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
import { AdminSlidesManagement } from "@/components/admin-slides-management"

interface Lecture {
  id: number
  week: number
  title: string
  session: string
  description: string
  materials_url: string | null
  created_at: string
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

export function LecturesManagement() {
  const router = useRouter()
  const { toast } = useToast()
  const [lectures, setLectures] = useState<Lecture[]>([])
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

  // Filters
  const [sessionFilter, setSessionFilter] = useState<string>("all")
  const [weekFilter, setWeekFilter] = useState<string>("all")

  const [formData, setFormData] = useState({
    week: "",
    title: "",
    session: "P01",
    description: "",
    materials_url: "",
  })

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
      return
    }

    fetchLectures()
  }, [router])

  const fetchLectures = async () => {
    try {
      const response = await studentApiFetch("/api/lectures")
      const data = await response.json()

      if (response.ok) {
        setLectures(data.lectures || [])
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

  const handleCreateLecture = async () => {
    try {
      const response = await studentApiFetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          week: Number.parseInt(formData.week),
        }),
      })

      if (response.ok) {
        toast({
          title: "Lecture created",
          description: "The lecture has been added successfully.",
        })
        setCreateDialogOpen(false)
        resetForm()
        fetchLectures()
      } else {
        const data = await response.json()
        toast({
          title: "Failed to create lecture",
          description: data.error || "An error occurred.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to create lecture:", error)
      toast({
        title: "Failed to create lecture",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateLecture = async () => {
    if (!lectureToEdit) return

    try {
      const response = await studentApiFetch(`/api/lectures/${lectureToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          week: Number.parseInt(formData.week),
        }),
      })

      if (response.ok) {
        toast({
          title: "Lecture updated",
          description: "The lecture has been updated successfully.",
        })
        setEditDialogOpen(false)
        setLectureToEdit(null)
        resetForm()
        fetchLectures()
      } else {
        const data = await response.json()
        toast({
          title: "Failed to update lecture",
          description: data.error || "An error occurred.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to update lecture:", error)
      toast({
        title: "Failed to update lecture",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!lectureToDelete) return

    setDeleting(true)

    try {
      const response = await studentApiFetch(`/api/lectures/${lectureToDelete.id}`, {
        method: "DELETE",
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
      setLectureToDelete(null)
    }
  }

  const openEditDialog = (lecture: Lecture) => {
    setLectureToEdit(lecture)
    setFormData({
      week: lecture.week.toString(),
      title: lecture.title,
      session: lecture.session,
      description: lecture.description,
      materials_url: lecture.materials_url || "",
    })
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
      session: "P01",
      description: "",
      materials_url: "",
    })
  }

  // Filter lectures
  const filteredLectures = lectures.filter((lecture) => {
    if (sessionFilter !== "all" && lecture.session !== sessionFilter) return false
    if (weekFilter !== "all" && lecture.week !== Number.parseInt(weekFilter)) return false
    return true
  })

  // Group by session
  const lecturesBySession = filteredLectures.reduce(
    (acc, lecture) => {
      if (!acc[lecture.session]) {
        acc[lecture.session] = []
      }
      acc[lecture.session].push(lecture)
      return acc
    },
    {} as Record<string, Lecture[]>,
  )

  const sessions = Object.keys(lecturesBySession).sort()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Lectures Management</h2>
          <p className="text-muted-foreground">Create and manage weekly lecture topics for all sessions</p>
        </div>
        <Button className="bg-gradient-to-r from-primary to-secondary text-white" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Lecture
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Filter by Session</Label>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="P01">P01</SelectItem>
                  <SelectItem value="P02">P02</SelectItem>
                  <SelectItem value="P05">P05</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Filter by Week</Label>
              <Select value={weekFilter} onValueChange={setWeekFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Weeks</SelectItem>
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((week) => (
                    <SelectItem key={week} value={week.toString()}>
                      Week {week}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lectures by Session */}
      {lectures.length === 0 ? (
        <Card className="border-2">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No lectures created yet.</p>
            <Button className="bg-gradient-to-r from-primary to-secondary text-white" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Lecture
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={sessions[0] || "P01"} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="P01">P01</TabsTrigger>
            <TabsTrigger value="P02">P02</TabsTrigger>
            <TabsTrigger value="P05">P05</TabsTrigger>
          </TabsList>

          {["P01", "P02", "P05"].map((session) => (
            <TabsContent key={session} value={session} className="space-y-4">
              {lecturesBySession[session]?.length === 0 || !lecturesBySession[session] ? (
                <Card className="border-2">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No lectures for {session} yet.</p>
                  </CardContent>
                </Card>
              ) : (
                lecturesBySession[session]
                  .sort((a, b) => a.week - b.week)
                  .map((lecture) => {
                    const lectureEngagement = engagement[lecture.id]

                    return (
                      <Card key={lecture.id} className="border-2 hover:border-primary/50 transition-colors">
                        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                  Week {lecture.week}
                                </Badge>
                                <Badge variant="secondary">{lecture.session}</Badge>
                              </div>
                              <CardTitle className="text-xl">{lecture.title}</CardTitle>
                              <CardDescription className="mt-2">
                                {new Date(lecture.created_at).toLocaleDateString()}
                              </CardDescription>
                            </div>

                            {lectureEngagement && (
                              <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Eye className="h-4 w-4" />
                                  <span>{lectureEngagement.stats.total_views}</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <MessageSquare className="h-4 w-4" />
                                  <span>{lectureEngagement.stats.total_comments}</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Star className="h-4 w-4" />
                                  <span>{lectureEngagement.stats.total_bookmarks}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-muted-foreground leading-relaxed">{lecture.description}</p>

                          {lecture.materials_url && (
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="h-4 w-4 text-primary" />
                              <a
                                href={lecture.materials_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                View Materials
                              </a>
                            </div>
                          )}

                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSlidesDialog(lecture)}
                              className="gap-2"
                            >
                              <Presentation className="h-4 w-4" />
                              Manage Slides
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openMaterialsDialog(lecture)}
                              className="gap-2"
                            >
                              <Upload className="h-4 w-4" />
                              Materials & Stats
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openCommentsDialog(lecture)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Comments
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(lecture)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLectureToDelete(lecture)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

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
                                onClick={() => window.open(material.file_url, "_blank")}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{lectureToEdit ? "Edit Lecture" : "Create New Lecture"}</DialogTitle>
            <DialogDescription>
              {lectureToEdit ? "Update lecture information" : "Add a new weekly lecture topic"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="week">Week Number</Label>
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
                <Label htmlFor="session">Session</Label>
                <Select
                  value={formData.session}
                  onValueChange={(value) => setFormData({ ...formData, session: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P01">P01</SelectItem>
                    <SelectItem value="P02">P02</SelectItem>
                    <SelectItem value="P05">P05</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Lecture Title</Label>
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
                placeholder="Course intro, syllabus review, algorithms, flowcharts, AI tools for coding help."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="materials_url">Materials URL (optional)</Label>
              <Input
                id="materials_url"
                value={formData.materials_url}
                onChange={(e) => setFormData({ ...formData, materials_url: e.target.value })}
                placeholder="https://example.com/lecture-slides.pdf"
              />
              <p className="text-xs text-muted-foreground">
                Upload your lecture materials (slides, PDFs, sample codes) and paste the URL here
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false)
                setEditDialogOpen(false)
                setLectureToEdit(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={lectureToEdit ? handleUpdateLecture : handleCreateLecture}>
              {lectureToEdit ? "Update Lecture" : "Create Lecture"}
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
              {selectedLecture?.title} - Week {selectedLecture?.week}
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
    </div>
  )
}
