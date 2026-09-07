"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, RotateCcw, Trash2, Archive, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"
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

interface DeletedAttempt {
  attempt_id: number
  student_name: string
  student_id: string
  section: string
  quiz_title: string
  assessment_type: string
  score: number
  total_questions: number
  percentage: number
  deleted_at: string
  completed_at: string
}

export default function TrashPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [deletedItems, setDeletedItems] = useState<DeletedAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [permanentDeleting, setPermanentDeleting] = useState<number | null>(null)
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<DeletedAttempt | null>(null)

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }

    fetchDeletedItems()
  }, [router])

  const fetchDeletedItems = async () => {
    setLoading(true)
    try {
      const response = await instructorApiFetch("/api/instructor/results/trash")
      const data = await response.json()

      if (response.ok) {
        setDeletedItems(data.deletedItems || [])
      } else {
        throw new Error(data.error || "Failed to fetch deleted items")
      }
    } catch (error) {
      console.error("Failed to fetch deleted items:", error)
      toast({
        title: "Failed to load trash",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (attemptId: number) => {
    setRestoring(attemptId)
    try {
      const response = await instructorApiFetch("/api/instructor/results/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Restored successfully",
          description: "The quiz attempt has been restored and is now visible in results."
        })
        fetchDeletedItems()
      } else {
        throw new Error(data.error || "Failed to restore")
      }
    } catch (error) {
      console.error("Failed to restore:", error)
      toast({
        title: "Failed to restore",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    } finally {
      setRestoring(null)
    }
  }

  const handlePermanentDelete = async () => {
    if (!itemToDelete) return

    setPermanentDeleting(itemToDelete.attempt_id)
    try {
      const response = await instructorApiFetch("/api/instructor/results/permanent-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: itemToDelete.attempt_id })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Permanently deleted",
          description: "The quiz attempt has been permanently removed."
        })
        setShowPermanentDeleteDialog(false)
        setItemToDelete(null)
        fetchDeletedItems()
      } else {
        throw new Error(data.error || "Failed to delete permanently")
      }
    } catch (error) {
      console.error("Failed to delete permanently:", error)
      toast({
        title: "Failed to delete",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    } finally {
      setPermanentDeleting(null)
    }
  }

  const getTimeSinceDeleted = (deletedAt: string) => {
    const deleted = new Date(deletedAt)
    const now = new Date()
    const hours = Math.floor((now.getTime() - deleted.getTime()) / (1000 * 60 * 60))
    const remainingHours = 24 - hours

    if (remainingHours <= 0) return "Expired - will be auto-deleted"
    if (remainingHours === 1) return "1 hour remaining"
    return `${remainingHours} hours remaining`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                <Archive className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Trash / Deleted Results
                </h1>
                <p className="text-sm text-slate-600">Recoverable for 24 hours</p>
              </div>
            </div>
            
            <Link href="/instructor/results">
              <Button 
                variant="outline"
                className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-600">Loading deleted items...</p>
          </div>
        ) : deletedItems.length === 0 ? (
          <Card className="border border-slate-200/60 bg-white/80 backdrop-blur-sm">
            <CardContent className="py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
                <Archive className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Trash is Empty</h3>
              <p className="text-slate-600 max-w-md mx-auto">
                Deleted quiz attempts will appear here and can be restored within 24 hours
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl px-5 py-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-slate-700">{deletedItems.length}</span>
                  <span className="text-sm text-slate-500">deleted {deletedItems.length === 1 ? 'item' : 'items'}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Items auto-delete after 24 hours
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {deletedItems.map((item) => (
                <Card key={item.attempt_id} className="border border-amber-200/60 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-all duration-200 rounded-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-base font-semibold text-slate-800">
                            {item.student_name}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {item.student_id}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Section {item.section}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{item.quiz_title}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>Score: <strong className="text-slate-700">{item.score}/{item.total_questions}</strong> ({item.percentage}%)</span>
                          <span>Deleted: {new Date(item.deleted_at).toLocaleString()}</span>
                        </div>
                        <div className="mt-2">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                            ⏰ {getTimeSinceDeleted(item.deleted_at)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(item.attempt_id)}
                      disabled={restoring === item.attempt_id}
                      className="border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 transition-all rounded-lg"
                    >
                      {restoring === item.attempt_id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      Restore
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setItemToDelete(item)
                        setShowPermanentDeleteDialog(true)
                      }}
                      disabled={permanentDeleting === item.attempt_id}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all rounded-lg"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Permanently
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800">
                Permanent Delete
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to <strong>permanently delete</strong> this quiz attempt?
              <br/><br/>
              <strong>Student:</strong> {itemToDelete?.student_name}
              <br/>
              <strong>Quiz:</strong> {itemToDelete?.quiz_title}
              <br/>
              <strong>Score:</strong> {itemToDelete?.score}/{itemToDelete?.total_questions}
              <br/><br/>
              <span className="text-red-600 font-semibold">This action cannot be undone!</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={permanentDeleting !== null}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl"
            >
              {permanentDeleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

