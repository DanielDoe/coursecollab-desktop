"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import Link from "next/link"
import { BookOpen, Clock, HelpCircle, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const QUICK_LINKS = [
  { label: "Office Hours", href: "/admin/dashboard-v2/learning-center/office-hours", icon: Clock, desc: "Manage student office hour requests" },
  { label: "Help & Support", href: "/admin/dashboard-v2/learning-center/help", icon: HelpCircle, desc: "Get help and access resources" },
]

export default function LearningCenterPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15">
              <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Learning Center
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Resources and support for your teaching
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-xl",
                    "hover:bg-slate-100 dark:hover:bg-white/5 transition-colors",
                    "group"
                  )}
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
                    <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">{link.label}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{link.desc}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                </Link>
              )
            })}
          </div>
        </div>
      </CardWrapper>
    </motion.div>
  )
}
