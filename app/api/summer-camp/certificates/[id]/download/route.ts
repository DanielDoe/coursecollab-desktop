import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { generateCampCertificatePdf } from "@/lib/summer-camp/certificate-pdf"
import {
  formatCertificateNumber,
  getCampCertificateTemplate,
} from "@/lib/summer-camp/certificate-template-db"
import { buildCertificateVerificationUrl } from "@/lib/summer-camp/certificate-verification-url"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const certId = Number(id)

    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId

    const rows = await sql`
      SELECT c.*, t.title AS training_title
      FROM camp_certificates c
      JOIN camp_trainings t ON t.id = c.training_id
      WHERE c.id = ${certId} AND c.student_id = ${studentDbId}
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Certificate not found" }, { status: 404 })
    }

    const cert = rows[0] as {
      id: number
      student_name: string
      camp_title: string
      training_title: string
      training_id: number
      verification_code: string
      issued_at: string
      metadata: Record<string, unknown> | null
    }

    const template = await getCampCertificateTemplate(cert.training_id)
    const certificateNumber =
      (cert.metadata?.certificate_number as string) ??
      formatCertificateNumber(template.certificateIdPrefix, cert.id)

    const pdf = await generateCampCertificatePdf(template, {
      studentName: cert.student_name,
      trainingName: template.trainingName || cert.training_title,
      campName: cert.camp_title,
      certificateNumber,
      verificationCode: cert.verification_code,
      verificationUrl: buildCertificateVerificationUrl(
        cert.verification_code,
        request.nextUrl.origin,
      ),
      issuedAt: cert.issued_at,
      certificateType: "completion",
    })

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="summer-camp-certificate-${cert.verification_code}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[summer-camp/certificates/download]", error)
    return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 })
  }
}
