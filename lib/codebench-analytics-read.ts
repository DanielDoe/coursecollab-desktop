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

export type StudentCodingInsight = {
  summary: string
  problemTitle: string | null
  problemDetail: string | null
  compilerNote: string | null
  improve: string[]
  strengths: string[]
  watchOuts: string[]
}

export function buildStudentCodingInsight(
  studio: StudioSnapshot,
  performance?: AnalyticsPerformance | null,
): StudentCodingInsight {
  const focus = studio.topErrors[0] ?? studio.lastError
  const submissions = performance?.submissionCount ?? 0
  if (studio.runs === 0 && submissions === 0) {
    return {
      summary:
        "Nothing is logged yet. Run your code and this page will tell you which errors came up, what to fix, and what you already do well.",
      problemTitle: null,
      problemDetail: null,
      compilerNote: null,
      improve: ["Open the editor and press Run."],
      strengths: [],
      watchOuts: ["When the compiler stops you, read only the first message, change that one thing, and Run again."],
    }
  }

  const failed = studio.compileErrors
  const clean = studio.compileSuccesses
  let summary: string
  if (failed === 0 && clean > 0) {
    summary = `You have ${clean} clean compile${clean === 1 ? "" : "s"} and no compiler error saved. Keep changing one thing, then Run.`
  } else if (focus && failed > 0) {
    summary = `You have ${failed} logged compiler error${failed === 1 ? "" : "s"} and ${clean} clean build${clean === 1 ? "" : "s"}. The error that shows up most is ${focus.label.toLowerCase()} — ${focus.count} time${focus.count === 1 ? "" : "s"}${focus.share ? `, ${focus.share}% of your errors` : ""}.`
  } else if (studio.runs > 0) {
    summary = `You have run the editor ${studio.runs} time${studio.runs === 1 ? "" : "s"}. A compile will fill in the error summary.`
  } else {
    summary = `You have ${submissions} submission${submissions === 1 ? "" : "s"}. Run code in the editor to see which compiler errors you repeat.`
  }

  const strengths: string[] = []
  if (studio.successRate >= 70 && clean >= 2) {
    strengths.push(`You get a clean build ${studio.successRate}% of the time.`)
  }
  if (clean > 0) strengths.push(`${clean} compile${clean === 1 ? "" : "s"} succeeded.`)
  if (studio.saves > 0) strengths.push("You save your work in the editor.")
  if ((performance?.approvedCount ?? 0) > 0) {
    const approved = performance?.approvedCount ?? 0
    strengths.push(`${approved} submission${approved === 1 ? "" : "s"} approved.`)
  }
  if ((performance?.streakDays ?? 0) > 0) strengths.push(`${performance?.streakDays}-day streak.`)
  if (strengths.length === 0 && studio.runs > 0) {
    strengths.push("You are running your code, so these notes can get specific.")
  }

  const watchOuts =
    studio.topErrors.length > 0
      ? studio.topErrors.slice(0, 3).map((fault) => `Watch out for ${fault.label.toLowerCase()}. ${fault.tip}`)
      : ["If a new error appears, fix only the first line the compiler names, then Run again."]

  return {
    summary,
    problemTitle: focus && failed > 0 ? focus.label : null,
    problemDetail:
      focus && failed > 0
        ? `${focus.why} It has come up ${focus.count} time${focus.count === 1 ? "" : "s"}.`
        : null,
    compilerNote: failed > 0 ? focus?.lastMessage ?? null : null,
    improve:
      focus && failed > 0
        ? [focus.nextMove, ...focus.checks.filter((step) => step !== focus.nextMove)].slice(0, 4)
        : ["Change one line, save, and Run again."],
    strengths: strengths.slice(0, 4),
    watchOuts,
  }
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
  if (studio.successRate >= 70 && studio.compileSuccesses >= 2) {
    strengths.push(`Clean builds ${studio.successRate}% of the time`)
  }
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
  for (const fault of studio.topErrors) {
    if (weaknesses.some((item) => item.toLowerCase().includes(fault.label.toLowerCase()))) continue
    weaknesses.push(clip(`${fault.label} · ${fault.count}× (${fault.share}% of faults)`))
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
