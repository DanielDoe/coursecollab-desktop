"use client"

import { useEffect, useState } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { CoraUsageHistory } from "@/components/cora/CoraUsageHistory"
import { resolveStudentDatabaseId } from "@/lib/auth"

export default function StudentCoraUsageHistoryPage() {
  const [studentId, setStudentId] = useState<string | null>(null)

  useEffect(() => {
    setStudentId(resolveStudentDatabaseId())
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0 pb-4">
      <CoraUsageHistory userId={studentId} role="student" />
    </motion.div>
  )
}
