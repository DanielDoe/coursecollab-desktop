import { sql } from "@/lib/db"

/** Server-synced Cora privacy for instructors and administrators. */
export type CoraActorPrivacySettings = {
  personalizedLearning: boolean
  useLearningContext: boolean
}

export type CoraActorPrivacyType = "instructor" | "admin"

export const DEFAULT_CORA_ACTOR_PRIVACY: CoraActorPrivacySettings = {
  personalizedLearning: true,
  useLearningContext: true,
}

let schemaReady: Promise<void> | null = null

export function ensureCoraActorPrivacySettingsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cora_actor_privacy_settings (
          actor_type VARCHAR(16) NOT NULL CHECK (actor_type IN ('instructor', 'admin')),
          actor_id TEXT NOT NULL,
          personalized_learning BOOLEAN NOT NULL DEFAULT TRUE,
          use_learning_context BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (actor_type, actor_id)
        )
      `
    })()
  }
  return schemaReady
}

export async function getCoraActorPrivacySettings(
  actorType: CoraActorPrivacyType,
  actorId: string,
): Promise<CoraActorPrivacySettings> {
  await ensureCoraActorPrivacySettingsSchema()
  const rows = await sql`
    SELECT personalized_learning, use_learning_context
    FROM cora_actor_privacy_settings
    WHERE actor_type = ${actorType}
      AND actor_id = ${actorId}
    LIMIT 1
  `
  const row = rows[0] as
    | { personalized_learning: boolean; use_learning_context: boolean }
    | undefined
  if (!row) return { ...DEFAULT_CORA_ACTOR_PRIVACY }
  return {
    personalizedLearning: row.personalized_learning !== false,
    useLearningContext: row.use_learning_context !== false,
  }
}

export async function setCoraActorPrivacySettings(
  actorType: CoraActorPrivacyType,
  actorId: string,
  patch: Partial<CoraActorPrivacySettings>,
): Promise<CoraActorPrivacySettings> {
  await ensureCoraActorPrivacySettingsSchema()
  const current = await getCoraActorPrivacySettings(actorType, actorId)
  const next: CoraActorPrivacySettings = {
    personalizedLearning: patch.personalizedLearning ?? current.personalizedLearning,
    useLearningContext: patch.useLearningContext ?? current.useLearningContext,
  }
  if (patch.personalizedLearning === false) {
    next.useLearningContext = false
  }
  await sql`
    INSERT INTO cora_actor_privacy_settings (
      actor_type,
      actor_id,
      personalized_learning,
      use_learning_context,
      updated_at
    )
    VALUES (
      ${actorType},
      ${actorId},
      ${next.personalizedLearning},
      ${next.useLearningContext},
      NOW()
    )
    ON CONFLICT (actor_type, actor_id) DO UPDATE SET
      personalized_learning = EXCLUDED.personalized_learning,
      use_learning_context = EXCLUDED.use_learning_context,
      updated_at = NOW()
  `
  return next
}
