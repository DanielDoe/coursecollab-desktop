export const PASSWORD_RESET_PUBLIC_MESSAGE =
  "If an account exists for those details, a reset request has been submitted for review."

export function passwordResetAcceptedResponse() {
  return { success: true as const, message: PASSWORD_RESET_PUBLIC_MESSAGE }
}
