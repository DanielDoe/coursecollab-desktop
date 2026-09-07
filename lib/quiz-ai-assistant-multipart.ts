/**
 * Strip answer keys from multi-part subquestions before sending to the learning assistant.
 */
import { getGradableSubquestions } from "@/lib/multi-part-question"

export function summarizeSubquestionsForAi(raw: unknown): string {
  const subs = getGradableSubquestions(raw)
  if (subs.length === 0) return ""

  return subs
    .map((sq, index) => {
      const optionTexts: string[] = []
      if (Array.isArray(sq.options)) {
        for (const opt of sq.options) {
          if (typeof opt === "string") optionTexts.push(opt.trim())
          else if (opt && typeof opt === "object") optionTexts.push(String(opt.text ?? "").trim())
        }
      }
      const typeLabel =
        sq.type === "select_all"
          ? "select all that apply"
          : sq.type === "mcq"
            ? "multiple choice"
            : sq.type.replace(/_/g, " ")
      return [
        `Part ${index + 1} (${typeLabel}, id ${sq.id}): ${sq.prompt.trim()}`,
        optionTexts.length > 0 ? `Options: ${optionTexts.join(" | ")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n\n")
}
