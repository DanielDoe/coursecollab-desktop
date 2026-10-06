"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, User, Zap, ArrowLeft, Gamepad2, Trophy, Clock, Star, Target, Award, Coins, Loader2, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink";
import { StudentHeader } from "@/components/student-header";
import { getStudentData, logoutStudent, studentApiFetch } from "@/lib/auth";
import { PlaygroundAccessModal } from "@/components/playground-access-modal";
import { cn } from "@/lib/utils";
import {
  portalCard,
  portalLabel,
  portalMain,
  portalShellRoot,
  portalSubtitle,
  portalTitle,
} from "@/lib/appearance/portal-shell-theme";
import { resolvePlaygroundJoinError } from "@/lib/playground-join-client"
import { PLAYGROUND_WEEKLY_CREDITS } from "@/lib/membership-constants";
import {
  getPlaygroundSessionLock,
  playgroundLockStillActive,
  resumePlaygroundWebSession,
  upsertPlaygroundSessionLock,
} from "@/lib/playground-session-lock";

const RULES: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: Clock, value: "10s", label: "Per question" },
  { icon: Target, value: "+100", label: "Correct" },
  { icon: Zap, value: "+10", label: "Speed bonus" },
  { icon: Trophy, value: "∞", label: "Unlimited" },
];

function AccentIcon({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl",
        active
          ? "bg-[var(--cc-accent)] text-white"
          : "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
            {label}
          </p>
          <p className="mt-1.5 truncate text-[1.65rem] font-semibold tabular-nums leading-none tracking-tight text-[var(--cc-text)]">
            {value}
          </p>
        </div>
        <AccentIcon icon={icon} />
      </div>
      <div className="mt-3.5 h-px w-full bg-[var(--border)]" />
      <p className="mt-2.5 truncate text-[11px] text-[var(--cc-text-muted)]">{hint}</p>
    </div>
  );
}

