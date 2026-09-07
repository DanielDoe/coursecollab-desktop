import Image from "next/image"

export type DeviceShot = {
  src: string
  alt: string
  width: number
  height: number
}

/** MacBook-style frame. Screen adapts to the image's intrinsic aspect. */
export function LaptopFrame({
  shot,
  sizes = "(max-width: 1024px) 92vw, 820px",
  priority = false,
}: {
  shot: DeviceShot
  sizes?: string
  priority?: boolean
}) {
  return (
    <div className="relative mx-auto w-full">
      <div className="rounded-t-[1.1rem] border border-b-0 border-slate-700/70 bg-[#0f1219] p-[1.6%] pb-[0.9%] shadow-[0_32px_70px_-30px_rgba(15,18,25,0.55)]">
        <div className="overflow-hidden rounded-[0.55rem] bg-black">
          <Image
            src={shot.src}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            priority={priority}
            sizes={sizes}
            className="block h-auto w-full"
          />
        </div>
      </div>
      <div className="mx-[-3.5%] h-[13px] rounded-b-[0.9rem] bg-gradient-to-b from-[#2a2f3a] to-[#161a22] shadow-[0_10px_24px_-12px_rgba(15,18,25,0.6)] sm:h-[17px]">
        <div className="mx-auto h-[5px] w-[12%] rounded-b-md bg-[#0c0f15]" />
      </div>
    </div>
  )
}

/** Tablet-style frame with even bezels. Screen adapts to the image's intrinsic aspect. */
export function TabletFrame({
  shot,
  sizes = "(max-width: 1024px) 92vw, 520px",
}: {
  shot: DeviceShot
  sizes?: string
}) {
  return (
    <div className="relative mx-auto w-full rounded-[1.4rem] border border-slate-700/70 bg-[#0f1219] p-[2.4%] shadow-[0_28px_60px_-28px_rgba(15,18,25,0.55)]">
      <div className="overflow-hidden rounded-[0.75rem] bg-black">
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          sizes={sizes}
          className="block h-auto w-full"
        />
      </div>
    </div>
  )
}

/**
 * Simulator phone capture — the bezel is part of the image, so no CSS frame.
 *
 * The shadow is deliberately tiny (5px offset, 14px blur = 19px of reach).
 * Two reasons it cannot be generous:
 *
 * 1. Several of these captures are cropped flush at the bottom of the canvas,
 *    so the silhouette ends in a straight horizontal line. `drop-shadow`
 *    follows that silhouette, and a big offset shadow off a straight edge
 *    renders as a grey rectangle rather than a device shadow.
 * 2. The devices sit near the bottom of their card, so a long shadow gets
 *    sliced by the card's `overflow-hidden` and ends in a hard horizontal cut.
 *
 * Earlier these PNGs also shipped a black shadow baked into their alpha channel
 * (up to 15px), which stacked with this one; those have been stripped.
 */
export function PhoneShot({
  shot,
  sizes = "(max-width: 768px) 45vw, 220px",
  className,
}: {
  shot: DeviceShot
  sizes?: string
  className?: string
}) {
  return (
    <Image
      src={shot.src}
      alt={shot.alt}
      width={shot.width}
      height={shot.height}
      sizes={sizes}
      className={`block h-auto w-full drop-shadow-[0_5px_14px_rgba(15,23,42,0.20)] ${className ?? ""}`}
    />
  )
}

/**
 * The canonical device pairing for the landing page: iPhone on the left, a gap,
 * then the laptop — bottoms aligned, nothing overlapping.
 *
 * Every composition (hero, Cora personas, feature spotlight) renders through
 * this one component so the three cannot drift apart in proportion or spacing.
 * An earlier version had the phone standing in front of the laptop; the overlap
 * covered the left column of whatever web screenshot sat behind it.
 *
 * Widths: phone 22% of the row, laptop 74%, 4% gap — putting the phone at ~0.30
 * of the laptop's width. Real hardware is ~0.23 (an iPhone 15 Pro is 70.6mm
 * against a 14" MacBook's 312mm screen); the small excess keeps the handset
 * legible without reading as a giant slab next to a toy computer.
 */
export function DeviceDuo({
  web,
  phone,
  priority = false,
  webSizes = "(max-width: 640px) 68vw, (max-width: 1024px) 54vw, 420px",
  phoneSizes = "(max-width: 640px) 21vw, (max-width: 1024px) 16vw, 125px",
  /**
   * Tuck the phone slightly over the laptop's near edge. Off by default: on the
   * landing page the overlap hid the left column of the web screenshots. Opt in
   * only where the laptop's left edge carries nothing important.
   */
  overlap = false,
  className,
}: {
  web: DeviceShot
  phone: DeviceShot
  priority?: boolean
  webSizes?: string
  phoneSizes?: string
  overlap?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex w-full items-end justify-center ${overlap ? "gap-0" : "gap-[4%]"} ${
        className ?? ""
      }`}
    >
      {/*
        data-duo-phone / data-duo-web are styling hooks, not behaviour. They let
        a parent choreograph the two devices from CSS (see .cc-duo-tour in
        globals.css) without this component knowing anything about it, and
        without depending on child order or Tailwind class strings.
      */}
      <div data-duo-phone className={`w-[22%] shrink-0 ${overlap ? "relative z-10" : ""}`}>
        <PhoneShot shot={phone} sizes={phoneSizes} />
      </div>
      <div data-duo-web className={`w-[74%] min-w-0 ${overlap ? "-ml-[5%]" : ""}`}>
        <LaptopFrame shot={web} sizes={webSizes} priority={priority} />
      </div>
    </div>
  )
}
