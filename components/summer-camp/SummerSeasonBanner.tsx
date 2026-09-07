"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "@/components/landing/framer"
import { Sun, X, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getSummerYear,
  isSummerSeason,
  summerBannerStorageKey,
} from "@/lib/summer-season"

const PURPLE = "#582c83"
const GOLD = "#EAAA00"

function scrollToSummerCamp() {
  document.getElementById("summer-camp")?.scrollIntoView({ behavior: "smooth", block: "start" })
}

type SummerSeasonBannerProps = {
  /** Full-bleed strip (legacy) or inset rounded pill matching the marketing landing. */
  variant?: "strip" | "pill"
}

export function SummerSeasonBanner({ variant = "strip" }: SummerSeasonBannerProps) {
  const [visible, setVisible] = useState(false)
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    const now = new Date()
    if (!isSummerSeason(now)) return

    const summerYear = getSummerYear(now)
    const dismissed = localStorage.getItem(summerBannerStorageKey(summerYear)) === "true"
    if (dismissed) return

    setYear(summerYear)
    setVisible(true)
  }, [])

  const dismiss = () => {
    if (year != null) {
      localStorage.setItem(summerBannerStorageKey(year), "true")
    }
    setVisible(false)
  }

  if (year == null) return null

  const isPill = variant === "pill"

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={
            isPill
              ? "relative z-30 overflow-hidden"
              : "relative z-30 overflow-hidden border-b border-amber-200/60 dark:border-amber-500/20"
          }
        >
          <div
            data-summer-banner
            className={
              isPill
                ? "relative rounded-2xl sm:rounded-[1.25rem] shadow-lg shadow-violet-900/15 overflow-hidden"
                : "relative"
            }
            style={{
              background: `linear-gradient(105deg, ${PURPLE} 0%, #6b3a9e 40%, ${GOLD} 100%)`,
            }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                background:
                  "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.35) 50%, transparent 75%)",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />

            <div
              className={
                isPill
                  ? "relative px-3.5 py-3 sm:px-4 sm:py-3.5"
                  : "container mx-auto px-4 sm:px-6 py-3 sm:py-4 relative"
              }
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pr-10">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <motion.div
                    animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.05, 1] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    className="shrink-0 size-9 sm:size-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/25"
                  >
                    <Sun className="h-5 w-5 text-amber-100" />
                  </motion.div>
                  <p className="text-white text-xs leading-snug font-medium sm:text-[15px]">
                    <span className="font-bold">Summer {year} is here!</span>
                    {" 🚀 "}
                    Check out our{" "}
                    <span className="font-semibold">Summer Camp {year}</span>
                    {" "}— hands-on AI, edge computing, and engineering projects.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 sm:ml-auto">
                  {isPill ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={scrollToSummerCamp}
                        className="rounded-xl !border-white/60 !bg-white/15 !text-white h-9 px-4 font-semibold hover:!bg-white/25 hover:!text-white"
                      >
                        Explore camp
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        className="rounded-xl border-0 bg-[#EAAA00] text-violet-950 hover:bg-amber-300 font-semibold shadow-md h-9 px-4"
                      >
                        <Link href="/student/login/summer-camp">Enroll now</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={scrollToSummerCamp}
                        className="rounded-xl !border-0 !bg-white !text-violet-900 shadow-md h-9 px-4 font-semibold hover:!bg-amber-50 hover:!text-violet-950"
                      >
                        Explore camp
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-xl border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white h-9 px-4"
                      >
                        <Link href="/student/login/summer-camp">Enroll now</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors"
                aria-label={`Dismiss Summer ${year} banner`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
