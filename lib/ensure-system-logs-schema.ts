import { sql } from "@/lib/db"

let ensured = false

export async function ensureSystemLogsSchema() {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS system_log_groups (
      id BIGSERIAL PRIMARY KEY,
      fingerprint VARCHAR(64) NOT NULL UNIQUE,
      title VARCHAR(500) NOT NULL,
      severity VARCHAR(16) NOT NULL DEFAULT 'error',
      category VARCHAR(32) NOT NULL,
      module_name VARCHAR(100),
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      affected_user_count INTEGER NOT NULL DEFAULT 0,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      assigned_to VARCHAR(255),
      resolution_notes TEXT,
      resolved_at TIMESTAMPTZ,
      resolved_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS system_logs (
      id BIGSERIAL PRIMARY KEY,
      log_id VARCHAR(36) NOT NULL UNIQUE,
      group_id BIGINT REFERENCES system_log_groups(id) ON DELETE SET NULL,
      fingerprint VARCHAR(64),
      environment VARCHAR(32) NOT NULL DEFAULT 'production',
      severity VARCHAR(16) NOT NULL,
      category VARCHAR(32) NOT NULL,
      title VARCHAR(500),
      description TEXT,
      error_message TEXT,
      stack_trace TEXT,
      module_name VARCHAR(100),
      feature_name VARCHAR(100),
      page_url TEXT,
      route VARCHAR(500),
      api_endpoint VARCHAR(500),
      http_method VARCHAR(16),
      http_status_code INTEGER,
      user_id VARCHAR(64),
      user_name VARCHAR(255),
      user_role VARCHAR(64),
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      course_name VARCHAR(255),
      browser VARCHAR(100),
      operating_system VARCHAR(100),
      device_type VARCHAR(64),
      screen_resolution VARCHAR(32),
      ip_address VARCHAR(45),
      session_id VARCHAR(128),
      execution_time_ms INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      root_cause_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON system_logs(severity)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_module ON system_logs(module_name)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_fingerprint ON system_logs(fingerprint)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_group ON system_logs(group_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_course ON system_logs(course_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_logs_environment ON system_logs(environment)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_log_groups_status ON system_log_groups(status)`
  await sql`CREATE INDEX IF NOT EXISTS idx_system_log_groups_last_seen ON system_log_groups(last_seen_at DESC)`

  // Migrate legacy status values to open / resolved workflow
  await sql`
    UPDATE system_log_groups
    SET status = 'open', updated_at = NOW()
    WHERE status IN ('active', 'ignored')
  `

  ensured = true
}
