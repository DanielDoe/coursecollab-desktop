import { htmlToNoteBody } from "@/lib/imscc/html"
import { xmlAttr, xmlBlocks, xmlText } from "@/lib/imscc/xml"
import type { ImsccQuestion, ImsccQuestionType } from "@/lib/imscc/types"

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const

const CANVAS_TYPE_MAP: Record<string, ImsccQuestionType> = {
  multiple_choice_question: "mcq",
  true_false_question: "true_false",
  multiple_answers_question: "select_all",
  essay_question: "essay",
  short_answer_question: "short_answer",
  numerical_question: "short_answer",
  text_only_question: "needs_review",
  matching_question: "needs_review",
  fill_in_multiple_blanks_question: "needs_review",
  multiple_dropdowns_question: "needs_review",
  calculated_question: "needs_review",
  file_upload_question: "needs_review",
}

function canvasQuestionType(itemXml: string): string {
  const fields = xmlBlocks(itemXml, "qtimetadatafield")
  for (const field of fields) {
    const label = (xmlText(field, "fieldlabel") ?? "").trim()
    if (label === "question_type") return (xmlText(field, "fieldentry") ?? "").trim()
  }
  if (/rcardinality\s*=\s*"Multiple"/i.test(itemXml)) return "multiple_answers_question"
  if (/<response_str\b/i.test(itemXml)) return "short_answer_question"
  return "multiple_choice_question"
}

function pointsFromItem(itemXml: string): number | null {
  const fields = xmlBlocks(itemXml, "qtimetadatafield")
  for (const field of fields) {
    const label = (xmlText(field, "fieldlabel") ?? "").trim()
    if (label === "points_possible") {
      const n = Number(xmlText(field, "fieldentry"))
      return Number.isFinite(n) ? n : null
    }
  }
  return null
}

export function parseQtiItems(xml: string, sourceTitle = "Imported quiz"): ImsccQuestion[] {
  const items = xmlBlocks(xml, "item")
  const out: ImsccQuestion[] = []
  for (const item of items) {
    const ident = xmlAttr(item, "ident") ?? xmlAttr(item, "identifier") ?? `q-${out.length + 1}`
    const title = xmlAttr(item, "title") ?? sourceTitle
    const canvasType = canvasQuestionType(item)
    const mappedType = CANVAS_TYPE_MAP[canvasType] ?? "needs_review"
    const mat = xmlBlocks(item, "mattext")[0]
    const stemRaw = mat ? (xmlText(mat, "mattext") ?? "") : ""
    const stem = htmlToNoteBody(stemRaw) || title

    const labels = xmlBlocks(item, "response_label")
    const options = labels.slice(0, 6).map((label, i) => {
      const id = xmlAttr(label, "ident") ?? LETTERS[i] ?? String(i + 1)
      const text = htmlToNoteBody(xmlText(label, "mattext") ?? xmlText(label, "material") ?? label) || `Option ${LETTERS[i]}`
      return { id, text }
    })

    const correctIds = [...item.matchAll(/<varequal\b[^>]*>([^<]+)<\/varequal>/gi)].map((m) => m[1].trim())
    let correctAnswer: string | string[] | null = null
    let needsReview = mappedType === "needs_review"
    let reviewReason: string | null = mappedType === "needs_review"
      ? `Canvas type “${canvasType}” has no clean CourseCollab equivalent.`
      : null

    if (mappedType === "mcq" || mappedType === "true_false") {
      const hit = options.find((o) => correctIds.includes(o.id))
      const idx = hit ? options.indexOf(hit) : -1
      correctAnswer = idx >= 0 ? (LETTERS[idx] ?? "A") : null
      if (!correctAnswer) {
        needsReview = true
        reviewReason = "Could not determine the correct choice."
      }
    } else if (mappedType === "select_all") {
      correctAnswer = options.filter((o) => correctIds.includes(o.id)).map((o) => o.text)
      if (correctAnswer.length === 0) {
        needsReview = true
        reviewReason = "Could not determine the correct selections."
      }
    } else if (mappedType === "short_answer") {
      correctAnswer = correctIds[0] ?? null
    }

    if (mappedType === "true_false" && options.length === 0) {
      options.push({ id: "A", text: "True" }, { id: "B", text: "False" })
    }

    out.push({
      identifier: ident,
      title,
      canvasType,
      mappedType,
      stem,
      options,
      correctAnswer,
      points: pointsFromItem(item),
      needsReview,
      reviewReason,
    })
  }
  return out
}
