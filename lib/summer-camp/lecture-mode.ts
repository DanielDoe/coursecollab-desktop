import type { CampModuleBlock } from "@/lib/summer-camp/types"
import {
  layoutModuleBlocks,
  type ModuleLayoutItem,
} from "@/lib/summer-camp/group-module-blocks"

/** Block types that are always teaching content (no student input). */
const LECTURE_INCLUDE_BLOCK_TYPES = new Set([
  "text",
  "hero",
  "callout",
  "image",
  "image_gallery",
  "video",
  "pdf",
  "code",
  "faculty_cards",
  "mission_objectives",
  "column_grid",
])

/** Block types that always require student interaction — never show in lecture mode. */
const LECTURE_EXCLUDE_BLOCK_TYPES = new Set([
  "checkpoint",
  "quiz",
  "reflection",
  "activity",
  "feedback",
  "confidence",
  "step",
  "profile_form",
  "module_completion",
])

/** Presentational interactive variants (cards, pipelines, walkthrough images — no inputs). */
export const LECTURE_SAFE_INTERACTIVE_VARIANTS = new Set([
  "feature_cards",
  "numbered_steps",
  "wave_cards",
  "concept_cards",
  "topic_deck",
  "hands_on_missions",
  "vertical_pipeline",
  "comparison_table",
  "example_cards",
  "dual_model_compare",
  "ai_type_cards",
  "industrial_compare",
  "industry_sectors",
  "industry_spotlight",
  "pattern_gallery",
  "ai_hierarchy",
  "demo_flow",
  "roadmap_map",
  "training_demo",
  "training_loop",
  "training_simulation",
  "prediction_flow",
  "programming_traditional",
  "programming_ml",
  "ml_compare",
  "capstone_pipeline",
  "capstone_steps",
  "brain_network",
  "dl_applications",
  "project_architecture",
  "data_types_gallery",
  "human_vs_ai",
  "vision_pipeline_compare",
  "cv_feature_pipeline",
  "cat_dog_compare",
  "cv_tasks",
  "od_use_cases",
  "iot_network_flow",
  "sensor_gallery",
  "iot_components",
  "iot_system_flow",
  "data_explosion",
  "iot_ai_pipeline",
  "iot_ai_examples",
  "iot_applications",
  "cloud_flow",
  "cloud_benefits",
  "latency_workflow",
  "cloud_vs_edge",
  "edge_benefits",
  "edge_applications",
  "edge_device_gallery",
  "pi_hardware_preview",
  "edge_journey",
  "edge_ai_formula",
  "intelligence_evolution",
  "edge_ai_architecture",
  "edge_ai_challenges",
  "cloud_vs_pi",
  "tflite_compare",
  "edge_ai_future",
  "pi_hero",
  "desktop_vs_pi",
  "pi_why_love",
  "pi_hardware_explorer",
  "pi_edge_diagram",
  "pi_real_world",
  "camera_module",
  "tool_spotlight",
  "industry_spotlight",
])

export function isLectureContentBlock(block: CampModuleBlock): boolean {
  if (LECTURE_EXCLUDE_BLOCK_TYPES.has(block.block_type)) return false
  if (LECTURE_INCLUDE_BLOCK_TYPES.has(block.block_type)) return true
  if (block.block_type === "interactive") {
    const variant = String((block.content as { variant?: string }).variant ?? "")
    return LECTURE_SAFE_INTERACTIVE_VARIANTS.has(variant)
  }
  return false
}

export function filterBlocksForLecture(blocks: CampModuleBlock[]): CampModuleBlock[] {
  return blocks.filter(isLectureContentBlock)
}

export function layoutLectureModuleBlocks(blocks: CampModuleBlock[]): ModuleLayoutItem[] {
  return layoutModuleBlocks(filterBlocksForLecture(blocks))
}

export function countLectureSlides(layoutItems: ModuleLayoutItem[]): number {
  let count = 0
  for (const item of layoutItems) {
    if (item.type !== "section") continue
    const blocks = item.group.blocks
    if (blocks.length <= 4) {
      const size = blocks.reduce((n, b) => n + JSON.stringify(b.content ?? {}).length, 0)
      count += size <= 3200 ? 1 : Math.ceil(size / 3200)
    } else {
      count += Math.ceil(blocks.length / 4)
    }
  }
  return Math.max(count, 1)
}
