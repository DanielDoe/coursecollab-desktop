export type PlaygroundMyResultStatus = {
  attemptComplete?: boolean
  questionsAnswered?: number
  inWaitingRoom?: boolean
}

/** True when the student has finished this classroom attempt (no resume). */
export function isPlaygroundAttemptFinished(
  myResult: PlaygroundMyResultStatus | null | undefined,
  questionCount: number,
): boolean {
  if (!myResult) return false
  if (myResult.attemptComplete) return true
  const answered = myResult.questionsAnswered ?? 0
  return questionCount > 0 && answered >= questionCount
}

/** True when the student may resume an in-progress attempt (waiting room or mid-game). */
export function isPlaygroundAttemptResumable(
  myResult: PlaygroundMyResultStatus | null | undefined,
  questionCount: number,
): boolean {
  if (!myResult) return false
  if (isPlaygroundAttemptFinished(myResult, questionCount)) return false
  return true
}
