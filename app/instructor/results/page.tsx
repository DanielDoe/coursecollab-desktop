"use client"

import { ResultsViewer } from "@/components/results-viewer"

export default function InstructorResultsPage() {
    return (
    <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <ResultsViewer userType="instructor" />
    </div>
  )
}
