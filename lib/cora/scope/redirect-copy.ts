import type { CoraPrincipalRole } from "@/lib/cora/security/types"

export function coraScopeRedirectMessage(role: CoraPrincipalRole): string {
  if (role === "faculty") {
    return "That looks outside the teaching, research, and CourseCollab support I provide. I can help with courses, assessments, instructional design, academic writing, or other professional academic work. What would you like to work on?"
  }
  if (role === "admin") {
    return "That looks outside institutional and CourseCollab operations I support. I can help with users, courses, enrollment, analytics, system health, or platform configuration. What would you like to work on?"
  }
  return "That looks outside the academic and learning support I provide in CourseCollab. I can help with your courses, learning, academic projects, career preparation, or other educational topics. What would you like to work on?"
}

export function coraScopeRepeatRedirectMessage(role: CoraPrincipalRole): string {
  if (role === "faculty") {
    return "Quick reminder: I'm CourseCollab's academic teaching assistant — happy to help with teaching, research, or course operations."
  }
  if (role === "admin") {
    return "Quick reminder: I'm focused on CourseCollab institutional operations and platform support."
  }
  return "Quick reminder: I'm CourseCollab's academic assistant — happy to help with learning, coursework, or student success."
}
