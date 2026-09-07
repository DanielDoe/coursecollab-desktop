"use client"

import { useState } from "react"
import { Clock, QrCode } from "lucide-react"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { InstructorOfficeHoursContent } from "@/components/instructor-office-hours-content"
import { InstructorOfficeHoursDoorQrPanel } from "@/components/instructor/office-hours/instructor-office-hours-door-qr"

type OfficeHoursMenu = "requests" | "door-qr"

const MODULE_ID = "office-hours"

const MENU_ITEMS = [
  { id: "requests" as const, label: "Student requests", icon: Clock },
  { id: "door-qr" as const, label: "Door QR code", icon: QrCode },
]

export function InstructorOfficeHoursPanel({ embedInDashboard = true }: { embedInDashboard?: boolean }) {
  const [activeMenu, setActiveMenu] = useState<OfficeHoursMenu>("door-qr")

  const sidebar = (
    <FacultyModuleSideMenu
      moduleId={MODULE_ID}
      title="Office Hours"
      activeId={activeMenu}
      onSelect={(id) => setActiveMenu(id as OfficeHoursMenu)}
      items={MENU_ITEMS}
    />
  )

  return (
    <FacultyModuleSplitLayout menu={sidebar}>
      {activeMenu === "requests" ? (
        <InstructorOfficeHoursContent embedInDashboard={embedInDashboard} />
      ) : (
        <InstructorOfficeHoursDoorQrPanel />
      )}
    </FacultyModuleSplitLayout>
  )
}
