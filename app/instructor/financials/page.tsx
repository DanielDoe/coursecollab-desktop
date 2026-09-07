"use client"

import dynamic from "next/dynamic"

const FinancialManagement = dynamic(
  () => import("@/components/financial-management").then((m) => m.FinancialManagement),
  { ssr: false },
)

export default function InstructorFinancialsPage() {
  return <FinancialManagement />
}
