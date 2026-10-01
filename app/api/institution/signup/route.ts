import { type NextRequest, NextResponse } from "next/server"
import { persistRefreshToken, setRefreshTokenCookie } from "@/lib/auth-refresh-tokens"
import { checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"
import { InstitutionWorkspaceExistsError, provisionInstitutionWorkspace } from "@/lib/institutions/workspace"
import { notifyInstitutionAccessRequest } from "@/lib/institutions/request-notify"
import { institutionRequestSpamReason } from "@/lib/institutions/request-spam"
import { getInstitutionPlan } from "@/lib/institution-plans"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(rateLimitKey(request, "institution-signup"), 6, 60_000)
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const institutionName = String(body.institutionName ?? "").trim()
  const contactName = String(body.contactName ?? "").trim()
  const contactEmail = String(body.contactEmail ?? body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  const plan = body.desiredPlan ? getInstitutionPlan(String(body.desiredPlan)) : null
  const requestKindRaw = String(body.requestKind ?? "")
  const requestKind =
    requestKindRaw === "quote" || requestKindRaw === "pilot" || requestKindRaw === "demo"
      ? requestKindRaw
      : plan?.planKey === "course_pilot"
        ? "pilot"
        : "demo"

  const domain = body.domain ? String(body.domain).trim() : ""
  if (String(body.companyWebsite ?? "").trim()) {
    return NextResponse.json({ error: "Could not create workspace" }, { status: 400 })
  }
  const spam = institutionRequestSpamReason({
    institutionName,
    contactName,
    contactEmail,
    domain,
  })
  if (spam) {
    console.warn("[institution/signup] rejected spam", spam)
    return NextResponse.json(
      { error: "Enter a real institution name, contact email, and school domain." },
      { status: 400 },
    )
  }

  try {
    const created = await provisionInstitutionWorkspace({
      institutionName,
      contactName,
      contactEmail,
      password,
      domain: domain || null,
      institutionType: body.institutionType ? String(body.institutionType) : null,
      desiredPlan: plan?.planKey ?? null,
      requestKind,
    })

    if (created.createdRequest) {
      try {
        await notifyInstitutionAccessRequest({
          requestId: created.requestId ?? 0,
          requestKind,
          institutionName,
          contactName,
          contactEmail,
          desiredPlan: plan?.planKey ?? null,
          domain: domain || null,
        })
      } catch (err) {
        console.error("[institution/signup] notify failed", err)
      }
    }

    const { rawToken, expiresAt } = await persistRefreshToken({
      userType: "institution_admin",
      userId: created.accountId,
      universityId: created.institutionId,
      rememberMe: true,
    })
    const response = NextResponse.json({
      success: true,
      institutionId: created.institutionId,
    })
    setRefreshTokenCookie(response, rawToken, expiresAt)
    return response
  } catch (err) {
    if (err instanceof InstitutionWorkspaceExistsError) {
      return NextResponse.json({ error: err.message, code: "exists" }, { status: 409 })
    }
    const message = err instanceof Error ? err.message : "Could not create workspace"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
