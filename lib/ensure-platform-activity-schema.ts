import { sql } from "@/lib/db"

let ensured = false

export async function ensurePlatformActivitySchema() {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS platform_activity_logs (
      id BIGSERIAL PRIMARY KEY,
      portal VARCHAR(32) NOT NULL,
      actor_type VARCHAR(32) NOT NULL,
      actor_id INTEGER,
      actor_label VARCHAR(255),
      actor_email VARCHAR(255),
      action VARCHAR(200) NOT NULL,
      category VARCHAR(64) NOT NULL DEFAULT 'general',
      entity_type VARCHAR(100),
      entity_id VARCHAR(64),
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      path VARCHAR(500),
      method VARCHAR(16),
      success BOOLEAN NOT NULL DEFAULT true,
      summary TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_platform_activity_created ON platform_activity_logs(created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_platform_activity_portal ON platform_activity_logs(portal)`
  await sql`CREATE INDEX IF NOT EXISTS idx_platform_activity_actor ON platform_activity_logs(actor_type, actor_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_platform_activity_category ON platform_activity_logs(category)`
  await sql`CREATE INDEX IF NOT EXISTS idx_platform_activity_action ON platform_activity_logs(action)`

  ensured = true
}
