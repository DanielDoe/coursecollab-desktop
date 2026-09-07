import { redirect } from "next/navigation"

export default async function InstructorRecommendationDetailAliasPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  redirect(`/instructor/dashboard-v2/recommendations/${requestId}`)
}
