import type { GuestCoraContextPayload } from "@/lib/cora/fetch-guest-context"

export const GUEST_CORA_CONTEXT_VERSION = 1 as const

export type GuestCoraSetupStepId =
  | "preparing"
  | "exploring"
  | "reading"
  | "generating"
  | "finalizing"

export const GUEST_CORA_SETUP_STEPS: Array<{ id: GuestCoraSetupStepId; label: string }> = [
  { id: "preparing", label: "Setting things up" },
  { id: "exploring", label: "Exploring your applications" },
  { id: "reading", label: "Reading your materials" },
  { id: "generating", label: "Personalizing Cora Career" },
  { id: "finalizing", label: "Finalizing setup" },
]

export type GuestCoraContext = {
  version: typeof GUEST_CORA_CONTEXT_VERSION
  guestId: string
  guestName?: string
  focusLabel?: string
  focusTopics: string[]
  payload: GuestCoraContextPayload
  generatedAt: string
  setupComplete: boolean
}

function resolveFocusTopics(payload: GuestCoraContextPayload): string[] {
  return payload.focusTopics.slice(0, 6)
}

export function buildGuestCoraContext(
  guestId: string,
  payload: GuestCoraContextPayload,
  guestName?: string,
): GuestCoraContext {
  const focusTopics = resolveFocusTopics(payload)
  return {
    version: GUEST_CORA_CONTEXT_VERSION,
    guestId,
    guestName: payload.account.fullName ?? guestName,
    focusLabel: focusTopics[0] ?? payload.applications[0]?.title,
    focusTopics,
    payload,
    generatedAt: new Date().toISOString(),
    setupComplete: true,
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runGuestCoraContextSetup(
  guestId: string,
  options?: {
    guestName?: string
    onStep?: (step: GuestCoraSetupStepId) => void
  },
): Promise<GuestCoraContext> {
  options?.onStep?.("preparing")
  await delay(240)
  options?.onStep?.("exploring")
  await delay(280)
  options?.onStep?.("reading")

  const response = await fetch(
    `/api/guest/cora/context?studentDatabaseId=${encodeURIComponent(guestId)}`,
  )
  if (!response.ok) {
    throw new Error("Could not load your guest context for Cora.")
  }
  const payload = (await response.json()) as GuestCoraContextPayload

  options?.onStep?.("generating")
  await delay(300)
  const context = buildGuestCoraContext(guestId, payload, options?.guestName)
  options?.onStep?.("finalizing")
  await delay(200)
  return context
}
