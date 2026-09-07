"use client"

import { BookOpen, Calendar, Clock, Edit, Mail, User, UserCog } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type FacultyMemberRow = {
  id: number
  username: string
  email: string
  name: string
  role: string
  is_active: boolean
  assigned_instructor_id: number | null
  assigned_instructor_name: string | null
  created_at: string
  last_login: string | null
  course_count: number
  course_codes: string[]
}

const ROLE_LABELS: Record<string, string> = {
  instructor: "Instructor",
  ta: "Teaching Assistant",
  department_admin: "Department Admin",
}

function formatFacultyDate(iso: string | null) {
  if (!iso) return "Never"
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: typeof User }) {
  if (value == null || value === "" || value === "—") return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-white/5 last:border-0">
      {Icon ? (
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
          <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm text-slate-900 dark:text-white break-all mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export function FacultyMemberDetailModal({
  row,
  open,
  onOpenChange,
  onEdit,
}: {
  row: FacultyMemberRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (row: FacultyMemberRow) => void
}) {
  if (!row) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ROLE_LABELS[row.role] ?? row.role}</Badge>
            <Badge variant={row.is_active ? "outline" : "destructive"}>
              {row.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <DialogTitle className="text-left text-xl leading-snug pr-6">{row.name}</DialogTitle>
          <DialogDescription className="text-left">@{row.username}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 max-h-[min(60vh,520px)] overflow-y-auto">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Account</p>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-4">
              <DetailRow label="Email" value={row.email} icon={Mail} />
              <DetailRow label="Username" value={row.username} icon={User} />
              <DetailRow label="Account ID" value={`#${row.id}`} icon={UserCog} />
            </div>
          </section>

          {row.role === "ta" && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Assignment</p>
              <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-4">
                <DetailRow
                  label="Supervisor"
                  value={row.assigned_instructor_name ?? "Not assigned"}
                  icon={UserCog}
                />
              </div>
            </section>
          )}

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {row.role === "ta" ? "Assigned courses" : "Courses"}
            </p>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                  <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {row.course_count} course{row.course_count === 1 ? "" : "s"}
                  </p>
                  {row.course_codes?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {row.course_codes.map((code) => (
                        <Badge key={code} variant="outline" className="font-normal text-xs">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">No courses linked yet.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Activity</p>
            <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-4">
              <DetailRow label="Created" value={formatFacultyDate(row.created_at)} icon={Calendar} />
              <DetailRow label="Last login" value={formatFacultyDate(row.last_login)} icon={Clock} />
            </div>
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-200/80 dark:border-white/10 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Close
          </Button>
          {onEdit ? (
            <Button
              className="rounded-xl bg-violet-600 hover:bg-violet-700"
              onClick={() => {
                onOpenChange(false)
                onEdit(row)
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit faculty
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ROLE_LABELS }
