/**
 * Institution research analytics — capability audit (Phase 1).
 * Do not compute research outcomes that are not instrumented or study-designed.
 */

export type MetricEvidence = "descriptive" | "derived" | "inferred" | "research_outcome"
export type MetricAvailability = "available_now" | "requires_instrumentation" | "requires_research_design"

export type ResearchCapability = {
  id: string
  label: string
  domain: string
  evidence: MetricEvidence
  availability: MetricAvailability
  formula?: string
  sourceTables?: string[]
  unblock?: string
}

export const RESEARCH_CAPABILITIES: ResearchCapability[] = [
  {
    id: "students_covered",
    label: "Students covered",
    domain: "overview",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Distinct enrolled students on license-covered courses, not deleted.",
    sourceTables: ["students", "institution_license_scopes"],
  },
  {
    id: "active_students",
    label: "Active students",
    domain: "overview",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Distinct covered students with a quiz or practice attempt in the selected period.",
    sourceTables: ["quiz_attempts", "practice_attempts"],
  },
  {
    id: "ai_assisted_students",
    label: "AI assisted students",
    domain: "ai_assistance",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Distinct student user_id rows in institution_cora_usage in the period.",
    sourceTables: ["institution_cora_usage"],
  },
  {
    id: "practice_accuracy",
    label: "Practice accuracy",
    domain: "learning",
    evidence: "derived",
    availability: "available_now",
    formula: "Mean score_percentage on completed practice_attempts. Hidden when N < 10 students.",
    sourceTables: ["practice_attempts"],
  },
  {
    id: "concept_topic_accuracy",
    label: "Topic accuracy (practice)",
    domain: "learning",
    evidence: "derived",
    availability: "available_now",
    formula: "Mean correctness of practice answers joined to question_bank.topic. Topics missing if bank is untagged.",
    sourceTables: ["practice_answers", "question_bank"],
    unblock: "Tag question_bank.topic on a larger share of items to enable concept heatmaps.",
  },
  {
    id: "assessment_volume",
    label: "Assessment volume and scores",
    domain: "assessment",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Completed quiz_attempts count and mean/median score on covered courses.",
    sourceTables: ["quiz_attempts", "quizzes"],
  },
  {
    id: "automated_feedback",
    label: "Automated feedback events",
    domain: "assessment",
    evidence: "descriptive",
    availability: "available_now",
    formula: "quiz_answers with ai_feedback.aiGraded = true.",
    sourceTables: ["quiz_answers"],
  },
  {
    id: "cora_workflow_mix",
    label: "Cora workflow mix",
    domain: "ai_assistance",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Counts by institution_cora_usage.workflow_type. This is a product workflow, not an assistance taxonomy.",
    sourceTables: ["institution_cora_usage"],
  },
  {
    id: "attention_flags",
    label: "Students needing attention",
    domain: "student_success",
    evidence: "derived",
    availability: "available_now",
    formula: "Heuristic: inactivity ≥14 days, missing submissions, or declining recent quiz scores. Not a validated risk model.",
    sourceTables: ["quiz_attempts", "practice_attempts"],
  },
  {
    id: "assistance_taxonomy",
    label: "AI assistance type (hint, explanation, worked example…)",
    domain: "ai_assistance",
    evidence: "inferred",
    availability: "available_now",
    formula: "Heuristic classification on Cora turns stored in ai_learning_interactions.",
    sourceTables: ["ai_learning_interactions"],
    unblock: "Charts appear after ≥10 classified interactions in the selected period.",
  },
  {
    id: "assistance_depth",
    label: "Assistance depth (0–5)",
    domain: "ai_assistance",
    evidence: "inferred",
    availability: "available_now",
    formula: "Depth mapped from inferred assistance type. Deeper is not assumed better.",
    sourceTables: ["ai_learning_interactions"],
    unblock: "Requires classified Cora interactions on institution-covered courses.",
  },
  {
    id: "attempt_before_ai",
    label: "Attempt before AI / follow-through",
    domain: "cognitive",
    evidence: "derived",
    availability: "available_now",
    formula: "Share of Cora sessions with practice in the prior 24h, no practice in the prior 7d, or practice in the next 24h.",
    sourceTables: ["institution_cora_usage", "practice_attempts"],
    unblock: "Same-problem escalation still requires concept-linked Cora turns. These rates are behavioral timestamps, not cognition.",
  },
  {
    id: "learning_trajectories",
    label: "Learning trajectories",
    domain: "cognitive",
    evidence: "derived",
    availability: "available_now",
    formula: "Weekly roster × practice accuracy bands: not attempted / emerging / developing / proficient / mastered.",
    sourceTables: ["students", "practice_attempts"],
    unblock: "Bands are derived cut-points, not a validated mastery model.",
  },
  {
    id: "independent_performance",
    label: "Independent performance",
    domain: "independent",
    evidence: "derived",
    availability: "requires_instrumentation",
    formula: "Mean score on assessments tagged AI_RESTRICTED, AI_UNAVAILABLE, or INDEPENDENT_CHECK.",
    sourceTables: ["quizzes", "quiz_attempts"],
    unblock: "Instructors must set quizzes.ai_policy. Scores stay hidden until tagged independent attempts exist.",
  },
  {
    id: "transfer_score",
    label: "AI-to-independent transfer",
    domain: "independent",
    evidence: "derived",
    availability: "requires_instrumentation",
    formula: "Next independent-tagged quiz within 14 days after a Cora session. Contrast: delayed (>14d) and no-prior-Cora when N≥10.",
    sourceTables: ["institution_cora_usage", "quizzes", "quiz_attempts"],
    unblock: "Tag later assessments as independent. Descriptive association only — not an AI effect.",
  },
  {
    id: "pre_post_gain",
    label: "Pre/post learning gain",
    domain: "learning",
    evidence: "research_outcome",
    availability: "available_now",
    formula: "raw gain = post − pre; normalized gain = (post − pre) / (max − pre) on paired quiz attempts.",
    sourceTables: ["institution_research_instruments", "institution_research_studies", "quiz_attempts"],
    unblock: "Create a pre/post study and link pre & post quiz IDs via POST /api/institution/research/instruments.",
  },
  {
    id: "ai_causal_effect",
    label: "Causal AI effect",
    domain: "research",
    evidence: "research_outcome",
    availability: "requires_research_design",
    unblock: "Requires an authorized experiment with explicit assignment. AI user vs non-user is not a causal estimate.",
  },
  {
    id: "study_builder",
    label: "Research study builder",
    domain: "research",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Persisted study design, outcome, window, and authorization note. Never assigns treatments.",
    sourceTables: ["institution_research_studies"],
  },
  {
    id: "research_cohorts",
    label: "Research cohorts",
    domain: "research",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Activity filters: roster, Cora, no Cora, practice, assessment, independent-tagged.",
    sourceTables: ["institution_research_cohorts"],
  },
  {
    id: "group_comparison",
    label: "Group comparison",
    domain: "research",
    evidence: "derived",
    availability: "available_now",
    formula: "Per-cohort n, mean, median, SD when N≥10. Mean difference and Cohen's d. No p-values.",
    unblock: "Need two cohorts with N ≥ 10 each. Contrast is descriptive, not a confirmatory test.",
  },
  {
    id: "research_exports",
    label: "Research exports",
    domain: "research",
    evidence: "descriptive",
    availability: "available_now",
    formula: "CSV of de-identified research IDs. Names and emails are never exported. Each download is logged.",
    sourceTables: ["institution_research_export_logs"],
  },
  {
    id: "mixed_effects_export",
    label: "Mixed-effects panel export",
    domain: "research",
    evidence: "descriptive",
    availability: "available_now",
    formula: "Long-format student-week rows for lmer(y ~ time + (1|id)). CourseCollab does not estimate the model.",
    sourceTables: ["practice_attempts", "quiz_attempts", "institution_cora_usage"],
  },
  {
    id: "longitudinal_panel",
    label: "Longitudinal panel",
    domain: "longitudinal",
    evidence: "derived",
    availability: "available_now",
    formula: "Repeated weekly observations, completeness, and learners with 2+ weeks. Not a growth-curve fit.",
    sourceTables: ["students", "practice_attempts", "quiz_attempts"],
  },
  {
    id: "delayed_transfer",
    label: "Delayed transfer windows",
    domain: "longitudinal",
    evidence: "derived",
    availability: "requires_instrumentation",
    formula: "Next independent-tagged quiz after Cora in 0–7 / 8–14 / 15–28 / 29–60 day buckets.",
    unblock: "Tag later assessments as independent. Subsequent untagged quizzes are follow-through, not transfer.",
  },
  {
    id: "learning_pathways",
    label: "Learning pathways",
    domain: "pathways",
    evidence: "derived",
    availability: "available_now",
    formula: "First three activity types (practice → Cora → assessment) per learner. Paths with N<10 are suppressed.",
    sourceTables: ["practice_attempts", "institution_cora_usage", "quiz_attempts"],
  },
  {
    id: "validated_predictive_model",
    label: "Validated predictive model",
    domain: "longitudinal",
    evidence: "research_outcome",
    availability: "requires_research_design",
    formula: "Registered model with held-out or temporal validation. Heuristic flags are not a model.",
    sourceTables: ["institution_research_models"],
    unblock: "Do not treat attention heuristics as risk scores. Register a validated fit before predictions appear.",
  },
  {
    id: "interventions",
    label: "Intervention funnel",
    domain: "interventions",
    evidence: "descriptive",
    availability: "available_now",
    sourceTables: ["institution_interventions", "analytics_events"],
    unblock:
      "Intervention rows sync from attention heuristics on tab load; delivery/engagement update via notifications and practice completion. Full lifecycle coverage still depends on product surfaces marking viewed/completed.",
  },
  {
    id: "cognitive_constructs",
    label: "Cognitive engagement / SRL / AI trust surveys",
    domain: "cognitive",
    evidence: "research_outcome",
    availability: "available_now",
    sourceTables: ["institution_survey_instruments", "institution_survey_responses"],
    unblock: "Create an instrument and import de-identified scores via POST /api/institution/research/surveys.",
  },
  {
    id: "equity_subgroups",
    label: "Equity and demographic subgroups",
    domain: "equity",
    evidence: "descriptive",
    availability: "available_now",
    sourceTables: ["institution_equity_attributes", "quiz_attempts"],
    unblock: "Import authorized demographic attributes via POST /api/institution/research/equity. Cells below N are suppressed.",
  },
  {
    id: "analytics_events",
    label: "Standardized analytics event stream",
    domain: "data_quality",
    evidence: "descriptive",
    availability: "available_now",
    sourceTables: ["analytics_events", "quiz_attempts", "practice_attempts", "institution_cora_usage"],
    unblock:
      "Cora, practice start/submit, assessment start/submit, feedback generated, and intervention lifecycle events write to analytics_events. Legacy tables still backfill some overview KPIs until event volume is sufficient.",
  },
]

export const MIN_CELL_SIZE = 10

export function capabilitiesForDomain(domain: string): ResearchCapability[] {
  return RESEARCH_CAPABILITIES.filter((c) => c.domain === domain)
}

export function capabilitiesByAvailability(availability: MetricAvailability): ResearchCapability[] {
  return RESEARCH_CAPABILITIES.filter((c) => c.availability === availability)
}
