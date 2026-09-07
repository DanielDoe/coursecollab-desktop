import {
  parseLectureSamplePractice,
  stripSamplePracticeAnswers,
} from "@/lib/lecture-sample-practice"
import {
  parseLectureWorkspace,
  stripLectureWorkspaceSolutions,
} from "@/lib/lecture-workspace"

/** Strip answer keys and worked solutions from student-visible lecture rows. */
export function redactStudentLectureRecord<T extends Record<string, unknown>>(row: T): T {
  const next = { ...row }
  if (next.sample_practice != null) {
    next.sample_practice = stripSamplePracticeAnswers(
      parseLectureSamplePractice(next.sample_practice),
    ) as T["sample_practice"]
  }
  if (next.lecture_workspace != null) {
    next.lecture_workspace = stripLectureWorkspaceSolutions(
      parseLectureWorkspace(next.lecture_workspace),
    ) as T["lecture_workspace"]
  }
  return next
}

export function redactStudentLectureRecords<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => redactStudentLectureRecord(row))
}
