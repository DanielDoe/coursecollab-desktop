export type InteractiveImageSlot = {
  /** Top-level content field, or key inside `stepImages`. */
  kind: "field" | "stepImages"
  key: string
  label: string
  group?: string
}

export const PI_HARDWARE_INTERACTIVE_VARIANTS = [
  "hardware_kit_layout",
  "camera_orientation",
  "pi_assembly_steps",
  "pi_imager_workflow",
] as const

export type PiHardwareInteractiveVariant = (typeof PI_HARDWARE_INTERACTIVE_VARIANTS)[number]

const PI_ASSEMBLY_IMAGE_SLOTS: InteractiveImageSlot[] = [
  { kind: "stepImages", key: "1", label: "Step 1 — Insert MicroSD Card" },
  { kind: "stepImages", key: "2", label: "Step 2 — Connect HDMI Cable" },
  { kind: "stepImages", key: "3", label: "Step 3 — Connect Keyboard" },
  { kind: "stepImages", key: "4", label: "Step 4 — Connect Mouse" },
  { kind: "stepImages", key: "5", label: "Step 5 — Connect Camera Module" },
  { kind: "stepImages", key: "6", label: "Step 6 — Connect Power" },
]

const PI_IMAGER_IMAGE_SLOTS: InteractiveImageSlot[] = [
  { kind: "stepImages", key: "install:0", label: "Step 1 — Download Raspberry Pi Imager", group: "Section 2 — Installing Raspberry Pi OS" },
  { kind: "stepImages", key: "install:1", label: "Step 2 — Install Raspberry Pi Imager", group: "Section 2 — Installing Raspberry Pi OS" },
  { kind: "stepImages", key: "install:2", label: "Step 3 — Launch Raspberry Pi Imager", group: "Section 2 — Installing Raspberry Pi OS" },
  { kind: "stepImages", key: "device:0", label: "Select Raspberry Pi Device", group: "Section 3 — Configure Raspberry Pi Imager" },
  { kind: "stepImages", key: "device:1", label: "Select Raspberry Pi OS (64-bit)", group: "Section 3 — Configure Raspberry Pi Imager" },
  { kind: "stepImages", key: "device:2", label: "Select Storage Device", group: "Section 3 — Configure Raspberry Pi Imager" },
  { kind: "stepImages", key: "customize:0", label: "Configure Hostname", group: "Section 4 — Customize Raspberry Pi Settings" },
  { kind: "stepImages", key: "customize:1", label: "Configure Localization", group: "Section 4 — Customize Raspberry Pi Settings" },
  { kind: "stepImages", key: "customize:2", label: "Create User Account", group: "Section 4 — Customize Raspberry Pi Settings" },
  { kind: "stepImages", key: "write:0", label: "Review Configuration", group: "Section 5 — Writing Raspberry Pi OS" },
  { kind: "stepImages", key: "write:1", label: "Confirm Installation", group: "Section 5 — Writing Raspberry Pi OS" },
  { kind: "stepImages", key: "write:2", label: "Writing Progress", group: "Section 5 — Writing Raspberry Pi OS" },
  { kind: "stepImages", key: "write:3", label: "Verification Progress", group: "Section 5 — Writing Raspberry Pi OS" },
  { kind: "stepImages", key: "write:4", label: "Installation Complete", group: "Section 5 — Writing Raspberry Pi OS" },
]

export const INTERACTIVE_IMAGE_SLOTS: Record<string, InteractiveImageSlot[]> = {
  pi_hero: [{ kind: "field", key: "imageUrl", label: "Raspberry Pi hero photo" }],
  desktop_vs_pi: [
    { kind: "field", key: "desktopImageUrl", label: "Traditional desktop computer" },
    { kind: "field", key: "piImageUrl", label: "Raspberry Pi board" },
  ],
  pi_hardware_explorer: [{ kind: "field", key: "imageUrl", label: "Raspberry Pi board (labeled view)" }],
  camera_module: [{ kind: "field", key: "imageUrl", label: "Camera module with ribbon cable" }],
  pi_ecosystem: [{ kind: "field", key: "imageUrl", label: "Raspberry Pi with camera connected" }],
  hardware_kit_layout: [{ kind: "field", key: "imageUrl", label: "Complete kit layout (top-down photo)" }],
  camera_orientation: [
    { kind: "field", key: "correctImageUrl", label: "Correct ribbon orientation" },
    { kind: "field", key: "incorrectImageUrl", label: "Incorrect ribbon orientation" },
  ],
  pi_assembly_steps: PI_ASSEMBLY_IMAGE_SLOTS,
  pi_imager_workflow: PI_IMAGER_IMAGE_SLOTS,
  face_eye_pipeline: [{ kind: "field", key: "imageUrl", label: "Face & eye detection pipeline diagram" }],
  camera_verify: [
    { kind: "field", key: "imageUrl", label: "Camera list command screenshot (rpicam-hello --list-cameras)" },
    { kind: "stepImages", key: "0", label: "List cameras — terminal output" },
    { kind: "stepImages", key: "1", label: "Live preview — rpicam-hello window" },
  ],
  desktop_tour: [{ kind: "field", key: "imageUrl", label: "Raspberry Pi desktop screenshot" }],
  opencv_pixels_poll: [{ kind: "field", key: "imageUrl", label: "Pixel grid illustration" }],
  vertical_pipeline: [{ kind: "field", key: "imageUrl", label: "Pipeline illustration" }],
  od_result_viz: [{ kind: "field", key: "originalImageUrl", label: "Original scene image" }],
  manual_bounding_box: [{ kind: "field", key: "imageUrl", label: "Scene for bounding box exercise" }],
  detection_scores: [{ kind: "field", key: "imageUrl", label: "Detection output example" }],
  run_detection: [{ kind: "field", key: "imageUrl", label: "Example live detection screenshot" }],
  od_pipeline_anim: [{ kind: "field", key: "imageUrl", label: "Detection pipeline diagram" }],
}

export function getInteractiveImageSlots(variant: string): InteractiveImageSlot[] | null {
  return INTERACTIVE_IMAGE_SLOTS[variant] ?? null
}

export function readInteractiveImage(
  content: Record<string, unknown>,
  slot: InteractiveImageSlot,
): string {
  if (slot.kind === "stepImages") {
    const map = (content.stepImages as Record<string, string> | undefined) ?? {}
    return String(map[slot.key] ?? "")
  }
  return String(content[slot.key] ?? "")
}

export function writeInteractiveImage(
  content: Record<string, unknown>,
  slot: InteractiveImageSlot,
  url: string,
): Record<string, unknown> {
  if (slot.kind === "stepImages") {
    const map = { ...((content.stepImages as Record<string, string> | undefined) ?? {}), [slot.key]: url }
    return { ...content, stepImages: map }
  }
  return { ...content, [slot.key]: url }
}

/** Resolve image for pi_imager phase step or assembly step number. */
export function readStepImage(
  content: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!content) return undefined

  if (Array.isArray(content.mediaItems) && content.mediaItems.length > 0) {
    const item = (content.mediaItems as Array<{ id: string; imageUrl?: string }>).find((row) => row.id === key)
    const url = item?.imageUrl?.trim()
    return url || undefined
  }

  const map = (content.stepImages as Record<string, string> | undefined) ?? {}
  const url = map[key] || String(content[key] ?? "")
  return url.trim() ? url : undefined
}
