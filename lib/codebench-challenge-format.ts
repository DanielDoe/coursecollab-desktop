/** Turn raw daily-challenge text into scannable visual sections. */

export type ChallengePresentation = {
  goal: string
  requirements: string[]
  extras: Array<{ title: string; body: string }>
  timeHint: string | null
}

function cleanLine(line: string): string {
  return line
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\*\*/g, "")
    .trim()
}

function splitMarkdownSections(raw: string): Array<{ title: string; body: string }> {
  const text = raw.replace(/\r\n/g, "\n").trim()
  if (!/^#{1,3}\s/m.test(text)) return []
  const parts = text.split(/\n(?=#{1,3}\s)/)
  return parts
    .map((block) => {
      const lines = block.trim().split("\n")
      const title = lines[0]?.replace(/^#{1,3}\s+/, "").trim() || "Section"
      const body = lines.slice(1).join("\n").trim()
      return { title, body }
    })
    .filter((s) => s.body || s.title)
}

export function parseChallengePresentation(description: string): ChallengePresentation {
  const raw = description.replace(/\r\n/g, "\n").trim()
  const mdSections = splitMarkdownSections(raw)

  if (mdSections.length) {
    const goalSection =
      mdSections.find((s) => /problem|goal|overview|task/i.test(s.title)) ?? mdSections[0]
    const reqSection = mdSections.find((s) => /requirement|constraint|checklist|rules/i.test(s.title))
    const exampleSection = mdSections.find((s) => /example|sample|input|output/i.test(s.title))
    const requirements = (reqSection?.body || "")
      .split("\n")
      .map(cleanLine)
      .filter((line) => line.length > 2)
      .slice(0, 6)

    const goal =
      goalSection.body
        .split("\n")
        .map(cleanLine)
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 280) || goalSection.title

    const extras: Array<{ title: string; body: string }> = []
    if (exampleSection?.body) {
      extras.push({ title: exampleSection.title, body: exampleSection.body.trim().slice(0, 500) })
    }
    for (const section of mdSections) {
      if (section === goalSection || section === reqSection || section === exampleSection) continue
      if (/time|minute/i.test(section.body)) continue
      extras.push({ title: section.title, body: section.body.trim().slice(0, 320) })
      if (extras.length >= 2) break
    }

    const timeMatch = raw.match(/(\d+\s*[-–]\s*\d+\s*minutes?|\d+\s*minutes?)/i)
    return {
      goal,
      requirements:
        requirements.length > 0
          ? requirements
          : goalSection.body
              .split(/(?<=\.)\s+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 20)
              .slice(0, 4),
      extras,
      timeHint: timeMatch?.[1] ?? null,
    }
  }

  // Plain / semi-structured text
  const reqSplit = raw.split(/\n\s*Requirements?\s*:?\s*\n/i)
  let goalBlock = reqSplit[0] || raw
  let reqBlock = reqSplit[1] || ""

  if (!reqBlock && /Requirements?\s*:/i.test(raw)) {
    const idx = raw.search(/Requirements?\s*:/i)
    goalBlock = raw.slice(0, idx).trim()
    reqBlock = raw.slice(idx).replace(/^Requirements?\s*:?\s*/i, "")
  }

  const requirements = reqBlock
    .split("\n")
    .map(cleanLine)
    .filter((line) => line.length > 8 && !/^this challenge tests/i.test(line))
    .slice(0, 6)

  // If requirements were inline after "Requirements:" on same paragraph flow
  if (requirements.length === 0 && /Requirements?\s*:/i.test(raw)) {
    const after = raw.split(/Requirements?\s*:/i)[1] || ""
    const chunks = after
      .split(/(?<=\.)\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12 && !/^this challenge tests/i.test(s))
    requirements.push(...chunks.slice(0, 6))
  }

  const goal = goalBlock
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 280)

  const timeMatch = raw.match(/(\d+\s*[-–]\s*\d+\s*minutes?|\d+\s*minutes?)/i)
  const testsMatch = raw.match(/This challenge tests[^.]*\./i)

  const extras: Array<{ title: string; body: string }> = []
  if (testsMatch?.[0]) {
    extras.push({ title: "Skills", body: testsMatch[0].replace(/^This challenge tests\s*/i, "Tests ") })
  }

  return {
    goal: goal || "Complete today’s coding challenge in the workspace.",
    requirements,
    extras,
    timeHint: timeMatch?.[1] ?? null,
  }
}
