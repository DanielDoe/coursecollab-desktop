"use client"

import Link from "next/link"
import { Upload, CheckCircle2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"

type CheckpointsHub = {
  pending: Array<{
    block_id: number
    module_id: number
    module_title: string
    training_title: string
    content: { title?: string }
  }>
  approved: Array<{
    submission_id: number
    module_id: number
    module_title: string
    training_title: string
    content: { title?: string }
    status: string
    file_name: string | null
  }>
}

export default function CheckpointsPage() {
  const { data, loading } = useCampHub<CheckpointsHub>("checkpoints")

  return (
    <CamperPageShell
      icon={Upload}
      title="Checkpoints & Submissions"
      subtitle="What you need to submit — and what your mentors have approved."
      loading={loading}
    >
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-amber-600" />
          Pending
        </h2>
        {(data?.pending?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nothing pending — you&apos;re all caught up!</p>
        ) : (
          <ul className="space-y-3">
            {data!.pending.map((cp) => (
              <li key={cp.block_id}>
                <Link
                  href={campRoute(`/module/${cp.module_id}`)}
                  className="block rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-4 hover:border-violet-500/40"
                >
                  <p className="font-medium">{cp.content?.title ?? "Submit checkpoint"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cp.training_title} · {cp.module_title}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Approved
        </h2>
        {(data?.approved?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Approved submissions will appear here.</p>
        ) : (
          <ul className="space-y-3">
            {data!.approved.map((s) => (
              <li
                key={s.submission_id}
                className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{s.content?.title ?? s.module_title}</p>
                  <Badge variant="outline" className="text-xs">{s.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.training_title}</p>
                {s.file_name && <p className="text-xs text-slate-400 mt-0.5">{s.file_name}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </CamperPageShell>
  )
}
