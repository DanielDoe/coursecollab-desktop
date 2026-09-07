import { notFound } from "next/navigation"
import { OfficeHoursDoorSignPage } from "@/components/public/OfficeHoursDoorSignPage"
import {
  buildPermanentOfficeHoursPublicUrl,
  fetchPublicOfficeHoursPage,
} from "@/lib/office-hours-public-profile"

export const dynamic = "force-dynamic"

export default async function OfficeHoursDoorSignRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const normalized = String(slug ?? "").trim().toLowerCase()
  if (!normalized) notFound()

  const page = await fetchPublicOfficeHoursPage(normalized, null, null)
  if (!page) notFound()

  return (
    <OfficeHoursDoorSignPage
      instructorName={page.instructorName}
      department={page.instructorContact.department}
      publicUrl={buildPermanentOfficeHoursPublicUrl(normalized)}
    />
  )
}
