"use client"

import { useState } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CardWrapper } from "./CardWrapper"

const MOCK_DATA = [
  { name: "Sat", quizzes: 8, practice: 12 },
  { name: "Sun", quizzes: 5, practice: 10 },
  { name: "Mon", quizzes: 6, practice: 8 },
  { name: "Tue", quizzes: 4, practice: 12 },
  { name: "Wed", quizzes: 10, practice: 15 },
  { name: "Thu", quizzes: 7, practice: 9 },
  { name: "Fri", quizzes: 11, practice: 14 },
]

export function ProfitWeeklyChart() {
  const [period, setPeriod] = useState("This Week")

  return (
    <CardWrapper delay={0.15}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Activity This Week</h3>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] sm:w-[140px] rounded-2xl border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#0f172a]/95 backdrop-blur-xl border-slate-200 dark:border-white/10 rounded-2xl">
              <SelectItem value="This Week">This Week</SelectItem>
              <SelectItem value="Last Week">Last Week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
                <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#3B82F6" />
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.9)" }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "12px" }}
                formatter={(value) => (
                  <span className="text-xs sm:text-sm text-slate-500 dark:text-white/60 uppercase tracking-wider">{value}</span>
                )}
              />
              <Bar dataKey="quizzes" fill="url(#barPurple)" radius={[8, 8, 0, 0]} name="Quizzes" />
              <Bar dataKey="practice" fill="url(#barBlue)" radius={[8, 8, 0, 0]} name="Practice" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </CardWrapper>
  )
}
