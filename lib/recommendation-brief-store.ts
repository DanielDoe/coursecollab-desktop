import { sql } from "@/lib/db"
import type { ProfileBundle } from "@/lib/recommendation-letters-ai"
import { generateRecommendationBriefMarkdown } from "@/lib/recommendation-brief-ai"
import { purposeLabel } from "@/lib/recommendation-letters-shared"

export type RecommendationBriefRow = {
  request_id: number
  opportunity_title: string | null
  program_name: string | null
  highlight_topics: string | null
  relationship_context: string | null
  brief_markdown: string
  ai_model: string | null
  generated_at: Date | string | null
  updated_at: Date | string
}

let schemaReady: Promise<void> | null = null

export async function ensureRecommendationBriefSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS recommendation_briefs (
          request_id INTEGER PRIMARY KEY REFERENCES recommendation_requests(id) ON DELETE CASCADE,
          opportunity_title TEXT,
          program_name TEXT,
          highlight_topics TEXT,
          relationship_context TEXT,
          brief_markdown TEXT NOT NULL DEFAULT '',
          ai_model VARCHAR(80),
          generated_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    })()
  }
  await schemaReady
}

export async function getRecommendationBrief(requestId: number): Promise<RecommendationBriefRow | null> {
  await ensureRecommendationBriefSchema()
  const rows = (await sql`
    SELECT request_id, opportunity_title, program_name, highlight_topics,
           relationship_context, brief_markdown, ai_model, generated_at, updated_at
    FROM recommendation_briefs WHERE request_id = ${requestId} LIMIT 1
  `) as RecommendationBriefRow[]
  return rows[0] ?? null
}

export async function upsertRecommendationBriefFields(
  requestId: number,
  fields: {
    opportunityTitle?: string
    programName?: string
    highlightTopics?: string
    relationshipContext?: string
  },
): Promise<RecommendationBriefRow> {
  await ensureRecommendationBriefSchema()
  const existing = await getRecommendationBrief(requestId)
  const opportunity_title = fields.opportunityTitle ?? existing?.opportunity_title ?? null
  const program_name = fields.programName ?? existing?.program_name ?? null
  const highlight_topics = fields.highlightTopics ?? existing?.highlight_topics ?? null
  const relationship_context = fields.relationshipContext ?? existing?.relationship_context ?? null

  const rows = (await sql`
    INSERT INTO recommendation_briefs (
      request_id, opportunity_title, program_name, highlight_topics, relationship_context, brief_markdown, updated_at
    ) VALUES (
      ${requestId},
      ${opportunity_title},
      ${program_name},
      ${highlight_topics},
      ${relationship_context},
      ${existing?.brief_markdown ?? ""},
      NOW()
    )
    ON CONFLICT (request_id) DO UPDATE SET
      opportunity_title = EXCLUDED.opportunity_title,
      program_name = EXCLUDED.program_name,
      highlight_topics = EXCLUDED.highlight_topics,
      relationship_context = EXCLUDED.relationship_context,
      updated_at = NOW()
    RETURNING request_id, opportunity_title, program_name, highlight_topics,
              relationship_context, brief_markdown, ai_model, generated_at, updated_at
  `) as RecommendationBriefRow[]
  return rows[0]
}

export async function generateAndStoreRecommendationBrief(input: {
  requestId: number
  studentName: string
  purpose: string
  deadline?: string | null
  instructorName: string
  courseLabel: string
  profile: ProfileBundle
  attachments: { file_type: string; file_name: string | null }[]
  fields?: {
    opportunityTitle?: string
    programName?: string
    highlightTopics?: string
    relationshipContext?: string
  }
}): Promise<RecommendationBriefRow> {
  await upsertRecommendationBriefFields(input.requestId, input.fields ?? {})

  const generated = await generateRecommendationBriefMarkdown({
    studentName: input.studentName,
    purposeLabel: purposeLabel(input.purpose),
    deadline: input.deadline ?? null,
    instructorName: input.instructorName,
    courseLabel: input.courseLabel,
    profile: input.profile,
    attachments: input.attachments,
    opportunityTitle: input.fields?.opportunityTitle,
    programName: input.fields?.programName,
    highlightTopics: input.fields?.highlightTopics,
    relationshipContext: input.fields?.relationshipContext,
  })

  const rows = (await sql`
    UPDATE recommendation_briefs
    SET brief_markdown = ${generated.markdown},
        ai_model = ${generated.modelUsed},
        generated_at = NOW(),
        updated_at = NOW()
    WHERE request_id = ${input.requestId}
    RETURNING request_id, opportunity_title, program_name, highlight_topics,
              relationship_context, brief_markdown, ai_model, generated_at, updated_at
  `) as RecommendationBriefRow[]

  if (!rows[0]) throw new Error("Brief save failed")
  return rows[0]
}
