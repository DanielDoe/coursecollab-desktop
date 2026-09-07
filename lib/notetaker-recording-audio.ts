/**
 * Mic constraints for notetaker recording. `noiseSuppression: false` often helps Chrome
 * deliver audio to both MediaRecorder and the Web Speech API at the same time.
 * After `getUserMedia`, see `notetaker-mic-gain.ts` for optional linear gain + light compression.
 */

/** `room`: turn off browser AGC so a loud talker does not duck quieter voices farther from the mic. */
export type NotetakerAudioCaptureMode = "default" | "room"

export function getNotetakerAudioCaptureMode(): NotetakerAudioCaptureMode {
  if (typeof process === "undefined") return "default"
  const m = process.env.NEXT_PUBLIC_NOTETAKER_AUDIO_MODE?.trim().toLowerCase()
  return m === "room" ? "room" : "default"
}

export function getNotetakerRecordingAudioConstraints(): MediaStreamConstraints {
  const room = getNotetakerAudioCaptureMode() === "room"
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: false,
      /** AGC often pulls gain down when you are loud, which hides softer room / background speech. */
      autoGainControl: !room,
    },
  }
}
