"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import {
  FileCheck,
  MessageCircle,
  Pencil,
  Trophy,
  MessageSquare,
  FolderKanban,
  Info,
  Users,
  BookOpen,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalThemeStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { FacultySummerCampShell } from "@/components/instructor/FacultySummerCampShell"
import { FacultyCampDiscussions } from "@/components/summer-camp/FacultyCampDiscussions"
import {
  FacultyTrainingProjectsPanel,
  type FacultyCampProject,
} from "@/components/summer-camp/FacultyTrainingProjectsPanel"
import { FacultyCampModuleSchedulePanel } from "@/components/summer-camp/FacultyCampModuleSchedulePanel"
import { CampStatusBadge } from "@/components/summer-camp/CampPublishControls"

type Tab = "overview" | "modules" | "projects" | "submissions" | "discussions" | "awards" | "feedback"

type TrainingDetail = {
  id: number
  title: string
  slug: string
  description: string | null
  status: string
  published_at: string | null
  camp_title: string
  camp_status: string
  camp_start_date: string | null
  camp_end_date: string | null
  enrollment_count: number
  project_count: number
  capstone_count: number
  module_count: number
  curriculum_module_count: number
  submission_count: number
  pending_submission_count: number
  open_discussion_count: number
  faculty_count: number
  module_completions: number
}

type TrainingCatalogOverview = {
  title: string
  summary: string
  overview: string
  duration: string
  difficulty: string
  audience: string
  format: string
  outcomes: string[]
  tags: string[]
  comingSoon: boolean
}

type TrainingFacultyMember = {
  instructor_id: number
  training_role: string
  name: string
  email: string
  instructor_role: string
  job_title?: string | null
  institution?: string | null
  phone?: string | null
  office?: string | null
}

const FACULTY_AWARD_TYPES = [
  { id: "best_technical_demo", label: "Best Technical Demo Award" },
  { id: "best_engineering_reflection", label: "Best Engineering Reflection Award" },
  { id: "most_creative_edge_ai", label: "Most Creative Edge AI Application Award" },
] as const

function trainingFacultyRoleLabel(role: string) {
  if (role === "lead") return "Lead instructor"
  if (role === "dean") return "Dean"
  if (role === "assistant") return "Co-instructor"
  return role.replace(/_/g, " ")
}

