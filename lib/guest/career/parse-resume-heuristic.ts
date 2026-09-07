import type { ProvenanceRef, ResumeProfileData, ResumeSkill } from "@/lib/guest/career/types"

export function emptyResumeProfileData(): ResumeProfileData {
  return {
    contactInformation: {},
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    publications: [],
    awards: [],
    volunteerExperience: [],
    additionalSections: [],
  }
}

const SECTION_HEADINGS = [
  { key: "experience" as const, patterns: [/^\s*experience\s*$/i, /^\s*work experience\s*$/i, /^\s*professional experience\s*$/i] },
  { key: "education" as const, patterns: [/^\s*education\s*$/i] },
  { key: "skills" as const, patterns: [/^\s*skills\s*$/i, /^\s*technical skills\s*$/i] },
  { key: "projects" as const, patterns: [/^\s*projects\s*$/i] },
  { key: "summary" as const, patterns: [/^\s*summary\s*$/i, /^\s*profile\s*$/i, /^\s*objective\s*$/i] },
]

function splitSkillTokens(text: string): string[] {
  return text
    .split(/[,;|•·\n/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 80)
}

function extractEmail(text: string): string | undefined {
  const m = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)
  return m?.[0]
}

function extractPhone(text: string): string | undefined {
  const m = text.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/)
  return m?.[0]
}

/** Heuristic résumé parser — no fabrication; extracts only from supplied text. */
export function parseResumeHeuristic(parsedText: string): ResumeProfileData {
  const data = emptyResumeProfileData()
  const text = parsedText.trim()
  if (!text) return data

  data.contactInformation.email = extractEmail(text)
  data.contactInformation.phone = extractPhone(text)

  const lines = text.split(/\r?\n/)
  let currentSection: "summary" | "experience" | "education" | "skills" | "projects" | "other" = "other"
  const sectionBuffers: Record<string, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    other: [],
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const heading = SECTION_HEADINGS.find((h) => h.patterns.some((p) => p.test(trimmed)))
    if (heading) {
      currentSection = heading.key
      continue
    }
    sectionBuffers[currentSection]?.push(trimmed)
  }

  if (sectionBuffers.summary.length) {
    data.summary = sectionBuffers.summary.join(" ").slice(0, 1200)
  }

  if (sectionBuffers.skills.length) {
    const skillBlock = sectionBuffers.skills.join("\n")
    const provenance: ProvenanceRef = { sourceSection: "Skills", sourceText: skillBlock.slice(0, 400) }
    for (const token of splitSkillTokens(skillBlock)) {
      data.skills.push({ name: token, provenance: [provenance] })
    }
  }

  if (sectionBuffers.education.length) {
    for (const line of sectionBuffers.education.slice(0, 8)) {
      data.education.push({
        degree: line.slice(0, 120),
        institution: "",
        provenance: [{ sourceSection: "Education", sourceText: line }],
      })
    }
  }

  if (sectionBuffers.experience.length) {
    let current: { title: string; organization: string; bullets: string[] } | null = null
    for (const line of sectionBuffers.experience) {
      if (/^[•\-*]/.test(line) || /^\d+\./.test(line)) {
        const bullet = line.replace(/^[•\-*\d.]+\s*/, "").trim()
        if (current) current.bullets.push(bullet)
        else if (!data.experience.length) {
          current = { title: "Experience", organization: "", bullets: [bullet] }
        }
        continue
      }
      if (current) {
        data.experience.push({
          ...current,
          provenance: [{ sourceSection: "Experience", sourceText: [current.title, ...current.bullets].join(" | ") }],
        })
      }
      current = { title: line.slice(0, 120), organization: "", bullets: [] }
    }
    if (current) {
      data.experience.push({
        ...current,
        provenance: [{ sourceSection: "Experience", sourceText: [current.title, ...current.bullets].join(" | ") }],
      })
    }
  }

  // Fallback skill mining from full text when no skills section
  if (data.skills.length === 0) {
    const techPattern =
      /\b(Python|Java(?:Script)?|TypeScript|C\+\+|MATLAB|SQL|AWS|Azure|GCP|Kubernetes|Docker|PyTorch|TensorFlow|Machine Learning|ML|AI|React|Node\.?js|Git|Linux|Java|R\b|Scala|Go|Rust|HTML|CSS)\b/gi
    const found = new Map<string, string>()
    let m: RegExpExecArray | null
    while ((m = techPattern.exec(text)) !== null) {
      const name = m[1]
      if (!found.has(name)) {
        found.set(name, text.slice(Math.max(0, m.index - 30), m.index + name.length + 30))
      }
    }
    for (const [name, snippet] of found) {
      data.skills.push({
        name,
        provenance: [{ sourceSection: "Document", sourceText: snippet }],
      })
    }
  }

  return data
}
