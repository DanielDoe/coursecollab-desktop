/** Static illustration paths for AI & Edge summer camp interactive blocks. */
export const AI_EDGE_ASSETS = {
  photos: {
    pi4Side: "/summer-camp/ai-edge/photos/pi4-side.jpg",
    pi4Top: "/summer-camp/ai-edge/photos/module-7/pi4-top.jpg",
    pi4SideHero: "/summer-camp/ai-edge/photos/module-7/pi4-side-wikimedia.jpg",
    piWithCamera: "/summer-camp/ai-edge/photos/module-7/pi-with-camera.jpg",
    cameraModuleRibbon: "/summer-camp/ai-edge/photos/module-7/camera-module-ribbon.jpg",
    desktopComputer: "/summer-camp/ai-edge/photos/module-7/desktop-computer.jpg",
    cameraRibbonCorrect: "/summer-camp/ai-edge/photos/camera-ribbon-correct.jpg",
    cameraWithPi: "/summer-camp/ai-edge/photos/camera-with-pi.jpg",
    faceEyeDetectionSample: "/summer-camp/ai-edge/photos/face-eye-detection-sample.png",
    /** Module 8 — real camp setup screenshots (from instructor Pictures folder). */
    m8ImagerDownload: "/summer-camp/ai-edge/photos/module-8/imager-download-page.png",
    m8ImagerInstall: "/summer-camp/ai-edge/photos/module-8/imager-install-drag-app.png",
    m8ImagerLaunch: "/summer-camp/ai-edge/photos/module-8/imager-launch-spotlight.png",
    m8ImagerSelectPi4: "/summer-camp/ai-edge/photos/module-8/imager-select-pi4.png",
    m8ImagerOs64: "/summer-camp/ai-edge/photos/module-8/imager-choose-os-64bit.png",
    m8ImagerStorage: "/summer-camp/ai-edge/photos/module-8/imager-select-storage.png",
    m8ImagerHostname: "/summer-camp/ai-edge/photos/module-8/imager-hostname-filled.png",
    m8ImagerLocalisation: "/summer-camp/ai-edge/photos/module-8/imager-localisation.png",
    m8ImagerUser: "/summer-camp/ai-edge/photos/module-8/imager-create-user.png",
    m8ImagerWriteReview: "/summer-camp/ai-edge/photos/module-8/imager-write-review.png",
    m8ImagerEraseConfirm: "/summer-camp/ai-edge/photos/module-8/imager-erase-confirm.png",
    m8ImagerAdminAuth: "/summer-camp/ai-edge/photos/module-8/imager-admin-auth.png",
    m8ImagerWriting: "/summer-camp/ai-edge/photos/module-8/imager-writing-progress.png",
    m8ImagerComplete: "/summer-camp/ai-edge/photos/module-8/imager-write-complete.png",
    m8PiDesktop: "/summer-camp/ai-edge/photos/module-8/pi-desktop-terminal.png",
    m8CameraList: "/summer-camp/ai-edge/photos/module-8/camera-list-cameras.png",
    m8CameraPreview: "/summer-camp/ai-edge/photos/module-8/camera-live-preview.png",
  },
  vectors: {
    opencvPixels: "/summer-camp/ai-edge/opencv-pixels.svg",
    cvPipeline: "/summer-camp/ai-edge/cv-pipeline.svg",
    piDesktop: "/summer-camp/ai-edge/pi-desktop.svg",
    piImagerUi: "/summer-camp/ai-edge/pi-imager-ui.svg",
    assemblyMicrosd: "/summer-camp/ai-edge/assembly-microsd.svg",
    assemblyHdmi: "/summer-camp/ai-edge/assembly-hdmi.svg",
    assemblyPeripherals: "/summer-camp/ai-edge/assembly-peripherals.svg",
    assemblyCamera: "/summer-camp/ai-edge/assembly-camera.svg",
    assemblyPower: "/summer-camp/ai-edge/assembly-power.svg",
    cameraVerify: "/summer-camp/ai-edge/camera-verify.svg",
  },
  shared: {
    trafficCamera: "/summer-camp/module-0/smart-traffic-camera.png",
    factoryCamera: "/summer-camp/module-0/smart-factory-camera.png",
    warehouseRobot: "/summer-camp/module-0/warehouse-robot.png",
    patternDogs: "/summer-camp/shared/pattern-dog-images.png",
    aiPipeline: "/summer-camp/shared/ai-training-pipeline.png",
    edgeDevice: "/summer-camp/shared/edge-healthcare-device.png",
  },
} as const

const A = AI_EDGE_ASSETS

