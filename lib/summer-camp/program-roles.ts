import type { StudentProgramRole } from "./types"

export type SummerProgramRole = "summer_camper" | "summer_student"

export const SUMMER_PROGRAM_REQUEST_KINDS = ["summer_camper", "summer_student"] as const

export function isSummerProgramRole(role: string | undefined | null): role is SummerProgramRole {
  return role === "summer_camper" || role === "summer_student"
}

export function hasSummerProgramAccess(role: StudentProgramRole | string): boolean {
  return isSummerProgramRole(role)
}

export function summerProgramRoleLabel(role: string): string {
  if (role === "summer_camper") return "Summer Camper"
  if (role === "summer_student") return "Summer Student"
  return role
}
