import { roleHasPermission, type CourseCollabRole, type Permission } from "@/lib/authz/permissions"

export type AuthzActor = {
  id: number
  role: CourseCollabRole
  courseIds?: number[]
  institutionId?: number | null
}

export type AuthzResource = {
  type: string
  id?: number | string
  ownerId?: number
  courseId?: number
  institutionId?: number | null
}

export type AuthzDecision =
  | { ok: true }
  | { ok: false; code: "unauthenticated" | "permission" | "ownership" | "course" | "tenant"; reason: string }

export function authorize(input: {
  actor: AuthzActor | null | undefined
  action: Permission
  resource?: AuthzResource
}): AuthzDecision {
  const actor = input.actor
  if (!actor || !Number.isFinite(actor.id) || actor.id <= 0) {
    return { ok: false, code: "unauthenticated", reason: "Authentication required." }
  }
  if (!roleHasPermission(actor.role, input.action)) {
    return { ok: false, code: "permission", reason: "Not permitted." }
  }

  const resource = input.resource
  if (!resource) return { ok: true }

  if (actor.role === "admin") return { ok: true }

  if (
    resource.institutionId != null &&
    actor.institutionId != null &&
    resource.institutionId !== actor.institutionId
  ) {
    return { ok: false, code: "tenant", reason: "Outside institution scope." }
  }

  if (resource.courseId != null && actor.courseIds && !actor.courseIds.includes(resource.courseId)) {
    return { ok: false, code: "course", reason: "Outside course scope." }
  }

  const ownOnly = input.action.endsWith("readOwn") || input.action === "billing.manageOwn" || input.action === "submission.create"
  if (ownOnly && resource.ownerId != null && resource.ownerId !== actor.id) {
    return { ok: false, code: "ownership", reason: "Not the resource owner." }
  }

  if (actor.role === "observer" && !input.action.endsWith(".read") && input.action !== "grade.readOwn" && input.action !== "assignment.read" && input.action !== "course.read") {
    return { ok: false, code: "permission", reason: "Observer is read-only." }
  }

  return { ok: true }
}
