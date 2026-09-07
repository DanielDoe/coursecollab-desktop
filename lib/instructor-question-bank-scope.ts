import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { getInstructorMembership } from "@/lib/instructor-membership"
import { INSTRUCTOR_MEMBERSHIP_PLANS } from "@/lib/instructor-membership-constants"

export async function requireInstructorQuestionBankScope(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope

  const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
    "question_bank",
    "course_id",
    scope.course.id,
    scope.instructorId,
    { scopeCourseCode: scope.course.course_code },
  )

  return { ok: true as const, course: scope.course, instructorId: scope.instructorId, qbScope }
}

/** AI draft / PDF / custom-type generation — Pro+ `aiQuestionGenerator`. */
export async function requireInstructorQuestionBankAi(request: NextRequest) {
  const scope = await requireInstructorQuestionBankScope(request)
  if (!scope.ok) return scope

  const membership = await getInstructorMembership(scope.instructorId)
  const tier = membership?.tier ?? "Free"
  const plan =
    INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === tier) ??
    INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === "Free")
  if (!plan?.features.aiQuestionGenerator) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "AI question generation requires Instructor Pro." },
        { status: 403 },
      ),
    }
  }
  return scope
}

/** @deprecated Use requireInstructorQuestionBankScope */
export const resolveInstructorQuestionBankScope = requireInstructorQuestionBankScope