/** Default image content patches keyed by interactive variant. */
export function defaultInteractiveImageContent(variant: string): Record<string, unknown> {
  switch (variant) {
    case "pi_hero":
      return { imageUrl: A.photos.pi4SideHero }
    case "desktop_vs_pi":
      return { desktopImageUrl: A.photos.desktopComputer, piImageUrl: A.photos.pi4SideHero }
    case "pi_hardware_explorer":
      return { imageUrl: A.photos.pi4Top }
    case "camera_module":
      return { imageUrl: A.photos.cameraModuleRibbon }
    case "pi_ecosystem":
      return { imageUrl: A.photos.piWithCamera }
    case "hardware_kit_layout":
      return { imageUrl: A.photos.pi4Top }
    case "camera_orientation":
      return {
        correctImageUrl: A.photos.cameraRibbonCorrect,
        incorrectImageUrl: A.photos.cameraWithPi,
      }
    case "pi_assembly_steps":
      return {
        stepImages: {
          "1": A.vectors.assemblyMicrosd,
          "2": A.vectors.assemblyHdmi,
          "3": A.vectors.assemblyPeripherals,
          "4": A.vectors.assemblyPeripherals,
          "5": A.vectors.assemblyCamera,
          "6": A.vectors.assemblyPower,
        },
      }
    case "pi_imager_workflow":
      return {
        stepImages: {
          "install:0": A.photos.m8ImagerDownload,
          "install:1": A.photos.m8ImagerInstall,
          "install:2": A.photos.m8ImagerLaunch,
          "device:0": A.photos.m8ImagerSelectPi4,
          "device:1": A.photos.m8ImagerOs64,
          "device:2": A.photos.m8ImagerStorage,
          "customize:0": A.photos.m8ImagerHostname,
          "customize:1": A.photos.m8ImagerLocalisation,
          "customize:2": A.photos.m8ImagerUser,
          "write:0": A.photos.m8ImagerWriteReview,
          "write:1": A.photos.m8ImagerEraseConfirm,
          "write:2": A.photos.m8ImagerAdminAuth,
          "write:3": A.photos.m8ImagerWriting,
          "write:4": A.photos.m8ImagerComplete,
        },
      }
    case "camera_verify":
      return {
        imageUrl: A.photos.m8CameraList,
        stepImages: {
          "0": A.photos.m8CameraList,
          "1": A.photos.m8CameraPreview,
        },
      }
    case "desktop_tour":
      return { imageUrl: A.photos.m8PiDesktop }
    case "opencv_pixels_poll":
      return { imageUrl: A.vectors.opencvPixels }
    case "face_eye_pipeline":
      return { imageUrl: A.vectors.cvPipeline }
    case "face_eye_sample_gallery":
      return {
        samples: [
          {
            title: "Face & Eye Detection Result",
            caption: "Green boxes indicate faces; blue rectangles indicate detected eyes.",
            imageUrl: A.photos.faceEyeDetectionSample,
          },
        ],
        mediaItems: [
          {
            id: "sample:0",
            label: "Face & Eye Detection Result",
            caption: "Green boxes indicate faces; blue rectangles indicate detected eyes.",
            imageUrl: A.photos.faceEyeDetectionSample,
            kind: "sample",
          },
        ],
      }
    case "vertical_pipeline":
      return { imageUrl: A.vectors.cvPipeline }
    case "od_result_viz":
      return { originalImageUrl: A.shared.trafficCamera }
    case "manual_bounding_box":
      return { imageUrl: A.shared.patternDogs }
    case "detection_scores":
      return { imageUrl: A.shared.factoryCamera }
    case "run_detection":
      return { imageUrl: A.shared.trafficCamera }
    case "od_pipeline_anim":
      return { imageUrl: A.shared.aiPipeline }
    default:
      return {}
  }
}

/** Merge default images into block content without overwriting existing URLs. */
export function mergeInteractiveImages(
  variant: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  const defaults = defaultInteractiveImageContent(variant)
  if (!Object.keys(defaults).length) return content

  const next = { ...content }

  for (const [key, value] of Object.entries(defaults)) {
    if (key === "samples" && Array.isArray(value)) {
      const existing = Array.isArray(next.samples) ? (next.samples as Array<Record<string, unknown>>) : []
      const existingMedia = Array.isArray(next.mediaItems) ? next.mediaItems : []
      if (existing.length === 0 && existingMedia.length === 0) {
        next.samples = value
        if (variant === "face_eye_sample_gallery") {
          next.mediaItems = (value as Array<{ title?: string; caption?: string; imageUrl?: string }>).map(
            (sample, i) => ({
              id: `sample:${i}`,
              label: String(sample.title ?? "Sample result"),
              caption: sample.caption ? String(sample.caption) : undefined,
              imageUrl: sample.imageUrl ? String(sample.imageUrl) : undefined,
              kind: "sample",
            }),
          )
        }
        continue
      }
      const defaultSamples = value as Array<{ imageUrl?: string }>
      next.samples = existing.map((sample, i) => ({
        ...sample,
        imageUrl:
          String(sample.imageUrl ?? "").trim() ||
          String(defaultSamples[i]?.imageUrl ?? defaultSamples[0]?.imageUrl ?? "").trim() ||
          undefined,
      }))
      continue
    }
    if (key === "stepImages" && value && typeof value === "object") {
      const existing = (next.stepImages as Record<string, string> | undefined) ?? {}
      const merged = { ...(value as Record<string, string>) }
      for (const [sk, sv] of Object.entries(existing)) {
        if (String(sv).trim()) merged[sk] = sv
      }
      next.stepImages = merged
      continue
    }
    if (!String(next[key] ?? "").trim()) {
      next[key] = value
    }
  }

  return next
}
