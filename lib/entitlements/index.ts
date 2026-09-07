export type { EntitlementContext, FeatureAccessResult, ResolvedEntitlement } from "@/lib/entitlements/types"
export {
  getEffectiveEntitlements,
  getEffectiveStudentAccess,
  getEffectiveInstructorAccess,
  getEntitlementSources,
  hasFeatureAccess,
  studentHasInstitutionalLearningAccess,
} from "@/lib/entitlements/resolver"
export { getCoraAllowance } from "@/lib/institutions/cora"
