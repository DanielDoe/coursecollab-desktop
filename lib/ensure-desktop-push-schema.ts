import { sql } from "@/lib/db"

let ensured = false

export async function ensureDesktopPushDevicesSchema() {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS desktop_push_devices (
      id SERIAL PRIMARY KEY,
      device_id VARCHAR(64) NOT NULL,
      owner_kind VARCHAR(16) NOT NULL CHECK (owner_kind IN ('student', 'instructor', 'admin')),
      owner_id INTEGER NOT NULL,
      platform VARCHAR(16) NOT NULL,
      push_token VARCHAR(512),
      push_provider VARCHAR(16),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (device_id, owner_kind, owner_id)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_desktop_push_devices_owner
    ON desktop_push_devices(owner_kind, owner_id)
  `

  ensured = true
}

type RegisterDesktopDeviceInput = {
  deviceId: string
  ownerKind: "student" | "instructor" | "admin"
  ownerId: number
  platform: string
  pushToken?: string | null
  pushProvider?: string | null
}

export async function registerDesktopPushDevice(input: RegisterDesktopDeviceInput) {
  await ensureDesktopPushDevicesSchema()

  await sql`
    INSERT INTO desktop_push_devices (
      device_id,
      owner_kind,
      owner_id,
      platform,
      push_token,
      push_provider,
      updated_at
    )
    VALUES (
      ${input.deviceId},
      ${input.ownerKind},
      ${input.ownerId},
      ${input.platform},
      ${input.pushToken ?? null},
      ${input.pushProvider ?? null},
      NOW()
    )
    ON CONFLICT (device_id, owner_kind, owner_id)
    DO UPDATE SET
      platform = EXCLUDED.platform,
      push_token = COALESCE(EXCLUDED.push_token, desktop_push_devices.push_token),
      push_provider = COALESCE(EXCLUDED.push_provider, desktop_push_devices.push_provider),
      updated_at = NOW()
  `
}
