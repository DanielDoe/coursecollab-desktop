import { redirect } from "next/navigation"
import { campRoute } from "@/lib/summer-camp/camper-nav"

export default async function SummerCampModuleLegacyRedirect({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params
  redirect(campRoute(`/module/${moduleId}`))
}
