import { redirect } from "next/navigation"

export default function AdminQuotesRedirect() {
  redirect("/admin/dashboard-v2/institution-quotes")
}
