import type { InstitutionAdminRole } from "@/lib/institutions/auth"

export type InstitutionPermission =
  | "view_license"
  | "request_license_change"
  | "manage_organization"
  | "manage_faculty"
  | "view_student_academic"
  | "manage_students"
  | "manage_courses"
  | "view_cora_ops"
  | "view_billing"
  | "manage_billing_contact"
  | "view_invoices"
  | "manage_settings"
  | "manage_admins"
  | "export_research"
  | "manage_research_studies"

const ROLE_PERMISSIONS: Record<InstitutionAdminRole, InstitutionPermission[]> = {
  owner: [
    "view_license",
    "request_license_change",
    "manage_organization",
    "manage_faculty",
    "view_student_academic",
    "manage_students",
    "manage_courses",
    "view_cora_ops",
    "view_billing",
    "manage_billing_contact",
    "view_invoices",
    "manage_settings",
    "manage_admins",
  ],
  institution_admin: [
    "view_license",
    "request_license_change",
    "manage_organization",
    "manage_faculty",
    "view_student_academic",
    "manage_students",
    "manage_courses",
    "view_cora_ops",
    "view_billing",
    "manage_billing_contact",
    "view_invoices",
    "manage_settings",
    "manage_admins",
  ],
  academic_admin: [
    "view_license",
    "manage_organization",
    "manage_faculty",
    "view_student_academic",
    "manage_students",
    "manage_courses",
    "view_cora_ops",
  ],
  department_admin: [
    "view_license",
    "manage_faculty",
    "view_student_academic",
    "manage_students",
    "manage_courses",
    "view_cora_ops",
  ],
  billing_admin: ["view_license", "view_billing", "view_invoices", "manage_billing_contact"],
  research_admin: [
    "view_license",
    "view_student_academic",
    "view_cora_ops",
    "export_research",
    "manage_research_studies",
  ],
  analytics_viewer: ["view_license", "view_student_academic", "view_cora_ops"],
}

export function institutionHasPermission(role: InstitutionAdminRole, permission: InstitutionPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function institutionPermissions(role: InstitutionAdminRole): InstitutionPermission[] {
  return ROLE_PERMISSIONS[role] ?? []
}
