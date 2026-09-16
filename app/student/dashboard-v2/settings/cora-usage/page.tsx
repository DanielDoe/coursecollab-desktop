"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CoraUsageHistory } from "@/components/cora/CoraUsageHistory"
import { resolveStudentDatabaseId } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"

export default function StudentCoraUsageHistoryPage() {
  const [studentId, setStudentId] = useState<string | null>(null)

  useEffect(() => {
    setStudentId(resolveStudentDatabaseId())
  }, [])

  return (
    <div className="w-full min-w-0 space-y-4 p-4 sm:p-5 pb-10">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/student/dashboard-v2/settings">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <CoraUsageHistory userId={studentId} role="student" />
        </div>
      </EmbedModuleCard>
    </div>
  )
}
