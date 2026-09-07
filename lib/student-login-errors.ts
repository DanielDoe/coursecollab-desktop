/** User-facing copy for university / roster student login failures. */

export const STUDENT_LOGIN_NOT_FOUND_ERROR =
  "We couldn't find a roster account for that Student ID or email."

export const STUDENT_LOGIN_NOT_FOUND_HINT =
  "Use the Student ID from your syllabus (numbers work even if email sign-in fails). Confirm you selected the correct university. If your instructor enrolled you, sign in with the temporary password from your welcome email — do not use account activation. Otherwise ask your instructor to verify your email is listed on the roster."

export const STUDENT_ALREADY_ACTIVATED_ERROR = "Account already activated. Sign in with your password."

export const STUDENT_ALREADY_ACTIVATED_HINT =
  "Your instructor already added you to CourseCollab. Go back to Sign in, enter your Student ID or email, and use your password. First time signing in? Use the temporary password from your welcome email — CourseCollab will prompt you to set a new one."

export function studentLoginNotFoundPayload() {
  return {
    error: STUDENT_LOGIN_NOT_FOUND_ERROR,
    lifecycle: "not_found" as const,
    requiresAccessRequest: true,
    message: STUDENT_LOGIN_NOT_FOUND_HINT,
  }
}

export function formatStudentLoginErrorMessage(body: {
  error?: string
  message?: string
  lifecycle?: string
  code?: string
}): string {
  const error = String(body.error ?? "Login failed").trim()
  const hint = typeof body.message === "string" ? body.message.trim() : ""
  if (body.code === "already_activated" || error === STUDENT_ALREADY_ACTIVATED_ERROR) {
    return hint || STUDENT_ALREADY_ACTIVATED_HINT
  }
  if (body.lifecycle === "not_found") {
    return hint ? `${error}\n\n${hint}` : STUDENT_LOGIN_NOT_FOUND_HINT
  }
  if (hint && hint !== error) {
    return `${error}\n\n${hint}`
  }
  return error
}

export function isStudentAlreadyActivatedResponse(body: {
  error?: string
  code?: string
}): boolean {
  const error = String(body.error ?? "").trim()
  return body.code === "already_activated" || error === STUDENT_ALREADY_ACTIVATED_ERROR
}

export function formatStudentLoginApiError(error: string, details?: unknown): string {
  if (!details || typeof details !== "object") {
    return error
  }
  const body = details as Record<string, unknown>
  return formatStudentLoginErrorMessage({
    error,
    message: typeof body.message === "string" ? body.message : undefined,
    lifecycle: typeof body.lifecycle === "string" ? body.lifecycle : undefined,
  })
}
