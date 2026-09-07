"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { CalendarClock, FileText, Loader2, PenLine, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers"
import { formatAssignmentDueLabel } from "@/lib/classroom-submission-availability"
import {
  CLASSROOM_SUBMISSION_KIND_SOLUTION,
  isClassroomSolutionAssignment,
} from "@/lib/classroom-solution-submission"
import {
  ClassroomAssignmentAvailabilityFields,
  ClassroomAssignmentProblemFields,
  assignmentFormFromSubmission,
  classroomAssignmentFormToApiPayload,
  type ClassroomAssignmentFormValues,
} from "@/components/classroom-assignment-editor"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  submission: {
    id: number
    title?: string
    description?: string | null
    submission_kind?: string
    question_config?: unknown
    session?: string | null
    due_at?: string | null
    duration_hours?: number | null
    expires_at?: string | null
  } | null
  sessions?: string[]
  onSaved?: () => void
}

function TabPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto w-full max-w-4xl rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40 sm:p-6 ${className}`}
    >
      {children}
    </div>
  )
}

export function ClassroomAssignmentEditDialog({
  open,
  onOpenChange,
  submission,
  sessions = [],
  onSaved,
}: Props) {
  const { toast } = useToast()
  const [values, setValues] = useState<ClassroomAssignmentFormValues | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  useEffect(() => {
    if (open && submission) {
      setValues(assignmentFormFromSubmission(submission))
      setActiveTab("details")
    } else if (!open) {
      setValues(null)
    }
  }, [open, submission])

  const handleSave = async () => {
    if (!submission || !values?.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter an assignment title.",
        variant: "destructive",
      })
      setActiveTab("details")
      return
    }

    if (
      values.submissionKind === CLASSROOM_SUBMISSION_KIND_SOLUTION &&
      !values.questionConfig?.question_text?.trim()
    ) {
      toast({
        title: "Problem statement required",
        description: "Solution assignments need a problem statement students can read.",
        variant: "destructive",
      })
      setActiveTab("problem")
      return
    }

    if (!values.neverExpires && !values.dueAtLocal.trim()) {
      toast({
        title: "Due date required",
        description: "Set a due date or choose “No due date (never expires)”.",
        variant: "destructive",
      })
      setActiveTab("schedule")
      return
    }

    try {
      setSaving(true)
      const payload = classroomAssignmentFormToApiPayload(values)
      const response = await studentApiFetch(`/api/classroom-points/submissions/${submission.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorAuthorizedApiHeaders(),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || err.details || "Failed to update assignment")
      }

      toast({ title: "Saved", description: "Assignment updated successfully." })
      onOpenChange(false)
      onSaved?.()
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update assignment",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const isSolution = submission ? isClassroomSolutionAssignment(submission.submission_kind) : false
  const duePreview = values
    ? values.neverExpires
      ? "No due date"
      : formatAssignmentDueLabel(values.dueAtLocal ? new Date(values.dueAtLocal) : null) ?? "Not set"
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(94dvh,920px)] w-[min(98vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-3 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-8 dark:border-slate-700 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold sm:text-2xl">Edit assignment</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Update what students see, the problem content, and when submissions close.
              </DialogDescription>
            </div>
            {submission ? (
              <Badge variant={isSolution ? "secondary" : "outline"} className="shrink-0">
                {isSolution ? "Solution" : "Code"}
              </Badge>
            ) : null}
          </div>
          {values?.title ? (
            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {values.title}
            </p>
          ) : null}
        </DialogHeader>

        {values ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col bg-slate-50/60 dark:bg-slate-950/40"
          >
            <div className="shrink-0 border-b border-slate-200/80 bg-white px-5 sm:px-8 dark:border-slate-700 dark:bg-slate-950">
              <TabsList
                className={`grid h-auto w-full gap-1 bg-transparent p-0 py-3 ${
                  isSolution ? "max-w-xl grid-cols-3" : "max-w-sm grid-cols-2"
                }`}
              >
                <TabsTrigger
                  value="details"
                  className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>Details</span>
                </TabsTrigger>
                {isSolution ? (
                  <TabsTrigger
                    value="problem"
                    className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-violet-950/50 dark:data-[state=active]:text-violet-100"
                  >
                    <PenLine className="h-4 w-4 shrink-0" />
                    <span>Problem</span>
                  </TabsTrigger>
                ) : null}
                <TabsTrigger
                  value="schedule"
                  className="gap-2 rounded-lg py-2.5 data-[state=active]:bg-slate-100 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800"
                >
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  <span>Schedule</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
              <TabsContent value="details" className="mt-0 focus-visible:outline-none">
                <TabPanel>
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={values.title}
                        onChange={(e) => setValues({ ...values, title: e.target.value })}
                        placeholder="e.g., Exercise 3-3 — Supernode Analysis"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        {isSolution ? "Instructor notes (optional)" : "Assignment description"}
                      </Label>
                      <Textarea
                        rows={5}
                        value={values.description}
                        onChange={(e) => setValues({ ...values, description: e.target.value })}
                        placeholder={
                          isSolution
                            ? "Internal notes for faculty — not shown as the problem statement."
                            : "Describe what students should implement. Used for AI validation of code submissions."
                        }
                        className="min-h-[120px] resize-y"
                      />
                      {isSolution ? (
                        <p className="text-xs text-muted-foreground">
                          Students see the problem statement on the Problem tab, not this field.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TabPanel>
              </TabsContent>

              {isSolution ? (
                <TabsContent value="problem" className="mt-0 focus-visible:outline-none">
                  <TabPanel className="max-w-none">
                    <ClassroomAssignmentProblemFields
                      values={values}
                      onChange={setValues}
                      variant="stacked"
                    />
                  </TabPanel>
                </TabsContent>
              ) : null}

              <TabsContent value="schedule" className="mt-0 focus-visible:outline-none">
                <TabPanel>
                  <ClassroomAssignmentAvailabilityFields
                    values={values}
                    onChange={setValues}
                    sessions={sessions}
                    showRestartOption
                  />
                  {duePreview ? (
                    <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted-foreground dark:bg-slate-900/60">
                      Students see this assignment until{" "}
                      <span className="font-medium text-slate-800 dark:text-slate-100">{duePreview}</span>.
                    </p>
                  ) : null}
                </TabPanel>
              </TabsContent>
            </div>
          </Tabs>
        ) : null}

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-slate-200/80 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-8 dark:border-slate-700 dark:bg-slate-950">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !values?.title.trim()}
            className="w-full gap-2 sm:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
