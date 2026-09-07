/**
 * Pick a MediaRecorder mimeType the browser accepts. Safari rejects { mimeType: "audio/webm" }
 * when unsupported — that threw before recording started.
 */
export function createAudioMediaRecorder(stream: MediaStream): MediaRecorder {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support in-browser recording.")
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/ogg;codecs=opus",
  ]
  for (const mimeType of candidates) {
    if (!MediaRecorder.isTypeSupported(mimeType)) continue
    try {
      return new MediaRecorder(stream, { mimeType })
    } catch {
      continue
    }
  }
  return new MediaRecorder(stream)
}
