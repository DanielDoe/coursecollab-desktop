"use client"

import { useState, useEffect } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CardWrapper } from "./CardWrapper"

const MOCK_WEEKLY = [
  { name: "Mon", progress: 45, attendance: 38 },
  { name: "Tue", progress: 52, attendance: 45 },
  { name: "Wed", progress: 61, attendance: 52 },
  { name: "Thu", progress: 58, attendance: 48 },
  { name: "Fri", progress: 72, attendance: 65 },
  { name: "Sat", progress: 68, attendance: 60 },
  { name: "Sun", progress: 75, attendance: 70 },
]

const MOCK_MONTHLY = [
  { name: "Jan", progress: 42, attendance: 35 },
  { name: "Feb", progress: 48, attendance: 40 },
  { name: "Mar", progress: 55, attendance: 48 },
  { name: "Apr", progress: 62, attendance: 55 },
  { name: "May", progress: 58, attendance: 52 },
  { name: "Jun", progress: 70, attendance: 62 },
  { name: "Jul", progress: 75, attendance: 68 },
  { name: "Aug", progress: 68, attendance: 60 },
  { name: "Sep", progress: 72, attendance: 65 },
  { name: "Oct", progress: 78, attendance: 70 },
  { name: "Nov", progress: 80, attendance: 75 },
  { name: "Dec", progress: 85, attendance: 80 },
]

export function PaymentsOverviewChart() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly")
  const [data, setData] = useState(MOCK_MONTHLY)

  useEffect(() => {
    setData(period === "weekly" ? MOCK_WEEKLY : MOCK_MONTHLY)
  }, [period])

  return (
    <CardWrapper delay={0.1}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Progress Overview</h3>
          <Select value={period} onValueChange={(v) => setPeriod(v as "weekly" | "monthly")}>
            <SelectTrigger className="w-[120px] sm:w-[140px] rounded-2xl border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#0f172a]/95 backdrop-blur-xl border-slate-200 dark:border-white/10 rounded-2xl">
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="strokePurple" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#A78BFA" />
                </linearGradient>
                <linearGradient id="strokeBlue" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#60A5FA" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.3)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.9)" }}
                formatter={(value: number) => [`${value}%`, ""]}
              />
              <Area
                type="monotone"
                dataKey="progress"
                stroke="url(#strokePurple)"
                strokeWidth={3}
                fill="url(#progressGradient)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="attendance"
                stroke="url(#strokeBlue)"
                strokeWidth={3}
                fill="url(#attendanceGradient)"
                fillOpacity={1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span className="text-xs sm:text-sm text-slate-500 dark:text-white/60 uppercase tracking-wider">Quiz & Practice</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-xs sm:text-sm text-slate-500 dark:text-white/60 uppercase tracking-wider">Attendance</span>
          </div>
        </div>
      </div>
    </CardWrapper>
  )
}
