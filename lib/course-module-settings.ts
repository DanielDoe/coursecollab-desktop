export type CourseModuleSettings = {
  codeBench: boolean
  aiTutor: boolean
  questionBank: boolean
  practiceHub: boolean
  announcements: boolean
  lectures: boolean
  attendance: boolean
}

const DEFAULT_MODULES: CourseModuleSettings = {
  codeBench: true,
  aiTutor: true,
  questionBank: true,
  practiceHub: true,
  announcements: true,
  lectures: true,
  attendance: true,
}

export function mergeCourseModuleSettings(raw: unknown): CourseModuleSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MODULES }
  const o = raw as Record<string, unknown>
  return {
    codeBench: o.codeBench !== false,
    aiTutor: o.aiTutor !== false,
    questionBank: o.questionBank !== false,
    practiceHub: o.practiceHub !== false,
    announcements: o.announcements !== false,
    lectures: o.lectures !== false,
    attendance: o.attendance !== false,
  }
}
