"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { getAdminData } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import {
  InstructorRequestWorkspace,
  type InstructorRequestBundle,
} from "@/components/instructor/recommendations/instructor-request-workspace"

export default function InstructorRecommendationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = String(params.requestId ?? "")
  const [bundle, setBundle] = useState<InstructorRequestBundle | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const inst = getAdminData()
    if (!inst?.id) {
      setErr("Not signed in")
      return
    }
    const res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}`, {
      headers: { "x-instructor-id": String(inst.id) },
    })
    const j = await res.json()
    if (!res.ok) throw new Error(j.error || "Failed")
    setBundle({
      request: j.request,
      settings: j.settings ?? null,
      profile: j.profile ?? null,
      drafts: j.drafts || [],
      attachments: j.attachments || [],
      audit: j.audit || [],
    })
  }, [requestId])

  useEffect(() => {
    ;(async () => {
      try {
        setErr(null)
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed")
        setBundle(null)
      }
    })()
  }, [load])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full min-w-0 max-w-4xl xl:max-w-7xl 2xl:max-w-[min(100%,92rem)]"
    >
      <div className="flex flex-col gap-4 sm:gap-5">
        <CardWrapper delay={0} hover={false}>
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-6 min-w-0">
            <header className="border-b border-slate-200/80 dark:border-white/[0.08] pb-4">
              <div className="flex flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white min-w-0">
                  Request workspace
                </h1>
                <Button
                  variant="ghost"
                  asChild
                  size="sm"
                  className="-mr-1 -mt-0.5 shrink-0 gap-2 text-slate-600 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-400"
                >
                  <Link href="/admin/dashboard-v2/recommendations/all">
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    All requests
                  </Link>
                </Button>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
                Request #{requestId} · Drafts, questionnaire review, and final approval.
              </p>
            </header>

            {err && (
              <p className="text-sm text-red-600 dark:text-red-400 rounded-xl border border-red-200/80 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2">
                {err}
              </p>
            )}

            {!bundle && !err && (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center">Loading…</p>
            )}

            {bundle ? (
              <InstructorRequestWorkspace
                requestId={requestId}
                bundle={bundle}
                showDetailLink={false}
                onAfterMutation={load}
                onRequestDeleted={() => router.push("/admin/dashboard-v2/recommendations/all")}
              />
            ) : null}
          </div>
        </CardWrapper>
      </div>
    </motion.div>
  )
}
