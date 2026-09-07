export type PlaygroundJoinErrorType =
  | "insufficient_credits"
  | "no_access"
  | "upgrade_required"
  | "wait_for_reset"

export function resolvePlaygroundJoinError(errorData: {
  error?: string
  insufficientCredits?: boolean
  creditsRemaining?: number
}): {
  showAccessModal: boolean
  errorType: PlaygroundJoinErrorType
  errorMessage: string
  creditsRemaining: number
} {
  const errorMessage = errorData.error || "Failed to join playground"
  const creditsRemaining =
    typeof errorData.creditsRemaining === "number" ? errorData.creditsRemaining : 0

  if (errorData.insufficientCredits) {
    return {
      showAccessModal: true,
      errorType: "insufficient_credits",
      errorMessage,
      creditsRemaining,
    }
  }

  const looksLikeCreditsError =
    /credit/i.test(errorMessage) &&
    (/exhaust|used all|insufficient|no credit/i.test(errorMessage) || creditsRemaining <= 0)

  if (looksLikeCreditsError) {
    return {
      showAccessModal: true,
      errorType: "insufficient_credits",
      errorMessage,
      creditsRemaining,
    }
  }

  return {
    showAccessModal: false,
    errorType: "no_access",
    errorMessage,
    creditsRemaining,
  }
}
