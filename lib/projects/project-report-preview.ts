import { readFile } from "fs/promises"
import path from "path"
import { jsPDF } from "jspdf"
import type { ProjectSectionRevisionContent } from "@/lib/projects/project-template-types"
import { sanitizePdfPlainText } from "@/lib/pdf-text-sanitize"
import {
  collectFiguresFromSections,
  figureHeading,
  figureLine,
  figureSourceLine,
  figuresForBlock,
} from "@/lib/projects/project-report-figures"

type PreviewSection = {
  title: string
  instructions: string | null
  status: string
  config: Record<string, unknown>
  revision: ProjectSectionRevisionContent | null
}

type PreviewField = {
  id: string
  label: string
  kind: string
  required: boolean
  help: string | null
  answerHtml: string
  answered: boolean
}

export type PreviewCover = {
  university: string
  college: string
  department: string
  logoUrl: string
  course: string
  kind: string
  projectTitle: string | null
  completedOn: string | null
  instructor: string | null
  members: string[]
}

export type ReportPreviewDocument = {
  title: string
  generated_at: string
  sections: Array<{
    title: string
    html: string
    blocks: ProjectSectionRevisionContent["blocks"]
    instructions: string | null
    status: string
    points: number | null
    expected: string | null
    fields: PreviewField[]
    awarded?: { score: number | null; max: number | null; feedback: string | null } | null
  }>
  references: Array<{ title: string; authors?: string | null; year?: number | null; url?: string | null }>
  /** Set on the student graded copy. Pending means no score has been saved yet. */
  grade?: { earned: number; possible: number; pending: boolean; note: string | null } | null
  cover?: PreviewCover
  /** Student submission copy: saved answers only, no assignment prompts. */
  submissionCopy?: boolean
  figures?: Array<{ src: string; label: string; section: string }>
}

