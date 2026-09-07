/** Placeholder-heavy body students can paste over in the workspace editor */

export type LetterTemplateVars = {
  studentName: string
  readerLine: string
  instructorName: string
  courseLine: string
}

export function buildRecommendationLetterPlaceholderBody(v: LetterTemplateVars): string {
  const dear = v.readerLine.trim() ? `Dear ${v.readerLine},\n\n` : "Dear Selection Committee,\n\n"
  return `${dear}I write to recommend ${v.studentName} for consideration. Through ${v.courseLine || "your course"}, ${v.studentName} demonstrated strong intellectual engagement and reliability.

[Brief paragraph: describe a concrete example — project, exam, labs, teamwork — that shows how you know ${v.studentName}'s strengths. Replace this bracket with your drafted text or paste content from elsewhere.]

[Optional second paragraph: leadership, resilience, initiative, technical skills relevant to ${v.readerLine ? "your program" : "the opportunity"} — edit freely.]

In summary, I recommend ${v.studentName} without reservation. Please contact me at ${v.instructorName}'s departmental email if you need additional perspective.

Respectfully,
${v.instructorName}`
}
