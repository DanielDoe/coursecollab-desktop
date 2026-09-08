"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Plus,
  Edit,
  Trash2,
  UserCog,
  Loader2,
  BookOpen,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  AM_EMPTY_FILL,
  AM_PANEL_SCROLL,
} from "@/lib/assessments/assessment-management-surface-classes"
import { cn } from "@/lib/utils"
import {
  FacultyAdministrationWorkspace,
  facultyAdminMetaLine,
} from "@/components/instructor/administration/FacultyAdministrationWorkspace"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { FACULTY_DEFAULT_PASSWORD } from "@/lib/faculty-default-password"
import {
  TA_MODULE_UI_GROUPS,
  TA_NAV_MODULE_CONFIG,
  buildTaModuleGrantState,
  isModuleIncludedInTaRole,
  type TaModuleGrantState,
  type TaNavModuleId,
} from "@/lib/ta-nav-access"
type TaRow = {
  id: number
  username: string
  email: string
  name: string
  is_active: boolean
  created_at?: string
  last_login?: string | null
  course_codes: string[]
  assigned_course_ids: number[]
}

type InstructorCourse = {
  id: number
  course_code: string
  course_title: string
  semester?: string | null
}

type FormState = {
  username: string
  email: string
  name: string
  password: string
  is_active: boolean
  course_ids: string[]
}

const emptyForm: FormState = {
  username: "",
  email: "",
  name: "",
  password: FACULTY_DEFAULT_PASSWORD,
  is_active: true,
  course_ids: [],
}

