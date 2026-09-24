/** Shared scoring for instructor engagement review and the student leaderboard. */

export type CodebenchEngagementInput = {
  /** Classroom points already awarded. Omitted on the instructor activity view. */
  xp?: number
  approvedCodes: number
  submissions?: number
  runs: number
  compileSuccesses: number
  compileErrors: number
  saves: number
  coraToolUses: number
  liveClassroomSessions: number
}

/**
 * Points an instructor can use when awarding engagement credit.
 * Approved codes and live classroom time weigh more than raw keystrokes.
 * Compile errors are reported separately and do not reduce the score.
 */
export function codebenchEngagementPoints(input: CodebenchEngagementInput): number {
  const xp = Number(input.xp) || 0
  const approved = Number(input.approvedCodes) || 0
  const successes = Number(input.compileSuccesses) || 0
  const saves = Number(input.saves) || 0
  const runs = Number(input.runs) || 0
  const cora = Number(input.coraToolUses) || 0
  const live = Number(input.liveClassroomSessions) || 0
  return xp + approved * 15 + successes * 3 + saves * 2 + runs + cora * 2 + live * 8
}

export function codebenchImprovementNote(
  input: CodebenchEngagementInput,
  audience: "class" | "you" = "class",
): string {
  const approved = Number(input.approvedCodes) || 0
  const submissions = Number(input.submissions ?? approved) || 0
  const runs = Number(input.runs) || 0
  const errors = Number(input.compileErrors) || 0
  const successes = Number(input.compileSuccesses) || 0
  const saves = Number(input.saves) || 0
  const cora = Number(input.coraToolUses) || 0
  const live = Number(input.liveClassroomSessions) || 0
  const you = audience === "you"

  if (runs === 0 && submissions === 0 && saves === 0 && cora === 0 && live === 0) {
    return you
      ? "No editor activity yet. Open the editor and press Run."
      : "No editor activity yet. Invite them into the next live classroom."
  }
  if (errors >= 3 && errors > successes) {
    return you
      ? "Compile errors are ahead of your clean builds. Fix the first error, then run again."
      : "Compile errors are ahead of clean builds. Walk through one error together."
  }
  if (runs >= 2 && approved === 0) {
    return you
      ? "You are running code, but nothing is approved yet."
      : "They are running code, but nothing is approved to award yet."
  }
  if (submissions > 0 && approved === 0) {
    return you
      ? "You submitted code, but nothing is approved yet."
      : "They submitted code, but nothing is approved to award yet."
  }
  if (runs > 0 && saves === 0) {
    return you
      ? "You run the editor without saving. Save before you leave."
      : "They run the editor without saving. Remind them to save before they leave."
  }
  if (live === 0 && (runs > 0 || approved > 0)) {
    return you
      ? "You are active on your own, and you have not joined a live classroom in this window."
      : "Active on their own, but they have not joined a live classroom in this window."
  }
  if (approved > 0 && errors === 0) {
    return you
      ? "Clean approved work. That is what moves you up the leaderboard."
      : "Clean approved work. A strong candidate for engagement points."
  }
  return you
    ? "Steady editor use. Keep submitting the codes that compile cleanly."
    : "Steady editor use and submissions. Award points for the approved codes."
}
