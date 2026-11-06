import type { AiGradingTask, AiModelPreset } from "@/lib/ai-model-catalog"
import { DEFAULT_OPUS_CONFIDENCE_THRESHOLD } from "@/lib/ai-model-catalog"

export type ProjectCoraPolicy = "off" | "guided" | "full"

export type ProjectCopyPastePolicy = "allowed" | "tracked" | "blocked"

export type ProjectIntegritySettings = {
  strict_mode: boolean
  copy_paste: ProjectCopyPastePolicy
  track_paste: boolean
  track_focus: boolean
  prefer_fullscreen: boolean
  track_editing_activity: boolean
  cora_policy: ProjectCoraPolicy
  require_citations: boolean
  require_workspace_editing: boolean
  external_upload_policy: "allowed" | "restricted" | "blocked"
  require_group_confirmation: boolean
  disclaimer?: string
}

export type ProjectSectionIntegrityOverride = Partial<ProjectIntegritySettings>

export type ProjectAiStrictness = "relaxed" | "standard" | "strict" | "very_strict"

export type ProjectAiGradingSettings = {
  scope: "whole_project" | "section_by_section"
  strictness: ProjectAiStrictness
  auto_run_on_submit: boolean
  require_review_below_confidence: number
  model_feature: string
  ai_model: AiModelPreset
  ai_model_by_task: Partial<Record<AiGradingTask, AiModelPreset>> | null
  ai_enable_opus_fallback: boolean
  ai_opus_confidence_threshold: number
}

export type ProjectFeedbackReleaseSettings = {
  show_final_grade: boolean
  show_section_scores: boolean
  show_rubric_results: boolean
  show_instructor_feedback: boolean
  show_ai_grading_feedback: boolean
  show_voting_component: boolean
  show_individual_adjustment: boolean
  show_calculation_breakdown: boolean
}

export const DEFAULT_PROJECT_INTEGRITY_SETTINGS = (): ProjectIntegritySettings => ({
  strict_mode: false,
  copy_paste: "allowed",
  track_paste: false,
  track_focus: false,
  prefer_fullscreen: false,
  track_editing_activity: true,
  cora_policy: "guided",
  require_citations: false,
  require_workspace_editing: true,
  external_upload_policy: "allowed",
  require_group_confirmation: true,
  disclaimer:
    "Integrity controls provide evidence and deterrence. They do not guarantee academic integrity on their own.",
})

export const DEFAULT_AI_GRADING_SETTINGS = (): ProjectAiGradingSettings => ({
  scope: "section_by_section",
  strictness: "standard",
  auto_run_on_submit: false,
  require_review_below_confidence: 0.65,
  model_feature: "project_ai_grade",
  ai_model: "auto",
  ai_model_by_task: null,
  ai_enable_opus_fallback: true,
  ai_opus_confidence_threshold: DEFAULT_OPUS_CONFIDENCE_THRESHOLD,
})

export const DEFAULT_FEEDBACK_RELEASE = (): ProjectFeedbackReleaseSettings => ({
  show_final_grade: true,
  show_section_scores: true,
  show_rubric_results: true,
  show_instructor_feedback: true,
  show_ai_grading_feedback: true,
  show_voting_component: true,
  show_individual_adjustment: false,
  show_calculation_breakdown: true,
})