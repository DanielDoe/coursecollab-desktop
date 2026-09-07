import { type NextRequest, NextResponse } from "next/server"
import { getCertificateVerificationDetails } from "@/lib/summer-camp/certificate-verification"
import { buildCertificateVerificationUrl } from "@/lib/summer-camp/certificate-verification-url"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const details = await getCertificateVerificationDetails(code)
    if (!details) {
      return NextResponse.json({ error: "Certificate not found", status: "unknown" }, { status: 404 })
    }
    return NextResponse.json({
      ...details,
      verificationUrl: buildCertificateVerificationUrl(code, request.nextUrl.origin),
    })
  } catch (error) {
    console.error("[summer-camp/certificates/verify]", error)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
