/** Shown when a student tries to join a classroom session they already attempted. */
export const PLAYGROUND_ALREADY_JOINED_TITLE = "Already in this session"

export const PLAYGROUND_ALREADY_JOINED_MESSAGE =
  "You already have an attempt for this live session. Ask your instructor to reset your attempt before joining again."

export const PLAYGROUND_LEAVE_LOBBY_TITLE = "Leave waiting room?"

export const PLAYGROUND_LEAVE_LOBBY_MESSAGE =
  "You'll leave the lobby but stay registered for this session. To play later, open Playground and tap Continue session — or ask your instructor to reset your attempt."

export const PLAYGROUND_LEAVE_SESSION_TITLE = "Leave session?"

export const PLAYGROUND_LEAVE_SESSION_MESSAGE =
  "You'll keep your current score and progress. You won't be able to rejoin this live session unless your instructor resets your attempt."

/** Waiting-room row: joined lobby but game has not started for this student yet. */
export function isPlaygroundWaitingRoomResult(row: {
  joined_at_question: number | null | undefined
  completed_at: string | null | undefined
}): boolean {
  return Number(row.joined_at_question ?? 0) < 0 && row.completed_at == null
}
