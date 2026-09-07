import { notFound, redirect } from "next/navigation"
import { InstitutionPlanPerksView } from "@/components/institution/InstitutionPlanPerksView"
import { getInstitutionPlan, INSTITUTION_PLANS, normalizeInstitutionPlanKey } from "@/lib/institution-plans"

export function generateStaticParams() {
  return INSTITUTION_PLANS.filter((p) => p.active).map((p) => ({ planKey: p.planKey }))
}

export default async function InstitutionPlanPerksPage({
  params,
}: {
  params: Promise<{ planKey: string }>
}) {
  const { planKey } = await params
  const normalized = normalizeInstitutionPlanKey(planKey)
  if (!normalized) notFound()
  if (planKey !== normalized) redirect(`/institutions/${normalized}`)
  const plan = getInstitutionPlan(normalized)
  if (!plan?.active) notFound()
  return <InstitutionPlanPerksView plan={plan} />
}
