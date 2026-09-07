import { redirect } from "next/navigation"

/** Legacy alias — canonical Cora Career workspace is /guest/cora-career */
export default function GuestCareerLegacyRedirect() {
  redirect("/guest/cora-career")
}
