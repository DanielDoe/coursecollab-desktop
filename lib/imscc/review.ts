import type { ImsccCommitCounts, ImsccItem, ImsccReview } from "@/lib/imscc/types"

const CANVAS_HOST = /canvaslms\.com|instructure\.com/i
const BROKEN_PACKAGE_REF = /\$IMS-CC-FILEBASE\$|\/web_resources\/|wiki_content\//i

function canvasUrl(value: string | null | undefined): boolean {
  return Boolean(value && CANVAS_HOST.test(value))
}

export function buildImsccReview(items: ImsccItem[], counts: ImsccCommitCounts): ImsccReview {
  const assessments = items.filter(
    (i) =>
      (i.kind === "assignment" || i.kind === "quiz") &&
      (i.mapping.target === "homework" ||
        i.mapping.target === "quizzes" ||
        i.mapping.target === "mid_semester" ||
        i.mapping.target === "final"),
  )
  const questions = items.flatMap((i) => i.questions ?? [])
  const missingPoints = assessments.filter((i) => i.pointsPossible == null || i.pointsPossible <= 0)
  const missingDates = assessments.filter((i) => !i.unlockAt && !i.dueAt)
  const unvalidated = questions.filter((q) => q.needsReview || (q.mappedType !== "essay" && !q.correctAnswer))
  const canvasLinks = items.filter(
    (i) => i.kind === "weblink" && canvasUrl(i.url),
  )
  const brokenRefs = items.filter((i) => BROKEN_PACKAGE_REF.test(`${i.html ?? ""} ${i.url ?? ""}`))

  const checks: ImsccReview["checks"] = []
  if (assessments.length > 0) {
    checks.push({
      ok: missingPoints.length === 0,
      label: "All assessments have point values",
    })
  }
  if (questions.length > 0) {
    checks.push({
      ok: unvalidated.length === 0,
      label: "Question answers validated",
    })
  }
  checks.push({
    ok: counts.files > 0 || counts.lectures > 0 || counts.notes > 0,
    label: "Course files are accessible",
  })
  checks.push({
    ok: brokenRefs.length === 0,
    label: "No broken internal references",
  })

  const issues: ImsccReview["issues"] = []
  for (const item of missingDates) {
    issues.push({
      id: `avail-${item.identifier}`,
      title: `${item.title} has no availability date`,
      detail: "Canvas did not export an unlock or due date. Set availability before publishing.",
    })
  }
  if (canvasLinks.length === 1) {
    issues.push({
      id: `canvas-link-${canvasLinks[0].identifier}`,
      title: "One external Canvas link could not be migrated",
      detail: canvasLinks[0].url || canvasLinks[0].title,
    })
  } else if (canvasLinks.length > 1) {
    issues.push({
      id: "canvas-links",
      title: `${canvasLinks.length} external Canvas links could not be migrated`,
      detail: canvasLinks.map((l) => l.title).join(", "),
    })
  }
  if (unvalidated.length > 0) {
    issues.push({
      id: "questions-review",
      title: `${unvalidated.length} question${unvalidated.length === 1 ? "" : "s"} require review`,
      detail: "Cora can convert these into supported CourseCollab formats after you open the question bank.",
    })
  }
  for (const item of missingPoints) {
    issues.push({
      id: `points-${item.identifier}`,
      title: `${item.title} has no point value`,
      detail: "Add points before publishing this assessment.",
    })
  }

  return { checks, issues }
}

export function emptyImsccCounts(): ImsccCommitCounts {
  return {
    syllabus: 0,
    notes: 0,
    lectures: 0,
    assessments: 0,
    quizzes: 0,
    homework: 0,
    questions: 0,
    questionsNeedingReview: 0,
    links: 0,
    files: 0,
    filesCataloged: 0,
    skipped: 0,
    total: 0,
  }
}
