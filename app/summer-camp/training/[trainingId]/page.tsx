import { redirect } from "next/navigation"
import { campRoute } from "@/lib/summer-camp/camper-nav"

export default async function SummerCampTrainingLegacyRedirect({
  params,
}: {
  params: Promise<{ trainingId: string }>
}) {
  const { trainingId } = await params
  redirect(campRoute(`/training/${trainingId}`))
}
