"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminCoraCostCenter } from "@/components/admin/AdminCoraCostCenter"

export default function AdminCoraCostsPage() {
  const router = useRouter()

  useEffect(() => {
    const adminId = localStorage.getItem("adminId") || sessionStorage.getItem("adminId")
    if (!adminId) router.push("/admin/login")
  }, [router])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminCoraCostCenter />
    </div>
  )
}
