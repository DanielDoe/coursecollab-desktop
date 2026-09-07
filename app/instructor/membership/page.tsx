import { redirect } from "next/navigation"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"

export default function LegacyInstructorMembershipRedirect() {
  redirect(FACULTY_MEMBERSHIP_HREF)
}
