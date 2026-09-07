/** Typed Cora UI payloads. Do not render fake Markdown buttons. */

export type CoraUiAction = {
  label: string
  route?: string
  actionId?: string
}

export type CoraUiPayload =
  | { type: "text_response"; message: string }
  | {
      type: "confirmation"
      message: string
      actionId: string
      preview: Record<string, unknown>
      actions: CoraUiAction[]
    }
  | {
      type: "created_resource"
      message: string
      resource: { type: string; id: string | number; title?: string }
      actions?: CoraUiAction[]
    }
  | { type: "walkthrough"; title: string; objective?: string; steps: unknown[] }
  | { type: "assessment_preview"; message: string; count: number; data: unknown }
  | { type: "question_preview"; message: string; count: number; data: unknown }
  | { type: "analytics"; message: string; data: unknown }
  | { type: "progress_summary"; message: string; data: unknown }
  | { type: "error"; message: string; code?: string }
  | { type: "permission_denied"; message: string }
  | { type: "insufficient_credits"; message: string; needed?: number; available?: number }

export function coraUiFromProposals(
  message: string,
  proposals?: Array<{ actionId: string; preview?: Record<string, unknown> }> | null,
): CoraUiPayload | undefined {
  if (!proposals?.length) return undefined
  const first = proposals[0]!
  return {
    type: "confirmation",
    message,
    actionId: first.actionId,
    preview: first.preview ?? {},
    actions: proposals.map((p) => ({ label: "Confirm", actionId: p.actionId })),
  }
}
