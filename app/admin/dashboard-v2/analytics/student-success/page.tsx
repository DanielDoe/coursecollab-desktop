"use client"

import dynamic from "next/dynamic"

const AdminStudentSuccessDashboard = dynamic(
  () => import("@/components/admin/AdminStudentSuccessDashboard").then((m) => m.AdminStudentSuccessDashboard),
  { ssr: false },
)

export default function Page() {
  return <AdminStudentSuccessDashboard />
}
