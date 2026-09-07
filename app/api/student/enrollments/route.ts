import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  findEnrollmentsForStudentDbId,
  publicStudentEnrollments,
} from "@/lib/student-active-enrollment"

export const dynamic = "force-dynamic"

/** Authenticated student's active enrollments — never a university catalog. */
export async function GET(request: NextRequest) {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return auth.response

  const enrollments = await findEnrollmentsForStudentDbId(auth.studentDbId)
  const active =
    enrollments.find((row) => row.studentRowId === auth.studentDbId) ?? enrollments[0] ?? null

  return NextResponse.json({
    enrollments: publicStudentEnrollments(enrollments),
    activeEnrollment: active ? publicStudentEnrollments([active])[0] : null,
  })
}
