import { redirect } from "next/navigation"

export default async function AdminInstitutionIdRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/dashboard-v2/institutions/${id}`)
}
