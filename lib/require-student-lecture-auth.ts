import { type NextRequest, NextResponse } from "next/server"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import {
  getStudentLectureSessionByDbId,
  type StudentLectureSessionRow,
} from "@/lib/student-lecture-access"

export async function requireStudentLectureCaller(
  request: NextRequest,
  claimedStudentId?: string | null,
): Promise<
  | { ok: true; studentDbId: number; sessionRow: StudentLectureSessionRow }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireStudentIdParamMatchesCaller(request, claimedStudentId)
  if (!auth.ok) return auth
  const sessionRow = await getStudentLectureSessionByDbId(auth.studentDbId)
  if (!sessionRow) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Student session not found" }, { status: 404 }),
    }
  }
  return { ok: true, studentDbId: auth.studentDbId, sessionRow }
}
