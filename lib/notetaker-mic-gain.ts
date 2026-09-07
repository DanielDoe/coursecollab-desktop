import { getNotetakerAudioCaptureMode } from "./notetaker-recording-audio"

/**
 * Software gain for very quiet speech on the **recording** path (MediaRecorder + our level meter).
 * Chrome Web Speech live captions still tap the microphone separately; this does not change that path.
 *
 * Set `NEXT_PUBLIC_NOTETAKER_MIC_GAIN` to a linear multiplier (e.g. `2.5` or `3.5`). Default 2.5 (or 3 in
 * `NEXT_PUBLIC_NOTETAKER_AUDIO_MODE=room` when unset). Max 5. Use 1 to disable. High values can clip.
 */
export function getNotetakerMicLinearGain(): number {
  const roomDefault = getNotetakerAudioCaptureMode() === "room" ? 3 : 2.5
  if (typeof process === "undefined") return roomDefault
  const raw = process.env.NEXT_PUBLIC_NOTETAKER_MIC_GAIN
  if (raw == null || String(raw).trim() === "") return roomDefault
  const n = Number.parseFloat(String(raw).trim())
  if (!Number.isFinite(n)) return roomDefault
  return Math.min(5, Math.max(1, n))
}

export type NotetakerMicGainBridge = {
  /** Use this stream for MediaRecorder and metering. */
  gainedStream: MediaStream
  /** Call when recording ends (after MediaRecorder stops), then stop raw `getUserMedia` tracks. */
  release: () => void
}

/**
 * Wraps the raw mic in GainNode → light DynamicsCompressor → destination (reduces clipping when gain is high).
 * When gain ≤ 1, returns the raw stream and a no-op release.
 */
export async function createNotetakerMicGainBridge(rawStream: MediaStream): Promise<NotetakerMicGainBridge> {
  const g = getNotetakerMicLinearGain()
  if (g <= 1.001) {
    return { gainedStream: rawStream, release: () => {} }
  }

  const Ctx =
    typeof globalThis !== "undefined"
      ? globalThis.AudioContext ||
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined
  if (!Ctx) {
    return { gainedStream: rawStream, release: () => {} }
  }

  const ctx = new Ctx()
  const source = ctx.createMediaStreamSource(rawStream)
  const gainNode = ctx.createGain()
  gainNode.gain.value = g
  const dest = ctx.createMediaStreamDestination()
  const room = getNotetakerAudioCaptureMode() === "room"
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = room ? -40 : -36
  comp.knee.value = 14
  comp.ratio.value = room ? 3.1 : 2.6
  comp.attack.value = 0.004
  comp.release.value = 0.22

  source.connect(gainNode)
  gainNode.connect(comp)
  comp.connect(dest)

  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {})
  }

  let released = false
  const release = () => {
    if (released) return
    released = true
    try {
      source.disconnect()
    } catch {
      /* ignore */
    }
    try {
      gainNode.disconnect()
    } catch {
      /* ignore */
    }
    try {
      comp.disconnect()
    } catch {
      /* ignore */
    }
    try {
      dest.disconnect()
    } catch {
      /* ignore */
    }
    void ctx.close()
  }

  return { gainedStream: dest.stream, release }
}
