import { type NextRequest, NextResponse } from "next/server"
import { createSummerCamperPasswordResetRequest } from "@/lib/summer-camp/camper-accounts"
import { passwordResetAcceptedResponse } from "@/lib/compliance/password-reset-public"
import { checkRateLimit, PASSWORD_RESET_RATE_LIMIT, rateLimitKey } from "@/lib/compliance/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email, password, confirmPassword } = await request.json()

    const limited = checkRateLimit(
      rateLimitKey(request, "summer-camp-password-reset"),
      PASSWORD_RESET_RATE_LIMIT.limit,
      PASSWORD_RESET_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
    }

    if (!email?.trim() || !password || !confirmPassword) {
      return NextResponse.json({ error: "Email and both password fields are required" }, { status: 400 })
    }

    const emailNorm = String(email).trim().toLowerCase()
    if (!emailNorm.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 })
    }

    await createSummerCamperPasswordResetRequest({
      email: emailNorm,
      password: String(password),
    })

    return NextResponse.json(passwordResetAcceptedResponse())
  } catch (error) {
    console.error("[summer-camp/request-password-reset]", error)
    return NextResponse.json(passwordResetAcceptedResponse())
  }
}
