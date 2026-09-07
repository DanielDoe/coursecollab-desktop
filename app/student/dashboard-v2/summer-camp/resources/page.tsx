"use client"

import Link from "next/link"
import { Library, FileText, Video, Code2, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"

type ResourcesHub = {
  trainings: Array<{
    training_id: number
    training_title: string
    resources: Array<{
      id: number
      type: string
      title: string
      module_title: string
      url?: string
      description?: string
    }>
  }>
}

const TYPE_ICON: Record<string, typeof FileText> = {
  pdf: FileText,
  video: Video,
  code: Code2,
  text: FileText,
  image_gallery: FileText,
}

export default function CampResourcesPage() {
  const { data, loading } = useCampHub<ResourcesHub>("resources")

  return (
    <CamperPageShell
      icon={Library}
      title="Resources"
      subtitle="PDFs, slides, videos, code templates, and datasets for your trainings."
      loading={loading}
    >
      {(data?.trainings?.length ?? 0) === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Resources from your enrolled modules will appear here.</p>
      ) : (
        <div className="space-y-8">
          {data!.trainings.map((t) => (
            <section key={t.training_id}>
              <h2 className="text-lg font-bold mb-3">{t.training_title}</h2>
              <ul className="space-y-2">
                {t.resources.map((r) => {
                  const Icon = TYPE_ICON[r.type] ?? FileText
                  return (
                    <li
                      key={r.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-white/10 p-4"
                    >
                      <Icon className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{r.title}</p>
                          <Badge variant="outline" className="text-xs">{r.type}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{r.module_title}</p>
                        {r.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {r.description}
                          </p>
                        )}
                      </div>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-600 shrink-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </CamperPageShell>
  )
}
