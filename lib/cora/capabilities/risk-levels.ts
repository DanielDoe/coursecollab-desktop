/**
 * Unified Cora action risk levels (Student + Faculty + Admin).
 *
 * The LLM cannot choose risk — registries + confirmation runtime do.
 */

/** Canonical five-level scale. */
export type CoraActionRisk = "R0" | "R1" | "R2" | "R3" | "R4"

/**
 * Extra permission classes that never inherit from a sibling capability.
 * Even admins need an explicit grant for these.
 */
export type CoraSpecialRiskClass =
  | "FINANCIAL_RESTRICTED"
  | "CRITICAL_EXTERNAL_ACTION"

export type CoraRiskClassification = CoraActionRisk | CoraSpecialRiskClass

/** Legacy faculty/confirm UI vocabulary — still accepted at boundaries. */
export type CoraLegacyRisk = "none" | "confirm" | "high" | "forbidden"

export const CORA_ACTION_RISK_META: Record<
  CoraActionRisk,
  { label: string; behavior: string; examples: string }
> = {
  R0: {
    label: "Read",
    behavior: "Execute immediately",
    examples: "Search lectures, analyze results, system health read",
  },
  R1: {
    label: "Personal reversible",
    behavior: "Execute or lightweight confirmation",
    examples: "Student creates a note or flashcard deck",
  },
  R2: {
    label: "Course mutation",
    behavior: "Preview/confirm depending on context",
    examples: "Faculty creates quiz draft, updates syllabus section",
  },
  R3: {
    label: "Consequential",
    behavior: "Explicit confirmation required",
    examples: "Publish exam, send announcement, change grade",
  },
  R4: {
    label: "Institutional / Critical",
    behavior: "Strong confirmation + elevated permission + audit",
    examples: "Role change, bulk deletion, global config, emergency broadcast",
  },
}

const ACTION_ORDER: CoraActionRisk[] = ["R0", "R1", "R2", "R3", "R4"]

export function maxActionRisk(levels: CoraActionRisk[]): CoraActionRisk {
  let max: CoraActionRisk = "R0"
  for (const level of levels) {
    if (ACTION_ORDER.indexOf(level) > ACTION_ORDER.indexOf(max)) max = level
  }
  return max
}

export function requiresConfirmation(risk: CoraActionRisk): boolean {
  return risk === "R2" || risk === "R3" || risk === "R4"
}

export function requiresStrongConfirmation(risk: CoraActionRisk): boolean {
  return risk === "R3" || risk === "R4"
}

/** Map legacy confirm vocabulary → R-scale (forbidden stays denial, not a risk). */
export function legacyRiskToAction(risk: CoraLegacyRisk): CoraActionRisk | null {
  switch (risk) {
    case "none":
      return "R0"
    case "confirm":
      return "R2"
    case "high":
      return "R3"
    case "forbidden":
      return null
    default:
      return "R2"
  }
}

export function actionRiskToLegacy(risk: CoraActionRisk): Exclude<CoraLegacyRisk, "forbidden"> {
  switch (risk) {
    case "R0":
      return "none"
    case "R1":
      return "confirm"
    case "R2":
      return "confirm"
    case "R3":
    case "R4":
      return "high"
    default:
      return "confirm"
  }
}

export function isSpecialRiskClass(value: string): value is CoraSpecialRiskClass {
  return value === "FINANCIAL_RESTRICTED" || value === "CRITICAL_EXTERNAL_ACTION"
}
