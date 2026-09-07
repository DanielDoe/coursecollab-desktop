import { type NextRequest, NextResponse } from "next/server"
import { deleteAccount } from "@/lib/compliance/account-deletion"
import type { AccountKind } from "@/lib/compliance/account-deletion-policy"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { publicErrorMessage } from "@/lib/compliance/safe-error"
import { checkRateLimit, rateLimitKey, DELETE_ACCOUNT_RATE_LIMIT } from "@/lib/compliance/rate-limit"

async function resolveInstructorId(request: NextRequest): Promise<number | null> {
  const raw = request.headers.get("x-instructor-id")?.trim()
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

export async function postAccountDelete(
  request: NextRequest,
  defaultKind?: AccountKind,
): Promise<NextResponse> {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "account-delete"),
      DELETE_ACCOUNT_RATE_LIMIT.limit,
      DELETE_ACCOUNT_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many deletion attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      confirm?: unknown
      confirmPhrase?: unknown
      password?: unknown
      accountKind?: unknown
      accountId?: unknown
    }

    const kind =
      body.accountKind === "student" || body.accountKind === "guest" || body.accountKind === "instructor"
        ? body.accountKind
        : defaultKind ?? null

    if (!kind) {
      return NextResponse.json(
        { error: "accountKind must be student, guest, or instructor." },
        { status: 400 },
      )
    }

    let accountId: number | null = null
    if (kind === "instructor") {
      accountId = await resolveInstructorId(request)
    } else {
      const auth = await requireCallerStudentDbId(request)
      if (!auth.ok) return auth.response
      accountId = auth.studentDbId
    }

    if (accountId == null) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    if (body.accountId != null && Number(body.accountId) !== accountId) {
      return NextResponse.json({ error: "You can only delete your own account." }, { status: 403 })
    }

    const confirmed =
      body.confirm === true ||
      String(body.confirmPhrase ?? "").trim().toUpperCase() === "DELETE"

    const result = await deleteAccount({
      accountKind: kind,
      accountId,
      password: String(body.password ?? ""),
      confirm: confirmed,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Your account deletion request was processed.",
      accountKind: result.accountKind,
      deleted: result.deleted,
      anonymized: result.anonymized,
      retained: result.retained,
      retainedRecords: result.retained,
    })
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, "Unable to delete account.") },
      { status: 500 },
    )
  }
}
