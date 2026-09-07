"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { useToast } from "@/hooks/use-toast"
import {
  fetchFacultyCoraAutomations,
  scheduleFacultyCoraAutomation,
  type FacultyCoraAutomationJob,
} from "@/lib/cora/faculty-cora-client"

function jobLabel(job: FacultyCoraAutomationJob) {
  const type = job.jobType || job.job_type
  if (type === "post_lecture_flashcards") return "Post-lecture flashcards"
  if (type === "weekly_announcement") return "Weekly announcement"
  return String(type ?? "Automation")
}

function jobWhen(job: FacultyCoraAutomationJob) {
  const raw = job.runAt || job.run_at
  if (!raw) return "—"
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString()
}

export function FacultyCoraAutomatePanel() {
  const { toast } = useToast()
  const [jobs, setJobs] = useState<FacultyCoraAutomationJob[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetchFacultyCoraAutomations()
      setJobs(res.jobs ?? [])
    } catch (error) {
      toast({
        title: "Could not load automations",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const schedule = async (jobType: "weekly_announcement" | "post_lecture_flashcards") => {
    setScheduling(true)
    try {
      await scheduleFacultyCoraAutomation({
        jobType,
        runInHours: jobType === "weekly_announcement" ? 24 * 7 : 24,
        payload: {
          notes:
            jobType === "weekly_announcement"
              ? "Draft a weekly announcement summarizing deadlines and class updates."
              : "Generate flashcards after the next lecture.",
        },
      })
      toast({ title: "Scheduled", description: "Automation job created." })
      await refresh()
    } catch (error) {
      toast({
        title: "Schedule failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--cc-text)]">Automations</h2>
        <p className="text-sm text-[var(--cc-text-muted)]">
          Schedule recurring teaching tasks. Cron picks them up and runs them for your selected course.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-xl"
          disabled={scheduling}
          onClick={() => void schedule("weekly_announcement")}
        >
          {scheduling ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
          Weekly announcement
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={scheduling}
          onClick={() => void schedule("post_lecture_flashcards")}
        >
          Post-lecture flashcards
        </Button>
      </div>

      <CardWrapper variant="inner" hover={false}>
        <div className="p-4">
          <p className="text-sm font-semibold text-[var(--cc-text)]">Scheduled jobs</p>
          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : jobs.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--cc-text-muted)]">No automations scheduled yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {jobs.map((job) => (
                <li
                  key={String(job.id)}
                  className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[var(--cc-text)]">{jobLabel(job)}</span>
                    <span className="text-xs text-[var(--cc-text-muted)]">{job.status ?? "pending"}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--cc-text-muted)]">Runs {jobWhen(job)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardWrapper>
    </div>
  )
}
