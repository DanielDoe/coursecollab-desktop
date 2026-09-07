import { redirect } from "next/navigation"
import { SUMMER_CAMP_DASHBOARD_BASE } from "@/lib/summer-camp/camper-nav"

export default function SummerCampLegacyRedirect() {
  redirect(SUMMER_CAMP_DASHBOARD_BASE)
}
