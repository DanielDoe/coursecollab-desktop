"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "@/components/student/dashboard-v2/light-motion"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { CoraLogo } from "@/components/cora/CoraLogo"
import { CoraCreditBalanceBadge } from "@/components/cora/CoraCreditBalanceBadge"
import { cn } from "@/lib/utils"
import { getStudentAuthHeaders, getStudentData, studentApiFetch } from "@/lib/auth"
import type { MembershipTier } from "@/lib/membership-constants"
import { canAccessAiTutor, AI_TUTOR_UPGRADE_MESSAGE } from "@/lib/ai-tutor-access"
import { TutorSettingsDrawer } from "@/components/ai-tutor/TutorSettingsDrawer"
import { CORA_NAME, CORA_PLATFORM_SUBTITLE, CORA_PLATFORM_TITLE } from "@/lib/cora/constants"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { CoraHomePanel } from "@/components/cora/platform/CoraHomePanel"
import { CoraPlatformNav } from "@/components/cora/platform/CoraPlatformNav"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { CoraWorkspacePanel } from "@/components/cora/platform/CoraWorkspacePanel"
import { CoraSolvePanel } from "@/components/cora/platform/CoraSolvePanel"
import { CoraLearnPanel } from "@/components/cora/platform/CoraLearnPanel"
import { CoraCodePanel } from "@/components/cora/platform/CoraCodePanel"
import { CoraInsightsPanel } from "@/components/cora/platform/CoraInsightsPanel"
import { CoraStudyPlanPanel } from "@/components/cora/platform/CoraStudyPlanPanel"
import { CoraToolsPanel } from "@/components/cora/platform/CoraToolsPanel"
import { CoraPreferencesPanel } from "@/components/cora/platform/CoraPreferencesPanel"
import { useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"
import {
  loadCoraTutorPreferences,
  saveCoraTutorPreferences,
  type CoraLearningMemory,
  type CoraTutorPreferences,
  DEFAULT_TUTOR_PREFERENCES,
  DEFAULT_LEARNING_MEMORY,
} from "@/lib/cora/preferences-storage"
import type { CoraPrivacySettings } from "@/lib/cora/privacy/cora-privacy-settings"
import type { StudentCoraCapability } from "@/lib/cora/student-capabilities"
import {
  buildStudentCoraTodayRecommendations,
  resolveCoraTodayLink,
  type CoraTodayRecommendation,
} from "@/lib/cora/today-recommendations"
import {
  findCoraConversationForCapability,
  loadCoraConversationsFromStorage,
} from "@/lib/cora/conversation-storage"
import { useStudentCoraContext } from "@/hooks/use-student-cora-context"
import { StudentCoraSetupOverlay } from "@/components/cora/platform/StudentCoraSetupOverlay"
import { isStudentCoraContextStale } from "@/lib/cora/student-cora-context-store"
import {
  STUDENT_CORA_SETUP_STEPS,
  type StudentCoraSetupStepId,
} from "@/lib/cora/student-cora-context"
import { useCoraChrome } from "@/hooks/use-cora-chrome"
import { peekSolveHandoff } from "@/lib/cora/solve-handoff"

const coraTheme = getStudentModuleTheme("ai-tutor")

export type CoraWorkspaceBootstrap = {
  capabilityId?: string
  prompt?: string
  resumeConversationId?: string
  nonce: number
}

export function CoraDashboard() {
  const router = useRouter()
  const chrome = useCoraChrome()
  const { coraImmersive, setCoraImmersive } = useDashboardV2()
  const [activeTab, setActiveTab] = useState<CoraPlatformTab>("home")
  const [isLoading, setIsLoading] = useState(true)
  const [effectiveTier, setEffectiveTier] = useState<MembershipTier | null>(null)
  const [studentId, setStudentId] = useState("")
  const [studentName, setStudentName] = useState<string>()
  const [recommendations, setRecommendations] = useState<CoraTodayRecommendation[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [initialToolId, setInitialToolId] = useState<string | null>(null)
  const [solveDomain, setSolveDomain] = useState<"circuit" | "coding" | "generic">("generic")
  const [solveHandoffNonce, setSolveHandoffNonce] = useState(0)
  const [workspaceBootstrap, setWorkspaceBootstrap] = useState<CoraWorkspaceBootstrap | null>(null)
  const [showIntroBanner, setShowIntroBanner] = useState(true)
  const [forceSetupPreview, setForceSetupPreview] = useState(false)
  const [previewSetupStep, setPreviewSetupStep] = useState<StudentCoraSetupStepId>("preparing")

  const [tutorPreferences, setTutorPreferences] = useState<CoraTutorPreferences>({
    ...DEFAULT_TUTOR_PREFERENCES,
    memory: { ...DEFAULT_LEARNING_MEMORY },
    teaching: { ...DEFAULT_TUTOR_PREFERENCES.teaching },
    explanationFormats: [...DEFAULT_TUTOR_PREFERENCES.explanationFormats],
    clearedMemoryIds: [],
  })
  const [serverPrivacy, setServerPrivacy] = useState<CoraPrivacySettings>({
    personalizedLearning: true,
    useLearningContext: true,
    shareWithInstructor: false,
  })
  const learningMemory = tutorPreferences.memory

  const syncServerPrivacy = useCallback(
    (next: CoraPrivacySettings) => {
      void fetch("/api/cora/privacy", {
        method: "PUT",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => undefined)
    },
    [],
  )

  const updateServerPrivacy = useCallback(
    (patch: Partial<CoraPrivacySettings>) => {
      setServerPrivacy((prev) => {
        const next = { ...prev, ...patch }
        if (patch.shareWithInstructor != null) {
          setTutorPreferences((tp) => {
            const synced = { ...tp, shareWithInstructor: next.shareWithInstructor }
            saveCoraTutorPreferences(studentId, synced)
            return synced
          })
        }
        syncServerPrivacy(next)
        return next
      })
    },
    [studentId, syncServerPrivacy],
  )

  const updateLearningMemory = useCallback(
    (id: keyof CoraLearningMemory, value: boolean) => {
      setTutorPreferences((prev) => {
        const next = { ...prev, memory: { ...prev.memory, [id]: value } }
        saveCoraTutorPreferences(studentId, next)
        return next
      })
    },
    [studentId],
  )

  const updateTutorPreferences = useCallback(
    (next: CoraTutorPreferences) => {
      setTutorPreferences(next)
      saveCoraTutorPreferences(studentId, next)
      if (next.shareWithInstructor !== serverPrivacy.shareWithInstructor) {
        updateServerPrivacy({ shareWithInstructor: next.shareWithInstructor === true })
      }
    },
    [studentId, serverPrivacy.shareWithInstructor, updateServerPrivacy],
  )

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      setForceSetupPreview(params.get("previewSetup") === "1")
      const tab = params.get("tab")
      const validTabs = new Set<string>([
        "home",
        "workspace",
        "solve",
        "learn",
        "code",
        "insights",
        "study-plan",
        "tools",
        "preferences",
      ])
      if (peekSolveHandoff()) {
        setActiveTab("solve")
        setSolveHandoffNonce(Date.now())
      } else if (tab && validTabs.has(tab)) {
        setActiveTab(tab as CoraPlatformTab)
      }
    } catch {
      setForceSetupPreview(false)
    }
  }, [])

  const {
    status: coraContextStatus,
    setupStep,
    context: studentCoraContext,
    error: coraSetupError,
    capabilities,
    retrySetup,
    refreshContextIfStale,
  } = useStudentCoraContext({
    studentId: studentId || null,
    studentName,
    enabled: Boolean(studentId && effectiveTier && canAccessAiTutor(effectiveTier)),
  })

  const showCoraSetupOverlay =
    forceSetupPreview ||
    (Boolean(studentId && effectiveTier && canAccessAiTutor(effectiveTier)) &&
      (coraContextStatus === "loading" || coraContextStatus === "running" || coraContextStatus === "error"))

  useEffect(() => {
    if (!forceSetupPreview) return
    let index = 0
    setPreviewSetupStep(STUDENT_CORA_SETUP_STEPS[0]!.id)
    const timer = window.setInterval(() => {
      index = (index + 1) % STUDENT_CORA_SETUP_STEPS.length
      setPreviewSetupStep(STUDENT_CORA_SETUP_STEPS[index]!.id)
    }, 1100)
    return () => window.clearInterval(timer)
  }, [forceSetupPreview])

  const navigate = useCallback((tab: CoraPlatformTab, toolId?: string) => {
    if (tab === "solve" && toolId === "circuit") setSolveDomain("circuit")
    else if (tab === "solve") setSolveDomain("generic")
    if (toolId && tab === "tools") setInitialToolId(toolId)
    setActiveTab(tab)
  }, [])

  const startCapability = useCallback(
    (capability: StudentCoraCapability, prompt?: string) => {
      if (!prompt && (capability.tab === "tools" || capability.tab === "study-plan" || capability.tab === "learn" || capability.tab === "code" || capability.tab === "insights")) {
        navigate(capability.tab, capability.toolId)
        return
      }
      setWorkspaceBootstrap({
        capabilityId: capability.id,
        prompt,
        nonce: Date.now(),
      })
      setActiveTab("workspace")
    },
    [navigate],
  )

  const resumeCapability = useCallback((capability: StudentCoraCapability) => {
    const conversations = loadCoraConversationsFromStorage(studentId)
    const match = findCoraConversationForCapability(conversations, capability.id)
    if (!match) {
      startCapability(capability)
      return
    }
    setWorkspaceBootstrap({
      capabilityId: capability.id,
      resumeConversationId: match.id,
      nonce: Date.now(),
    })
    setActiveTab("workspace")
  }, [studentId, startCapability])

  const canResumeCapability = useCallback(
    (capabilityId: string) => {
      if (!studentId) return false
      return Boolean(findCoraConversationForCapability(loadCoraConversationsFromStorage(studentId), capabilityId))
    },
    [studentId],
  )

  useEffect(() => {
    if (activeTab !== "workspace" && coraImmersive) {
      setCoraImmersive(false)
    }
  }, [activeTab, coraImmersive, setCoraImmersive])

  useEffect(() => {
    if (!showIntroBanner) return
    const timer = window.setTimeout(() => setShowIntroBanner(false), 4200)
    return () => window.clearTimeout(timer)
  }, [showIntroBanner])

  useEffect(() => {
    if (!coraImmersive) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCoraImmersive(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [coraImmersive, setCoraImmersive])

  useEffect(() => {
    const student = getStudentData()
    if (!student) {
      router.push("/student/login")
      return
    }
    setStudentName(student.name ?? (student as { fullName?: string }).fullName)
    const currentDbId =
      sessionStorage.getItem("studentDatabaseId") ||
      (student as { databaseId?: string | number }).databaseId?.toString() ||
      ""
    if (currentDbId) {
      setStudentId(currentDbId)
      const local = loadCoraTutorPreferences(currentDbId)
      setTutorPreferences(local)
      void fetch("/api/cora/privacy", { headers: getStudentAuthHeaders() })
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as Partial<CoraPrivacySettings>
          setServerPrivacy({
            personalizedLearning: data.personalizedLearning !== false,
            useLearningContext: data.useLearningContext !== false,
            shareWithInstructor: data.shareWithInstructor === true,
          })
          setTutorPreferences((prev) => {
            const next = { ...prev, shareWithInstructor: data.shareWithInstructor === true }
            saveCoraTutorPreferences(currentDbId, next)
            return next
          })
        })
        .catch(() => undefined)
    }
    void refreshMembership(currentDbId)
  }, [router])

  useEffect(() => {
    if (!studentCoraContext?.payload) return
    void (async () => {
      let apiRecommendations: CoraTodayRecommendation[] = []
      try {
        const response = await fetch(
          `/api/ai-tutor/recommendations?studentId=${studentCoraContext.studentId}`,
        )
        const data = await response.json()
        if (response.ok) apiRecommendations = data.recommendations || []
      } catch {
        // ignore
      }
      setRecommendations(
        buildStudentCoraTodayRecommendations({
          payload: studentCoraContext.payload,
          apiRecommendations,
        }),
      )
    })()
  }, [studentCoraContext])

  useEffect(() => {
    if (activeTab !== "home" || !studentCoraContext) return
    if (isStudentCoraContextStale(studentCoraContext)) {
      void refreshContextIfStale(true)
    }
  }, [activeTab, studentCoraContext, refreshContextIfStale])

  const refreshMembership = async (studentDbId: string) => {
    try {
      if (!studentDbId) {
        setEffectiveTier("Scholar")
        return
      }
      const response = await studentApiFetch(`/api/student/membership?studentId=${studentDbId}`)
      if (response.ok) {
        const data = await response.json()
        const t = (data.membership?.tier || "Scholar") as MembershipTier
        setEffectiveTier(t)
        sessionStorage.setItem("studentMembershipTier", t)
      } else {
        setEffectiveTier("Scholar")
      }
    } catch {
      setEffectiveTier("Scholar")
    } finally {
      setIsLoading(false)
    }
  }

  if (forceSetupPreview) {
    return (
      <StudentCoraSetupOverlay
        visible
        activeStep={previewSetupStep}
        courseLabel={
          studentCoraContext?.courseCode ||
          studentCoraContext?.courseTitle ||
          "ECE 2202"
        }
        focusLabel={studentCoraContext?.focusLabel ?? "Nodal analysis"}
        error={null}
      />
    )
  }

  if (isLoading) {
    return (
      <CardWrapper variant="inner" delay={0} hover={false}>
        <div className="flex flex-col items-center justify-center p-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className={cn("h-12 w-12 rounded-full border-2 border-t-transparent", coraTheme.page.spinner)}
          />
          <p className="mt-4 text-[var(--cc-text-muted)]">Loading {CORA_NAME}…</p>
        </div>
      </CardWrapper>
    )
  }

  if (effectiveTier && !canAccessAiTutor(effectiveTier)) {
    return (
      <CardWrapper variant="inner" delay={0} hover={false} className="border-amber-200/80 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="space-y-3 p-6">
          <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">Membership required</h2>
          <p className="text-sm text-amber-900/90 dark:text-amber-200/90">{AI_TUTOR_UPGRADE_MESSAGE}</p>
          <Button asChild className="rounded-full">
            <Link href="/student/dashboard-v2/membership">View membership options</Link>
          </Button>
        </div>
      </CardWrapper>
    )
  }

  const studentDbNum = studentId ? Number(studentId) : null
  const isWorkspace = activeTab === "workspace"
  const preparedStudentContext = studentCoraContext?.payload ?? null

  if (showCoraSetupOverlay) {
    return (
      <StudentCoraSetupOverlay
        visible
        activeStep={forceSetupPreview ? previewSetupStep : setupStep}
        courseLabel={
          studentCoraContext?.courseCode ||
          studentCoraContext?.courseTitle ||
          "ECE 2202"
        }
        focusLabel={studentCoraContext?.focusLabel ?? (forceSetupPreview ? "Nodal analysis" : undefined)}
        error={forceSetupPreview ? null : coraContextStatus === "error" ? coraSetupError : null}
        onRetry={forceSetupPreview ? undefined : retrySetup}
      />
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <AnimatePresence>
        {showIntroBanner ? (
          <motion.div
            key="cora-intro"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 dark:border-white/[0.06]"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${chrome.soft} 55%, var(--card)), color-mix(in srgb, ${chrome.mid} 28%, var(--card)))`,
              }}
            >
              <CoraLogo size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--cc-text)]">{CORA_PLATFORM_TITLE}</p>
                <p className="truncate text-xs text-[var(--cc-text-muted)]">{CORA_PLATFORM_SUBTITLE}</p>
                <p className="mt-1 text-[10px] text-[var(--cc-text-muted)]">
                  Cora responses are AI generated and can contain errors.
                </p>
              </div>
              <CoraCreditBalanceBadge userId={studentId || null} role="student" />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="min-w-0">
        <FacultyModuleSplitLayout
          splitMode="container"
          containerName="cora-hub"
          className="lg:min-h-[min(640px,72vh)]"
          menuWidthClass="@[720px]/cora-hub:w-44 @[880px]/cora-hub:w-52"
          menu={
            <CoraPlatformNav activeTab={activeTab} onNavigate={setActiveTab} chrome={chrome} />
          }
        >
          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={false}
                className="min-w-0 w-full"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <CoraHomePanel
                  studentName={studentName}
                  courseLabel={
                    studentCoraContext?.courseCode ??
                    studentCoraContext?.courseTitle ??
                    preparedStudentContext?.account?.courseCode ??
                    null
                  }
                  recommendations={recommendations}
                  capabilities={capabilities}
                  chrome={chrome}
                  onNavigate={navigate}
                  onStartCapability={startCapability}
                  onResumeCapability={resumeCapability}
                  canResumeCapability={canResumeCapability}
                  onRecommendationNavigate={(rec) => {
                    const resolved = resolveCoraTodayLink(rec.link)
                    if (resolved.kind === "tab") navigate(resolved.tab, resolved.toolId)
                    else router.push(resolved.href)
                  }}
                />
              </motion.div>
            )}
            {activeTab === "workspace" && (
              <motion.div key="workspace" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraWorkspacePanel
                  studentId={studentId}
                  studentFirstName={studentName?.split(" ")[0]}
                  learningMemory={learningMemory}
                  tutorPreferences={tutorPreferences}
                  membershipTier={effectiveTier}
                  bootstrap={workspaceBootstrap}
                  preparedStudentContext={preparedStudentContext}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  fillHeight={coraImmersive}
                  immersive={coraImmersive}
                  onToggleImmersive={() => setCoraImmersive(!coraImmersive)}
                  onCoraNavigate={navigate}
                  onAppNavigate={(href) => router.push(href)}
                />
              </motion.div>
            )}
            {activeTab === "solve" && (
              <motion.div key="solve" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraSolvePanel
                  key={solveDomain}
                  studentDatabaseId={studentDbNum}
                  studentId={studentId}
                  initialDomain={solveDomain}
                  handoffNonce={solveHandoffNonce}
                  courseLabel={
                    studentCoraContext?.courseTitle ??
                    studentCoraContext?.courseCode ??
                    preparedStudentContext?.account?.courseCode ??
                    null
                  }
                />
              </motion.div>
            )}
            {activeTab === "learn" && (
              <motion.div key="learn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraLearnPanel
                  studentDatabaseId={studentDbNum}
                  studentContext={preparedStudentContext}
                  onOpenWorkspace={() => navigate("workspace")}
                />
              </motion.div>
            )}
            {activeTab === "code" && (
              <motion.div key="code" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraCodePanel
                  effectiveTier={effectiveTier}
                  studentDatabaseId={studentDbNum}
                  studentContext={preparedStudentContext}
                />
              </motion.div>
            )}
            {activeTab === "insights" && (
              <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraInsightsPanel
                  studentId={studentId}
                  studentDatabaseId={studentDbNum}
                  studentContext={preparedStudentContext}
                  onNavigate={navigate}
                />
              </motion.div>
            )}
            {activeTab === "study-plan" && (
              <motion.div key="study-plan" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraStudyPlanPanel
                  studentFirstName={studentName?.split(" ")[0] || "there"}
                  studentDatabaseId={studentDbNum}
                  studentContext={preparedStudentContext}
                  onNavigate={navigate}
                />
              </motion.div>
            )}
            {activeTab === "tools" && (
              <motion.div key="tools" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraToolsPanel
                  studentId={studentId}
                  studentDatabaseId={studentDbNum}
                  studentFirstName={studentName?.split(" ")[0] || "there"}
                  studentContext={preparedStudentContext}
                  initialToolId={initialToolId}
                  onNavigate={navigate}
                />
              </motion.div>
            )}
            {activeTab === "preferences" && (
              <motion.div key="preferences" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <CoraPreferencesPanel
                  studentId={studentId}
                  preferences={tutorPreferences}
                  onPreferencesChange={updateTutorPreferences}
                  serverPrivacy={serverPrivacy}
                  onServerPrivacyChange={updateServerPrivacy}
                  studentContext={preparedStudentContext}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </FacultyModuleSplitLayout>
      </div>

      {(activeTab === "workspace" || isSettingsOpen) && (
        <TutorSettingsDrawer
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          learningMemory={learningMemory}
          onLearningMemoryChange={(id, value) =>
            updateLearningMemory(id as keyof CoraLearningMemory, value)
          }
          onGenerateStudyPlan={() => {
            setActiveTab("study-plan")
            window.dispatchEvent(new CustomEvent("generate-study-plan", { detail: { learningMemory } }))
          }}
        />
      )}
    </div>
  )
}

/** @deprecated use CoraDashboard — kept for route import compatibility */
export const AITutorDashboardV2 = CoraDashboard
