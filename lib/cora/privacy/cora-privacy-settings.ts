import { sql } from "@/lib/db"

/** Server-synced Cora privacy toggles (student). Local teaching prefs stay in browser storage. */
export type CoraPrivacySettings = {
  personalizedLearning: boolean
  useLearningContext: boolean
  shareWithInstructor: boolean
}

export const DEFAULT_CORA_PRIVACY_SETTINGS: CoraPrivacySettings = {
  personalizedLearning: true,
  useLearningContext: true,
  shareWithInstructor: false,
}

let schemaReady: Promise<void> | null = null

export function ensureCoraPrivacySettingsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cora_privacy_settings (
          student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
          personalized_learning BOOLEAN NOT NULL DEFAULT TRUE,
          use_learning_context BOOLEAN NOT NULL DEFAULT TRUE,
          share_with_instructor BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
    })()
  }
  return schemaReady
}

export async function getCoraPrivacySettings(studentId: number): Promise<CoraPrivacySettings> {
  await ensureCoraPrivacySettingsSchema()
  const rows = await sql`
    SELECT personalized_learning, use_learning_context, share_with_instructor
    FROM cora_privacy_settings
    WHERE student_id = ${studentId}
    LIMIT 1
  `
  const row = rows[0] as
    | {
        personalized_learning: boolean
        use_learning_context: boolean
        share_with_instructor: boolean
      }
    | undefined
  if (!row) return { ...DEFAULT_CORA_PRIVACY_SETTINGS }
  return {
    personalizedLearning: row.personalized_learning !== false,
    useLearningContext: row.use_learning_context !== false,
    shareWithInstructor: row.share_with_instructor === true,
  }
}

export async function setCoraPrivacySettings(
  studentId: number,
  patch: Partial<CoraPrivacySettings>,
): Promise<CoraPrivacySettings> {
  await ensureCoraPrivacySettingsSchema()
  const current = await getCoraPrivacySettings(studentId)
  const next: CoraPrivacySettings = {
    personalizedLearning: patch.personalizedLearning ?? current.personalizedLearning,
    useLearningContext: patch.useLearningContext ?? current.useLearningContext,
    shareWithInstructor: patch.shareWithInstructor ?? current.shareWithInstructor,
  }
  await sql`
    INSERT INTO cora_privacy_settings (
      student_id,
      personalized_learning,
      use_learning_context,
      share_with_instructor,
      updated_at
    )
    VALUES (
      ${studentId},
      ${next.personalizedLearning},
      ${next.useLearningContext},
      ${next.shareWithInstructor},
      NOW()
    )
    ON CONFLICT (student_id) DO UPDATE SET
      personalized_learning = EXCLUDED.personalized_learning,
      use_learning_context = EXCLUDED.use_learning_context,
      share_with_instructor = EXCLUDED.share_with_instructor,
      updated_at = NOW()
  `
  return next
}
