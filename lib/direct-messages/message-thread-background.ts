export const MESSAGE_BACKGROUND_PRESETS = [
  {
    id: "aurora",
    label: "Aurora",
    light: "linear-gradient(160deg, #ddd6fe 0%, #fbcfe8 48%, #bae6fd 100%)",
    dark: "linear-gradient(165deg, #2e1065 0%, #4a044e 52%, #0f172a 100%)",
  },
  {
    id: "lagoon",
    label: "Lagoon",
    light: "linear-gradient(165deg, #cffafe 0%, #bae6fd 46%, #d1fae5 100%)",
    dark: "linear-gradient(165deg, #083344 0%, #0c4a6e 50%, #022c22 100%)",
  },
  {
    id: "ember",
    label: "Ember",
    light: "linear-gradient(160deg, #ffedd5 0%, #fecaca 50%, #fde68a 100%)",
    dark: "linear-gradient(165deg, #431407 0%, #7f1d1d 48%, #1c1917 100%)",
  },
  {
    id: "night",
    label: "Night",
    light: "linear-gradient(165deg, #e0e7ff 0%, #c7d2fe 45%, #ddd6fe 100%)",
    dark: "linear-gradient(180deg, #020617 0%, #1e1b4b 55%, #0f172a 100%)",
  },
  {
    id: "bloom",
    label: "Bloom",
    light: "linear-gradient(160deg, #fce7f3 0%, #fecdd3 48%, #fae8ff 100%)",
    dark: "linear-gradient(165deg, #500724 0%, #831843 48%, #1e1b4b 100%)",
  },
  {
    id: "glacier",
    label: "Glacier",
    light: "linear-gradient(180deg, #f8fafc 0%, #e0f2fe 55%, #e2e8f0 100%)",
    dark: "linear-gradient(180deg, #0f172a 0%, #164e63 55%, #1e293b 100%)",
  },
  {
    id: "orchard",
    label: "Orchard",
    light: "linear-gradient(160deg, #ecfccb 0%, #bbf7d0 48%, #fef3c7 100%)",
    dark: "linear-gradient(165deg, #14532d 0%, #3f6212 48%, #1c1917 100%)",
  },
  {
    id: "graphite",
    label: "Graphite",
    light: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)",
    dark: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
  },
  {
    id: "slate",
    label: "Slate",
    light: "linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)",
    dark: "linear-gradient(180deg, #334155 0%, #0f172a 100%)",
  },
  {
    id: "charcoal",
    label: "Charcoal",
    light: "linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)",
    dark: "linear-gradient(180deg, #111827 0%, #020617 100%)",
  },
] as const

export type MessageBackgroundPresetId = (typeof MESSAGE_BACKGROUND_PRESETS)[number]["id"]

export type MessageThreadBackground =
  | { kind: "default" }
  | { kind: "preset"; presetId: MessageBackgroundPresetId }
  | { kind: "image"; uri: string }

export type BackgroundNotice = {
  id: string
  at: string
  text: string
}

export type MessageThreadAppearance = {
  background: MessageThreadBackground
  notices: BackgroundNotice[]
}

const PRESET_IDS = new Set<string>(MESSAGE_BACKGROUND_PRESETS.map((preset) => preset.id))
const storageKey = (threadId: number) => `cc.messages.thread-background.${threadId}`
const EMPTY_APPEARANCE: MessageThreadAppearance = { background: { kind: "default" }, notices: [] }

export function messageBackgroundPreset(id: string) {
  return MESSAGE_BACKGROUND_PRESETS.find((preset) => preset.id === id) ?? null
}

export function backgroundChangeLine(actorName: string | null | undefined, removed = false): string {
  const who = actorName?.trim() || "You"
  return removed ? `${who} removed the background image.` : `${who} changed the background image.`
}

function normalizeBackground(raw: unknown): MessageThreadBackground {
  if (!raw || typeof raw !== "object") return { kind: "default" }
  const parsed = raw as Partial<MessageThreadBackground>
  if (parsed.kind === "preset" && parsed.presetId && PRESET_IDS.has(parsed.presetId)) {
    return { kind: "preset", presetId: parsed.presetId }
  }
  if (parsed.kind === "image" && typeof parsed.uri === "string" && parsed.uri.trim()) {
    return { kind: "image", uri: parsed.uri }
  }
  return { kind: "default" }
}

function normalizeNotices(raw: unknown): BackgroundNotice[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Partial<BackgroundNotice>
    const text = typeof row.text === "string" ? row.text.trim() : ""
    const at = typeof row.at === "string" ? row.at : ""
    const id = typeof row.id === "string" ? row.id : ""
    if (!text || !at || !id) return []
    return [{ id, at, text }]
  })
}

export function readMessageThreadAppearance(threadId: number): MessageThreadAppearance {
  if (typeof window === "undefined") return EMPTY_APPEARANCE
  try {
    const raw = window.localStorage.getItem(storageKey(threadId))
    if (!raw) return EMPTY_APPEARANCE
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed && typeof parsed.background === "object") {
      return {
        background: normalizeBackground(parsed.background),
        notices: normalizeNotices(parsed.notices),
      }
    }
    return { background: normalizeBackground(parsed), notices: [] }
  } catch {
    return EMPTY_APPEARANCE
  }
}

export function writeMessageThreadAppearance(threadId: number, appearance: MessageThreadAppearance): void {
  if (typeof window === "undefined") return
  try {
    if (appearance.background.kind === "default" && appearance.notices.length === 0) {
      window.localStorage.removeItem(storageKey(threadId))
      return
    }
    window.localStorage.setItem(storageKey(threadId), JSON.stringify(appearance))
  } catch {
    // A large photo can exceed local storage. The in-memory background still applies for this session.
  }
}

export function sameMessageBackground(a: MessageThreadBackground, b: MessageThreadBackground): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "preset" && b.kind === "preset") return a.presetId === b.presetId
  if (a.kind === "image" && b.kind === "image") return a.uri === b.uri
  return true
}

/** Shrink a library photo so it can stay behind this chat after a reload. */
export function fileToBackgroundDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read that photo."))
    reader.onload = () => {
      const source = String(reader.result ?? "")
      const image = new Image()
      image.onload = () => {
        const maxEdge = 1400
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext("2d")
        if (!context) {
          reject(new Error("Could not save that photo."))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", 0.72))
      }
      image.onerror = () => reject(new Error("Could not save that photo."))
      image.src = source
    }
    reader.readAsDataURL(file)
  })
}
