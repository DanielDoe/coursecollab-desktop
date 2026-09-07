import { publicCoraModeLabel } from "@/lib/cora/models/telemetry"
import type { CoraModelProfile, CoraPublicModeLabel } from "@/lib/cora/models/types"
import type { CoraUiPayload } from "@/lib/cora/models/ui-payloads"

/** Student/faculty/career-safe routing. Never includes provider marketing names. */
export type PublicCoraRoutingMeta = {
  profile: CoraModelProfile
  publicMode: CoraPublicModeLabel
  complexity?: string
  reason?: string
}

export function buildPublicCoraChatFields(args: {
  profile?: CoraModelProfile | null
  liteMode?: boolean
  complexity?: string
  reason?: string
  ui?: CoraUiPayload
}): {
  profile: CoraModelProfile
  publicMode: CoraPublicModeLabel
  coraMode: "lite" | "premium"
  routing: PublicCoraRoutingMeta
  ui?: CoraUiPayload
} {
  const profile = args.profile ?? (args.liteMode ? "lite" : "standard")
  const publicMode = publicCoraModeLabel({ profile, liteMode: args.liteMode })
  return {
    profile,
    publicMode,
    coraMode: args.liteMode || profile === "lite" ? "lite" : "premium",
    routing: {
      profile,
      publicMode,
      complexity: args.complexity,
      reason: args.reason,
    },
    ...(args.ui ? { ui: args.ui } : {}),
  }
}