export default function PlaygroundLobby() {
  const router = useRouter();
  const { toast } = useToast();
  const homeLink = useSmartHomeLink();
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [nickname, setNickname] = useState("");
  const [classPasscode, setClassPasscode] = useState("");
  const [mode, setMode] = useState<"CLASSROOM" | "PERSONAL">("CLASSROOM");
  const [isJoining, setIsJoining] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);
  const [accumulatedPoints, setAccumulatedPoints] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [playgroundCredits, setPlaygroundCredits] = useState<number | null>(null);
  const [creditsLimit, setCreditsLimit] = useState<number | "unlimited" | null>(null);
  const [isUnlimited, setIsUnlimited] = useState<boolean>(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessModalData, setAccessModalData] = useState<{
    errorType?: "insufficient_credits" | "no_access" | "upgrade_required" | "wait_for_reset";
    errorMessage?: string;
    currentCredits?: number;
    creditsLimit?: number | "unlimited";
    tier?: string;
    daysUntilReset?: number;
  }>({});

  useEffect(() => {
    const data = getStudentData();
    if (!data) {
      router.push("/student/login");
      return;
    }
    setStudentData(data);
    setStudentName(data.name || "");
    setStudentId(data.id || "");
  }, [router]);

  useEffect(() => {
    void (async () => {
      const lock = getPlaygroundSessionLock()
      if (!lock || lock.completed) return
      const stillActive = await playgroundLockStillActive(lock.sessionId, lock.resultId)
      if (!stillActive) return
      const resumePath = await resumePlaygroundWebSession(lock, false)
      if (resumePath) {
        toast({
          title: "Session in progress",
          description: "Resuming your active playground session.",
        })
        router.replace(resumePath)
      }
    })()
  }, [router, toast])

  // Fetch accumulated points and scores from trade center
  useEffect(() => {
    const fetchStudentStats = async () => {
      try {
        // Get student database ID from localStorage
        const studentSessionData = localStorage.getItem("studentSession");
        if (!studentSessionData) return;
        
        const sessionData = JSON.parse(studentSessionData);
        const studentDbId = sessionData.databaseId;
        // sessionData.section contains the session code (e.g., "ELEG1301P01")
        const sessionCode = sessionData.section || "ALL";
        
        if (!studentDbId) return;
        
        await studentApiFetch(`/api/student/membership/refresh?studentId=${studentDbId}`).catch(() => {});

        // Fetch accumulated points
        const pointsResponse = await fetch(`/api/trade-center/points?studentId=${studentDbId}&session=${sessionCode}`);
        if (pointsResponse.ok) {
          const pointsData = await pointsResponse.json();
          if (pointsData.points) {
            setAccumulatedPoints(pointsData.points.playground_points || 0);
          }
        }

        // Fetch playground scores (best and average)
        const scoresResponse = await fetch(`/api/playground/scores?studentId=${studentDbId}`);
        if (scoresResponse.ok) {
          const scoresData = await scoresResponse.json();
          // Show scores if student has played games (totalGames > 0), even if scores are 0
          if (scoresData.totalGames > 0) {
            setBestScore(scoresData.bestScore || 0);
            setAverageScore(scoresData.averageScore || 0);
          } else {
            // No games played yet, keep as null to hide the cards
            setBestScore(null);
            setAverageScore(null);
          }
        }

        // Fetch playground credits
        const creditsResponse = await fetch(`/api/playground/credits?studentId=${studentDbId}`);
        if (creditsResponse.ok) {
          const creditsData = await creditsResponse.json();
          setPlaygroundCredits(creditsData.credits || 0);
          setCreditsLimit(creditsData.creditsLimit || 0);
          setIsUnlimited(creditsData.isUnlimited || false);
        }
      } catch (error) {
        // Error fetching student stats
      }
    };
    
    if (studentData) {
      fetchStudentStats();
    }
  }, [studentData]);

  const handleJoin = async () => {
    if (!studentName.trim() || !studentId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both your name and student ID",
        variant: "destructive",
      });
      return;
    }

    if (mode === "CLASSROOM" && classPasscode.trim().length !== 5) {
      toast({
        title: "Passcode Required",
        description: "Enter the 5-character passcode from your instructor",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);

    const existingLock = getPlaygroundSessionLock()
    if (existingLock && !existingLock.completed) {
      const stillActive = await playgroundLockStillActive(existingLock.sessionId, existingLock.resultId)
      if (stillActive) {
        toast({
          title: "Session in progress",
          description: "Leave and rejoin is disabled during active games.",
          variant: "destructive",
        })
        const resumePath = await resumePlaygroundWebSession(existingLock, false)
        if (resumePath) router.replace(resumePath)
        setIsJoining(false)
        return
      }
    }

    const goToPlayground = (data: Record<string, unknown>) => {
      if (typeof data.sessionId === "number" && typeof data.resultId === "number") {
        upsertPlaygroundSessionLock({
          sessionId: data.sessionId,
          resultId: data.resultId,
          mode,
          startedAt: Date.now(),
          answeredQuestionIds: [],
          lockedIndex: 0,
        })
      }
      sessionStorage.setItem("playgroundSession", JSON.stringify(data));
      sessionStorage.setItem(
        "playgroundStudent",
        JSON.stringify({ studentName, studentId, nickname: nickname.trim() || null }),
      );
      if (data.waitingRoom && !data.gameStarted) {
        router.push("/student/playground/waiting");
      } else {
        router.push("/student/playground/game");
      }
    };

    try {
      const response = await fetch("/api/playground/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          studentId,
          mode,
          nickname: nickname.trim() || null,
          passcode: mode === "CLASSROOM" ? classPasscode.trim().toUpperCase() : undefined,
        }),
      });

      if (!response.ok) {
        let errorData: Record<string, unknown> = {};
        try {
          errorData = await response.json();
        } catch {}

        const resolved = resolvePlaygroundJoinError({
          error: typeof errorData.error === "string" ? errorData.error : undefined,
          insufficientCredits: Boolean(errorData.insufficientCredits),
          creditsRemaining:
            typeof errorData.creditsRemaining === "number" ? errorData.creditsRemaining : undefined,
        });

        if (!resolved.showAccessModal) {
          toast({
            title: "Could not join",
            description: resolved.errorMessage,
            variant: "destructive",
          });
          setIsJoining(false);
          return;
        }

        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysUntilReset = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

        const studentSessionData = localStorage.getItem("studentSession");
        let studentDbId: string | null = null;
        let currentTier = "Scholar";
        if (studentSessionData) {
          const sessionData = JSON.parse(studentSessionData);
          studentDbId = sessionData.databaseId;
          currentTier = sessionStorage.getItem("studentMembershipTier") || "Scholar";
        }

        try {
          const refreshResponse = await studentApiFetch(`/api/student/membership/refresh?studentId=${studentDbId}`);
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.tier) {
              sessionStorage.setItem("studentMembershipTier", refreshData.tier);
              localStorage.setItem("studentMembershipTier", refreshData.tier);
            }
            if (refreshData.hasDonationAccess) {
              const retryResponse = await fetch("/api/playground/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  studentName,
                  studentId,
                  mode,
                  nickname: nickname.trim() || null,
                  passcode: mode === "CLASSROOM" ? classPasscode.trim().toUpperCase() : undefined,
                }),
              });
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                goToPlayground(retryData);
                return;
              }
            }
          }
        } catch {}

        setAccessModalData({
          errorType: resolved.errorType,
          errorMessage: resolved.errorMessage,
          currentCredits: resolved.creditsRemaining ?? playgroundCredits ?? 0,
          creditsLimit: creditsLimit || PLAYGROUND_WEEKLY_CREDITS,
          tier: currentTier,
          daysUntilReset,
        });
        setShowAccessModal(true);
        setIsJoining(false);
        return;
      }

      const data = await response.json();
      goToPlayground(data);
    } catch (error: any) {
      // Only show toast for unexpected errors (not handled by modal)
      if (!showAccessModal) {
        toast({
          title: "Error",
          description: error?.message || "Failed to join playground. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = () => {
    logoutStudent();
    router.push("/student/login");
  };

  if (!studentData) {
    return null;
  }

  let lastClassroomSessionId: number | null = null;
  try {
    const lastSession = sessionStorage.getItem("playgroundSession");
    if (lastSession) {
      const sessionData = JSON.parse(lastSession);
      if (sessionData.sessionId && sessionData.mode === "CLASSROOM") {
        lastClassroomSessionId = sessionData.sessionId;
      }
    }
  } catch {
    lastClassroomSessionId = null;
  }

  const showStats =
    accumulatedPoints !== null ||
    bestScore !== null ||
    averageScore !== null ||
    playgroundCredits !== null;

  return (
    <div className={portalShellRoot}>
      <StudentHeader />

      <main className={cn(portalMain, "max-w-4xl space-y-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--cc-accent)] text-white">
              <Gamepad2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--cc-text)] sm:text-3xl">
                Playground
              </h1>
              <p className={portalSubtitle}>Interactive quiz gaming</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(homeLink)}
            className="shrink-0 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>

        {showStats ? (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Your performance
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {accumulatedPoints !== null ? (
                <StatTile
                  icon={Trophy}
                  label="Total"
                  value={accumulatedPoints.toLocaleString()}
                  hint="Accumulated points"
                />
              ) : null}
              {bestScore !== null ? (
                <StatTile
                  icon={Award}
                  label="Peak"
                  value={bestScore.toLocaleString()}
                  hint="Your best score"
                />
              ) : null}
              {averageScore !== null ? (
                <StatTile
                  icon={Target}
                  label="Average"
                  value={averageScore.toLocaleString()}
                  hint="Your average score"
                />
              ) : null}
              {playgroundCredits !== null ? (
                <StatTile
                  icon={isUnlimited ? Zap : Coins}
                  label={isUnlimited ? "Unlimited" : "Credits"}
                  value={isUnlimited ? "∞" : String(playgroundCredits)}
                  hint={
                    isUnlimited
                      ? "Unlimited credits"
                      : creditsLimit
                        ? `${creditsLimit} per week`
                        : "Credits available"
                  }
                />
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={portalCard}>
          <h2 className={portalTitle}>How it works</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {RULES.map((rule) => (
              <div key={rule.label} className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/45 px-3 py-3">
                <AccentIcon icon={rule.icon} />
                <p className="mt-3 text-xl font-semibold tabular-nums text-[var(--cc-text)]">{rule.value}</p>
                <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{rule.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={cn(portalCard, "space-y-6")}>
          <div>
            <h2 className={portalTitle}>Join the game</h2>
            <p className={cn(portalSubtitle, "mt-1")}>
              Your name and ID stay locked. Add a nickname, then pick a mode.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Choose your game mode
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Game mode">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "CLASSROOM"}
                onClick={() => setMode("CLASSROOM")}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  mode === "CLASSROOM"
                    ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/55"
                    : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40",
                )}
              >
                <AccentIcon icon={Users} active={mode === "CLASSROOM"} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--cc-text)]">Classroom battle</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--cc-text-muted)]">
                    Compete live with classmates using your instructor&apos;s passcode.
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--cc-accent-dark)]">
                    <Trophy className="h-3.5 w-3.5" />
                    Live leaderboard
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "PERSONAL"}
                onClick={() => setMode("PERSONAL")}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  mode === "PERSONAL"
                    ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/55"
                    : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/40",
                )}
              >
                <AccentIcon icon={User} active={mode === "PERSONAL"} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--cc-text)]">Solo practice</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--cc-text-muted)]">
                    Practice at your own pace and track your personal bests.
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--cc-accent-dark)]">
                    <Star className="h-3.5 w-3.5" />
                    Personal records
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className={portalLabel}>
                Full name
              </Label>
              <Input
                id="name"
                value={studentName}
                disabled
                readOnly
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studentId" className={portalLabel}>
                Student ID
              </Label>
              <Input
                id="studentId"
                value={studentId}
                disabled
                readOnly
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nickname" className={portalLabel}>
              Gaming nickname <span className="font-normal text-[var(--cc-text-muted)]">(optional)</span>
            </Label>
            <Input
              id="nickname"
              placeholder="Shown on the leaderboard instead of your name"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={isJoining}
              maxLength={50}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-[var(--cc-text-muted)]">
              Leave blank to use your full name on the leaderboard.
            </p>
          </div>

          {mode === "CLASSROOM" ? (
            <div className="space-y-1.5">
              <Label htmlFor="passcode" className={portalLabel}>
                Session passcode
              </Label>
              <Input
                id="passcode"
                placeholder="ABCDE"
                value={classPasscode}
                onChange={(e) =>
                  setClassPasscode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))
                }
                disabled={isJoining}
                maxLength={5}
                autoComplete="off"
                className="h-14 rounded-xl text-center font-mono text-lg tracking-[0.35em] uppercase"
              />
            </div>
          ) : null}

          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleJoin}
              disabled={isJoining}
              className="h-11 w-full rounded-xl"
            >
              {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
              {isJoining ? "Joining game…" : mode === "CLASSROOM" ? "Join battle" : "Start practice"}
            </Button>
            {lastClassroomSessionId ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl"
                onClick={() =>
                  router.push(
                    `/student/playground/leaderboard?sessionId=${lastClassroomSessionId}&mode=CLASSROOM`,
                  )
                }
              >
                <Trophy className="h-4 w-4" />
                Classroom leaderboard
              </Button>
            ) : null}
          </div>
        </section>
      </main>

      <PlaygroundAccessModal
        open={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        errorType={accessModalData.errorType}
        errorMessage={accessModalData.errorMessage}
        currentCredits={accessModalData.currentCredits}
        creditsLimit={accessModalData.creditsLimit || 0}
        tier={accessModalData.tier}
        daysUntilReset={accessModalData.daysUntilReset}
      />
    </div>
  );
}
