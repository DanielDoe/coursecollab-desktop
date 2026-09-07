"use client"

import { motion } from "framer-motion"
import { CamperManagement } from "@/components/summer-camp/CamperManagement"

export default function FacultyCampersPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0 overflow-x-hidden"
    >
      <CamperManagement portal="faculty" />
    </motion.div>
  )
}
