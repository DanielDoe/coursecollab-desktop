import { getCurrentXP } from "@/lib/codebench-xp"
import { resolveCodebenchEditorCode, readStoredCodebenchLanguageId } from "@/lib/codebench-languages"

export type CodebenchSubmissionRow = {
  code?: string
  solution?: string
  submitted_at?: string
}

export type CodebenchProgressSummary = {
  xp: number
  level: number
  levelProgress: number
  xpToNextLevel: number
  streak: number
  badgeCount: number
  submissionCount: number
  rank: number | null
  proficiencyScore: number | null
  analyzeCode: string
}

const PROGRESS_TTL_MS = 60_000
let lastFetchAt = 0
let cachedSummary: CodebenchProgressSummary | null = null
let cachedStudentId: string | null = null

export function codebenchLevelFromXp(xp: number): { level: number; levelProgress: number; xpToNextLevel: number } {
  const level = Math.floor(xp / 100) + 1
  const levelProgress = xp % 100
  return { level, levelProgress, xpToNextLevel: 100 }
}

export function latestSubmissionCode(
  codeSubmissions: CodebenchSubmissionRow[],
  practiceSubmissions: CodebenchSubmissionRow[] = [],
): string {
  const merged = [
    ...codeSubmissions.map((s) => ({ code: s.code ?? "", at: s.submitted_at ?? "" })),
    ...practiceSubmissions.map((s) => ({ code: s.solution ?? s.code ?? "", at: s.submitted_at ?? "" })),
  ]
    .filter((s) => s.code.trim().length > 0)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return merged[0]?.code.trim() ?? ""
}

export function resolveAnalyzeCode(latestSubmission: string, editorCode?: string): string {
  const editor = (editorCode ?? "").trim()
  const latest = latestSubmission.trim()
  return latest || editor || resolveCodebenchEditorCode(readStoredCodebenchLanguageId()).trim()
}

export async function fetchCodebenchProgressSummary(
  studentId: string,
  options?: { editorCode?: string; force?: boolean },
): Promise<CodebenchProgressSummary> {
  const now = Date.now()
  if (
    !options?.force &&
    cachedSummary &&
    cachedStudentId === studentId &&
    now - lastFetchAt < PROGRESS_TTL_MS
  ) {
    return cachedSummary
  }

  const editorCode = options?.editorCode ?? resolveCodebenchEditorCode(readStoredCodebenchLanguageId())
  const xp = getCurrentXP()
  const { level, levelProgress, xpToNextLevel } = codebenchLevelFromXp(xp)

  let streak = 0
  let badgeCount = 0
  let submissionCount = 0
  let rank: number | null = null
  let analyzeCode = editorCode.trim()
  let proficiencyScore: number | null = null

  try {
    const [subRes, streakRes, badgesRes, lbRes] = await Promise.all([
      fetch(`/api/codebench/submissions?studentId=${studentId}`),
      fetch(`/api/codebench/streak?studentId=${studentId}`),
      fetch(`/api/codebench/badges?studentId=${studentId}`),
      fetch(`/api/codebench/leaderboard?studentId=${studentId}`),
    ])

    if (subRes.ok) {
      const subData = await subRes.json()
      const codeSubs = (subData.codeSubmissions ?? []) as CodebenchSubmissionRow[]
      const practiceSubs = (subData.practiceSubmissions ?? []) as CodebenchSubmissionRow[]
      submissionCount = codeSubs.length + practiceSubs.length
      analyzeCode = resolveAnalyzeCode(latestSubmissionCode(codeSubs, practiceSubs), editorCode)
    }

    if (streakRes.ok) {
      const streakData = await streakRes.json()
      streak = streakData.streakDays ?? streakData.streak ?? 0
    }

    if (badgesRes.ok) {
      const badgeData = await badgesRes.json()
      badgeCount = Object.values(badgeData.badges ?? {}).filter(Boolean).length
    }

    if (lbRes.ok) {
      const lbData = await lbRes.json()
      const me = (lbData.leaderboard ?? []).find(
        (row: { student_id?: number | string }) => String(row.student_id) === studentId,
      )
      rank = me?.rank ?? null
    }

    if (analyzeCode.length > 20) {
      const analyzeRes = await fetch("/api/codebench/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: analyzeCode, studentId }),
      })
      if (analyzeRes.ok) {
        const analysis = await analyzeRes.json()
        proficiencyScore =
          typeof analysis.proficiencyScore === "number" ? analysis.proficiencyScore : null
      }
    }
  } catch (error) {
    console.error("[codebench-progress] fetch failed:", error)
  }

  const summary: CodebenchProgressSummary = {
    xp,
    level,
    levelProgress,
    xpToNextLevel,
    streak,
    badgeCount,
    submissionCount,
    rank,
    proficiencyScore,
    analyzeCode,
  }

  cachedSummary = summary
  cachedStudentId = studentId
  lastFetchAt = now
  return summary
}

export function invalidateCodebenchProgressCache(): void {
  lastFetchAt = 0
  cachedSummary = null
  cachedStudentId = null
}
