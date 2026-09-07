"use client"

import dynamic from "next/dynamic"
import { CodebenchEditorSkeleton } from "@/components/codebench/CodebenchSkeletons"

const CodeBenchPage = dynamic(
  () => import("@/app/student/codebench/page").then((mod) => mod.default),
  { ssr: false, loading: () => <CodebenchEditorSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2CodebenchIdePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <CodeBenchPage embedded />
    </div>
  )
}
