"use client"

import { motion } from "framer-motion"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { UserCheck, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface EmbedPageProps {
  src: string
  title: string
  /** Optional icon - defaults to UserCheck for attendance */
  icon?: React.ComponentType<{ className?: string }>
  /** Optional description */
  description?: string
  /** Optional external link URL */
  externalHref?: string
  externalLabel?: string
}

export function EmbedPage({
  src,
  title,
  icon: Icon = UserCheck,
  description,
  externalHref,
  externalLabel = "Open full page",
}: EmbedPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full min-w-0"
    >
      <CardWrapper delay={0} hover={false}>
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-teal-500/10 dark:bg-teal-500/15 shrink-0">
                <Icon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100">
                  {title}
                </h2>
                {description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    {description}
                  </p>
                )}
              </div>
            </div>
            {externalHref && (
              <Link href={externalHref} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2 shrink-0">
                  <ExternalLink className="h-4 w-4" />
                  {externalLabel}
                </Button>
              </Link>
            )}
          </div>
          <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden bg-slate-50/50 dark:bg-slate-900/30 min-h-[60vh]">
            <iframe
              src={src}
              title={title}
              className="w-full h-[70vh] min-h-[400px] sm:min-h-[500px] border-0"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
        </div>
      </CardWrapper>
    </motion.div>
  )
}
