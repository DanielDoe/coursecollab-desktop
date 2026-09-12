"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, CheckCircle2, AlertTriangle, Clock, FileText, Calendar } from "lucide-react"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

interface DeletedItem {
  id: number
  title: string
  description?: string
  total_questions?: number
  time_limit_minutes?: number
  deleted_at: string
  deleted_by?: string
}

interface InstructorAssessmentDeletedViewProps {
  assessmentType?: string
  assessmentLabel?: string
  assessmentPluralLabel?: string
}

export function InstructorAssessmentDeletedView({
  assessmentType = "quiz",
  assessmentLabel = "Quiz",
  assessmentPluralLabel = "Quizzes",
}: InstructorAssessmentDeletedViewProps) {
  const { toast } = useToast()
  const { confirm } = useAppConfirm()
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDeletedItems = async () => {
    try {
      setLoading(true)
      const response = await instructorApiFetch(`/api/instructor/deleted-items?type=${assessmentType}`)
      const data = await response.json()
      if (response.ok) {
        const raw = data.deleted_items ?? data.deletedItems ?? data.items
        setDeletedItems(Array.isArray(raw) ? raw : [])
      } else {
        setDeletedItems([])
        toast({
          title: "Failed to fetch deleted items",
          description: data.error || "An error occurred.",
          variant: "destructive",
        })
      }
    } catch {
      setDeletedItems([])
      toast({
        title: "Network Error",
        description: "Unable to connect to the server.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeletedItems()
  }, [assessmentType])

  const handleRestore = async (itemId: number) => {
    try {
      const response = await instructorApiFetch("/api/instructor/deleted-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: itemId }),
      })
      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Item Restored",
          description: `${assessmentLabel} has been restored successfully.`,
        })
        fetchDeletedItems()
      } else {
        toast({
          title: "Restore Failed",
          description: data.error || "An error occurred.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Unable to restore item.",
        variant: "destructive",
      })
    }
  }

  const handlePermanentDelete = async (itemId: number) => {
    const ok = await confirm({
      title: "Permanently delete this item?",
      description: "This cannot be undone.",
      confirmLabel: "Delete permanently",
      cancelLabel: "Cancel",
      variant: "destructive",
    })
    if (!ok) return
    try {
      const response = await instructorApiFetch("/api/instructor/deleted-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: itemId }),
      })
      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Item Permanently Deleted",
          variant: "destructive",
        })
        fetchDeletedItems()
      } else {
        toast({
          title: "Delete Failed",
          description: data.error || "An error occurred.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Unable to delete item.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-slate-200/60 dark:border-white/[0.08] shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-red-600 shadow-lg shrink-0">
              <Trash2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
                Deleted {assessmentPluralLabel}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Recover accidentally deleted items within 24 hours
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {deletedItems.length > 0 && (
        <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-500/50 rounded-xl sm:rounded-2xl overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-xs sm:text-sm text-orange-900 dark:text-orange-100 mb-1">
                  24-Hour Grace Period
                </h4>
                <p className="text-xs sm:text-sm text-orange-800 dark:text-orange-200">
                  Deleted items are permanently removed after 24 hours. Restore them before the countdown expires.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="border-slate-200/60 dark:border-white/[0.08] shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
          <CardContent className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading deleted items...</p>
          </CardContent>
        </Card>
      ) : deletedItems.length === 0 ? (
        <Card className="border-slate-200/60 dark:border-white/[0.08] shadow-sm rounded-xl sm:rounded-2xl overflow-hidden">
          <CardContent className="py-12 text-center">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full w-fit mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">No Deleted Items</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">All {assessmentPluralLabel.toLowerCase()} are safe and accounted for.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(Array.isArray(deletedItems) ? deletedItems : []).map((item) => {
            const deletedTime = new Date(item.deleted_at).getTime()
            const hoursRemaining = 24 - Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60))
            const minutesRemaining = Math.floor(((24 * 60 * 60 * 1000) - (Date.now() - deletedTime)) / (1000 * 60)) % 60

            return (
              <Card
                key={item.id}
                className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors rounded-xl sm:rounded-2xl overflow-hidden"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                        <Badge variant="destructive" className="text-xs">Deleted</Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{item.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {item.total_questions && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {item.total_questions} questions
                          </span>
                        )}
                        {item.time_limit_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {item.time_limit_minutes} min
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Deleted {new Date(item.deleted_at).toLocaleDateString()}
                        </span>
                        {item.deleted_by && <span>by {item.deleted_by}</span>}
                      </div>
                      {hoursRemaining > 0 && hoursRemaining <= 24 && (
                        <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-800 rounded-lg flex items-center gap-2">
                          <Clock className="h-3 w-3 text-blue-700 dark:text-blue-300 flex-shrink-0" />
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            {hoursRemaining}h {minutesRemaining}m until permanent deletion
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <Button
                        onClick={() => handleRestore(item.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                      <Button
                        onClick={() => handlePermanentDelete(item.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Forever
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
