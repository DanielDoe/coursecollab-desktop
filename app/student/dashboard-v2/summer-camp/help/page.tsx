import { redirect } from "next/navigation"
import { campRoute } from "@/lib/summer-camp/camper-nav"

export default function HelpLegacyRedirect() {
  redirect(campRoute("/support"))
}
