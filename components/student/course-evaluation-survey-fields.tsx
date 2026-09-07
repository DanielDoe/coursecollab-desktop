"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AnimatedCheckOption } from "@/components/ui/animated-check-option"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import {
  AI_TUTOR_USAGE_OPTIONS,
  FAVORITE_FEATURE_OPTIONS,
  FEATURE_TO_IMPROVE_OPTIONS,
  INSTRUCTOR_CLARITY_LIKERT,
  LIKERT_5,
  PLATFORM_HELPFULNESS_LIKERT,
  WORKLOAD_OPTIONS,
  SURVEY_OTHER_OPTION,
} from "@/lib/course-evaluation-survey"

const TITLE = "text-gray-800 dark:text-[var(--cc-text)]"
const BODY = "text-gray-700 dark:text-[var(--cc-text-muted)]"
const LABEL = "text-sm font-medium text-gray-800 dark:text-[var(--cc-text)]"

const FIELDSET = cn(
  "space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
  "dark:border-white/15 dark:bg-transparent dark:shadow-none",
)

const OPTION_ROW = cn(
  "flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 transition-shadow hover:shadow-md",
  "dark:border-white/15 dark:bg-transparent dark:text-[var(--cc-text)] dark:hover:brightness-110",
)

const INPUT = cn(
  "flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-500",
  "dark:border-white/15 dark:bg-[var(--muted)] dark:text-[var(--cc-text)] dark:placeholder:text-[var(--cc-text-muted)]",
)

function LikertQuestion({
  id,
  question,
  options,
  value,
  onChange,
}: {
  id: string
  question: string
  options: readonly { value: number; label: string }[]
  value: number
  onChange: (v: number) => void
}) {
  return (
    <fieldset className={FIELDSET}>
      <legend className={cn(LABEL, "px-1")}>{question}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <div key={opt.value} className={OPTION_ROW}>
            <AnimatedCheckOption
              id={`${id}-${opt.value}`}
              name={id}
              value={String(opt.value)}
              label={opt.label}
              checked={value === opt.value}
              onChange={(v) => onChange(Number.parseInt(v, 10))}
              color="var(--cc-accent)"
            />
          </div>
        ))}
      </div>
    </fieldset>
  )
}

export type SurveyFormState = {
  overallExperience: number
  platformHelpfulness: number
  favoriteFeatures: string[]
  favoriteFeaturesOther: string
  featureToImprove: string
  featureToImproveOther: string
  openFeedback: string
  instructorClarity: number
  workload: string
  aiTutorUsage: string
  npsScore: number | null
  missingFeatures: string
}

export const emptySurveyFormState = (): SurveyFormState => ({
  overallExperience: 0,
  platformHelpfulness: 0,
  favoriteFeatures: [],
  favoriteFeaturesOther: "",
  featureToImprove: "",
  featureToImproveOther: "",
  openFeedback: "",
  instructorClarity: 0,
  workload: "",
  aiTutorUsage: "",
  npsScore: null,
  missingFeatures: "",
})