function blocksToHtml(blocks: ProjectSectionRevisionContent["blocks"]): string {
  const parts: string[] = []
  for (const b of blocks) {
    switch (b.type) {
      case "text":
        parts.push(`<div class="prose">${b.html || ""}</div>`)
        break
      case "image":
      case "figure":
        parts.push(
          `<figure data-report-figure="1"><img src="${escapeAttr(b.url)}" alt="${escapeAttr(b.alt || b.caption || "Figure")}" /><figcaption>${escapeHtml(b.caption || b.alt || "Figure")}</figcaption></figure>`,
        )
        break
      case "table":
        parts.push(
          `<table><thead><tr>${b.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
        )
        break
      case "code":
        parts.push(`<pre><code class="language-${escapeAttr(b.language)}">${escapeHtml(b.code)}</code></pre>`)
        break
      case "equation":
        parts.push(`<p class="equation">\\(${escapeHtml(b.latex)}\\)</p>`)
        break
      case "link":
        parts.push(`<p><a href="${escapeAttr(b.url)}">${escapeHtml(b.label || b.url)}</a></p>`)
        break
      case "diagram":
        parts.push(
          `<div class="diagram">${b.url ? `<img src="${escapeAttr(b.url)}" />` : ""}<p>${escapeHtml(b.description || "")}</p></div>`,
        )
        break
      case "file":
        parts.push(`<p>[Attachment #${b.file_id}${b.label ? `: ${escapeHtml(b.label)}` : ""}]</p>`)
        break
      default:
        break
    }
  }
  return parts.join("\n")
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;")
}

const KIND_LABEL: Record<string, string> = {
  short_text: "Short answer",
  long_text: "Written response",
  image: "Image upload",
  file: "File upload",
  link: "Link",
  checklist: "Checklist",
  roster: "Class roster",
}

function statusLabel(status: string) {
  const key = status.toUpperCase()
  if (key === "NOT_STARTED") return "Not started"
  if (key === "IN_PROGRESS") return "In progress"
  if (key === "COMPLETE" || key === "COMPLETED") return "Complete"
  if (!status) return "Not started"
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

function fieldAnswer(block: ProjectSectionRevisionContent["blocks"][number] | undefined): { html: string; answered: boolean } {
  if (!block) return { html: "", answered: false }
  if (block.type === "text") {
    const text = plainText(block.html || "")
    const hasFigure = /data-report-figure/.test(block.html || "")
    return text || hasFigure ? { html: `<div class="answer prose">${block.html}</div>`, answered: true } : { html: "", answered: false }
  }
  const html = blocksToHtml([block])
  return { html, answered: Boolean(html.trim()) }
}

function readFields(section: PreviewSection): PreviewField[] {
  const raw = section.config.response_fields
  if (!Array.isArray(raw)) return []
  const blocks = section.revision?.blocks ?? []
  return raw.flatMap((field) => {
    if (!field || typeof field !== "object") return []
    const row = field as { id?: string; label?: string; kind?: string; required?: boolean; help?: string }
    if (!row.label) return []
    const block = blocks.find((item) => item.id === row.id)
    const answer = fieldAnswer(block)
    return [{
      id: String(row.id || ""),
      label: String(row.label),
      kind: String(row.kind || "long_text"),
      required: Boolean(row.required),
      help: row.help ? String(row.help) : null,
      answerHtml: answer.html,
      answered: answer.answered,
    }]
  })
}

export function assembleReportPreview(
  projectTitle: string,
  sections: PreviewSection[],
  references: ReportPreviewDocument["references"],
): ReportPreviewDocument {
  return {
    title: projectTitle,
    generated_at: new Date().toISOString(),
    sections: sections.map((s) => {
      const blocks = s.revision?.blocks ?? []
      const points = typeof s.config.points === "number" ? s.config.points : null
      const expected = typeof s.config.expected_content === "string" ? s.config.expected_content : null
      return {
        title: s.title,
        blocks,
        instructions: s.instructions,
        status: s.status,
        points,
        expected,
        fields: readFields(s),
        html: `<h2>${escapeHtml(s.title)}</h2>${blocksToHtml(blocks)}`,
      }
    }),
    references,
  }
}

function coverAnswer(doc: ReportPreviewDocument, id: string) {
  for (const section of doc.sections) {
    const field = section.fields.find((item) => item.id === id)
    if (field?.answered) return plainText(field.answerHtml)
  }
  return ""
}

export function applyPreviewCover(
  doc: ReportPreviewDocument,
  extras: { members: string[]; completedOn: string | null },
) {
  const named = coverAnswer(doc, "cover-members")
  const members = named
    ? named.split(/\n|,/).map((name) => name.trim()).filter(Boolean)
    : extras.members
  doc.cover = {
    university: "Prairie View A&M University",
    college: "Roy G. Perry College of Engineering",
    department: "Department of Electrical & Computer Engineering",
    logoUrl: "/universities/pvamu-seal.jpg",
    course: coverAnswer(doc, "cover-course") || (doc.submissionCopy ? "Not entered" : "ELEG 4325 – Computer Interfacing and Communications"),
    kind: "Final Project",
    projectTitle: doc.title,
    completedOn: extras.completedOn,
    instructor: coverAnswer(doc, "cover-instructor") || null,
    members,
  }
}

function coverBlock(doc: ReportPreviewDocument) {
  const cover = doc.cover
  if (!cover) return `<h1>${escapeHtml(doc.title)}</h1>`
  const members = cover.members.length
    ? `<ul class="members">${cover.members.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`
    : `<p>No group members listed yet.</p>`
  return `
    <img src="${escapeAttr(cover.logoUrl)}" alt="${escapeAttr(cover.university)}"/>
    <p class="school">${escapeHtml(cover.university)}</p>
    <p class="unit">${escapeHtml(cover.college)}</p>
    <p class="unit">${escapeHtml(cover.department)}</p>
    <hr class="rule"/>
    <h1>${escapeHtml(cover.course)}</h1>
    <p class="kind">${escapeHtml(cover.kind)}</p>
    ${cover.projectTitle ? `<p>${escapeHtml(cover.projectTitle)}</p>` : ""}
    <dl>
      <dt>Date of completion</dt>
      <dd>${escapeHtml(cover.completedOn || "Not completed")}</dd>
      <dt>Instructor</dt>
      <dd>${escapeHtml(cover.instructor || "Not entered")}</dd>
      <dt>Group members</dt>
      <dd>${members}</dd>
    </dl>`
}



export function hoistReportFigures(doc: ReportPreviewDocument, opts?: { stripInline?: boolean }) {
  const catalog = collectFiguresFromSections(
    doc.sections.map((section) => ({
      title: section.title,
      config: { response_fields: section.fields.map((field) => ({ id: field.id, label: field.label })) },
      blocks: section.blocks,
    })),
  )
  for (const section of doc.sections) {
    section.fields = section.fields.map((field) => {
      const attached = figuresForBlock(catalog, field.id)
      if (!attached.length) return field
      if (opts?.stripInline) {
        const lines = attached.map((figure) => `<p>${escapeHtml(figureLine(figure))}</p>`).join("")
        const leftover = field.answerHtml.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "").replace(/<img\b[^>]*>/gi, "")
        return { ...field, answerHtml: `${lines}${leftover}`, answered: true }
      }
      let html = field.answerHtml
      for (const figure of attached) {
        if (html.includes("<figcaption")) {
          html = html.replace(/<figcaption>[\s\S]*?<\/figcaption>/i, `<figcaption>${escapeHtml(figureHeading(figure))}</figcaption>`)
        } else if (html.includes("<figure")) {
          html = html.replace("</figure>", `<figcaption>${escapeHtml(figureHeading(figure))}</figcaption></figure>`)
        } else if (html.includes("<img")) {
          html = html.replace(
            /<img\b[^>]*>/i,
            (match) => `<figure data-report-figure="1">${match}<figcaption>${escapeHtml(figureHeading(figure))}</figcaption></figure>`,
          )
        } else {
          html = `<figure data-report-figure="1"><img src="${escapeAttr(figure.src)}" alt="${escapeAttr(figure.caption)}" /><figcaption>${escapeHtml(figureHeading(figure))}</figcaption></figure>${html}`
        }
      }
      return { ...field, answerHtml: html, answered: true }
    })
  }
  doc.figures = catalog.map((figure) => ({
    src: figure.src,
    label: figureHeading(figure),
    section: figureSourceLine(figure),
  }))
  return doc
}

function formatPoints(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function gradeBanner(doc: ReportPreviewDocument) {
  if (!doc.grade) return ""
  if (doc.grade.pending) {
    return `<section class="grade-banner"><strong>Not graded yet</strong><span>Scores appear here after this report is graded.</span></section>`
  }
  const note = doc.grade.note ? `<p>${escapeHtml(doc.grade.note)}</p>` : ""
  return `<section class="grade-banner"><span>Score</span><strong>${formatPoints(doc.grade.earned)} / ${formatPoints(doc.grade.possible)}</strong>${note}</section>`
}

export function renderPreviewHtml(doc: ReportPreviewDocument): string {
  hoistReportFigures(doc)
  const toc = doc.sections
    .map((section, index) => `<li><a href="#section-${index + 1}"><span>${index + 1}</span>${escapeHtml(section.title)}</a></li>`)
    .join("") + ((doc.figures?.length ?? 0) > 0 ? `<li><a href="#figures"><span>${doc.sections.length + 1}</span>Appendix A — Figures</a></li>` : "")

  const sections = doc.sections
    .map((section, index) => {
      const submissionCopy = Boolean(doc.submissionCopy)
      const fields = section.fields.length
        ? section.fields
            .map((field) => {
              const kind = KIND_LABEL[field.kind] ?? "Response"
              const body = field.answered
                ? field.answerHtml.trim()
                  ? field.answerHtml
                  : `<p class="empty">See Appendix A for this figure.</p>`
                : submissionCopy
                  ? `<p class="empty">Not entered yet.</p>`
                  : `<p class="empty">${field.required ? "Required. " : "Optional. "}Nothing has been entered for this field yet.</p>`
              const meta = submissionCopy
                ? ""
                : `<p>${escapeHtml(kind)}${field.required ? " · Required" : " · Optional"}</p>`
              const help = !submissionCopy && field.help ? `<p class="help">${escapeHtml(field.help)}</p>` : ""
              return `<article class="field">
                <header>
                  <h3>${escapeHtml(field.label)}</h3>
                  ${meta}
                </header>
                ${help}
                ${body}
              </article>`
            })
            .join("")
        : section.blocks.length
          ? blocksToHtml(section.blocks)
          : `<p class="empty">${submissionCopy ? "Not entered yet." : "This section has no response fields yet."}</p>`
      const awarded = section.awarded
      const scoreLine =
        awarded && awarded.score != null && awarded.max != null
          ? `<p class="pts">${formatPoints(awarded.score)} / ${formatPoints(awarded.max)}</p>`
          : ""
      const feedback = awarded?.feedback ? `<p class="grade-note">${escapeHtml(awarded.feedback)}</p>` : ""
      const kicker = submissionCopy
        ? ""
        : `<div class="section-kicker">Section ${index + 1}${section.points != null ? ` · ${section.points} ${section.points === 1 ? "point" : "points"}` : ""} · ${escapeHtml(statusLabel(section.status))}</div>`
      const guidance = submissionCopy
        ? ""
        : `${section.instructions ? `<p class="instructions">${escapeHtml(section.instructions)}</p>` : `<p class="instructions">No instructions were saved for this section.</p>`}
        ${section.expected ? `<p class="expected"><strong>What a complete answer includes.</strong> ${escapeHtml(section.expected)}</p>` : ""}`
      return `<section class="report-section" id="section-${index + 1}">
        ${kicker}
        <div class="awarded"><h2>${escapeHtml(section.title)}</h2>${scoreLine}</div>
        ${feedback}
        ${guidance}
        <div class="fields">${fields}</div>
      </section>`
    })
    .join("")

  const references = doc.references.length
    ? `<section class="report-section" id="references"><div class="section-kicker">Sources</div><h2>References</h2><ol class="refs">${doc.references
        .map(
          (ref) =>
            `<li><strong>${escapeHtml(ref.title)}</strong>${ref.authors ? `<span>${escapeHtml(ref.authors)}</span>` : ""}${ref.year ? `<span>${ref.year}</span>` : ""}${ref.url ? `<a href="${escapeAttr(ref.url)}">${escapeHtml(ref.url)}</a>` : ""}</li>`,
        )
        .join("")}</ol></section>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(doc.title)} — preview</title>
  <style>
    :root { color-scheme: light; --ink:#1c1430; --muted:#5c5470; --line:#e6e0ef; --paper:#f7f4fb; --card:#fff; --brand:#582c83; --gold:#EAAA00; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--paper); color:var(--ink); font:15px/1.55 "Segoe UI", sans-serif; }
    a { color:var(--brand); }
    .wrap { max-width:860px; margin:0 auto; padding:28px 20px 64px; }
    header.top { position:relative; background:var(--card); color:var(--ink); border:1px solid var(--line); border-radius:18px; padding:28px 28px 22px; text-align:center; }
    header.top img { width:118px; height:118px; object-fit:contain; border:0; border-radius:0; background:transparent; }
    header.top .school { margin:12px 0 0; font-size:20px; font-weight:700; letter-spacing:-0.02em; }
    header.top .unit { margin:0; color:var(--muted); font-size:14px; }
    header.top .rule { width:72px; height:3px; margin:16px auto; background:var(--gold); border:0; }
    header.top h1 { margin:0; font-size:26px; line-height:1.2; }
    header.top .kind { margin:4px 0 0; color:var(--brand); font-size:16px; font-weight:650; }
    header.top dl { margin:18px auto 0; max-width:420px; text-align:left; }
    header.top dt { margin-top:10px; color:var(--muted); font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
    header.top dd { margin:0; font-size:16px; }
    header.top .members { margin:0; padding:0; list-style:none; }
    .download { position:absolute; top:16px; right:16px; background:var(--brand); color:#fff; text-decoration:none; border-radius:999px; padding:8px 14px; font-size:13px; font-weight:650; }
    @media print { .download { display:none; } }
    nav.toc { margin:18px 0 0; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px 8px 8px 18px; }
    nav.toc h2 { margin:0 12px 6px; font-size:16px; letter-spacing:-0.01em; }
    nav.toc ol { margin:0; padding:8px 12px; columns:2; list-style:none; }
    nav.toc li { break-inside:avoid; margin:4px 0; }
    nav.toc a { display:flex; gap:8px; text-decoration:none; color:var(--ink); }
    nav.toc span { color:var(--brand); font-weight:700; min-width:1.2rem; }
    .report-section { margin-top:16px; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px 22px; }
    .section-kicker { color:var(--brand); font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
    h2 { margin:4px 0 8px; font-size:22px; }
    .instructions { margin:0 0 10px; color:var(--muted); }
    .expected { margin:0 0 14px; padding:10px 12px; border-left:3px solid var(--gold); background:#fff8e6; border-radius:8px; }
    .field { margin-top:12px; border-top:1px solid var(--line); padding-top:12px; }
    .field header { display:flex; justify-content:space-between; gap:12px; align-items:baseline; }
    .field h3 { margin:0; font-size:15px; }
    .field header p, .help, .empty { margin:2px 0 0; color:var(--muted); font-size:13px; }
    .grade-banner { margin:16px 0 0; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px 18px; text-align:center; }
    .grade-banner strong { display:block; color:var(--brand); font-size:28px; line-height:1.1; }
    .grade-banner span, .grade-banner p { margin:6px 0 0; color:var(--muted); font-size:13px; }
    .awarded { display:flex; justify-content:space-between; gap:12px; align-items:baseline; }
    .awarded h2 { margin:4px 0 8px; }
    .pts { margin:0; color:var(--brand); font-weight:700; white-space:nowrap; }
    .grade-note { margin:0 0 12px; padding:10px 12px; border-left:3px solid var(--brand); background:#f7f4fb; border-radius:8px; }
    .answer, .prose { margin-top:8px; }
    img { max-width:100%; border-radius:10px; border:1px solid var(--line); }
    figure { margin:8px 0; }
    figcaption { color:var(--muted); font-size:12px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th, td { border:1px solid var(--line); padding:6px 8px; text-align:left; }
    pre { overflow:auto; background:#241833; color:#f6f1ff; padding:12px; border-radius:10px; }
    .refs { padding-left:18px; }
    .refs li { margin:8px 0; }
    .refs span, .refs a { display:block; color:var(--muted); font-size:13px; }
    .gallery { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; margin-top:12px; }
    .gallery figure { margin:0; border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#fff; }
    .gallery img { width:100%; height:180px; object-fit:contain; background:#f7f4fb; border:0; border-radius:0; }
    .gallery figcaption { padding:8px 10px 0; font-size:13px; font-weight:650; }
    .gallery .from { margin:0; padding:2px 10px 10px; color:var(--muted); font-size:12px; }
    @media (max-width:640px) { nav.toc ol { columns:1; } header.top, .report-section { padding:16px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <a class="download" href="?format=pdf" target="_blank" rel="noopener">Download</a>
      <script>if (window.parent !== window) document.querySelectorAll("a.download").forEach((el) => el.remove())</script>
      ${coverBlock(doc)}
    </header>
    ${gradeBanner(doc)}
    <nav class="toc" aria-label="Table of Contents"><h2>Table of Contents</h2><ol>${toc}</ol></nav>
    ${sections}
    ${(doc.figures?.length ?? 0) > 0 ? `<section class="report-section report-gallery" id="figures"><div class="section-kicker">Appendix A</div><h2>Figures</h2><p class="instructions">Images stay in the section where they were uploaded. This gallery collects every labelled figure so the downloaded PDF can keep pictures out of the body text.</p><div class="gallery">${doc.figures!.map((figure) => `<figure><img src="${escapeAttr(figure.src)}" alt="${escapeAttr(figure.label)}"/><figcaption>${escapeHtml(figure.label)}</figcaption><p class="from">${escapeHtml(figure.section)}</p></figure>`).join("")}</div></section>` : ""}
    ${references}
  </div>
</body>
</html>`
}

export async function buildPreviewPdf(doc: ReportPreviewDocument): Promise<Buffer> {
  hoistReportFigures(doc, { stripInline: true })
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const cover = doc.cover
  const margin = 56
  const width = pdf.internal.pageSize.getWidth()
  let y = 56
  const line = (text: string, size = 12, color: [number, number, number] = [28, 20, 48]) => {
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    const rows = pdf.splitTextToSize(sanitizePdfPlainText(text), width - margin * 2)
    pdf.text(rows, margin, y)
    y += rows.length * (size + 4) + 4
  }
  try {
    const logo = await readFile(path.join(process.cwd(), "public/universities/pvamu-seal.jpg"))
    pdf.addImage(`data:image/jpeg;base64,${logo.toString("base64")}`, "JPEG", width / 2 - 36, y, 72, 72)
    y += 84
  } catch {
    y += 8
  }
  if (cover) {
    line(cover.university, 16, [88, 44, 131])
    line(cover.college, 11, [92, 84, 112])
    line(cover.department, 11, [92, 84, 112])
    y += 8
    line(cover.course, 18)
    line(cover.kind, 13, [88, 44, 131])
    if (cover.projectTitle) line(cover.projectTitle, 12)
    y += 8
    line(`Date of completion: ${cover.completedOn || "Not completed"}`)
    line(cover.instructor || "Instructor not entered")
    line("Group members")
    for (const member of cover.members) line(member)
    if (!cover.members.length) line("No group members listed yet.")
  } else {
    line(doc.title, 18)
  }
  if (doc.grade?.pending) line("Not graded yet")
  else if (doc.grade) line(`Score ${formatPoints(doc.grade.earned)} / ${formatPoints(doc.grade.possible)}`, 16, [88, 44, 131])
  if (doc.grade?.note) line(doc.grade.note, 11, [92, 84, 112])
  y += 8
  line("Table of Contents", 14, [88, 44, 131])
  doc.sections.forEach((section, index) => line(`${index + 1}. ${section.title}`, 11))
  if ((doc.figures?.length ?? 0) > 0) line(`${doc.sections.length + 1}. Appendix A — Figures`, 11)
  for (const section of doc.sections) {
    if (y > 740) {
      pdf.addPage()
      y = 56
    }
    y += 10
    const awarded = section.awarded
    const score =
      awarded && awarded.score != null && awarded.max != null
        ? ` (${formatPoints(awarded.score)} / ${formatPoints(awarded.max)})`
        : ""
    line(`${section.title}${score}`, 14, [88, 44, 131])
    if (awarded?.feedback) line(awarded.feedback, 11, [92, 84, 112])
    for (const field of section.fields) {
      const answer = field.answered ? plainText(field.answerHtml) || "See Appendix A." : "Not entered"
      line(`${field.label}: ${answer}`, 11)
    }
  }
  if (doc.figures?.length) {
    if (y > 680) {
      pdf.addPage()
      y = 56
    }
    y += 12
    line("Appendix A — Figures", 16, [88, 44, 131])
    for (const figure of doc.figures) {
      if (y > 640) {
        pdf.addPage()
        y = 56
      }
      try {
        const response = await fetch(figure.src)
        if (!response.ok) throw new Error("image")
        const bytes = Buffer.from(await response.arrayBuffer())
        const png = bytes[0] === 0x89
        const data = `data:${png ? "image/png" : "image/jpeg"};base64,${bytes.toString("base64")}`
        pdf.addImage(data, png ? "PNG" : "JPEG", margin, y, 180, 120)
        y += 128
      } catch {
        line("(image unavailable)")
      }
      line(figure.label, 11)
      line(figure.section, 10, [92, 84, 112])
      y += 6
    }
  }
  return Buffer.from(pdf.output("arraybuffer"))
}
