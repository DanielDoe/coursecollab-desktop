export type FacultyAccountSetupStepId =
  | "verify_account"
  | "load_courses"
  | "import_course"
  | "link_term"
  | "sync_permissions"
  | "ready"

export const FACULTY_ACCOUNT_SETUP_STEPS: Array<{ id: FacultyAccountSetupStepId; label: string }> =
  [
    { id: "verify_account", label: "Verifying your faculty account" },
    { id: "load_courses", label: "Loading course assignments" },
    { id: "import_course", label: "Importing course workspace" },
    { id: "link_term", label: "Linking active term" },
    { id: "sync_permissions", label: "Applying teaching permissions" },
    { id: "ready", label: "Account ready" },
  ]

export type FacultySetupCheck = {
  id: string
  label: string
  ok: boolean
  detail?: string
}
