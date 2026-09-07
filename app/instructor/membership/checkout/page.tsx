import { redirect } from "next/navigation"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"

export default function LegacyCheckoutRedirect({
  searchParams,
}: {
  searchParams: { plan?: string; cadence?: string }
}) {
  const q = new URLSearchParams()
  if (searchParams.plan) q.set("plan", searchParams.plan)
  if (searchParams.cadence) q.set("cadence", searchParams.cadence)
  const suffix = q.toString() ? `?${q.toString()}` : ""
  redirect(`${FACULTY_MEMBERSHIP_HREF}/checkout${suffix}`)
}
