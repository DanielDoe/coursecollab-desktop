"use client"

import { useState, useEffect } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Flame, Trophy } from "lucide-react"
import Link from "next/link"
import { resolveStudentDatabaseId, resolveStudentSection, studentApiFetch } from "@/lib/auth"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { CardWrapper } from "./CardWrapper"

const attendanceTheme = getStudentModuleTheme("attendance").page
const classroomPointsTheme = getStudentModuleTheme("classroom-points").page

/** Premium Streak & Points */
export function StreakAndPoints() {
  const [streak, setStreak] = useState(0)
  const [classroomPoints, setClassroomPoints] = useState(0)

  useEffect(() => {
    const studentId = resolveStudentDatabaseId()
    const section = resolveStudentSection()
    if (!studentId) return

    const fetchData = async () => {
      try {
        const pointsUrl =
          section && section !== "ALL"
            ? `/api/classroom-points?studentId=${encodeURIComponent(studentId)}&session=${encodeURIComponent(section)}`
            : `/api/classroom-points?studentId=${encodeURIComponent(studentId)}`
        const [profileRes, pointsRes] = await Promise.all([
          studentApiFetch(`/api/student/profile?studentId=${studentId}`),
          fetch(pointsUrl).catch(() => null),
        ])

        if (profileRes.ok) {
          const { profile, student } = await profileRes.json()
          const p = profile || student
          setStreak(p?.achievements?.streak_days ?? 0)
        }

        if (pointsRes?.ok) {
          const data = await pointsRes.json()
          const total =
            data.summary?.total_points ??
            data.points?.reduce((sum: number, p: { points: number }) => sum + (p.points || 0), 0) ??
            0
          setClassroomPoints(Number(total))
        } else {
          setClassroomPoints(0)
        }
      } catch (error) {
        console.error("[StreakAndPoints] Failed to fetch:", error)
      }
    }

    fetchData()
  }, [])

  return (
    <CardWrapper delay={0.3}>
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            Streak & Points
          </h3>
          <Link
            href="/student/dashboard-v2/attendance"
            className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${attendanceTheme.iconText} hover:underline`}
          >
            Details
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className={`rounded-2xl ${attendanceTheme.softBg} p-5`}
          >
            <Flame className={`mb-3 h-6 w-6 ${attendanceTheme.iconText}`} />
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--cc-text)]">{streak}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
              Day streak
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={`rounded-2xl ${classroomPointsTheme.softBg} p-5`}
          >
            <Trophy className={`mb-3 h-6 w-6 ${classroomPointsTheme.iconText}`} />
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--cc-text)]">{classroomPoints}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
              Classroom pts
            </p>
          </motion.div>
        </div>
      </div>
    </CardWrapper>
  )
}
