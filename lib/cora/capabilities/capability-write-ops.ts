import {
  facultyRiskFor,
  type FacultyCoraModuleId,
  type FacultyCoraOperation,
} from "@/lib/cora/capabilities/faculty-module-registry"

/** Base write operations exposed to the faculty agent allow-list. */
export const FACULTY_WRITE_OPS = new Set<FacultyCoraOperation>([
  "create",
  "update",
  "delete",
  "publish",
  "unpublish",
  "send",
  "bulkCreate",
  "configure",
  "approve",
  "award",
  "schedule",
  "archive",
  "restore",
  "regrade",
  "export",
])

/** Map compound capability suffixes to a base write operation family. */
const COMPOUND_SUFFIX_TO_OP: Record<string, FacultyCoraOperation> = {
  createSession: "create",
  createAssignment: "create",
  createMeeting: "create",
  createDeck: "create",
  createCards: "create",
  generateFromBank: "create",
  createShell: "create",
  importCopy: "create",
  draft: "create",
  save: "create",
  manageAvailability: "configure",
  configureDeadlines: "configure",
  configureTeams: "configure",
  configureDeliverables: "configure",
  configureAvailability: "configure",
  configureAttempts: "configure",
  configureSharing: "configure",
  populatePool: "update",
  addQuestions: "update",
  reviewPending: "approve",
  updateStatus: "update",
  updateSafe: "update",
  updateMembership: "update",
  assignStudents: "update",
  autoBalance: "update",
  managePerks: "update",
  manageRedemptions: "update",
  manageRules: "configure",
  proposeRegrade: "regrade",
  softDelete: "delete",
  removeQuestion: "delete",
  attach: "update",
  edit: "update",
  correct: "update",
  grantExtension: "update",
  process: "update",
  resolve: "update",
  manage: "update",
}

export function resolveCapabilityWriteOperation(capabilityId: string): FacultyCoraOperation | null {
  const suffix = capabilityId.includes(".") ? capabilityId.split(".").pop()! : capabilityId
  if (FACULTY_WRITE_OPS.has(suffix as FacultyCoraOperation)) {
    return suffix as FacultyCoraOperation
  }
  return COMPOUND_SUFFIX_TO_OP[suffix] ?? null
}

export function isWritableFacultyCapability(
  capabilityId: string,
  moduleId: FacultyCoraModuleId,
  denied: readonly string[],
): boolean {
  const op = resolveCapabilityWriteOperation(capabilityId)
  if (!op || !FACULTY_WRITE_OPS.has(op)) return false
  if (denied.includes(capabilityId) || denied.includes(op)) return false
  if (facultyRiskFor(moduleId, op) === "forbidden") return false
  return true
}
