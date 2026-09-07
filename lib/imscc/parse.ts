import { extractHtmlBody, fileExt, htmlToNoteBody, rewriteImsccHtml } from "@/lib/imscc/html"
import { humanCourseTitle, inferWeek, mapAssignmentGroup, mapFile, parseCanvasCourseCode } from "@/lib/imscc/mapping"
import { parseQtiItems } from "@/lib/imscc/questions"
import type {
  ImsccAssignmentGroup,
  ImsccCatalog,
  ImsccFoundCategory,
  ImsccItem,
  ImsccModule,
  ImsccQuestion,
} from "@/lib/imscc/types"
import { xmlAttr, xmlBlocks, xmlFirst, xmlText } from "@/lib/imscc/xml"
import {
  extractZipText,
  listZipEntries,
  type ZipBytesSource,
  type ZipEntry,
  zipSourceFromBlob,
  zipSourceFromBytes,
} from "@/lib/imscc/zip-source"

const TEXT_EXTS = new Set(["xml", "html", "htm", "txt", "qti"])
const SKIP_DIR = /\/$/

function entryMap(entries: ZipEntry[]): Map<string, ZipEntry> {
  const map = new Map<string, ZipEntry>()
  for (const e of entries) map.set(e.name.replace(/\\/g, "/"), e)
  return map
}

async function readText(
  source: ZipBytesSource,
  byName: Map<string, ZipEntry>,
  name: string,
): Promise<string | null> {
  const entry = byName.get(name)
  if (!entry) return null
  try {
    return await extractZipText(source, entry)
  } catch {
    return null
  }
}

function foundCategories(items: ImsccItem[], modules: ImsccModule[], groups: ImsccAssignmentGroup[]): ImsccFoundCategory[] {
  const counts: Record<string, number> = {}
  const bump = (id: string, n = 1) => {
    counts[id] = (counts[id] ?? 0) + n
  }
  bump("course")
  if (items.some((i) => i.kind === "syllabus")) bump("syllabus")
  if (modules.length) bump("modules", modules.length)
  bump("pages", items.filter((i) => i.kind === "page").length)
  bump("assessments", items.filter((i) => i.kind === "assignment" || i.kind === "quiz").length)
  bump("questions", items.reduce((n, i) => n + (i.questions?.length ?? 0), 0))
  bump("files", items.filter((i) => i.kind === "file" || i.kind === "lecture").length)
  bump("assignment_groups", groups.length)
  bump("links", items.filter((i) => i.kind === "weblink").length)
  bump("announcements", items.filter((i) => i.kind === "announcement").length)
  const labels: Record<string, string> = {
    course: "Course information",
    syllabus: "Syllabus",
    modules: "Modules",
    pages: "Pages",
    assessments: "Assessments",
    questions: "Questions",
    files: "Files",
    assignment_groups: "Assignment groups",
    links: "External links",
    announcements: "Announcements",
  }
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => ({ id, label: labels[id] ?? id, count }))
}

function itemBase(partial: Omit<ImsccItem, "mapping"> & { mapping: ImsccItem["mapping"] }): ImsccItem {
  return partial
}

