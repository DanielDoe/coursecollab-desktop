import { sql } from "@/lib/db"

let schemaReady = false

export async function ensureWebhookEventSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS processed_webhook_events (
      provider VARCHAR(32) NOT NULL,
      event_id VARCHAR(128) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, event_id)
    )
  `
  schemaReady = true
}

export async function claimWebhookEvent(
  provider: string,
  eventId: string,
): Promise<"claimed" | "duplicate"> {
  if (!provider || !eventId) return "claimed"
  await ensureWebhookEventSchema()
  const inserted = await sql`
    INSERT INTO processed_webhook_events (provider, event_id)
    VALUES (${provider}, ${eventId})
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING event_id
  `
  return inserted.length === 0 ? "duplicate" : "claimed"
}