export function InstructorTeachingAssistantsHub() {
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("teaching-assistants")
  const headers = () => buildInstructorApiHeaders()

  const [tas, setTas] = useState<TaRow[]>([])
  const [courses, setCourses] = useState<InstructorCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TaRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<TaRow | null>(null)

  const [dialogTab, setDialogTab] = useState<"profile" | "access">("profile")
  const [permCourseId, setPermCourseId] = useState<string>("")
  const [moduleGrants, setModuleGrants] = useState<Record<TaNavModuleId, TaModuleGrantState> | null>(null)
  const [moduleSaving, setModuleSaving] = useState<string | null>(null)
  const [moduleAccessLoading, setModuleAccessLoading] = useState(false)

  const loadCourses = useCallback(async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/courses", { headers: headers() })
      const data = await res.json()
      if (res.ok) {
        setCourses(
          (data.courses ?? []).map((c: InstructorCourse) => ({
            id: c.id,
            course_code: c.course_code,
            course_title: c.course_title,
            semester: c.semester,
          })),
        )
      }
    } catch {
      setCourses([])
    }
  }, [])

  const loadTas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/teaching-assistants", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setTas(data.tas ?? [])
    } catch (e) {
      toast({
        title: "Could not load teaching assistants",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadCourses()
    void loadTas()
  }, [loadCourses, loadTas])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tas
    return tas.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.username?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q),
    )
  }, [tas, search])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModuleGrants(null)
    setDialogTab("profile")
    setPermCourseId(courses[0] ? String(courses[0].id) : "")
    setDialogOpen(true)
  }

  const openEdit = (row: TaRow, initialTab: "profile" | "access" = "profile") => {
    setEditing(row)
    setDialogTab(initialTab)
    setForm({
      username: row.username,
      email: row.email,
      name: row.name,
      password: "",
      is_active: row.is_active,
      course_ids: (row.assigned_course_ids ?? []).map(String),
    })
    const firstCourse = row.assigned_course_ids?.[0] ?? courses[0]?.id
    setPermCourseId(firstCourse != null ? String(firstCourse) : "")
    setDialogOpen(true)
  }

  const loadModuleAccess = useCallback(
    async (taId: number, courseId: string) => {
      if (!courseId) {
        setModuleGrants(null)
        return
      }
      setModuleAccessLoading(true)
      try {
        const res = await fetch(
          `/api/instructor/ta-permissions?taId=${taId}&courseId=${courseId}`,
          { headers: headers() },
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load permissions")
        const codes = (data.rbacCodes as string[]) ?? []
        setModuleGrants(
          (data.moduleGrants as Record<TaNavModuleId, TaModuleGrantState>) ??
            buildTaModuleGrantState(codes),
        )
      } catch (e) {
        setModuleGrants(null)
        toast({
          title: "Could not load module access",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        })
      } finally {
        setModuleAccessLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!dialogOpen || !editing || !permCourseId || dialogTab !== "access") return
    void loadModuleAccess(editing.id, permCourseId)
  }, [dialogOpen, editing, permCourseId, dialogTab, loadModuleAccess])

  const saveTa = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.name.trim()) {
      toast({ title: "Username, email, and name are required", variant: "destructive" })
      return
    }
    if (!editing && form.course_ids.length === 0) {
      toast({ title: "Select at least one course", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        is_active: form.is_active,
        course_ids: form.course_ids.map(Number),
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      }

      const url = editing
        ? `/api/instructor/teaching-assistants/${editing.id}`
        : "/api/instructor/teaching-assistants"
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")

      toast({ title: editing ? "Teaching assistant updated" : "Teaching assistant created" })
      setDialogOpen(false)
      await loadTas()
      if (!editing && data.ta?.id) {
        setEditing(data.ta as TaRow)
        setPermCourseId(form.course_ids[0] ?? "")
      }
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setSaving(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/teaching-assistants/${toDelete.id}`, {
        method: "DELETE",
        headers: headers(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast({ title: "Teaching assistant deactivated" })
      setDeleteOpen(false)
      setToDelete(null)
      await loadTas()
    } catch (e) {
      toast({
        title: "Could not deactivate",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleModule = async (
    moduleId: TaNavModuleId,
    level: "crud" | "publish",
    enabled: boolean,
  ) => {
    if (!editing || !permCourseId || !moduleGrants) return
    const saveKey = `${moduleId}-${level}`
    setModuleSaving(saveKey)
    const cfg = TA_NAV_MODULE_CONFIG[moduleId]
    const prev = moduleGrants[moduleId]
    const nextGrant: TaModuleGrantState =
      level === "crud"
        ? { crud: enabled, publish: enabled ? prev.publish : false }
        : { crud: prev.crud, publish: enabled }
    setModuleGrants({ ...moduleGrants, [moduleId]: nextGrant })
    try {
      const res = await instructorApiFetch("/api/instructor/ta-permissions", {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          taId: editing.id,
          courseId: Number(permCourseId),
          navModule: moduleId,
          level,
          enabled,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      const codes = (data.rbacCodes as string[]) ?? []
      setModuleGrants(
        (data.moduleGrants as Record<TaNavModuleId, TaModuleGrantState>) ??
          buildTaModuleGrantState(codes),
      )
      toast({
        title: enabled
          ? level === "publish"
            ? "Publish access granted"
            : "Module access granted"
          : "Module access updated",
        description:
          level === "crud" && cfg.publishGrantCodes.length > 0
            ? "Access allows create/edit only. Enable Publish to release to students."
            : "The TA dashboard will reflect this after they refresh or re-select the course.",
      })
    } catch (e) {
      void loadModuleAccess(editing.id, permCourseId)
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setModuleSaving(null)
    }
  }

  const toggleCourse = (courseId: string) => {
    setForm((f) => {
      const has = f.course_ids.includes(courseId)
      return {
        ...f,
        course_ids: has ? f.course_ids.filter((id) => id !== courseId) : [...f.course_ids, courseId],
      }
    })
  }

  return (
    <>
    <FacultyAdministrationWorkspace
      moduleId="teaching-assistants"
      search={search}
      onSearchChange={setSearch}
      onSearchClear={() => setSearch("")}
      searchPlaceholder="Search by name, username, or email…"
      meta={facultyAdminMetaLine(
        `${tas.length} teaching assistant${tas.length === 1 ? "" : "s"}${filtered.length !== tas.length ? ` · ${filtered.length} shown` : ""}`,
      )}
      trailing={
        <Button onClick={openCreate} className={cn("h-9 shrink-0 gap-2 rounded-lg", chrome.cta)}>
          <Plus className="h-4 w-4" />
          Add teaching assistant
        </Button>
      }
    >
      {loading ? (
        <InstructorPolicyLoadingState moduleId="teaching-assistants" label="Loading teaching assistants…" fillHeight />
      ) : filtered.length === 0 ? (
        <div className={AM_EMPTY_FILL}>
          <span className={cn("mx-auto flex size-12 items-center justify-center rounded-2xl", chrome.p.softBg, chrome.p.iconText)}>
            <UserCog className="h-5 w-5" aria-hidden />
          </span>
          <p className={cn("mt-3 text-sm", PORTAL_TEXT_MUTED)}>
            No teaching assistants yet. Add one to help with homework, attendance, quizzes, and more.
          </p>
          <Button className={cn("mt-4 h-9 rounded-lg", chrome.cta)} onClick={openCreate}>
            Add teaching assistant
          </Button>
        </div>
      ) : (
        <div className={cn(PORTAL_CARD, "overflow-hidden", AM_PANEL_SCROLL)}>
          <table className="w-full text-sm">
            <thead className={cn("text-left text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                <th className="px-4 py-3">Name</th>
                <th className="hidden px-4 py-3 sm:table-cell">Username</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((ta) => (
                <tr key={ta.id} className="transition-colors hover:bg-[var(--cc-accent-soft)]/45">
                  <td className="px-4 py-3">
                    <div className={cn("font-medium", PORTAL_TEXT)}>{ta.name}</div>
                    <div className={cn("text-xs sm:hidden", PORTAL_TEXT_MUTED)}>{ta.username}</div>
                  </td>
                  <td className={cn("hidden px-4 py-3 sm:table-cell", PORTAL_TEXT_MUTED)}>
                    {ta.username}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(ta.course_codes ?? []).length === 0 ? (
                        <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>No courses</span>
                      ) : (
                        ta.course_codes.map((code) => (
                          <Badge key={code} variant="secondary" className="text-xs">
                            {code}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ta.is_active ? "default" : "secondary"}>
                      {ta.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn("h-8 gap-1.5 rounded-lg", PORTAL_OUTLINE_BTN)}
                        onClick={() => openEdit(ta, "access")}
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit access
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[var(--cc-sem-danger)] hover:bg-[var(--cc-accent-soft)]/45"
                        onClick={() => {
                          setToDelete(ta)
                          setDeleteOpen(true)
                        }}
                        aria-label={`Deactivate ${ta.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FacultyAdministrationWorkspace>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit teaching assistant" : "Add teaching assistant"}</DialogTitle>
            <DialogDescription>
              TAs inherit the standard TA role (homework grading, attendance, groups, lectures, etc.).
              Enable extra modules per course in the Access tab.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={dialogTab}
            onValueChange={(v) => setDialogTab(v as "profile" | "access")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger type="button" value="profile">
                Profile & courses
              </TabsTrigger>
              <TabsTrigger type="button" value="access" disabled={!editing}>
                Module access
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ta-name">Full name</Label>
                  <Input
                    id="ta-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ta-username">Username</Label>
                  <Input
                    id="ta-username"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    disabled={Boolean(editing)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="ta-email">Email</Label>
                  <Input
                    id="ta-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="ta-password">
                    {editing ? "New password (optional)" : "Initial password"}
                  </Label>
                  <Input
                    id="ta-password"
                    type="password"
                    value={form.password}
                    placeholder={editing ? "Leave blank to keep current" : FACULTY_DEFAULT_PASSWORD}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  {!editing && (
                    <p className="text-xs text-muted-foreground">
                      Default: {FACULTY_DEFAULT_PASSWORD} — TA must change on first login.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--cc-accent-soft)]/45">
                <Label htmlFor="ta-active">Active account</Label>
                <Switch
                  id="ta-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  className={chrome.switchChecked}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Course assignments
                </Label>
                <div className="max-h-40 space-y-0 overflow-y-auto rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                  {courses.length === 0 ? (
                    <p className={cn("px-3 py-2.5 text-sm", PORTAL_TEXT_MUTED)}>No active courses found.</p>
                  ) : (
                    courses.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[var(--cc-accent-soft)]/45"
                      >
                        <input
                          type="checkbox"
                          checked={form.course_ids.includes(String(c.id))}
                          onChange={() => toggleCourse(String(c.id))}
                          className="rounded border-slate-300"
                        />
                          <span className="text-sm">
                          <span className={cn("font-medium", PORTAL_TEXT)}>{c.course_code}</span>
                          <span className={PORTAL_TEXT_MUTED}> — {c.course_title}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="access" className="space-y-4 pt-2">
              {!editing ? (
                <p className="text-sm text-muted-foreground">
                  Save the TA first, then configure module access per course.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={permCourseId}
                      onChange={(e) => setPermCourseId(e.target.value)}
                    >
                      {form.course_ids.length === 0 ? (
                        <option value="">Assign courses in Profile tab first</option>
                      ) : (
                        form.course_ids.map((id) => {
                          const c = courses.find((x) => String(x.id) === id)
                          return (
                            <option key={id} value={id}>
                              {c ? `${c.course_code} — ${c.course_title}` : id}
                            </option>
                          )
                        })
                      )}
                    </select>
                  </div>

                  {moduleAccessLoading ? (
                    <div className="flex items-center justify-center py-10 text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : moduleGrants ? (
                    <div className="space-y-6">
                      <p className="text-xs text-muted-foreground">
                        Access lets TAs create and edit. Publish lets them release content to students.
                        Turning off Access also removes Publish.
                      </p>
                      {TA_MODULE_UI_GROUPS.map((group) => (
                        <div key={group.title}>
                          <h3 className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                            {group.title}
                          </h3>
                          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                            {group.moduleIds.map((moduleId) => {
                              const cfg = TA_NAV_MODULE_CONFIG[moduleId]
                              const isBase = isModuleIncludedInTaRole(moduleId)
                              const grant = moduleGrants[moduleId]
                              const hasPublishToggle = cfg.publishGrantCodes.length > 0
                              return (
                                <div
                                  key={moduleId}
                                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium">{cfg.label}</p>
                                    {isBase && (
                                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Included in standard TA role
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">Access</span>
                                      <Switch
                                        id={`ta-module-${moduleId}-crud`}
                                        checked={grant.crud}
                                        disabled={moduleSaving === `${moduleId}-crud`}
                                        onCheckedChange={(v) => void toggleModule(moduleId, "crud", v)}
                                        aria-label={`${cfg.label} access`}
                                      />
                                    </div>
                                    {hasPublishToggle && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Publish</span>
                                        <Switch
                                          id={`ta-module-${moduleId}-publish`}
                                          checked={grant.publish}
                                          disabled={
                                            !grant.crud || moduleSaving === `${moduleId}-publish`
                                          }
                                          onCheckedChange={(v) => void toggleModule(moduleId, "publish", v)}
                                          aria-label={`${cfg.label} publish`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select a course to configure module access.</p>
                  )}

                  <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-400">
                    <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Changes apply to this course only and update what appears in the TA faculty dashboard.
                  </p>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveTa()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Create TA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate teaching assistant?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.name} will no longer be able to sign in. Course assignments will be removed.
              Contact an administrator to restore the account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void confirmDelete()}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
