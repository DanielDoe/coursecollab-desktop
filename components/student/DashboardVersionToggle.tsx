"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  getDashboardVersion,
  setDashboardVersion,
  type DashboardVersion,
} from "@/lib/student-dashboard-version"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Sparkles } from "lucide-react"

export function DashboardVersionToggle() {
  const router = useRouter()
  const [version, setVersion] = useState<DashboardVersion>("v1")

  useEffect(() => {
    setVersion(getDashboardVersion())
  }, [])

  const handleSwitch = (newVersion: DashboardVersion) => {
    setDashboardVersion(newVersion)
    setVersion(newVersion)
    router.push(newVersion === "v2" ? "/student/dashboard-v2" : "/student/dashboard")
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Button
        variant={version === "v1" ? "default" : "outline"}
        onClick={() => handleSwitch("v1")}
        className="flex-1"
      >
        <LayoutDashboard className="h-4 w-4 mr-2" />
        Classic
      </Button>
      <Button
        variant={version === "v2" ? "default" : "outline"}
        onClick={() => handleSwitch("v2")}
        className="flex-1"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        2.0
      </Button>
    </div>
  )
}
