/**
 * Render per-problem PNGs from the June 18 classroom handout HTML (one section per assignment).
 */
import { existsSync, mkdirSync } from "fs"
import { join, resolve } from "path"
import { chromium } from "playwright"

const DOC_DIR = resolve(process.cwd(), "docs/ece2202-classroom-june18")
const HTML_FILE = join(DOC_DIR, "ece2202-classroom-points-june18.html")
const OUT_DIR = join(DOC_DIR, "sections-png")

/** Match classroom_point_submissions.title → HTML h1#id */
export const CLASSROOM_JUNE18_SECTION_BY_TITLE: Array<{ match: RegExp; sectionId: string; fileName: string }> = [
  {
    match: /Th[eé]venin Theorem.*terminals/i,
    sectionId: "thévenin-theorem-terminals-ab",
    fileName: "thevenin-terminals-ab.png",
  },
  {
    match: /Superposition.*V_\{?\\?(mathrm\{)?out|Exercise 3-10.*Superposition|E3\.10/i,
    sectionId: "exercise-3-10-superposition-v_mathrmout-fig.-e3.10",
    fileName: "exercise-3-10-vout-superposition.png",
  },
  {
    match: /Exercise 3-10.*Nodal|Nodal Analysis.*P3\.10/i,
    sectionId: "exercise-3-10-nodal-analysis-fig.-p3.10-i_x",
    fileName: "exercise-3-10-p310-nodal.png",
  },
  {
    match: /Norton'?s Theorem/i,
    sectionId: "nortons-theorem-terminals-ab",
    fileName: "norton-terminals-ab.png",
  },
  {
    match: /Exercise 3-12/i,
    sectionId: "exercise-3-12-thévenin-equivalent-and-current-i",
    fileName: "exercise-3-12-thevenin-i.png",
  },
  {
    match: /Exercise 3-13/i,
    sectionId: "exercise-3-13-norton-equivalent",
    fileName: "exercise-3-13-norton.png",
  },
]

export function resolveJune18SectionForTitle(title: string): (typeof CLASSROOM_JUNE18_SECTION_BY_TITLE)[number] | null {
  for (const row of CLASSROOM_JUNE18_SECTION_BY_TITLE) {
    if (row.match.test(title)) return row
  }
  return null
}

export async function renderJune18SectionPng(sectionId: string, outPath: string): Promise<void> {
  if (!existsSync(HTML_FILE)) {
    throw new Error(`Missing handout HTML: ${HTML_FILE}. Run npm run build:classroom-june18-pdf first.`)
  }
  mkdirSync(join(outPath, ".."), { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 1400 } })
  const fileUrl = `file:///${HTML_FILE.replace(/\\/g, "/")}`
  await page.goto(fileUrl, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)

  const handle = await page.evaluateHandle((id) => {
    const heading = document.getElementById(id)
    if (!heading) return null
    const wrap = document.createElement("div")
    wrap.style.cssText = "background:#fff;padding:28px 32px;max-width:820px;font-family:Georgia,serif;line-height:1.45"
    wrap.appendChild(heading.cloneNode(true))
    let sib = heading.nextElementSibling
    while (sib && sib.tagName !== "H1") {
      wrap.appendChild(sib.cloneNode(true))
      sib = sib.nextElementSibling
    }
    document.body.innerHTML = ""
    document.body.style.margin = "0"
    document.body.appendChild(wrap)
    return wrap
  }, sectionId)

  const element = handle.asElement()
  if (!element) {
    await browser.close()
    throw new Error(`Section #${sectionId} not found in ${HTML_FILE}`)
  }
  await element.screenshot({ path: outPath })
  await browser.close()
}

export async function ensureJune18SectionPngForTitle(title: string): Promise<string | null> {
  const spec = resolveJune18SectionForTitle(title)
  if (!spec) return null
  mkdirSync(OUT_DIR, { recursive: true })
  const outPath = join(OUT_DIR, spec.fileName)
  if (!existsSync(outPath)) {
    await renderJune18SectionPng(spec.sectionId, outPath)
  }
  return outPath
}
