"use client"

import { useCallback, useState } from "react"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { ClassroomAssignmentEditDialog } from "@/components/classroom-assignment-edit-dialog"
import { useToast } from "@/hooks/use-toast"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"

export type InstructorClassroomAssignmentRecord = {
  id: number
  title?: string
  description?: string | null
  submission_kind?: string
  question_config?: unknown
  session?: string | null
  due_at?: string | null
  duration_hours?: number | null
  expires_at?: string | null
  hidden_from_students?: boolean
}

type Props = {
  submission: InstructorClassroomAssignmentRecord
  sessions?: string[]
  onMutated?: () => void
  className?: string
  iconClassName?: string
}

export function InstructorClassroomAssignmentActions({
  submission,
  sessions = ["all"],
  onMutated,
  className,
  iconClassName = "h-3.5 w-3.5",
}: Props) {
  const { toast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const response = await instructorApiFetch(`/api/classroom-points/submissions/${submission.id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string; details?: string }
        throw new Error(errorData.error || errorData.details || "Failed to delete assignment")
      }
      const data = (await response.json()) as { message?: string; revokedPoints?: number }
      toast({
        title: "Assignment deleted",
        description: data.message || "Student submissions and points for this assignment were revoked.",
      })
      setDeleteOpen(false)
      onMutated?.()
    } catch (err) {
      toast({
        title: "Could not delete assignment",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }, [onMutated, submission.id, toast])

  return (
    <>
      <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title="Edit assignment"
          aria-label="Edit assignment"
          className="h-7 w-7 text-[var(--cc-text)] hover:bg-muted/60"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className={iconClassName} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title="Delete assignment"
          aria-label="Delete assignment"
          className="h-7 w-7 text-[var(--cc-text)] hover:bg-muted/60 hover:text-[var(--cc-sem-danger,var(--destructive))]"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className={iconClassName} />
        </Button>
      </div>

      <ClassroomAssignmentEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        submission={submission}
        sessions={sessions}
        onSaved={() => {
          onMutated?.()
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{submission.title ?? `Assignment #${submission.id}`}</strong>? This cannot be undone.
              Student submissions and classroom points tied to this assignment will be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Delete assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
