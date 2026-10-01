import { createHmac, timingSafeEqual } from "crypto"

/**
 * Anti-tamper receipt for AI/vision-graded evaluation results (Section II code_write,
 * code_write_plot, multi_part, circuit_submission, ...).
 *
 * These question types are graded by a first "evaluate" round-trip (`/api/[assessmentType]/evaluate`,
 * legacy `/api/quiz/evaluate`) that computes a real score server-side using the trusted question
 * row, then hands the result to the browser. The browser holds onto that result and re-sends it
 * later in the "submit" call, which historically just trusted whatever `aiFeedback.score` /
 * `pointsEarned` the client re-posted — a network-tools-savvy student could intercept that
 * response and inflate the score before it's persisted.
 *
 * This receipt binds the score to the exact attempt, question, and answer text the server graded,
 * using an HMAC the client cannot forge or edit. `submit` re-derives the same fingerprint from the
 * answer it's about to persist and only trusts the client's score if the receipt still matches —
 * otherwise it falls back to requiring manual/AI review instead of blindly zeroing or trusting it.
 */

const RECEIPT_TTL_MS = 12 * 60 * 60 * 1000 // 12h — generous for save-and-finish-later sittings

function receiptSecret(): string {
  return (
    process.env.AI_EVAL_RECEIPT_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    "coursecollab-eval-receipt-fallback-secret"
  )
}

function answerFingerprint(answer: unknown): string {
  // String answers (the common code_write/code_write_plot case) hash directly. Object/array
  // answers (multi_part, circuit_submission) are canonicalized with a stable key order so the
  // client's and server's JSON.stringify don't disagree on whitespace/key order.
  const normalized =
    typeof answer === "string" ? answer : JSON.stringify(sortKeysDeep(answer ?? null))
  return createHmac("sha256", "fingerprint-v1").update(normalized).digest("hex")
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value != null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key])
        return acc
      }, {} as Record<string, unknown>)
  }
  return value
}

type ReceiptPayload = {
  attemptId: number
  questionId: number
  answerFp: string
  isCorrect: boolean
  points: number
  issuedAt: number
}

export function issueEvaluationReceipt(args: {
  attemptId: number
  questionId: number
  answer: unknown
  isCorrect: boolean
  points: number
}): string {
  const payload: ReceiptPayload = {
    attemptId: Number(args.attemptId),
    questionId: Number(args.questionId),
    answerFp: answerFingerprint(args.answer),
    isCorrect: Boolean(args.isCorrect),
    points: Math.round(Number(args.points) * 1000) / 1000,
    issuedAt: Date.now(),
  }
  const json = JSON.stringify(payload)
  const encoded = Buffer.from(json, "utf8").toString("base64url")
  const sig = createHmac("sha256", receiptSecret()).update(encoded).digest("hex")
  return `${encoded}.${sig}`
}

export type EvaluationReceiptVerification =
  | { ok: true; isCorrect: boolean; points: number }
  | { ok: false; reason: "missing" | "malformed" | "bad_signature" | "mismatch" | "expired" }

/**
 * Verify a receipt against the (attemptId, questionId, answer) about to be persisted. Only
 * returns ok:true when the receipt's HMAC is valid, unexpired, and was issued for this exact
 * attempt/question/answer — anything else (missing, edited, reused for a different answer) fails.
 */
export function verifyEvaluationReceipt(
  receipt: unknown,
  expected: { attemptId: number; questionId: number; answer: unknown },
): EvaluationReceiptVerification {
  if (typeof receipt !== "string" || !receipt.includes(".")) {
    return { ok: false, reason: "missing" }
  }
  const dot = receipt.lastIndexOf(".")
  const encoded = receipt.slice(0, dot)
  const sig = receipt.slice(dot + 1)

  let expectedSig: string
  try {
    expectedSig = createHmac("sha256", receiptSecret()).update(encoded).digest("hex")
  } catch {
    return { ok: false, reason: "malformed" }
  }

  const sigBuf = Buffer.from(sig, "hex")
  const expectedBuf = Buffer.from(expectedSig, "hex")
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "bad_signature" }
  }

  let payload: ReceiptPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "malformed" }
  }

  if (
    payload.attemptId !== Number(expected.attemptId) ||
    payload.questionId !== Number(expected.questionId)
  ) {
    return { ok: false, reason: "mismatch" }
  }
  if (Date.now() - payload.issuedAt > RECEIPT_TTL_MS) {
    return { ok: false, reason: "expired" }
  }
  if (payload.answerFp !== answerFingerprint(expected.answer)) {
    return { ok: false, reason: "mismatch" }
  }

  return { ok: true, isCorrect: payload.isCorrect, points: payload.points }
}
