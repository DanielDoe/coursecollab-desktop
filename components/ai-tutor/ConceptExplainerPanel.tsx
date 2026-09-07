"use client"

import { StudioToolChatPanel } from "@/components/ai-tutor/StudioToolChatPanel"

type Props = {
  studentId: string
  onClose: () => void
}

/** @deprecated Prefer StudioToolChatPanel with toolId="concept-explainer". */
export function ConceptExplainerPanel({ studentId, onClose }: Props) {
  return <StudioToolChatPanel toolId="concept-explainer" studentId={studentId} onClose={onClose} />
}
