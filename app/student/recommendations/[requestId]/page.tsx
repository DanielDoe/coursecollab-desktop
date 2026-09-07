import { redirect } from "next/navigation"

type PageProps = { params: Promise<{ requestId: string }> }

export default async function LegacyStudentRecommendationDetailRedirect({ params }: PageProps) {
  const { requestId } = await params
  redirect(`/student/dashboard-v2/recommendations/${requestId}`)
}
