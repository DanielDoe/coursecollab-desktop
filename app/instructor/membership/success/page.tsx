import { redirect } from "next/navigation"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"

export default function LegacySuccessRedirect({
  searchParams,
}: {
  searchParams: { session_id?: string; plan?: string }
}) {
  const q = new URLSearchParams()
  if (searchParams.session_id) q.set("session_id", searchParams.session_id)
  if (searchParams.plan) q.set("plan", searchParams.plan)
  const suffix = q.toString() ? `?${q.toString()}` : ""
  redirect(`${FACULTY_MEMBERSHIP_HREF}/success${suffix}`)
}
