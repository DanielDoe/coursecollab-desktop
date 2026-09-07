import { redirect } from "next/navigation"

export default function AdminLicensesRedirect() {
  redirect("/admin/dashboard-v2/institution-licenses")
}