export async function parseImsccPackage(source: ZipBytesSource): Promise<ImsccCatalog> {
  const entries = await listZipEntries(source)
  if (entries.length === 0) throw new Error("Empty package")
  const byName = entryMap(entries)
  const warnings: string[] = []
  const items: ImsccItem[] = []
  const usedIds = new Set<string>()

  const push = (item: ImsccItem) => {
    if (usedIds.has(item.identifier)) item.identifier = `${item.identifier}-${usedIds.size}`
    usedIds.add(item.identifier)
    items.push(item)
  }

  const manifest = await readText(source, byName, "imsmanifest.xml")
  if (!manifest) throw new Error("Missing imsmanifest.xml — this is not an IMS Common Cartridge package")

  const schema = xmlFirst(manifest, ["schema"]) ?? "IMS Common Cartridge"
  const schemaVersion = xmlFirst(manifest, ["schemaversion"]) ?? ""
  const manifestTitle = xmlText(xmlBlocks(manifest, "string")[0] ?? "", "string")
    ?? xmlFirst(manifest, ["title"])
    ?? "Imported course"

  const settingsXml = await readText(source, byName, "course_settings/course_settings.xml")
  const canvasTitle = settingsXml ? xmlText(settingsXml, "title") : null
  const canvasCode = settingsXml ? xmlText(settingsXml, "course_code") : null
  const title = canvasTitle || manifestTitle
  const courseCodeRaw = canvasCode || title
  const parsedCode = parseCanvasCourseCode(courseCodeRaw, title)

  const exportDate =
    xmlFirst(manifest, ["dateTime"]) ??
    xmlFirst(manifest, ["date"]) ??
    null

  const info = {
    title,
    courseCode: courseCodeRaw,
    suggestedCode: parsedCode.suggestedCode,
    suggestedTitle: humanCourseTitle(title, parsedCode.suggestedCode),
    termLabel: parsedCode.termLabel,
    exportDate,
    schema,
    schemaVersion,
    fileCount: entries.length,
    packageBytes: source.size,
  }

  const resources = xmlBlocks(manifest, "resource")
  const resourceById = new Map<string, { type: string; href: string | null; files: string[] }>()
  for (const res of resources) {
    const id = xmlAttr(res, "identifier")
    if (!id) continue
    const type = xmlAttr(res, "type") ?? ""
    const href = xmlAttr(res, "href")
    const files = [...res.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    resourceById.set(id, { type, href, files: files.length ? files : href ? [href] : [] })
  }

  const syllabusHtml = await readText(source, byName, "course_settings/syllabus.html")
  if (syllabusHtml && htmlToNoteBody(syllabusHtml)) {
    push(
      itemBase({
        identifier: "syllabus",
        kind: "syllabus",
        title: "Syllabus",
        href: "course_settings/syllabus.html",
        html: rewriteImsccHtml(extractHtmlBody(syllabusHtml)),
        published: false,
        mapping: { target: "syllabus", label: "Syllabus (draft)", selectedDefault: true },
      }),
    )
  }

  const moduleXml = await readText(source, byName, "course_settings/module_meta.xml")
  const modules: ImsccModule[] = []
  const moduleItemMeta = new Map<string, { moduleId: string; moduleTitle: string; published: boolean; week: number | null; title: string; contentType: string; url?: string | null }>()

  if (moduleXml) {
    const moduleBlocks = xmlBlocks(moduleXml, "module")
    for (const block of moduleBlocks) {
      const id = xmlAttr(block, "identifier") ?? `module-${modules.length + 1}`
      const titleText = xmlText(block, "title") ?? "Module"
      const published = (xmlText(block, "workflow_state") ?? "active") !== "unpublished"
      const position = Number(xmlText(block, "position") ?? modules.length + 1)
      const week = inferWeek(titleText)
      const itemIds: string[] = []
      for (const itemBlock of xmlBlocks(block, "item")) {
        const itemId = xmlAttr(itemBlock, "identifier") ?? xmlText(itemBlock, "identifierref")
        const ref = xmlText(itemBlock, "identifierref")
        const itemTitle = xmlText(itemBlock, "title") ?? "Item"
        const contentType = xmlText(itemBlock, "content_type") ?? ""
        const itemPublished = (xmlText(itemBlock, "workflow_state") ?? "active") !== "unpublished"
        const url = xmlText(itemBlock, "url")
        const key = ref || itemId
        if (!key) continue
        itemIds.push(key)
        moduleItemMeta.set(key, {
          moduleId: id,
          moduleTitle: titleText,
          published: itemPublished && published,
          week,
          title: itemTitle,
          contentType,
          url,
        })
      }
      modules.push({ identifier: id, title: titleText, position, published, itemIds, week })
    }
  }

  const groupXml = await readText(source, byName, "course_settings/assignment_groups.xml")
  const assignmentGroups: ImsccAssignmentGroup[] = []
  const groupById = new Map<string, ImsccAssignmentGroup>()
  if (groupXml) {
    for (const block of xmlBlocks(groupXml, "assignmentGroup")) {
      const id = xmlAttr(block, "identifier") ?? `ag-${assignmentGroups.length + 1}`
      const g: ImsccAssignmentGroup = {
        identifier: id,
        title: xmlText(block, "title") ?? "Group",
        position: Number(xmlText(block, "position") ?? assignmentGroups.length + 1),
        weight: Number(xmlText(block, "group_weight") ?? "") || null,
      }
      assignmentGroups.push(g)
      groupById.set(id, g)
      push(
        itemBase({
          identifier: `ag-${id}`,
          kind: "assignment_group",
          title: g.title,
          published: false,
          mapping: {
            target: "grading_categories",
            label: "Grading category (informational)",
            selectedDefault: false,
          },
        }),
      )
    }
  }

  for (const [name, entry] of byName) {
    if (SKIP_DIR.test(name)) continue
    if (!name.startsWith("wiki_content/") || !name.toLowerCase().endsWith(".html")) continue
    const html = await readText(source, byName, name)
    if (!html) continue
    const pageTitle =
      xmlText(html.replace(/<!DOCTYPE[\s\S]*?>/i, ""), "title")?.replace(/^Page:\s*/i, "") ||
      name.split("/").pop()?.replace(/-/g, " ").replace(/\.html$/i, "") ||
      "Page"
    const unpublished = /do not publish/i.test(pageTitle)
    const meta = [...moduleItemMeta.values()].find((m) => m.title.trim() === pageTitle.trim())
    push(
      itemBase({
        identifier: `page-${name}`,
        kind: "page",
        title: pageTitle,
        href: name,
        html: rewriteImsccHtml(extractHtmlBody(html)),
        published: meta ? meta.published && !unpublished : !unpublished,
        moduleId: meta?.moduleId,
        moduleTitle: meta?.moduleTitle,
        week: meta?.week ?? null,
        mapping: {
          target: "course_notes",
          label: unpublished ? "Faculty-only page (unpublished note)" : "Course notes / lecture page (draft)",
          selectedDefault: !unpublished,
        },
      }),
    )
  }

  for (const [name] of byName) {
    if (!name.endsWith("/assignment_settings.xml")) continue
    const xml = await readText(source, byName, name)
    if (!xml) continue
    const ident = xmlAttr(xml, "identifier") ?? name.split("/")[0]
    const titleText = xmlText(xml, "title") ?? "Assignment"
    const groupId = xmlText(xml, "assignment_group_identifierref")
    const group = groupId ? groupById.get(groupId) : undefined
    const mapped = mapAssignmentGroup(group?.title || titleText)
    const htmlName = [...byName.keys()].find((n) => n.startsWith(`${ident}/`) && n.endsWith(".html"))
    const html = htmlName ? await readText(source, byName, htmlName) : null
    const blocked = mapped.target === "attendance" || mapped.target === "classroom_points"
    push(
      itemBase({
        identifier: `asg-${ident}`,
        kind: mapped.kind,
        title: titleText,
        href: htmlName,
        html: html ? rewriteImsccHtml(extractHtmlBody(html)) : null,
        published: false,
        assignmentGroupId: groupId,
        assignmentGroupTitle: group?.title,
        pointsPossible: Number(xmlText(xml, "points_possible") ?? "") || null,
        submissionTypes: xmlText(xml, "submission_types"),
        unlockAt: xmlText(xml, "unlock_at")?.trim() || null,
        dueAt: xmlText(xml, "due_at")?.trim() || null,
        mapping: {
          target: mapped.target,
          label: mapped.label,
          selectedDefault: !blocked,
          blocked,
          blockReason: blocked ? `${group?.title ?? titleText} has no direct CourseCollab assessment equivalent.` : null,
        },
      }),
    )
  }

  const topicMeta = new Map<string, { type: string; title: string; published: boolean }>()
  for (const [name] of byName) {
    if (!name.endsWith(".xml") || name.includes("/")) continue
    const xml = await readText(source, byName, name)
    if (!xml) continue
    if (/<topicMeta\b/i.test(xml)) {
      const topicId = xmlText(xml, "topic_id") ?? xmlAttr(xml, "identifier") ?? name.replace(/\.xml$/, "")
      topicMeta.set(topicId, {
        type: (xmlText(xml, "type") ?? "discussion").toLowerCase(),
        title: xmlText(xml, "title") ?? "Discussion",
        published: (xmlText(xml, "workflow_state") ?? "active") !== "unpublished",
      })
    }
  }
  for (const [name] of byName) {
    if (!name.endsWith(".xml") || name.includes("/")) continue
    const xml = await readText(source, byName, name)
    if (!xml || !/<topic\b/i.test(xml) || /<topicMeta\b/i.test(xml)) continue
    const ident = name.replace(/\.xml$/, "")
    const meta = topicMeta.get(ident)
    const titleText = xmlText(xml, "title") ?? meta?.title ?? "Discussion"
    const htmlRaw = xmlInnerTopicHtml(xml)
    const isAnnouncement = meta?.type === "announcement"
    push(
      itemBase({
        identifier: `${isAnnouncement ? "ann" : "disc"}-${ident}`,
        kind: isAnnouncement ? "announcement" : "discussion",
        title: titleText,
        href: name,
        html: htmlRaw,
        published: false,
        mapping: {
          target: "course_notes",
          label: isAnnouncement
            ? "Announcement (imported as unpublished note — not posted to students)"
            : "Discussion (imported as unpublished note)",
          selectedDefault: isAnnouncement,
        },
      }),
    )
  }

  for (const [name] of byName) {
    if (!name.endsWith(".xml")) continue
    const xml = await readText(source, byName, name)
    if (!xml || !/<webLink\b/i.test(xml)) continue
    const titleText = xmlText(xml, "title") ?? "External link"
    const hrefMatch = xml.match(/<url\b[^>]*href="([^"]+)"/i)
    const url = hrefMatch?.[1] ?? xmlText(xml, "url")
    const ident = name.replace(/\.xml$/, "")
    const meta = moduleItemMeta.get(ident)
    push(
      itemBase({
        identifier: `link-${ident}`,
        kind: "weblink",
        title: titleText,
        url,
        published: meta?.published ?? true,
        moduleId: meta?.moduleId,
        moduleTitle: meta?.moduleTitle,
        mapping: { target: "resource_links", label: "Resource link (in course notes)", selectedDefault: true },
      }),
    )
  }

  const qtiFiles = [...byName.keys()].filter((n) => {
    const lower = n.toLowerCase()
    return (
      lower.includes("assessment") && (lower.endsWith(".xml") || lower.endsWith(".qti"))
    ) || lower.includes("non_cc_assessments/") && (lower.endsWith(".xml") || lower.endsWith(".qti"))
  })
  for (const res of resources) {
    const type = xmlAttr(res, "type") ?? ""
    if (!/qti|assessment/i.test(type)) continue
    const href = xmlAttr(res, "href")
    if (href && !qtiFiles.includes(href)) qtiFiles.push(href)
    for (const fileHref of [...res.matchAll(/<file\b[^>]*href="([^"]+)"/gi)].map((m) => m[1])) {
      if (!qtiFiles.includes(fileHref)) qtiFiles.push(fileHref)
    }
  }

  const questionItems: { title: string; href: string; questions: ImsccQuestion[] }[] = []
  for (const href of qtiFiles) {
    const xml = await readText(source, byName, href)
    if (!xml || !/<item\b/i.test(xml)) continue
    const titleText = xmlAttr(xml, "title") ?? xmlText(xml, "title") ?? href
    const questions = parseQtiItems(xml, titleText)
    if (questions.length) questionItems.push({ title: titleText, href, questions })
  }
  for (const quiz of questionItems) {
    const needs = quiz.questions.filter((q) => q.needsReview).length
    push(
      itemBase({
        identifier: `quiz-${quiz.href}`,
        kind: "quiz",
        title: quiz.title,
        href: quiz.href,
        published: false,
        questions: quiz.questions,
        mapping: {
          target: "question_bank",
          label: needs
            ? `Question bank (${quiz.questions.length} questions, ${needs} need review)`
            : `Question bank (${quiz.questions.length} questions)`,
          selectedDefault: true,
        },
      }),
    )
  }

  for (const [name, entry] of byName) {
    if (!name.startsWith("web_resources/") || SKIP_DIR.test(name)) continue
    if (TEXT_EXTS.has(fileExt(name)) && name.toLowerCase().endsWith(".html")) continue
    const meta = [...moduleItemMeta.entries()].find(([, m]) => m.title === (name.split("/").pop() ?? ""))
    const mapped = mapFile(name, entry.uncompressedSize, meta?.[1].moduleTitle)
    push(
      itemBase({
        identifier: `file-${name}`,
        kind: mapped.kind,
        title: name.split("/").pop() ?? name,
        href: name,
        mimeHint: fileExt(name),
        bytes: entry.uncompressedSize,
        published: meta?.[1].published ?? true,
        moduleId: meta?.[1].moduleId,
        moduleTitle: meta?.[1].moduleTitle,
        week: meta?.[1].week ?? inferWeek(meta?.[1].moduleTitle ?? ""),
        mapping: {
          target: mapped.target,
          label: mapped.label,
          selectedDefault: mapped.selectedDefault,
          blocked: mapped.blocked,
          blockReason: mapped.blockReason,
        },
      }),
    )
  }

  if (info.packageBytes > 80 * 1024 * 1024) {
    warnings.push(
      "This package is larger than 80 MB. CourseCollab imported the course map without copying large videos or binaries. Lecture shells and assignments are created as drafts.",
    )
  }
  if (!items.some((i) => i.kind === "quiz" && (i.questions?.length ?? 0) > 0)) {
    warnings.push("No Canvas QTI question banks were found. Quizzes/homework were imported as empty drafts when present.")
  }

  modules.sort((a, b) => a.position - b.position)

  return {
    info,
    modules,
    assignmentGroups,
    items,
    found: foundCategories(items, modules, assignmentGroups),
    warnings,
  }
}

function xmlInnerTopicHtml(xml: string): string | null {
  const m = xml.match(/<text\b[^>]*>([\s\S]*?)<\/text>/i)
  if (!m) return null
  return rewriteImsccHtml(
    m[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&"),
  )
}

export async function parseImsccFromBlob(file: Blob): Promise<ImsccCatalog> {
  return parseImsccPackage(zipSourceFromBlob(file))
}

export async function parseImsccFromBytes(bytes: Uint8Array): Promise<ImsccCatalog> {
  return parseImsccPackage(zipSourceFromBytes(bytes))
}
