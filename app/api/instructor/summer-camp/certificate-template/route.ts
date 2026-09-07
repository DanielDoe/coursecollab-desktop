import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { canAccessSummerCampTraining, requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import {
  getCampCertificateTemplate,
  saveCampCertificateTemplate,
} from "@/lib/summer-camp/certificate-template-db"
import { TRAINING_INSTRUCTOR_SIGNATORY_ID } from "@/lib/summer-camp/certificate-instructor-signatory"
import { getTrainingCertificateFaculty } from "@/lib/summer-camp/certificate-instructor-signatory-db"
import { ensureInstructorSignaturesAllStyles } from "@/lib/summer-camp/certificate-signature-files"
import { saveCampCertificateTemplateAsset } from "@/lib/summer-camp-storage"
import type { CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const trainingId = Number(request.nextUrl.searchParams.get("trainingId"))
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "trainingId is required" }, { status: 400 })
    }

    const allowed = await canAccessSummerCampTraining(scope.instructorId, trainingId)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const trainingRows = await sql`
      SELECT t.title, c.title AS camp_title
      FROM camp_trainings t
      JOIN summer_camps c ON c.id = t.camp_id
      WHERE t.id = ${trainingId}
      LIMIT 1
    `
    const template = await getCampCertificateTemplate(trainingId)
    const trainingFaculty = await getTrainingCertificateFaculty(trainingId)

    return NextResponse.json({
      template,
      training: trainingRows[0] ?? null,
      trainingFaculty,
    })
  } catch (error) {
    console.error("[instructor/summer-camp/certificate-template GET]", error)
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const trainingId = Number(body.trainingId)
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "trainingId is required" }, { status: 400 })
    }

    const allowed = await canAccessSummerCampTraining(scope.instructorId, trainingId)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const template = body.template as CampCertificateTemplate
    if (!template || typeof template !== "object") {
      return NextResponse.json({ error: "template is required" }, { status: 400 })
    }

    const saved = await saveCampCertificateTemplate(trainingId, template, scope.instructorId)

    const trainingFaculty = await getTrainingCertificateFaculty(trainingId)
    const sig2 = saved.signatories.find((s) => s.id === TRAINING_INSTRUCTOR_SIGNATORY_ID)
    if (sig2?.instructorId != null && sig2.name) {
      await ensureInstructorSignaturesAllStyles(sig2.instructorId, sig2.name)
    }

    return NextResponse.json({ template: saved, trainingFaculty })
  } catch (error) {
    console.error("[instructor/summer-camp/certificate-template PATCH]", error)
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const trainingId = Number(formData.get("trainingId"))
    const assetKey = String(formData.get("assetKey") ?? "")
    const signatoryId = formData.get("signatoryId")?.toString() ?? null
    const file = formData.get("file") as File | null

    if (!Number.isFinite(trainingId) || !file?.size) {
      return NextResponse.json({ error: "trainingId and file are required" }, { status: 400 })
    }

    const allowed = await canAccessSummerCampTraining(scope.instructorId, trainingId)
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { url } = await saveCampCertificateTemplateAsset(trainingId, assetKey, file)

    const template = await getCampCertificateTemplate(trainingId)

    const validAssets = ["pvamuLogoUrl", "creditLogoUrl", "sealImageUrl", "watermarkImageUrl"] as const
    if (validAssets.includes(assetKey as (typeof validAssets)[number])) {
      template.assets[assetKey as (typeof validAssets)[number]] = url
    } else if (assetKey === "signature" && signatoryId) {
      template.signatories = template.signatories.map((s) =>
        s.id === signatoryId ? { ...s, signatureImageUrl: url } : s,
      )
    } else {
      return NextResponse.json({ error: "Invalid assetKey" }, { status: 400 })
    }

    const updated = await saveCampCertificateTemplate(trainingId, template, scope.instructorId)
    return NextResponse.json({ url, template: updated })
  } catch (error) {
    console.error("[instructor/summer-camp/certificate-template POST]", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