export default function InstructorSummerCampTrainingPage() {
  const chrome = facultyEmbedChrome("summer-camp")
  const { p: fp, card, solid, quiet, warning } = chrome
  const params = useParams()
  const searchParams = useSearchParams()
  const trainingId = params.trainingId as string
  const initialTab = searchParams.get("tab")
  const [training, setTraining] = useState<TrainingDetail | null>(null)
  const [catalog, setCatalog] = useState<TrainingCatalogOverview | null>(null)
  const [faculty, setFaculty] = useState<TrainingFacultyMember[]>([])
  const [modules, setModules] = useState<Array<Record<string, unknown>>>([])
  const [projects, setProjects] = useState<FacultyCampProject[]>([])
  const [submissions, setSubmissions] = useState<Array<Record<string, unknown>>>([])
  const [openDiscussionCount, setOpenDiscussionCount] = useState(0)
  const [awards, setAwards] = useState<Array<Record<string, unknown>>>([])
  const [tab, setTab] = useState<Tab>(
    initialTab === "modules" ||
      initialTab === "projects" ||
      initialTab === "submissions" ||
      initialTab === "discussions" ||
      initialTab === "awards" ||
      initialTab === "feedback"
      ? initialTab
      : "overview",
  )
  const [loading, setLoading] = useState(true)

  const [awardStudentId, setAwardStudentId] = useState("")
  const [awardType, setAwardType] = useState<string>(FACULTY_AWARD_TYPES[0].id)
  const [feedbackStudentId, setFeedbackStudentId] = useState("")
  const [feedbackTitle, setFeedbackTitle] = useState("")
  const [feedbackStrengths, setFeedbackStrengths] = useState("")
  const [feedbackImprovements, setFeedbackImprovements] = useState("")
  const [feedbackMessage, setFeedbackMessage] = useState("")

  const headers = { ...buildInstructorApiHeaders(), "Content-Type": "application/json" }

  const enrolledStudents = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of submissions) {
      const id = Number(s.student_id)
      if (Number.isFinite(id)) map.set(id, String(s.student_name))
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [submissions])

  const load = useCallback(async () => {
    const apiHeaders = buildInstructorApiHeaders()
    const [detailRes, modRes, projRes, subRes, discRes, awardRes] = await Promise.all([
      instructorApiFetch(`/api/instructor/summer-camp/trainings/${trainingId}`, { headers: apiHeaders }),
      instructorApiFetch(`/api/instructor/summer-camp/modules?trainingId=${trainingId}&scope=curriculum`, { headers: apiHeaders }),
      instructorApiFetch(`/api/instructor/summer-camp/projects?trainingId=${trainingId}`, { headers: apiHeaders }),
      instructorApiFetch(`/api/instructor/summer-camp/submissions?trainingId=${trainingId}`, { headers: apiHeaders }),
      instructorApiFetch(`/api/instructor/summer-camp/discussions?trainingId=${trainingId}`, { headers: apiHeaders }),
      instructorApiFetch(`/api/instructor/summer-camp/awards?trainingId=${trainingId}`, { headers: apiHeaders }),
    ])
    if (detailRes.ok) {
      const detailData = await detailRes.json()
      setTraining((detailData.training ?? null) as TrainingDetail | null)
      setCatalog((detailData.catalog ?? null) as TrainingCatalogOverview | null)
      setFaculty((detailData.faculty ?? []) as TrainingFacultyMember[])
    }
    if (modRes.ok) setModules((await modRes.json()).modules ?? [])
    if (projRes.ok) setProjects((await projRes.json()).projects ?? [])
    if (subRes.ok) setSubmissions((await subRes.json()).submissions ?? [])
    if (discRes.ok) {
      const discData = await discRes.json()
      const threads = (discData.discussions ?? []) as Array<{ status: string }>
      setOpenDiscussionCount(threads.filter((d) => d.status === "open").length)
    }
    if (awardRes.ok) setAwards((await awardRes.json()).awards ?? [])
  }, [trainingId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const reviewSubmission = async (id: number, status: string, feedback: string) => {
    await instructorApiFetch("/api/instructor/summer-camp/submissions", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ submission_id: id, status, feedback }),
    })
    await load()
  }

  const assignAward = async () => {
    if (!awardStudentId) return
    await instructorApiFetch("/api/instructor/summer-camp/awards", {
      method: "POST",
      headers,
      body: JSON.stringify({
        training_id: Number(trainingId),
        student_id: Number(awardStudentId),
        award_type: awardType,
      }),
    })
    await load()
  }

  const sendFeedbackCard = async (submissionId?: number) => {
    if (!feedbackStudentId || !feedbackTitle.trim() || !feedbackMessage.trim()) return
    await instructorApiFetch("/api/instructor/summer-camp/feedback-cards", {
      method: "POST",
      headers,
      body: JSON.stringify({
        training_id: Number(trainingId),
        student_id: Number(feedbackStudentId),
        submission_id: submissionId,
        title: feedbackTitle,
        strengths: feedbackStrengths || undefined,
        improvements: feedbackImprovements || undefined,
        message: feedbackMessage,
        card_type: "showcase",
      }),
    })
    setFeedbackTitle("")
    setFeedbackStrengths("")
    setFeedbackImprovements("")
    setFeedbackMessage("")
  }

  if (loading) {
    return (
      <FacultySummerCampShell>
        <div className="space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </FacultySummerCampShell>
    )
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "Overview", icon: <Info className="h-3.5 w-3.5 mr-1" /> },
    { id: "modules", label: "Modules", icon: <Pencil className="h-3.5 w-3.5 mr-1" /> },
    {
      id: "projects",
      label: projects.length > 0 ? `Projects (${projects.length})` : "Projects",
      icon: <FolderKanban className="h-3.5 w-3.5 mr-1" />,
    },
    { id: "submissions", label: "Submissions", icon: <FileCheck className="h-3.5 w-3.5 mr-1" /> },
    {
      id: "discussions",
      label: openDiscussionCount > 0 ? `Discussions (${openDiscussionCount})` : "Discussions",
      icon: <MessageCircle className="h-3.5 w-3.5 mr-1" />,
    },
    { id: "awards", label: "Awards", icon: <Trophy className="h-3.5 w-3.5 mr-1" /> },
    { id: "feedback", label: "Feedback Cards", icon: <MessageSquare className="h-3.5 w-3.5 mr-1" /> },
  ]

  return (
    <FacultySummerCampShell>
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            className={cn("h-9 shrink-0 rounded-lg", tab === t.id ? solid : quiet)}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {training == null ? (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Training details unavailable.</p>
          ) : (
            <>
              <section className={cn(card, "space-y-4 p-4 sm:p-5")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className={cn("text-xl font-semibold", PORTAL_TEXT)}>
                      {catalog?.title ?? training.title}
                    </h1>
                    <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                      {training.camp_title}
                      {training.camp_start_date && training.camp_end_date && (
                        <>
                          {" · "}
                          <CalendarDays className="inline h-3.5 w-3.5 -mt-0.5 mr-0.5" />
                          {new Date(training.camp_start_date).toLocaleDateString()} –{" "}
                          {new Date(training.camp_end_date).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {catalog?.comingSoon ? <Badge variant="secondary">Coming soon</Badge> : null}
                    <CampStatusBadge status={training.status} className="shrink-0" />
                  </div>
                </div>

                {(catalog?.summary || training.description) && (
                  <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>
                    {catalog?.summary || training.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {catalog?.duration && (
                    <Badge className="border-0 bg-[var(--cc-accent)] !text-white">{catalog.duration}</Badge>
                  )}
                  {catalog?.difficulty && (
                    <Badge className="border-0 bg-[var(--cc-accent)] !text-white">{catalog.difficulty}</Badge>
                  )}
                  {catalog?.tags?.map((tag) => (
                    <Badge key={tag} className="border-0 bg-[var(--cc-accent)] !text-white">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {catalog?.audience && (
                    <div className={cn("rounded-xl border p-3", portalThemeStripe(0).row, portalThemeStripe(0).border)}>
                      <p className={cn("mb-1 text-xs font-medium", "text-[var(--cc-text-secondary)]")}>Audience</p>
                      <p className={PORTAL_TEXT}>{catalog.audience}</p>
                    </div>
                  )}
                  {catalog?.format && (
                    <div className={cn("rounded-xl border p-3", portalThemeStripe(1).row, portalThemeStripe(1).border)}>
                      <p className={cn("mb-1 text-xs font-medium", "text-[var(--cc-text-secondary)]")}>Format</p>
                      <p className={PORTAL_TEXT}>{catalog.format}</p>
                    </div>
                  )}
                </div>
              </section>

              <section className={cn(card, "space-y-3 p-4 sm:p-5")}>
                <h2 className={cn("font-semibold", PORTAL_TEXT)}>About this training</h2>
                <p className={cn("whitespace-pre-line text-sm leading-relaxed", PORTAL_TEXT)}>
                  {catalog?.overview ||
                    training.description ||
                    "No detailed description has been configured for this training yet."}
                </p>
              </section>

              {catalog?.outcomes && catalog.outcomes.length > 0 && (
                <section className={cn(card, "p-4 sm:p-5")}>
                  <h2 className={cn("mb-3 font-semibold", PORTAL_TEXT)}>Learning outcomes</h2>
                  <ul className="space-y-2">
                    {catalog.outcomes.map((outcome, i) => {
                      const stripe = portalThemeStripe(i)
                      return (
                      <li
                        key={outcome}
                        className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-sm", stripe.row, stripe.border, PORTAL_TEXT)}
                      >
                        <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", stripe.iconBg)} />
                        {outcome}
                      </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              <section className="space-y-3">
                <h2 className={cn("font-semibold", PORTAL_TEXT)}>Training stats</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {[
                    {
                      label: "Curriculum modules",
                      value: training.curriculum_module_count ?? training.module_count,
                      Icon: BookOpen,
                    },
                    {
                      label: "Published modules",
                      value: training.module_count,
                      Icon: BookOpen,
                    },
                    {
                      label: "Projects",
                      value: training.project_count,
                      Icon: FolderKanban,
                    },
                    {
                      label: "Capstones",
                      value: training.capstone_count ?? 0,
                      Icon: Trophy,
                    },
                    {
                      label: "Active campers",
                      value: training.enrollment_count,
                      Icon: Users,
                    },
                    {
                      label: "Module completions",
                      value: training.module_completions ?? 0,
                      Icon: FileCheck,
                    },
                    {
                      label: "Submissions",
                      value: training.submission_count ?? 0,
                      Icon: FileCheck,
                    },
                    {
                      label: "Pending review",
                      value: training.pending_submission_count ?? 0,
                      Icon: FileCheck,
                    },
                    {
                      label: "Open discussions",
                      value: training.open_discussion_count ?? openDiscussionCount,
                      Icon: MessageCircle,
                    },
                    {
                      label: "Faculty",
                      value: training.faculty_count ?? faculty.length,
                      Icon: Users,
                    },
                  ].map((stat, i) => {
                    const stripe = portalThemeStripe(i)
                    const Icon = stat.Icon
                    return (
                    <div
                      key={stat.label}
                      className={cn("rounded-2xl border p-3 sm:p-4", stripe.row, stripe.border)}
                    >
                      <div className={cn("flex items-center gap-2 text-xs", PORTAL_TEXT_MUTED)}>
                        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", stripe.iconBg)}>
                          <Icon className={cn("h-3.5 w-3.5", stripe.iconText)} />
                        </span>
                        {stat.label}
                      </div>
                      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", PORTAL_TEXT)}>{stat.value}</p>
                    </div>
                    )
                  })}
                </div>
              </section>

              <section className={cn(card, "p-4 sm:p-5")}>
                <h2 className={cn("mb-4 flex items-center gap-2 font-semibold", PORTAL_TEXT)}>
                  <Users className={cn("h-4 w-4", fp.iconText)} />
                  Training faculty
                </h2>
                {faculty.length === 0 ? (
                  <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                    No faculty assigned to this training yet. Admins can assign faculty from the
                    camp management page.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {faculty.map((member, i) => {
                      const stripe = portalThemeStripe(i)
                      return (
                      <li
                        key={member.instructor_id}
                        className={cn("flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-3", stripe.row, stripe.border)}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className={cn("font-medium", PORTAL_TEXT)}>{member.name}</p>
                          {member.job_title && (
                            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{member.job_title}</p>
                          )}
                          {member.institution && (
                            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{member.institution}</p>
                          )}
                          {member.office && (
                            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{member.office}</p>
                          )}
                          {member.phone && (
                            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{member.phone}</p>
                          )}
                          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{member.email}</p>
                        </div>
                        <Badge
                          variant={
                            member.training_role === "lead" || member.training_role === "dean"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {trainingFacultyRoleLabel(member.training_role)}
                        </Badge>
                      </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {tab === "modules" && (
        <FacultyCampModuleSchedulePanel trainingId={Number(trainingId)} />
      )}

      {tab === "projects" && (
        <FacultyTrainingProjectsPanel projects={projects} onRefresh={load} />
      )}

      {tab === "submissions" && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className={cn(card, "p-8 text-center")}>
              <FileCheck className={cn("mx-auto mb-2 h-8 w-8", fp.iconText)} />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No submissions yet.</p>
            </div>
          ) : (
            submissions.map((s, i) => {
              const stripe = portalThemeStripe(i)
              return (
              <div key={String(s.id)} className={cn("rounded-2xl border p-4", stripe.row, stripe.border)}>
                <p className={cn("font-medium", PORTAL_TEXT)}>{String(s.student_name)}</p>
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{String(s.module_title)}</p>
                {s.file_name != null && <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>{String(s.file_name)}</p>}
                <Badge className="mt-2">{String(s.status)}</Badge>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className={cn("h-8 rounded-lg", solid)} onClick={() => void reviewSubmission(Number(s.id), "approved", "Great work!")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    className={cn("h-8 rounded-lg", warning)}
                    onClick={() => void reviewSubmission(Number(s.id), "revision_needed", "Please revise and resubmit.")}
                  >
                    Request revision
                  </Button>
                  <Button
                    size="sm"
                    className={cn("h-8 rounded-lg", solid)}
                    onClick={() => {
                      setFeedbackStudentId(String(s.student_id))
                      setFeedbackTitle(`Feedback: ${String(s.module_title)}`)
                      setTab("feedback")
                    }}
                  >
                    Send feedback card
                  </Button>
                </div>
              </div>
              )
            })
          )}
        </div>
      )}

      {tab === "discussions" && (
        <FacultyCampDiscussions trainingId={Number(trainingId)} />
      )}

      {tab === "awards" && (
        <div className="space-y-4">
          <section className={cn(card, "p-4 sm:p-5")}>
            <h2 className={cn("mb-3 font-semibold", PORTAL_TEXT)}>Current awards</h2>
            {awards.length === 0 ? (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No awards assigned yet. People&apos;s Choice is auto-assigned from gallery votes.</p>
            ) : (
              <ul className="space-y-2">
                {awards.map((a, i) => {
                  const stripe = portalThemeStripe(i)
                  return (
                  <li key={String(a.id)} className={cn("flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm", stripe.row, stripe.border)}>
                    <span className={PORTAL_TEXT}>{String(a.award_label ?? a.award_type)}</span>
                    <Badge>{String(a.student_name)}</Badge>
                  </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className={cn(card, "space-y-3 p-4 sm:p-5")}>
            <h2 className={cn("font-semibold", PORTAL_TEXT)}>Assign faculty award</h2>
            <Select value={awardStudentId || undefined} onValueChange={setAwardStudentId}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue placeholder="Select student…" />
              </SelectTrigger>
              <SelectContent>
                {enrolledStudents.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={awardType} onValueChange={setAwardType}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FACULTY_AWARD_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className={cn("h-9 rounded-lg", solid)} onClick={() => void assignAward()} disabled={!awardStudentId}>
              Assign award
            </Button>
          </section>
        </div>
      )}

      {tab === "feedback" && (
        <section className={cn(card, "max-w-xl space-y-3 p-4 sm:p-5")}>
          <h2 className={cn("font-semibold", PORTAL_TEXT)}>Create faculty feedback card</h2>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Structured feedback students see on their Camp Graduation dashboard.
          </p>
          <Select value={feedbackStudentId || undefined} onValueChange={setFeedbackStudentId}>
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder="Select student…" />
            </SelectTrigger>
            <SelectContent>
              {enrolledStudents.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Card title"
            value={feedbackTitle}
            onChange={(e) => setFeedbackTitle(e.target.value)}
          />
          <Input
            placeholder="Strengths (optional)"
            value={feedbackStrengths}
            onChange={(e) => setFeedbackStrengths(e.target.value)}
          />
          <Input
            placeholder="Areas for growth (optional)"
            value={feedbackImprovements}
            onChange={(e) => setFeedbackImprovements(e.target.value)}
          />
          <Textarea
            className="min-h-[100px]"
            placeholder="Your message to the student"
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
          />
          <Button
            size="sm"
            className={cn("h-9 rounded-lg", solid)}
            onClick={() => void sendFeedbackCard()}
            disabled={!feedbackStudentId || !feedbackTitle.trim() || !feedbackMessage.trim()}
          >
            Send feedback card
          </Button>
        </section>
      )}
    </FacultySummerCampShell>
  )
}
