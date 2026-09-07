"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow, format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"

interface DeletedQuiz {
  id: number
  title: string
  assessment_type: string
  description?: string
  total_questions?: number
  time_limit_minutes?: number
  deleted_at: string
  deleted_by?: string
  session?: string
}

export default function DeletedItemsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [deletedItems, setDeletedItems] = useState<DeletedQuiz[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedItem, setSelectedItem] = useState<DeletedQuiz | null>(null)
  const [restoreDialog, setRestoreDialog] = useState(false)
  const [permanentDeleteDialog, setPermanentDeleteDialog] = useState(false)

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }
    
    // Get type from URL params
    const urlParams = new URLSearchParams(window.location.search)
    const urlType = urlParams.get("type")
    if (urlType && urlType !== typeFilter) {
      setTypeFilter(urlType)
    } else {
      fetchDeletedItems()
    }
  }, [router, typeFilter])

  const fetchDeletedItems = async () => {
    try {
      const url = typeFilter === "all" 
        ? "/api/instructor/deleted-items"
        : `/api/instructor/deleted-items?type=${typeFilter}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setDeletedItems(data.deleted_items || [])
      } else {
        setDeletedItems([])
      }
    } catch (error) {
      console.error("Failed to fetch deleted items:", error)
      setDeletedItems([])
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedItem) return

    try {
      const response = await instructorApiFetch("/api/instructor/deleted-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: selectedItem.id }),
      })

      if (response.ok) {
        toast({
          title: "✅ Item Restored Successfully",
          description: `"${selectedItem.title}" has been restored and is now available.`,
        })
        setRestoreDialog(false)
        setSelectedItem(null)
        fetchDeletedItems()
      } else {
        throw new Error("Failed to restore item")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Restore Item",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePermanentDelete = async () => {
    if (!selectedItem) return

    try {
      const response = await instructorApiFetch("/api/instructor/deleted-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: selectedItem.id }),
      })

      if (response.ok) {
        toast({
          title: "🗑️ Item Permanently Deleted",
          description: `"${selectedItem.title}" has been permanently removed and cannot be recovered.`,
        })
        setPermanentDeleteDialog(false)
        setSelectedItem(null)
        fetchDeletedItems()
      } else {
        throw new Error("Failed to permanently delete item")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Delete Item",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRestoreAll = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/restore-all-deleted", {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "✅ All Items Restored",
          description: `Successfully restored ${data.restored_count} items.`,
        })
        fetchDeletedItems()
      } else {
        throw new Error("Failed to restore all items")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Restore All Items",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const getAssessmentTypeColor = (type: string) => {
    switch (type) {
      case "quiz": return "bg-blue-100 text-blue-700 border-blue-200"
      case "mid_semester": return "bg-purple-100 text-purple-700 border-purple-200"
      case "final": return "bg-red-100 text-red-700 border-red-200"
      case "homework": return "bg-green-100 text-green-700 border-green-200"
      case "practice": return "bg-yellow-100 text-yellow-700 border-yellow-200"
      default: return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getAssessmentTypeLabel = (type: string) => {
    switch (type) {
      case "quiz": return "Quiz"
      case "mid_semester": return "Mid-Semester Exam"
      case "final": return "Final Exam"
      case "homework": return "Homework"
      case "practice": return "Practice"
      default: return type
    }
  }

  // Filter items
  const filteredItems = deletedItems.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))

    return matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-lg text-slate-600">Loading Deleted Items...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/25">
                <Trash2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                  Deleted Items
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  Restore or permanently delete assessments
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchDeletedItems}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {filteredItems.length > 0 && (
              <Button
                onClick={handleRestoreAll}
                className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Restore All
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push("/instructor/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </div>

        {/* Warning Banner */}
        {filteredItems.length > 0 && (
          <Card className="mb-6 border-l-4 border-l-orange-500 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-900 mb-1">⚠️ 24-Hour Grace Period Active</h4>
                  <p className="text-sm text-orange-800">
                    Deleted items are automatically and permanently removed after 24 hours. Restore them before the countdown expires to prevent permanent data loss.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                Total Deleted
              </CardDescription>
              <CardTitle className="text-3xl text-red-600">{deletedItems.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                Quizzes
              </CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {deletedItems.filter(i => i.assessment_type === "quiz").length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-purple-500" />
                Exams
              </CardDescription>
              <CardTitle className="text-3xl text-purple-600">
                {deletedItems.filter(i => ["mid_semester", "final"].includes(i.assessment_type)).length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Info className="h-4 w-4 text-green-500" />
                Homework
              </CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {deletedItems.filter(i => i.assessment_type === "homework").length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-500" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search deleted items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="quiz">Quizzes</SelectItem>
                  <SelectItem value="mid_semester">Mid-Semester Exams</SelectItem>
                  <SelectItem value="final">Final Exams</SelectItem>
                  <SelectItem value="homework">Homework</SelectItem>
                  <SelectItem value="practice">Practice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Deleted Items List */}
        {filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2 text-lg">No Deleted Items</h4>
                <p className="text-sm text-gray-600 max-w-md">
                  {searchTerm || typeFilter !== "all"
                    ? "No deleted items match your filters."
                    : "Your recycle bin is empty. Deleted assessments will appear here."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-semibold text-gray-900">{item.title}</h3>
                            <Badge variant="outline" className={getAssessmentTypeColor(item.assessment_type)}>
                              {getAssessmentTypeLabel(item.assessment_type)}
                            </Badge>
                            {item.session && (
                              <Badge variant="outline">Session {item.session}</Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-gray-700 mb-3">{item.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {item.total_questions && (
                              <div className="flex items-center gap-1">
                                <Info className="h-4 w-4" />
                                {item.total_questions} questions
                              </div>
                            )}
                            {item.time_limit_minutes && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {item.time_limit_minutes} minutes
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Deleted {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
                            </div>
                            {item.deleted_by && (
                              <div className="text-xs text-gray-500">
                                by {item.deleted_by}
                              </div>
                            )}
                          </div>
                          {/* 24-Hour Countdown Warning */}
                          {(() => {
                            const deletedTime = new Date(item.deleted_at).getTime()
                            const currentTime = Date.now()
                            const hoursElapsed = Math.floor((currentTime - deletedTime) / (1000 * 60 * 60))
                            const hoursRemaining = 24 - hoursElapsed
                            const minutesRemaining = Math.floor(((24 * 60 * 60 * 1000) - (currentTime - deletedTime)) / (1000 * 60)) % 60
                            
                            if (hoursRemaining <= 0) {
                              return (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-red-900">
                                      ⚠️ This item will be permanently deleted soon
                                    </p>
                                    <p className="text-xs text-red-700">
                                      The 24-hour grace period has expired. Restore now to prevent permanent deletion.
                                    </p>
                                  </div>
                                </div>
                              )
                            } else if (hoursRemaining <= 3) {
                              return (
                                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-orange-900">
                                      ⏰ {hoursRemaining}h {minutesRemaining}m remaining
                                    </p>
                                    <p className="text-xs text-orange-700">
                                      Will be permanently deleted after 24 hours
                                    </p>
                                  </div>
                                </div>
                              )
                            } else {
                              return (
                                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                  <p className="text-xs text-blue-700">
                                    {hoursRemaining}h {minutesRemaining}m until permanent deletion
                                  </p>
                                </div>
                              )
                            }
                          })()}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            onClick={() => {
                              setSelectedItem(item)
                              setRestoreDialog(true)
                            }}
                            className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedItem(item)
                              setPermanentDeleteDialog(true)
                            }}
                            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          >
                            <XCircle className="h-4 w-4" />
                            Delete Forever
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Restore Dialog */}
        <Dialog open={restoreDialog} onOpenChange={setRestoreDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <RotateCcw className="h-5 w-5" />
                Restore Item
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to restore "{selectedItem?.title}"? It will be available again in your assessments.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRestoreDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRestore}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permanent Delete Dialog */}
        <Dialog open={permanentDeleteDialog} onOpenChange={setPermanentDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Permanently Delete Item
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to <strong>permanently delete</strong> "{selectedItem?.title}"? 
                This action cannot be undone and all associated data will be lost forever.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPermanentDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handlePermanentDelete}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Delete Forever
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
