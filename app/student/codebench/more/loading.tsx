import { CodebenchPaneSkeleton } from "@/components/codebench/CodebenchSkeletons"

export default function Loading() {
  return (
    <div className="min-h-screen p-4 sm:p-6">
      <CodebenchPaneSkeleton view="analytics" />
    </div>
  )
}
