"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CircuitWorkspaceExpandedDialog } from "@/components/circuit-workspace-expanded-dialog"
import { createEmptyWorkspace } from "@/lib/circuit-workspace"

/** Local-only workspace sandbox — blocked in production via middleware (404 on /dev/*). */
export default function DevWorkspacePage() {
  const [workspace, setWorkspace] = useState(createEmptyWorkspace)
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="h-[100dvh] p-4 bg-slate-100 dark:bg-slate-950 flex flex-col gap-3">
      <Button type="button" className="w-fit" onClick={() => setExpanded(true)}>
        Open expanded workspace
      </Button>
      <CircuitWorkspaceExpandedDialog
        open={expanded}
        onOpenChange={setExpanded}
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        onSave={async (snapshot) => {
          setWorkspace(snapshot)
          return true
        }}
        question={{
          question_text: "Dev sandbox — draw here to test pen smoothness and tool switching.",
          title: "Workspace test",
        }}
      />
    </div>
  )
}
