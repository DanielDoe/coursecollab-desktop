/**
 * Propose-time routing: registry capability_id → dedicated propose_* tool or generic proposal card.
 */

import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import type { CoraCapabilityRole } from "@/lib/cora/capabilities/capability-dedicated-tool-map"
import { getDedicatedProposeTool } from "@/lib/cora/capabilities/capability-dedicated-tool-map"
import type { CoraSession } from "@/lib/cora/security/types"
import {
  buildRegistryCapabilityProposal,
  formatRegistryCapabilityProposalResult,
  validateRegistryCapability,
} from "@/lib/cora/services/capability-propose"
import { resolveFacultyModuleForCapability } from "@/lib/cora/capabilities/faculty-tool-registry"
import { resolveStudentModuleForCapability } from "@/lib/cora/capabilities/student-tool-registry"
import { getFacultyModuleCapability } from "@/lib/cora/capabilities/faculty-module-registry"
import { getStudentModuleCapability } from "@/lib/cora/capabilities/student-module-registry"

export function mapCapabilityArgsToDedicatedTool(
  dedicatedTool: CoraAgentToolName,
  capabilityArgs: Record<string, unknown>,
  meta: { previewTitle?: string; previewSummary?: string },
): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...capabilityArgs }

  if (mapped.bodyText != null && mapped.content == null) {
    mapped.content = mapped.bodyText
  }
  if (mapped.body != null && mapped.content == null) {
    mapped.content = mapped.body
  }
  if (meta.previewTitle && mapped.title == null) {
    mapped.title = meta.previewTitle
  }
  if (meta.previewSummary && mapped.focus == null && dedicatedTool === "propose_study_plan") {
    mapped.focus = meta.previewSummary
  }

  if (dedicatedTool === "propose_announcement") {
    return {
      title: mapped.title ?? meta.previewTitle,
      body: mapped.body ?? mapped.bodyText ?? mapped.content ?? meta.previewSummary,
      publish: mapped.publish,
      section_id: mapped.section_id ?? mapped.sectionId,
    }
  }

  if (dedicatedTool === "create_faculty_flashcard_deck") {
    return {
      topic: mapped.topic ?? meta.previewSummary ?? meta.previewTitle,
      card_count: mapped.card_count ?? mapped.cardCount,
      section_id: mapped.section_id ?? mapped.sectionId,
    }
  }

  if (dedicatedTool === "propose_assessment_from_bank") {
    return {
      quiz_title: mapped.quiz_title ?? mapped.title ?? meta.previewTitle,
      topic: mapped.topic,
      question_ids: mapped.question_ids ?? mapped.questionIds,
      question_count: mapped.question_count ?? mapped.questionCount,
      assessment_type: mapped.assessment_type ?? mapped.assessmentType,
      publish: mapped.publish,
    }
  }

  return mapped
}

export type RegistryCapabilityProposeInput = {
  role: CoraCapabilityRole
  session: CoraSession
  capabilityId: string
  capabilityArgs: Record<string, unknown>
  previewTitle: string
  previewSummary: string
  confirmLabel?: string
  courseId?: number | null
  courseLabel?: string | null
  /** Delegate to dedicated propose_* tool when mapped. */
  executeDedicatedTool: (
    toolName: CoraAgentToolName,
    args: Record<string, unknown>,
  ) => Promise<string>
}

export async function proposeRegistryCapability(
  input: RegistryCapabilityProposeInput,
): Promise<string> {
  const validationError = validateRegistryCapability(input.role, input.capabilityId)
  if (validationError) {
    return `Error: ${validationError}`
  }

  const dedicated = getDedicatedProposeTool(input.role, input.capabilityId)
  if (dedicated) {
    const delegatedArgs = mapCapabilityArgsToDedicatedTool(dedicated, input.capabilityArgs, {
      previewTitle: input.previewTitle,
      previewSummary: input.previewSummary,
    })
    const result = await input.executeDedicatedTool(dedicated, delegatedArgs)
    return [
      `*(Auto-routed \`${input.capabilityId}\` → \`${dedicated}\` for best schema fit.)*`,
      "",
      result,
    ].join("\n")
  }

  const moduleId =
    input.role === "faculty"
      ? resolveFacultyModuleForCapability(input.capabilityId)
      : resolveStudentModuleForCapability(input.capabilityId)
  const mod =
    input.role === "faculty"
      ? moduleId
        ? getFacultyModuleCapability(moduleId)
        : null
      : moduleId
        ? getStudentModuleCapability(moduleId)
        : null

  const proposal = buildRegistryCapabilityProposal({
    role: input.role,
    session: input.session,
    capabilityId: input.capabilityId,
    capabilityArgs: input.capabilityArgs,
    previewTitle: input.previewTitle,
    previewSummary: input.previewSummary,
    confirmLabel: input.confirmLabel,
    courseId: input.courseId,
    courseLabel: input.courseLabel,
  })

  return formatRegistryCapabilityProposalResult({
    role: input.role,
    capabilityId: input.capabilityId,
    moduleLabel: mod?.label ?? null,
    proposal,
  })
}
