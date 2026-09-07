import type { CoraScopeMode } from "@/lib/cora/scope/types"

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]
  if (raw == null || raw === "") return defaultValue
  return !/^(0|false|off|no)$/i.test(raw)
}

/** Scope guardrail runtime config (purpose policy — not subject toggles). */
export function getCoraScopeConfig(): {
  mode: CoraScopeMode
  allowGeneralEducationalTopics: boolean
  allowCareerStudentSuccess: boolean
  allowResearchTopics: boolean
  allowProfessionalAcademicTopics: boolean
} {
  const raw = String(process.env.CORA_SCOPE_MODE ?? "observe").trim().toLowerCase()
  const mode: CoraScopeMode =
    raw === "off" || raw === "enforce" || raw === "observe" ? raw : "observe"

  return {
    mode,
    allowGeneralEducationalTopics: envFlag("CORA_SCOPE_ALLOW_GENERAL_EDUCATION", true),
    allowCareerStudentSuccess: envFlag("CORA_SCOPE_ALLOW_CAREER", true),
    allowResearchTopics: envFlag("CORA_SCOPE_ALLOW_RESEARCH", true),
    allowProfessionalAcademicTopics: envFlag("CORA_SCOPE_ALLOW_PROFESSIONAL", true),
  }
}
