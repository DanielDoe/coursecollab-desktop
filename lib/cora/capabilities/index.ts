/**
 * Re-export Cora capability manifests + unified resolver.
 */

export * from "./student-module-registry"
export * from "./faculty-module-registry"
export * from "./admin-module-registry"
export * from "./risk-levels"
export * from "./action-receipts"
export * from "./authorization-pipeline"
export * from "./module-manifest"
export {
  resolveModuleCapabilities,
  principalHasModuleCapability,
  buildAnnouncementTransactionPlan,
  buildRemediationQuizTransactionPlan,
  planToActionProposal,
  maxRisk,
  confirmTransactionPlan,
  type ResolvedModuleCapabilities,
  type CoraTransactionPlan,
  type CoraPlanOperation,
} from "./resolve-capabilities"
export {
  AnnouncementsCapability,
  QuestionBankCapability,
  PersonalFlashcardsCapability,
  PersonalNotesCapability,
  CORA_MODULE_CAPABILITIES,
} from "./modules"
