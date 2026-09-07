"use client"

import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { getStudentData } from "@/lib/auth"
import { useEffect, useState } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { NewRecommendationRequestForm } from "@/components/student/recommendations/new-recommendation-request-form"
import { useRecommendationNav } from "@/components/student/recommendations/recommendation-nav-context"

export default function DashboardRecommendationRequestPage({
  guestMode = false,
}: {
  guestMode?: boolean
}) {
  const router = useRouter()
  const { base: BASE } = useRecommendationNav()
  const [studentKey, setStudentKey] = useState<string | null>(null)

  useEffect(() => {
    const d = getStudentData()
    setStudentKey(d?.databaseId ?? d?.id ?? null)
  }, [])

  if (!studentKey) {
    return <p className="text-sm text-red-600 dark:text-red-400">Log in as a student to request a letter.</p>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full min-w-0 max-w-3xl"
    >
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
        <NewRecommendationRequestForm
          studentKey={studentKey}
          listHref={BASE}
          showCancel
          guestMode={guestMode}
          onCreated={(id) => router.push(`${BASE}/${id}`)}
        />
        </div>
      </EmbedModuleCard>
    </motion.div>
  )
}
