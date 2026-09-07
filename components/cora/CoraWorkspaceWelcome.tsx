"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { CoraBrandInline } from "@/components/cora/CoraLogo"
import { CORA_LEARNING_GOALS, type CoraLearningGoal } from "@/lib/cora/learning-goals"

type Props = {
  studentFirstName?: string
  activeGoal?: CoraLearningGoal
  onSelectGoal: (goal: CoraLearningGoal, starterPrompt: string) => void
  className?: string
}

export function CoraWorkspaceWelcome({
  studentFirstName,
  activeGoal,
  onSelectGoal,
  className,
}: Props) {
  const first = studentFirstName?.split(" ")[0]

  return (
    <div className={cn("relative px-4 py-8 sm:px-6 sm:py-10", className)}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 mx-auto w-full max-w-2xl text-center"
      >
        <h2 className="text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-2xl">
          {first ? (
            <>
              Hey {first} — I&apos;m <CoraBrandInline />
            </>
          ) : (
            <>
              Hey — I&apos;m <CoraBrandInline />
            </>
          )}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400 sm:text-[15px]">
          How can I help you today? Pick a learning goal — I&apos;ll figure out the subject and course from your context.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
        className="relative z-10 mx-auto mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2"
      >
        {CORA_LEARNING_GOALS.map((goal, i) => {
          const Icon = goal.icon
          const isActive = activeGoal === goal.id
          return (
            <motion.button
              key={goal.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectGoal(goal.id, goal.starterPrompt)}
              className={cn(
                "group flex items-start gap-3 rounded-[20px] border p-3.5 text-left transition-all",
                "shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
                isActive
                  ? "border-violet-300/80 bg-violet-50/80 dark:border-violet-500/30 dark:bg-violet-500/10"
                  : "border-neutral-200/80 bg-white dark:border-white/10 dark:bg-[#1c1c22]",
                goal.featured && "sm:col-span-2",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-50 text-lg dark:bg-white/[0.06]">
                {goal.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">
                    {goal.label}
                  </span>
                  {goal.featured && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      Featured
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">{goal.tagline}</span>
                <span className="mt-1 block text-xs text-neutral-400">{goal.description}</span>
              </span>
              <Icon className="mt-1 h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
