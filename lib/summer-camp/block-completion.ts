import type { CampModuleBlock } from "@/lib/summer-camp/types"

export type BlockProgressMap = Record<string, Record<string, unknown>>

export function isBlockSectionComplete(
  block: CampModuleBlock,
  blockProgress: BlockProgressMap | undefined,
  completedSteps: Set<number>,
  hasSubmission: boolean,
): boolean {
  const progress = blockProgress ?? {}

  if (progress.section_complete?.completed) return true
  if (completedSteps.has(block.id)) return true

  switch (block.block_type) {
    case "step":
      return completedSteps.has(block.id)
    case "checkpoint":
      return hasSubmission
    case "quiz": {
      const quiz = progress.quiz_response as { submitted?: boolean; answers?: Record<string, unknown> } | undefined
      if (!quiz?.submitted) return false
      const questions = (block.content.questions as Array<{ id: string }>) ?? []
      if (questions.length === 0) return true
      const answers = quiz.answers ?? {}
      return questions.every((q) => answers[q.id] != null)
    }
    case "reflection": {
      const ref = progress.reflection as { text?: string; selection?: string; optionIndex?: number } | undefined
      return Boolean(ref?.text?.trim() || ref?.selection?.trim() || ref?.optionIndex != null)
    }
    case "activity": {
      const eng = progress.engagement as { selected?: unknown[]; revealed?: boolean } | undefined
      const options = (block.content.options as string[]) ?? []
      if (options.length > 0) return Boolean(eng?.revealed && (eng.selected?.length ?? 0) > 0)
      return Boolean(progress.section_complete?.completed)
    }
    case "interactive": {
      const variant = String(block.content.variant ?? "")
      const eng = progress.engagement as Record<string, unknown> | undefined
      if (variant === "start_journey") return Boolean(eng?.journeyRevealed)
      return Boolean(progress.section_complete?.completed)
    }
    case "profile_form":
      return Boolean(progress.section_complete?.completed)
    case "feedback": {
      const fb = progress.feedback as Record<string, unknown> | undefined
      return fb?.rating != null || fb?.value != null || Boolean(fb?.submitted)
    }
    case "confidence": {
      const conf = progress.confidence as { level?: number; score?: number } | undefined
      return conf?.level != null || conf?.score != null
    }
    case "module_completion":
      return true
    default:
      return Boolean(progress.section_complete?.completed)
  }
}

/** Passive blocks that need an explicit Continue action */
export function blockNeedsContinueAction(block: CampModuleBlock): boolean {
  const passive = new Set([
    "text",
    "hero",
    "callout",
    "code",
    "image",
    "image_gallery",
    "faculty_cards",
    "video",
    "pdf",
    "mission_objectives",
  ])
  if (passive.has(block.block_type)) return true
  if (block.block_type === "interactive") {
    const selfComplete = new Set(["start_journey"])
    return !selfComplete.has(String(block.content.variant ?? ""))
  }
  if (block.block_type === "activity") {
    const options = (block.content.options as string[]) ?? []
    return options.length === 0
  }
  return false
}
