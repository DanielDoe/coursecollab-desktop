import { calculateContractValues } from "@/lib/institutional-pricing"

export type InstitutionEconomicsInput = {
  negotiatedPriceCents: number | null
  contractTermMonths?: number
  activeStudents: number
  studentCapacity: number | null
  includedCoraCredits: number
  usedCoraCredits: number
  estimatedAiCostCents: number
  infrastructureCostCents?: number | null
  supportCostCents?: number | null
}

export function buildInstitutionEconomics(input: InstitutionEconomicsInput) {
  const contract = input.negotiatedPriceCents != null
    ? calculateContractValues({
        negotiatedPriceCents: input.negotiatedPriceCents,
        contractTermMonths: input.contractTermMonths ?? 12,
      })
    : null
  const contractValue = contract?.annualContractValueCents ?? null
  const effectiveRevenuePerActiveStudentCents =
    contractValue != null && input.activeStudents > 0 ? Math.trunc(contractValue / input.activeStudents) : null
  const knownCosts =
    input.estimatedAiCostCents + (input.infrastructureCostCents ?? 0) + (input.supportCostCents ?? 0)
  const costsComplete = input.infrastructureCostCents != null && input.supportCostCents != null
  const estimatedGrossProfitCents = contractValue != null && costsComplete ? contractValue - knownCosts : null
  const estimatedGrossMarginBps =
    estimatedGrossProfitCents != null && contractValue && contractValue > 0
      ? Math.trunc((estimatedGrossProfitCents * 10_000) / contractValue)
      : null
  const coraCostBps =
    contractValue != null && contractValue > 0
      ? Math.trunc((input.estimatedAiCostCents * 10_000) / contractValue)
      : null
  const creditsPerActiveLearner =
    input.activeStudents > 0 ? Math.trunc(input.usedCoraCredits / input.activeStudents) : null
  return {
    contractValueCents: contractValue,
    cashCollectedCents: contract?.cashCollectedCents ?? null,
    annualContractValueCents: contract?.annualContractValueCents ?? null,
    arrContributionCents: contract?.arrContributionCents ?? null,
    mrrEquivalentCents: contract?.mrrEquivalentCents ?? null,
    activeStudents: input.activeStudents,
    studentCapacity: input.studentCapacity,
    utilizationBps:
      input.studentCapacity && input.studentCapacity > 0
        ? Math.trunc((input.activeStudents * 10_000) / input.studentCapacity)
        : null,
    effectiveRevenuePerActiveStudentCents,
    includedCoraCredits: input.includedCoraCredits,
    usedCoraCredits: input.usedCoraCredits,
    remainingCoraCredits: Math.max(0, input.includedCoraCredits - input.usedCoraCredits),
    creditsPerActiveLearner,
    estimatedAiCostCents: input.estimatedAiCostCents,
    infrastructureCostCents: input.infrastructureCostCents ?? null,
    supportCostCents: input.supportCostCents ?? null,
    estimatedGrossProfitCents,
    estimatedGrossMarginBps,
    coraCostAsPercentOfContractBps: coraCostBps,
  }
}
