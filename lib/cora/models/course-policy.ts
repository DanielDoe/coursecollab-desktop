import type { CoraModelProfile } from "@/lib/cora/models/types"

/** Faculty course policy — never a provider marketing name. */
export type CoraCourseRoutingPolicy = "auto" | "standard" | "reasoning"

export const CORA_COURSE_ROUTING_OPTIONS: Array<{
  value: CoraCourseRoutingPolicy
  label: string
  note: string
}> = [
  {
    value: "auto",
    label: "Smart routing",
    note: "Cora picks the least expensive capable profile for each task",
  },
  {
    value: "standard",
    label: "Everyday Cora",
    note: "Standard and Tutor. Advanced Reasoning stays off",
  },
  {
    value: "reasoning",
    label: "Allow Advanced Reasoning",
    note: "Permits expensive reasoning for difficult STEM and exams",
  },
]

export function normalizeCoraCourseRoutingPolicy(raw?: string | null): CoraCourseRoutingPolicy {
  const v = (raw || "").trim().toLowerCase()
  if (v === "standard" || v === "tutor" || v === "fast") return "standard"
  if (v === "reasoning" || v === "advanced_reasoning" || v === "advanced") return "reasoning"
  return "auto"
}

export function applyCourseRoutingPolicy(
  profile: CoraModelProfile,
  policy?: CoraCourseRoutingPolicy | null,
): CoraModelProfile {
  if (policy === "standard" && (profile === "reasoning" || profile === "advanced_reasoning")) {
    return "tutor"
  }
  return profile
}

export function coraCourseRoutingLabel(policy: CoraCourseRoutingPolicy): string {
  return CORA_COURSE_ROUTING_OPTIONS.find((o) => o.value === policy)?.label ?? "Smart routing"
}
