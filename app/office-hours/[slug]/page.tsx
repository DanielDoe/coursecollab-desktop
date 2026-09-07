import { PublicOfficeHoursPageClient } from "@/components/public/PublicOfficeHoursPageClient"

export const dynamic = "force-dynamic"

export default async function OfficeHoursPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <PublicOfficeHoursPageClient slug={slug} />
}
