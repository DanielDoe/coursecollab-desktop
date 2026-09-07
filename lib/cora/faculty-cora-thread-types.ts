import type { FacultyCoraCapabilityId } from "@/lib/cora/faculty-capabilities"

export type FacultyCoraStoredMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  actions?: Array<{
    id: string
    label: string
    kind: string
    payload: Record<string, unknown>
  }>
  proposals?: import("@/lib/cora/confirmations/action-proposals").CoraActionProposal[]
  proposalStatusById?: Record<string, "idle" | "confirming" | "done" | "error">
  proposalResultById?: Record<string, unknown>
  plans?: import("@/lib/cora/confirmations/transaction-plans").CoraTransactionPlan[]
  importedQuestion?: Record<string, unknown>
  importedQuestionLabel?: string
  timestamp?: string
}

export type FacultyCoraChatThread = {
  id: string
  title: string
  preview: string
  capabilityId?: FacultyCoraCapabilityId | string
  messages: FacultyCoraStoredMessage[]
  createdAt: string
  updatedAt: string
  titleIsCustom?: boolean
  archivedAt?: string
}
