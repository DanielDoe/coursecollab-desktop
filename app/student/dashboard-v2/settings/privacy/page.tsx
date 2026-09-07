"use client"

import { motion } from "@/components/student/dashboard-v2/light-motion"
import { PrivacySecurityPanel } from "@/components/compliance/PrivacySecurityPanel"
import { getStudentAuthHeaders, logoutStudent } from "@/lib/auth"

export default function StudentPrivacySettingsPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full min-w-0 pb-4">
      <PrivacySecurityPanel
        accountKind="student"
        authHeaders={getStudentAuthHeaders()}
        onDeleted={() => logoutStudent(true)}
      />
    </motion.div>
  )
}
