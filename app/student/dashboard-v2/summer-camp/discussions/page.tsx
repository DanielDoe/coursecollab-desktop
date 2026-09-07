"use client"

import Link from "next/link"
import { MessageCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"

type DiscussionsHub = {
  my_questions: Array<{
    id: number
    title: string | null
    body: string
    status: string
    module_id: number
    module_title: string
    training_title: string
    updated_at: string
  }>
  training_discussions: Array<{
    id: number
    title: string | null
    body: string
    status: string
    module_title: string
    training_title: string
    is_mine: boolean
  }>
  instructor_announcements: Array<{ id: number; title: string; body: string; date: string | null }>
  resolved_questions: Array<{ id: number; title: string | null; status: string }>
}

function ThreadList({
  items,
  showTraining,
}: {
  items: Array<{
    id: number
    title: string | null
    body?: string
    status: string
    module_id?: number
    module_title?: string
    training_title?: string
  }>
  showTraining?: boolean
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nothing here yet.</p>
  }
  return (
    <ul className="space-y-3">
      {items.map((q) => (
        <li key={q.id}>
          <Link
            href={q.module_id ? campRoute(`/module/${q.module_id}`) : "#"}
            className="block rounded-xl border border-slate-200/80 dark:border-white/10 p-4 hover:border-violet-500/40"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">{q.title ?? "Question"}</p>
              <Badge variant="outline" className="text-xs">{q.status}</Badge>
            </div>
            {q.body && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{q.body}</p>}
            {showTraining && q.training_title && (
              <p className="text-xs text-slate-400 mt-1">{q.training_title} · {q.module_title}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function DiscussionsHelpPage() {
  const { data, loading } = useCampHub<DiscussionsHub>("discussions")

  return (
    <CamperPageShell
      icon={MessageCircle}
      title="Discussions & Help"
      subtitle="Ask questions, follow training threads, and read instructor announcements."
      loading={loading}
    >
      <Tabs defaultValue="my-questions">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
          <TabsTrigger value="my-questions" className="text-xs sm:text-sm">My Questions</TabsTrigger>
          <TabsTrigger value="training" className="text-xs sm:text-sm">Training Discussions</TabsTrigger>
          <TabsTrigger value="announcements" className="text-xs sm:text-sm">Announcements</TabsTrigger>
          <TabsTrigger value="resolved" className="text-xs sm:text-sm">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="my-questions" className="mt-4">
          <ThreadList items={data?.my_questions ?? []} showTraining />
        </TabsContent>
        <TabsContent value="training" className="mt-4">
          <ThreadList items={data?.training_discussions ?? []} showTraining />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <ul className="space-y-3">
            {(data?.instructor_announcements ?? []).map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200/80 dark:border-white/10 p-4">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{a.body}</p>
                {a.date && <p className="text-xs text-slate-400 mt-2">{a.date}</p>}
              </li>
            ))}
            {(data?.instructor_announcements?.length ?? 0) === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">No announcements yet.</p>
            )}
          </ul>
        </TabsContent>
        <TabsContent value="resolved" className="mt-4">
          <ThreadList
            items={(data?.resolved_questions ?? []).map((q) => ({
              ...q,
              body: "",
              module_id: undefined,
            }))}
          />
        </TabsContent>
      </Tabs>
    </CamperPageShell>
  )
}
