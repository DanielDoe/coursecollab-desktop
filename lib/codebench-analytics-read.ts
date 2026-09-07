import type { StudioSnapshot } from "@/lib/codebench-studio-analytics"

export type AnalyticsPerformance = {
  submissionCount: number
  avgScore: number
  approvedCount: number
  xpEarned: number
  streakDays: number
  sourceCounts: { codebench: number; practice: number; challenge: number }
  recent: Array<{ title: string; score: number | null; status: string | null; source: string }>
}

export type CodebenchCoraRead = {
  overview: string
  strengths: string[]
  weaknesses: string[]
  proficiencyScore: number
  level: string
  nextMove: string
  tasks: string[]
  workshopBars: Array<{ name: string; value: number }>
}

function clip(text: string, max = 88) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}…`
}

function levelFromScore(score: number, hasWork: boolean) {
  if (!hasWork) return "New"
  if (score >= 75) return "Solid"
  if (score >= 40) return "Building"
  return "Getting started"
}

export function buildCodebenchCoraRead(
  performance: AnalyticsPerformance,
  studio: StudioSnapshot,
): CodebenchCoraRead {
  const hasWork = studio.runs > 0 || performance.submissionCount > 0
  const compilePart = studio.runs > 0 ? studio.successRate : null
  const evalPart = performance.submissionCount > 0 ? performance.avgScore : null
  const parts = [compilePart, evalPart].filter((n): n is number => n != null)
  const proficiencyScore = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0

  const bits: string[] = []
  if (studio.runs) bits.push(`${studio.runs} editor run${studio.runs === 1 ? "" : "s"}`)
  if (studio.compileErrors) bits.push(`${studio.compileErrors} failed compile${studio.compileErrors === 1 ? "" : "s"}`)
  if (studio.compileSuccesses) bits.push(`${studio.compileSuccesses} clean`)
  if (performance.submissionCount) {
    bits.push(`${performance.submissionCount} submission${performance.submissionCount === 1 ? "" : "s"}`)
  }

  let overview: string
  if (!hasWork) {
    overview = "Nothing recorded yet. Open the editor and press Run — this page will show your compiles, faults, and submissions."
  } else {
    const fault = studio.lastError
      ? ` Last fault: ${studio.lastError.label.toLowerCase()}${
          studio.lastError.lastFile ? ` in ${studio.lastError.lastFile}` : ""
        }${studio.lastError.lastMessage ? ` — ${studio.lastError.lastMessage}` : ""}.`
      : studio.runs
        ? " No compile faults on file."
        : ""
    const pending =
      performance.submissionCount > 0 && performance.approvedCount === 0
        ? ` ${performance.recent[0]?.title || "A submission"} is still pending${
            performance.avgScore === 0 ? " at 0%" : ` (avg ${performance.avgScore}%)`
          }.`
        : ""
    overview = `${bits.join(" · ")}.${fault}${pending}`.replace(/\s+/g, " ").trim()
  }

  const strengths: string[] = []
  if (studio.compileSuccesses > 0) {
    strengths.push(`${studio.compileSuccesses} clean compile${studio.compileSuccesses === 1 ? "" : "s"}`)
  }
  if (studio.suggestFixes > 0) strengths.push("Used Suggest fix on a real compiler error")
  if (studio.topTools[0]) strengths.push(`Opened Cora ${studio.topTools[0].label}`)
  if (performance.approvedCount > 0) {
    strengths.push(`${performance.approvedCount} approved submission${performance.approvedCount === 1 ? "" : "s"}`)
  }
  if (performance.streakDays > 0) strengths.push(`${performance.streakDays}-day streak`)
  if (performance.sourceCounts.challenge > 0) strengths.push("Tried the daily challenge")
  if (studio.saves > 0) strengths.push("Saving work in the editor")

  const weaknesses: string[] = []
  if (studio.lastError) {
    weaknesses.push(
      clip(
        studio.lastError.lastFile
          ? `${studio.lastError.label} in ${studio.lastError.lastFile}`
          : studio.lastError.label,
      ),
    )
  }
  if (studio.runs > 0 && studio.successRate < 50) {
    weaknesses.push(`${studio.successRate}% clean-build rate`)
  }
  if (performance.submissionCount > 0 && performance.approvedCount === 0) {
    weaknesses.push("No approved submissions yet")
  }
  if (performance.submissionCount > 0 && performance.avgScore === 0) {
    const title = performance.recent[0]?.title
    weaknesses.push(title ? `${clip(title, 40)} scored 0` : "Latest evaluation scored 0")
  }

  const tasks: string[] = []
  if (studio.lastError) tasks.push(clip(studio.lastError.nextMove, 110))
  if (performance.submissionCount > 0 && performance.avgScore === 0) {
    const title = performance.recent[0]?.title
    tasks.push(title ? `Get a working pass on ${clip(title, 48)}` : "Submit a solution that compiles and runs")
  }
  if (studio.runs === 0) tasks.push("Open the editor and press Run")
  if (tasks.length < 3 && studio.compileErrors > 0) tasks.push("Fix the first clang error, then Run once")
  if (tasks.length < 3) tasks.push("Change one line, Save, Run")

  const nextMove = studio.lastError?.nextMove
    || tasks[0]
    || "Open the editor and press Run"

  return {
    overview,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    proficiencyScore,
    level: levelFromScore(proficiencyScore, hasWork),
    nextMove,
    tasks: tasks.slice(0, 3),
    workshopBars: [
      { name: "Runs", value: studio.runs },
      { name: "Clean", value: studio.compileSuccesses },
      { name: "Faults", value: studio.compileErrors },
      { name: "Cora", value: studio.suggestFixes + Object.values(studio.toolsUsed).reduce((a, b) => a + b, 0) },
    ],
  }
}
