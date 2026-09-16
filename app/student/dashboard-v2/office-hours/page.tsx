"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import {
  Loader2,
  Send,
  Calendar,
  Plus,
  Trash2,
  Code2,
  Pencil,
  CheckCircle2,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/lib/app-toast"
import { cn } from "@/lib/utils"
import { PORTAL_CTA, PORTAL_OUTLINE_BTN } from "@/lib/appearance/portal-nav-classes"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export default function DashboardV2OfficeHoursPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    topic: "",
    areaOfConcern: "",
    description: "",
    priority: "medium" as string,
    preferredDates: [] as string[],
    codeSnippet: "",
  })
  const [preferredDateModalOpen, setPreferredDateModalOpen] = useState(false)
  const [newPreferredDate, setNewPreferredDate] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    topic: "",
    areaOfConcern: "",
    description: "",
    priority: "medium" as string,
    preferredDates: [] as string[],
    codeSnippet: "",
  })
  const [editNewDate, setEditNewDate] = useState("")
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadRequests = async () => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return
    try {
      const res = await studentApiFetch(`/api/student/office-hours?studentId=${dbId}`)
      const data = await res.json()
      if (res.ok && data.requests) setRequests(data.requests)
    } catch (e) {
      console.error(e)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.topic.trim()) {
      toast.error("Topic is required")
      return
    }
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) {
      toast.error("Please log in again")
      return
    }
    setSubmitting(true)
    try {
      const attachments: any[] = []
      if (form.codeSnippet?.trim()) {
        attachments.push({
          contentType: "code",
          content: form.codeSnippet.trim(),
          fileName: "snippet.txt",
        })
      }
      const res = await studentApiFetch("/api/student/office-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: dbId,
          topic: form.topic.trim(),
          areaOfConcern: form.areaOfConcern.trim() || undefined,
          description: form.description.trim() || undefined,
          priority: form.priority,
          preferredDates: form.preferredDates.length > 0 ? form.preferredDates : undefined,
          attachments,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("Request submitted", {
          description: "Your office hours request has been sent. Your instructor will review and schedule a time.",
        })
        setForm({ topic: "", areaOfConcern: "", description: "", priority: "medium", preferredDates: [], codeSnippet: "" })
        await loadRequests()
      } else {
        toast.error(data.error || "Failed to submit")
      }
    } catch (err) {
      toast.error("Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (r: any) => {
    setEditId(r.id)
    setEditForm({
      topic: r.topic || "",
      areaOfConcern: r.area_of_concern || "",
      description: r.description || "",
      priority: r.priority || "medium",
      preferredDates: (r.preferredDates || []).map((d: string) => {
        const dt = new Date(d)
        const y = dt.getFullYear()
        const m = String(dt.getMonth() + 1).padStart(2, "0")
        const day = String(dt.getDate()).padStart(2, "0")
        const h = String(dt.getHours()).padStart(2, "0")
        const min = String(dt.getMinutes()).padStart(2, "0")
        return `${y}-${m}-${day}T${h}:${min}`
      }),
      codeSnippet: r.attachments?.[0]?.content || "",
    })
    setEditNewDate("")
  }

  const handleUpdate = async () => {
    if (!editId || !editForm.topic.trim()) return
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) {
      toast.error("Please log in again")
      return
    }
    setSavingEdit(true)
    try {
      const attachments: any[] = []
      if (editForm.codeSnippet?.trim()) {
        attachments.push({
          contentType: "code",
          content: editForm.codeSnippet.trim(),
          fileName: "snippet.txt",
        })
      }
      const res = await studentApiFetch(`/api/student/office-hours/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: dbId,
          topic: editForm.topic.trim(),
          areaOfConcern: editForm.areaOfConcern.trim() || undefined,
          description: editForm.description.trim() || undefined,
          priority: editForm.priority,
          preferredDates: editForm.preferredDates.length > 0 ? editForm.preferredDates : undefined,
          attachments: editForm.codeSnippet?.trim()
            ? [{ contentType: "code", content: editForm.codeSnippet.trim(), fileName: "snippet.txt" }]
            : [],
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("Request updated", {
          description: "Your office hours request has been updated successfully.",
        })
        setEditId(null)
        await loadRequests()
      } else {
        toast.error(data.error || "Failed to update")
      }
    } catch {
      toast.error("Failed to update request")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (!dbId) return
    setDeleting(true)
    try {
      const res = await studentApiFetch(`/api/student/office-hours/${deleteId}?studentId=${dbId}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("Request deleted", {
          description: "Your office hours request has been cancelled.",
        })
        setDeleteId(null)
        await loadRequests()
      } else {
        toast.error(data.error || "Failed to delete")
      }
    } catch {
      toast.error("Failed to delete request")
    } finally {
      setDeleting(false)
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "approved":
      case "scheduled":
      case "completed":
        return "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
      case "rejected":
      case "cancelled":
        return "bg-red-500/15 text-red-700 dark:text-red-400"
      default:
        return "bg-[var(--muted)] text-[var(--cc-text-muted)]"
    }
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 w-full min-w-0 pb-8"
    >
      <EmbedModuleCard>
        <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-2 xl:items-start">
        <section className="rounded-xl bg-[var(--muted)]/30 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--cc-text)]">New request</h2>
          <p className="mt-0.5 mb-4 text-xs text-[var(--cc-text-muted)]">Describe what you need help with</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic" className="text-[var(--cc-text)]">Topic / area of concern *</Label>
              <Input
                id="topic"
                value={form.topic}
                onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                placeholder="e.g. Quiz 3 Question 2, pointers, debugging"
                className="rounded-lg border-[var(--border)] bg-[var(--muted)]/40"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="area" className="text-[var(--cc-text)]">Specific area (optional)</Label>
                <Input
                  id="area"
                  value={form.areaOfConcern}
                  onChange={(e) => setForm((p) => ({ ...p, areaOfConcern: e.target.value }))}
                  placeholder="e.g. Linked lists"
                  className="rounded-lg border-[var(--border)] bg-[var(--muted)]/40"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--cc-text)]">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger className="rounded-lg border-[var(--border)] bg-[var(--muted)]/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc" className="text-[var(--cc-text)]">Description</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Explain your question or what you need help with..."
                className="min-h-[96px] rounded-lg border-[var(--border)] bg-[var(--muted)]/40"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--cc-text)]">Preferred dates / times</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Dialog open={preferredDateModalOpen} onOpenChange={setPreferredDateModalOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className={cn("rounded-full h-9", PORTAL_OUTLINE_BTN)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add times
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md border-[var(--border)] !bg-[var(--cc-modal-surface,#fff)]">
                    <DialogHeader>
                      <DialogTitle>Add preferred dates</DialogTitle>
                      <DialogDescription>
                        Add times that work for you. Your instructor will pick one or schedule during regular office hours.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          type="datetime-local"
                          value={newPreferredDate}
                          onChange={(e) => setNewPreferredDate(e.target.value)}
                          className="rounded-lg flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className={PORTAL_CTA}
                          onClick={() => {
                            if (newPreferredDate.trim()) {
                              setForm((p) => ({ ...p, preferredDates: [...p.preferredDates, newPreferredDate].sort() }))
                              setNewPreferredDate("")
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {form.preferredDates.length > 0 && (
                        <ul className="max-h-40 space-y-1 overflow-y-auto">
                          {form.preferredDates.map((d, i) => (
                            <li key={i} className="flex items-center justify-between rounded-lg bg-[var(--muted)] px-2 py-1.5 text-sm">
                              {new Date(d).toLocaleString()}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-[var(--cc-text-muted)] hover:text-destructive"
                                onClick={() =>
                                  setForm((p) => ({
                                    ...p,
                                    preferredDates: p.preferredDates.filter((_, j) => j !== i),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" className={PORTAL_OUTLINE_BTN} onClick={() => setPreferredDateModalOpen(false)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                {form.preferredDates.length > 0 && (
                  <span className="text-xs text-[var(--cc-text-muted)]">
                    {form.preferredDates.length} time{form.preferredDates.length !== 1 ? "s" : ""} selected
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code" className="text-[var(--cc-text)]">
                <Code2 className="inline h-4 w-4 mr-1" /> Code snippet (optional)
              </Label>
              <Textarea
                id="code"
                value={form.codeSnippet}
                onChange={(e) => setForm((p) => ({ ...p, codeSnippet: e.target.value }))}
                placeholder="Paste code or error output..."
                className="min-h-[72px] rounded-lg border-[var(--border)] bg-[var(--muted)]/40 font-mono text-sm"
              />
            </div>
            <Button type="submit" disabled={submitting} className={cn("rounded-full", PORTAL_CTA)}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit request
            </Button>
          </form>
        </section>

        <section className="rounded-xl bg-[var(--muted)]/30 overflow-hidden min-h-[320px] flex flex-col">
          <div className="px-4 pt-4 pb-2 sm:px-5">
            <h2 className="text-sm font-semibold text-[var(--cc-text)]">My requests</h2>
            <p className="text-xs text-[var(--cc-text-muted)]">Track status and meeting details</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[var(--cc-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading...
              </div>
            ) : requests.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-[var(--cc-text-muted)] sm:px-5">
                No requests yet. Submit one using the form.
              </p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r: any) => (
                  <li key={r.id} className="rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 transition-colors hover:bg-[var(--muted)]/45">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-medium text-[var(--cc-text)]">{r.topic}</span>
                      <Badge className={cn("border-0 capitalize", statusColor(r.status))}>{r.status}</Badge>
                      {r.priority && (
                        <Badge variant="outline" className="text-[10px] border-[var(--border)] capitalize">
                          {r.priority}
                        </Badge>
                      )}
                    </div>
                    {r.description && (
                      <p className="text-sm text-[var(--cc-text-muted)] line-clamp-2 mb-2">{r.description}</p>
                    )}
                    {r.preferredDates?.length > 0 && (
                      <p className="text-xs text-[var(--cc-text-muted)] mb-1">
                        Preferred: {r.preferredDates.map((d: string) => new Date(d).toLocaleString()).join(" · ")}
                      </p>
                    )}
                    {r.scheduled_date && (
                      <p className="text-sm flex items-center gap-1 text-[var(--cc-text)]">
                        <Calendar className="h-3.5 w-3.5 text-[var(--cc-accent-dark)]" />
                        {new Date(r.scheduled_date).toLocaleString()}
                      </p>
                    )}
                    {r.meeting_link && (
                      <a
                        href={r.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-sm font-medium text-[var(--cc-accent-dark)] hover:underline"
                      >
                        Join meeting →
                      </a>
                    )}
                    {r.meeting_venue && (
                      <p className="text-xs text-[var(--cc-text-muted)] mt-1">Venue: {r.meeting_venue}</p>
                    )}
                    {r.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" size="sm" className={cn("h-8 rounded-full", PORTAL_OUTLINE_BTN)} onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        </div>
      </EmbedModuleCard>

      <div className="grid gap-3 sm:grid-cols-3 text-sm rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4">
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)] text-xs font-semibold text-[var(--cc-accent-dark)]">1</span>
          <div>
            <p className="font-medium text-[var(--cc-text)]">Submit</p>
            <p className="text-xs text-[var(--cc-text-muted)]">Topic, description, optional code.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)] text-xs font-semibold text-[var(--cc-accent-dark)]">2</span>
          <div>
            <p className="font-medium text-[var(--cc-text)]">Review</p>
            <p className="text-xs text-[var(--cc-text-muted)]">Instructor approves or schedules a time.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)] text-xs font-semibold text-[var(--cc-accent-dark)]">3</span>
          <div>
            <p className="font-medium text-[var(--cc-text)]">Meet</p>
            <p className="text-xs text-[var(--cc-text-muted)]">Join via link or in-person venue.</p>
          </div>
        </div>
      </div>

      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="sm:max-w-lg border-[var(--border)] !bg-[var(--cc-modal-surface,#fff)]">
          <DialogHeader>
            <DialogTitle>Edit request</DialogTitle>
            <DialogDescription>
              Update your office hours request. Only pending requests can be edited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Topic / Area of concern *</Label>
              <Input
                value={editForm.topic}
                onChange={(e) => setEditForm((p) => ({ ...p, topic: e.target.value }))}
                placeholder="e.g. Quiz 3 Question 2"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Specific area (optional)</Label>
              <Input
                value={editForm.areaOfConcern}
                onChange={(e) => setEditForm((p) => ({ ...p, areaOfConcern: e.target.value }))}
                placeholder="e.g. Linked lists"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Explain your question..."
                className="rounded-lg min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={editForm.priority} onValueChange={(v) => setEditForm((p) => ({ ...p, priority: v }))}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--card)] border-[var(--border)]">
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred dates</Label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={editNewDate}
                  onChange={(e) => setEditNewDate(e.target.value)}
                  className="rounded-lg flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (editNewDate.trim()) {
                      setEditForm((p) => ({ ...p, preferredDates: [...p.preferredDates, editNewDate].sort() }))
                      setEditNewDate("")
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {editForm.preferredDates.length > 0 && (
                <ul className="space-y-1 max-h-24 overflow-y-auto">
                  {editForm.preferredDates.map((d, i) => (
                    <li key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted">
                      {new Date(d).toLocaleString()}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          setEditForm((p) => ({ ...p, preferredDates: p.preferredDates.filter((_, j) => j !== i) }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label><Code2 className="inline h-4 w-4 mr-1" /> Code (optional)</Label>
              <Textarea
                value={editForm.codeSnippet}
                onChange={(e) => setEditForm((p) => ({ ...p, codeSnippet: e.target.value }))}
                placeholder="Paste code..."
                className="rounded-lg font-mono text-sm min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={savingEdit || !editForm.topic.trim()} className={PORTAL_CTA}>
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="border-[var(--border)] !bg-[var(--cc-modal-surface,#fff)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently cancel your office hours request. You can submit a new request anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
