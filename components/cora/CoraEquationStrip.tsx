"use client"

import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

type Props = {
  equations: { id: string; latex: string }[]
  accent: string
}

export function CoraEquationStrip({ equations, accent }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--cc-background)]/80 p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">Equations</p>
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="popLayout">
          {equations.map((eq, i) => (
            <motion.div
              key={eq.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, duration: 0.3 }}
              className="flex flex-col items-center gap-1"
            >
              <code className="rounded-lg bg-[var(--muted)]/50 px-4 py-2 font-mono text-base sm:text-lg text-[var(--cc-text)]">
                {eq.latex}
              </code>
              {i < equations.length - 1 ? (
                <motion.span
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  className={cn("h-4 w-px bg-gradient-to-b", accent)}
                />
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
