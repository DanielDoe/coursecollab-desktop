import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  fetchFlashcardsStudentActivity,
  fetchLecturesStudentActivity,
  fetchNotesStudentActivity,
  fetchSyllabusStudentActivity,
  type InstructorModuleActivityKind,
} from "@/lib/instructor-module-student-activity"

export const dynamic = "force-dynamic"

const MODULES = new Set<InstructorModuleActivityKind>(["syllabus", "flashcards", "notes", "lectures"])

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const moduleRaw = request.nextUrl.searchParams.get("module")?.trim().toLowerCase()
    if (!moduleRaw || !MODULES.has(moduleRaw as InstructorModuleActivityKind)) {
      return NextResponse.json(
        { error: "Query param module is required (syllabus | flashcards | notes | lectures)." },
        { status: 400 },
      )
    }

    const module = moduleRaw as InstructorModuleActivityKind
    const payload =
      module === "syllabus"
        ? await fetchSyllabusStudentActivity(scope.course.id, request)
        : module === "flashcards"
          ? await fetchFlashcardsStudentActivity(scope.course.id, request)
          : module === "notes"
            ? await fetchNotesStudentActivity(scope.course.id, request)
            : await fetchLecturesStudentActivity(
                scope.course.id,
                scope.instructorId,
                scope.course.course_code,
                request,
              )

    return NextResponse.json(payload)
  } catch (error) {
    console.error("[instructor/module-student-activity]", error)
    return NextResponse.json({ error: "Failed to load student activity" }, { status: 500 })
  }
}