export function CourseEvaluationSurveyFields({
  value,
  onChange,
}: {
  value: SurveyFormState
  onChange: (next: SurveyFormState) => void
}) {
  const patch = (partial: Partial<SurveyFormState>) => onChange({ ...value, ...partial })

  const toggleFeature = (feature: string, checked: boolean) => {
    const set = new Set(value.favoriteFeatures)
    if (checked) set.add(feature)
    else set.delete(feature)
    const next: Partial<SurveyFormState> = { favoriteFeatures: Array.from(set) }
    if (feature === SURVEY_OTHER_OPTION && !checked) next.favoriteFeaturesOther = ""
    patch(next)
  }

  return (
    <div className="space-y-4">
      <LikertQuestion
        id="overall-experience"
        question="Overall, how would you rate your experience in this course?"
        options={LIKERT_5}
        value={value.overallExperience}
        onChange={(v) => patch({ overallExperience: v })}
      />

      <LikertQuestion
        id="platform-helpfulness"
        question="How much did CourseCollab improve your learning experience throughout the semester?"
        options={PLATFORM_HELPFULNESS_LIKERT}
        value={value.platformHelpfulness}
        onChange={(v) => patch({ platformHelpfulness: v })}
      />

      <fieldset className={FIELDSET}>
        <legend className={cn(LABEL, "px-1")}>
          Which CourseCollab features did you find most valuable? (Select all that apply.)
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FAVORITE_FEATURE_OPTIONS.map((feature) => (
            <label
              key={feature}
              htmlFor={`feature-${feature}`}
              className={OPTION_ROW}
            >
              <Checkbox
                id={`feature-${feature}`}
                checked={value.favoriteFeatures.includes(feature)}
                onCheckedChange={(checked) => toggleFeature(feature, checked === true)}
              />
              <span>{feature}</span>
            </label>
          ))}
        </div>
        {value.favoriteFeatures.includes(SURVEY_OTHER_OPTION) && (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="favorite-features-other" className={LABEL}>
              Please specify other valuable features
            </Label>
            <input
              id="favorite-features-other"
              type="text"
              value={value.favoriteFeaturesOther}
              onChange={(e) => patch({ favoriteFeaturesOther: e.target.value })}
              placeholder="Describe the other feature(s)"
              className={INPUT}
            />
          </div>
        )}
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className={cn(LABEL, "px-1")}>
          If you could improve one part of CourseCollab, which would you choose first?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURE_TO_IMPROVE_OPTIONS.map((opt) => (
            <div key={opt} className={OPTION_ROW}>
              <AnimatedCheckOption
                id={`improve-${opt}`}
                name="feature-to-improve"
                value={opt}
                label={opt}
                checked={value.featureToImprove === opt}
                onChange={(v) =>
                  patch({
                    featureToImprove: v,
                    featureToImproveOther: v === SURVEY_OTHER_OPTION ? value.featureToImproveOther : "",
                  })
                }
                color="var(--cc-accent)"
              />
            </div>
          ))}
        </div>
        {value.featureToImprove === SURVEY_OTHER_OPTION && (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="feature-to-improve-other" className={LABEL}>
              Please specify what you would improve
            </Label>
            <input
              id="feature-to-improve-other"
              type="text"
              value={value.featureToImproveOther}
              onChange={(e) => patch({ featureToImproveOther: e.target.value })}
              placeholder="Describe the area to improve"
              className={INPUT}
            />
          </div>
        )}
      </fieldset>

      <div className={FIELDSET}>
        <Label htmlFor="open-feedback" className={LABEL}>
          What is one thing we should improve in this course or in CourseCollab before the next semester?
        </Label>
        <textarea
          id="open-feedback"
          value={value.openFeedback}
          onChange={(e) => patch({ openFeedback: e.target.value })}
          placeholder="Your feedback helps us improve future classes and the platform."
          rows={4}
          className={cn(INPUT, "mt-2 min-h-[100px] resize-y")}
        />
      </div>

      <div
        className={cn(
          "space-y-4 rounded-xl border border-dashed border-gray-300 bg-white p-4",
          "dark:border-white/20 dark:bg-transparent",
        )}
      >
        <p className={cn("text-base font-semibold", TITLE)}>Optional — bonus questions</p>

        <LikertQuestion
          id="instructor-clarity"
          question="The instructor explained concepts clearly."
          options={INSTRUCTOR_CLARITY_LIKERT}
          value={value.instructorClarity}
          onChange={(v) => patch({ instructorClarity: v })}
        />

        <fieldset className={FIELDSET}>
          <legend className={cn(LABEL, "px-1")}>How would you describe the workload?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {WORKLOAD_OPTIONS.map((opt) => (
              <div key={opt} className={OPTION_ROW}>
                <AnimatedCheckOption
                  id={`workload-${opt}`}
                  name="workload"
                  value={opt}
                  label={opt}
                  checked={value.workload === opt}
                  onChange={(v) => patch({ workload: v })}
                  color="var(--cc-accent)"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className={FIELDSET}>
          <legend className={cn(LABEL, "px-1")}>How often did you use the AI Tutor?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {AI_TUTOR_USAGE_OPTIONS.map((opt) => (
              <div key={opt} className={OPTION_ROW}>
                <AnimatedCheckOption
                  id={`ai-tutor-${opt}`}
                  name="ai-tutor-usage"
                  value={opt}
                  label={opt}
                  checked={value.aiTutorUsage === opt}
                  onChange={(v) => patch({ aiTutorUsage: v })}
                  color="var(--cc-accent)"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <div className={FIELDSET}>
          <Label className={LABEL}>
            How likely are you to recommend CourseCollab to another student? (0–10)
          </Label>
          <p className={cn("mt-1 text-sm", BODY)}>
            {value.npsScore == null ? "Slide to select a score" : `Selected: ${value.npsScore} / 10`}
          </p>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[value.npsScore ?? 0]}
            onValueChange={([n]) => patch({ npsScore: n })}
            className="py-2"
          />
          <div className={cn("flex justify-between text-xs", BODY)}>
            <span>0 — Not likely</span>
            <span>10 — Extremely likely</span>
          </div>
        </div>

        <div className={FIELDSET}>
          <Label htmlFor="missing-features" className={LABEL}>
            Is there a feature you wish CourseCollab had that would improve your learning experience?
          </Label>
          <textarea
            id="missing-features"
            value={value.missingFeatures}
            onChange={(e) => patch({ missingFeatures: e.target.value })}
            placeholder="Optional"
            rows={3}
            className={cn(INPUT, "mt-2 resize-y")}
          />
        </div>
      </div>
    </div>
  )
}
