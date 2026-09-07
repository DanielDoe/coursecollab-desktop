import type { ManualPresenceStatus, PresenceStatus } from "@/lib/presence/types"

/** Active within this window → available (when no manual status). */
export const PRESENCE_ONLINE_MS = 3 * 60 * 1000

/** Active within this window but idle → away. */
export const PRESENCE_IDLE_MS = 15 * 60 * 1000

/** Teams-inspired presence colors. */
export const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  available: "#6BB700",
  busy: "#C4314B",
  dnd: "#C4314B",
  away: "#F8D22A",
  offline: "#919191",
}

export const MANUAL_PRESENCE_OPTIONS: Array<{
  value: ManualPresenceStatus
  label: string
  description: string
  mapsTo: PresenceStatus
}> = [
  { value: "available", label: "Available", description: "Let others know you can chat", mapsTo: "available" },
  { value: "busy", label: "Busy", description: "Focus time — messages still arrive", mapsTo: "busy" },
  { value: "dnd", label: "Do not disturb", description: "Mute presence notifications", mapsTo: "dnd" },
  { value: "away", label: "Be right back", description: "Stepping away briefly", mapsTo: "away" },
  { value: "appear_offline", label: "Appear offline", description: "Show as offline to others", mapsTo: "offline" },
]
