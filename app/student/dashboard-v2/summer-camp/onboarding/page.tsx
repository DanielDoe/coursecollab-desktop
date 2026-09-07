"use client"

import { useRouter } from "next/navigation"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { cn } from "@/lib/utils"
import { Sun, BookOpen, MessageCircle, Upload, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStudentData } from "@/lib/auth"
import { SUMMER_CAMP_DASHBOARD_BASE } from "@/lib/summer-camp/camper-nav"
import { camperCta } from "@/lib/summer-camp/camper-ui-theme"

const STEPS = [
  { icon: BookOpen, title: "Follow interactive modules", desc: "Step-by-step instructions with checkpoints along the way." },
  { icon: Upload, title: "Submit your work", desc: "Upload screenshots, videos, and files at each checkpoint." },
  { icon: MessageCircle, title: "Get help anytime", desc: "Ask questions on any step — instructors reply in-thread." },
]

export default function SummerCampOnboardingPage() {
  const router = useRouter()
  const session = getStudentData()

  const finish = () => {
    localStorage.setItem("cc_summer_camp_onboarded", "1")
    router.push(SUMMER_CAMP_DASHBOARD_BASE)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto text-center"
    >
      <div className="inline-flex size-16 rounded-2xl bg-amber-500/15 items-center justify-center mb-6">
        <Sun className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">
        Welcome{session?.name ? `, ${session.name.split(" ")[0]}` : ""}!
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        You&apos;re all set for Summer Camp 2026. Here&apos;s how your learning experience works.
      </p>

      <div className="space-y-4 text-left mb-10">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div
              key={step.title}
              className="flex gap-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-4"
            >
              <div className="size-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {i + 1}. {step.title}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{step.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      <Button size="lg" onClick={finish} className={cn("rounded-xl", camperCta)}>
        Go to my camp dashboard
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </motion.div>
  )
}
