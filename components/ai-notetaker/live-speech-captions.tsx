"use client"

import { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { getLiveCaptionsPlatform, type LiveCaptionsPlatform } from "@/lib/browser-live-captions-capability"
import { logAiNotetakerClient } from "@/lib/ai-notetaker-client-log"
import { useMicLevelMeter } from "@/hooks/use-mic-level-meter"

/** BCP-47 tags Chrome generally supports for Web Speech. */
const SPEECH_RECOGNITION_LANGS: { value: string; label: string }[] = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-IN", label: "English (India)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-MX", label: "Spanish (Mexico)" },
  { value: "fr-FR", label: "French" },
  { value: "de-DE", label: "German" },
  { value: "it-IT", label: "Italian" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "zh-CN", label: "Chinese (Mandarin)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "ar-SA", label: "Arabic" },
  { value: "fil-PH", label: "Filipino" },
]

function pickDefaultSpeechLang(override?: string | null): string {
  const o = override?.trim()
  if (o) return o
  if (typeof navigator === "undefined") return "en-US"
  const raw = (navigator.language || "en-US").replace("_", "-")
  if (SPEECH_RECOGNITION_LANGS.some((x) => x.value === raw)) return raw
  const prefix = raw.split("-")[0]?.toLowerCase()
  if (prefix) {
    const hit = SPEECH_RECOGNITION_LANGS.find((x) => x.value.toLowerCase().startsWith(`${prefix}-`))
    if (hit) return hit.value
  }
  return "en-US"
}

type SpeechRecCtor = new () => {
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  lang: string
  onstart: (() => void) | null
  onaudiostart: (() => void) | null
  onaudioend: (() => void) | null
  onsoundstart: (() => void) | null
  onsoundend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  onnomatch: (() => void) | null
  onresult: ((ev: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null
  onerror: ((ev: { error: string; message?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecCtor
    webkitSpeechRecognition?: SpeechRecCtor
    webkitAudioContext?: typeof AudioContext
  }
}

type SpeechRecognitionInstance = InstanceType<SpeechRecCtor>

/**
 * Chrome only tolerates one active Web Speech session per tab. Two `LiveSpeechCaptions` mounts
 * (e.g. React Strict Mode dev double-invoke, or accidental duplicate in the tree) each schedule
 * `onend` → `start()` and mutually abort forever (`error: aborted` spam).
 */
let heldSpeechRecognition: SpeechRecognitionInstance | null = null

function tryAcquireSpeechRecognition(rec: SpeechRecognitionInstance): boolean {
  try {
    if (heldSpeechRecognition && heldSpeechRecognition !== rec) {
      try {
        heldSpeechRecognition.stop()
      } catch {
        /* ignore */
      }
      heldSpeechRecognition = null
    }
    rec.start()
    heldSpeechRecognition = rec
    return true
  } catch {
    return false
  }
}

function releaseSpeechRecognitionHolderIfCurrent(rec: SpeechRecognitionInstance) {
  if (heldSpeechRecognition === rec) heldSpeechRecognition = null
}

/** Latest `useEffect` run that owns speech setup (dev Strict Mode + duplicate mounts otherwise double-log / double-schedule). */
let liveSpeechCaptionEffectGeneration = 0

/**
 * Browser live captions while recording: native Web Speech API (Chrome/Edge). Recognition language
 * follows the optional `lang` prop or the browser default (no in-widget picker).
 */
export function LiveSpeechCaptions({
  active,
  className,
  /** Optional BCP-47 override; otherwise we use the browser language. */
  lang,
  onTranscriptChange,
  /** Same stream as MediaRecorder — used for diagnostics / stall logging (mic path vs speech path). */
  meterStream,
  /** Set synchronously in parent when getUserMedia resolves (before React re-renders state). */
  meterStreamRef,
  /** Optional: numeric student id for batched server logs (see `NEXT_PUBLIC_AI_NOTETAKER_CLIENT_LOG`). */
  studentDatabaseId,
}: {
  active: boolean
  className?: string
  lang?: string | null
  onTranscriptChange?: (text: string) => void
  meterStream?: MediaStream | null
  meterStreamRef?: RefObject<MediaStream | null>
  studentDatabaseId?: string | null
}) {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [finalText, setFinalText] = useState("")
  const [interim, setInterim] = useState("")
  const [speechError, setSpeechError] = useState<string | null>(null)
  const recRef = useRef<InstanceType<SpeechRecCtor> | null>(null)

  const [enginePhase, setEnginePhase] = useState<"idle" | "starting" | "listening" | "ended">("idle")
  const [resultEventCount, setResultEventCount] = useState(0)
  const [speechLang, setSpeechLang] = useState(() => pickDefaultSpeechLang(lang ?? null))
  useEffect(() => {
    setSpeechLang(pickDefaultSpeechLang(lang ?? null))
  }, [lang])
  const [audioStartCount, setAudioStartCount] = useState(0)
  const [soundStartCount, setSoundStartCount] = useState(0)
  const [speechStartCount, setSpeechStartCount] = useState(0)

  const sessionIdRef = useRef<string | null>(null)
  if (sessionIdRef.current == null && typeof window !== "undefined") {
    sessionIdRef.current = `ls-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
  const sessionId = sessionIdRef.current ?? "ls-pending"
  const studentIdRef = useRef(studentDatabaseId)
  studentIdRef.current = studentDatabaseId
  const log = useCallback(
    (event: string, detail?: Record<string, unknown>) => {
      logAiNotetakerClient(studentIdRef.current, "live-speech-captions", event, {
        ...detail,
        sessionId,
        speechLang,
      })
    },
    [sessionId, speechLang],
  )

  const resolvedMeterStream = meterStream ?? meterStreamRef?.current ?? null
  const hasMeterSource = Boolean(meterStream ?? meterStreamRef?.current)
  const micLevel = useMicLevelMeter(resolvedMeterStream, active && hasMeterSource)
  const micLevelRef = useRef(0)
  micLevelRef.current = micLevel

  const stallSnapshotRef = useRef({
    results: 0,
    speech: 0,
    sound: 0,
    audio: 0,
    mic: 0,
  })
  const speechSoftRestartAttemptsRef = useRef(0)
  /** Once we have captions, Chrome can still stop emitting `onresult` while staying "listening"; track and kick via `stop()` → `onend` restart. */
  const lastHeardResultCountRef = useRef(0)
  const stagnantResultsSinceRef = useRef<number | null>(null)
  const midSessionStallKickCountRef = useRef(0)
  const blindStallKickCountRef = useRef(0)
  const missingMeterLoggedRef = useRef(false)
  /** Generation of the active speech `useEffect` (see `liveSpeechCaptionEffectGeneration`). */
  const speechCaptionInstanceGenRef = useRef(0)

  const speechLangRef = useRef(speechLang)
  speechLangRef.current = speechLang

  const [platform, setPlatform] = useState<LiveCaptionsPlatform>("pending")

  useLayoutEffect(() => {
    stallSnapshotRef.current = {
      results: resultEventCount,
      speech: speechStartCount,
      sound: soundStartCount,
      audio: audioStartCount,
      mic: micLevel,
    }
  }, [resultEventCount, speechStartCount, soundStartCount, audioStartCount, micLevel])

  useEffect(() => {
    const p = getLiveCaptionsPlatform()
    setPlatform(p)
    logAiNotetakerClient(studentIdRef.current, "live-speech-captions", "platform_detected", {
      platform: p,
      sessionId,
      speechLang: speechLangRef.current,
    })
  }, [sessionId])

  useEffect(() => {
    if (!active || !studentDatabaseId?.trim()) return
    if (resolvedMeterStream) {
      missingMeterLoggedRef.current = false
      return
    }
    if (!missingMeterLoggedRef.current) {
      missingMeterLoggedRef.current = true
      logAiNotetakerClient(studentIdRef.current, "live-speech-captions", "meter_stream_missing", { sessionId })
    }
  }, [active, resolvedMeterStream, studentDatabaseId, sessionId])

  useEffect(() => {
    if (!active) {
      speechCaptionInstanceGenRef.current = 0
      lastHeardResultCountRef.current = 0
      stagnantResultsSinceRef.current = null
      midSessionStallKickCountRef.current = 0
      blindStallKickCountRef.current = 0
      try {
        recRef.current?.stop()
      } catch {
        /* ignore */
      }
      recRef.current = null
      setInterim("")
      setEnginePhase("idle")
      setResultEventCount(0)
      setAudioStartCount(0)
      setSoundStartCount(0)
      setSpeechStartCount(0)
      return
    }

    setFinalText("")
    setInterim("")
    setSpeechError(null)
    setEnginePhase("starting")
    setResultEventCount(0)
    speechSoftRestartAttemptsRef.current = 0
    setAudioStartCount(0)
    setSoundStartCount(0)
    setSpeechStartCount(0)

    if (platform === "pending") {
      speechCaptionInstanceGenRef.current = 0
      return () => {}
    }
    if (platform !== "chromium") {
      speechCaptionInstanceGenRef.current = 0
      setSupported(false)
      setEnginePhase("idle")
      log("speech_skipped_non_chromium", { platform })
      return () => {}
    }

    const Ctor = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined
    if (!Ctor) {
      speechCaptionInstanceGenRef.current = 0
      setSupported(false)
      setEnginePhase("idle")
      log("speech_ctor_missing", {})
      return () => {}
    }
    setSupported(true)

    liveSpeechCaptionEffectGeneration += 1
    const speechEffectGen = liveSpeechCaptionEffectGeneration
    speechCaptionInstanceGenRef.current = speechEffectGen
    const isCurrentSpeechEffect = () => speechEffectGen === liveSpeechCaptionEffectGeneration

    const meterStreamForLog = meterStream ?? meterStreamRef?.current ?? null
    const meterTrack = meterStreamForLog?.getAudioTracks()[0]
    const meterSettings = meterTrack?.getSettings?.() ?? {}
    log("speech_engine_starting", {
      speechLang,
      dualCaptureNote:
        "Mic bar = MediaRecorder stream; Web Speech = separate Chrome mic path (same device usually). Meter moving does not prove Google speech received usable audio.",
      meterDeviceId: typeof meterSettings.deviceId === "string" ? meterSettings.deviceId : undefined,
      meterLabel: meterTrack?.label,
    })

    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.lang = speechLang

    let accumulated = ""
    /** Last displayed interim (flat); used to salvage text when Chrome replaces slot-0 with an unrelated shorter string. */
    let lastFlatInterim = ""
    let cancelled = false
    let didStart = false
    let intentionalStop = false
    let abortRetries = 0

    const pendingTimeouts: number[] = []
    const armTimeout = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      pendingTimeouts.push(id)
      return id
    }

    rec.onstart = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
      setEnginePhase("listening")
      log("speech_onstart", {})
    }

    rec.onaudiostart = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
      setAudioStartCount((c) => c + 1)
      log("speech_onaudiostart", {})
    }

    rec.onsoundstart = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
      setSoundStartCount((c) => c + 1)
      log("speech_onsoundstart", {})
    }

    rec.onsoundend = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
    }

    rec.onspeechstart = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
      setSpeechStartCount((c) => c + 1)
      log("speech_onspeechstart", {})
    }

    rec.onspeechend = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
    }

    rec.onnomatch = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
      log("speech_onnomatch", {})
    }

    rec.onresult = (event) => {
      if (cancelled || !isCurrentSpeechEffect()) return
      setResultEventCount((c) => c + 1)
      let sawText = false
      // Newly finalized segments only appear from `resultIndex` onward; append those to the
      // running transcript (MDN: resultIndex = first result that changed in this event).
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        const piece = (r[0]?.transcript ?? "").trim()
        if (!piece) continue
        if (r.isFinal) {
          sawText = true
          accumulated = accumulated ? `${accumulated} ${piece}` : piece
        }
      }
      // Interim text: must rebuild from **all** results (0..length-1). Earlier indices stay
      // interim across events; if we only loop from resultIndex, the UI keeps only the tail and
      // looks like it "replaces" the whole caption with the latest fragment.
      let chunkInterim = ""
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) continue
        const raw = r[0]?.transcript ?? ""
        if (!raw.trim()) continue
        sawText = true
        chunkInterim += raw
      }
      const curTrim = chunkInterim.trimEnd()
      const prevTrim = lastFlatInterim.trimEnd()
      // Single-result interim often mutates in place; when the engine discards a longer hypothesis for
      // an unrelated shorter one, append the previous line so words are not lost from the UI.
      if (
        prevTrim.length >= 6 &&
        curTrim.length > 0 &&
        curTrim.length < prevTrim.length &&
        !prevTrim.startsWith(curTrim) &&
        !curTrim.startsWith(prevTrim)
      ) {
        const salvage = prevTrim.replace(/\s+/g, " ").trim()
        if (salvage.length >= 6) {
          accumulated = accumulated ? `${accumulated} ${salvage}` : salvage
          sawText = true
          log("speech_interim_hypothesis_reset_salvage", {
            prevLen: prevTrim.length,
            curLen: curTrim.length,
          })
        }
      }
      lastFlatInterim = curTrim
      setFinalText(accumulated)
      setInterim(chunkInterim.trimEnd())
      if (!sawText && event.results.length > 0) {
        log("speech_onresult_empty_transcripts", {
          resultIndex: event.resultIndex,
          resultCount: event.results.length,
        })
      }
      log("speech_onresult", {
        resultIndex: event.resultIndex,
        resultCount: event.results.length,
        sawText,
        finalLen: accumulated.length,
        interimLen: chunkInterim.length,
      })
    }

    rec.onerror = (e) => {
      if (!isCurrentSpeechEffect()) return
      if (e.error === "no-speech") {
        log("speech_error", { error: e.error })
        return
      }
      if (e.error === "aborted") {
        log("speech_error", { error: e.error, intentionalStop, cancelled, abortRetries })
        if (intentionalStop || cancelled) return
        if (heldSpeechRecognition !== rec) return
        if (abortRetries < 4) {
          abortRetries += 1
          didStart = false
          armTimeout(() => {
            if (cancelled || intentionalStop || !isCurrentSpeechEffect()) return
            if (heldSpeechRecognition !== rec) return
            if (tryAcquireSpeechRecognition(rec)) {
              didStart = true
              log("speech_restart_after_abort", { attempt: abortRetries })
            }
          }, 650)
        }
        return
      }
      if (e.error === "not-allowed") {
        setSpeechError("Microphone permission is required for live captions.")
        setEnginePhase("idle")
        log("speech_error_fatal", { error: e.error })
        return
      }
      if (e.error === "network") {
        setSpeechError(
          "Live captions need an internet connection (Chrome/Edge send audio to Google for recognition). Your lecture is still recorded; you'll get a full transcript after you stop.",
        )
        setEnginePhase("idle")
        log("speech_error_fatal", { error: e.error })
        return
      }
      if (e.error === "service-not-allowed") {
        setSpeechError("Live captions are not available in this browser or session. Recording still works.")
        setEnginePhase("idle")
        log("speech_error_fatal", { error: e.error })
        return
      }
      if (e.error === "audio-capture") {
        setSpeechError(
          "Could not capture audio for captions—another tab or app may be using the mic, or try a different input device.",
        )
        setEnginePhase("idle")
        log("speech_error_fatal", { error: e.error })
        return
      }
      setSpeechError(e.message || e.error)
      setEnginePhase("idle")
      log("speech_error_fatal", { error: e.error, message: e.message })
    }

    rec.onend = () => {
      if (cancelled || !isCurrentSpeechEffect()) return
      if (heldSpeechRecognition !== rec) {
        setEnginePhase("idle")
        return
      }
      setEnginePhase("ended")
      log("speech_onend", {})
      const restartAfterOnEnd = (delayMs: number, attempt: number) => {
        armTimeout(() => {
          if (cancelled || !isCurrentSpeechEffect()) return
          if (heldSpeechRecognition !== rec) return
          setEnginePhase("starting")
          if (tryAcquireSpeechRecognition(rec)) {
            didStart = true
            log(attempt === 0 ? "speech_restart_after_onend" : "speech_restart_after_onend_retry_ok", { attempt })
            return
          }
          if (attempt < 8) {
            const nextDelay = attempt === 0 ? 220 : attempt < 3 ? 450 : attempt < 6 ? 900 : 1600
            log("speech_restart_after_onend_retry", { attempt: attempt + 1, nextDelayMs: nextDelay })
            restartAfterOnEnd(nextDelay, attempt + 1)
            return
          }
          log("speech_restart_after_onend_exhausted", {})
          setSpeechError(
            "Live captions stopped (speech engine would not restart). Your recording is still fine—try pausing and resuming recording, or refresh the page.",
          )
          setEnginePhase("idle")
        }, delayMs)
      }
      restartAfterOnEnd(180, 0)
    }

    recRef.current = rec

    const attemptStart = (delayMs: number) => {
      const run = () => {
        if (cancelled || didStart || !isCurrentSpeechEffect()) return
        if (tryAcquireSpeechRecognition(rec)) {
          didStart = true
          return
        }
        if (delayMs === 0) {
          armTimeout(() => attemptStart(120), 120)
        } else if (delayMs < 400) {
          armTimeout(() => attemptStart(400), 280)
        } else {
          log("speech_start_exhausted", { delayMs })
          setSpeechError(
            "Could not start live captions (speech engine rejected start). Try pausing recording briefly or use Chrome on a stable connection.",
          )
          setEnginePhase("idle")
        }
      }
      if (delayMs === 0) queueMicrotask(run)
      else armTimeout(run, delayMs)
    }

    /** Defer Web Speech until MediaRecorder has the mic — too-early start often yields `aborted` + zero results in Chrome. */
    const speechStartDelayMs = 1100
    log("speech_schedule_start", { delayMs: speechStartDelayMs })
    armTimeout(() => attemptStart(0), speechStartDelayMs)

    return () => {
      cancelled = true
      intentionalStop = true
      speechCaptionInstanceGenRef.current = 0
      for (const id of pendingTimeouts) window.clearTimeout(id)
      rec.onend = null
      rec.onerror = null
      rec.onresult = null
      rec.onstart = null
      rec.onaudiostart = null
      rec.onaudioend = null
      rec.onsoundstart = null
      rec.onsoundend = null
      rec.onspeechstart = null
      rec.onspeechend = null
      rec.onnomatch = null
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
      releaseSpeechRecognitionHolderIfCurrent(rec)
      if (recRef.current === rec) recRef.current = null
    }
  }, [active, speechLang, platform, log, meterStream])

  useEffect(() => {
    if (platform !== "chromium" || !active || enginePhase !== "listening") return
    if (resultEventCount > 0) return
    const id = window.setTimeout(() => {
      if (
        speechCaptionInstanceGenRef.current === 0 ||
        speechCaptionInstanceGenRef.current !== liveSpeechCaptionEffectGeneration
      ) {
        return
      }
      const snap = stallSnapshotRef.current
      log("listening_stalled_12s", {
        micLevel: snap.mic,
        resultEventCount: snap.results,
        speechStartCount: snap.speech,
        soundStartCount: snap.sound,
        audioStartCount: snap.audio,
      })
      const micLooksLive = snap.mic > 0.04
      const engineSawAudio = snap.audio > 0 || snap.sound > 0 || snap.speech > 0
      if (snap.results === 0 && speechSoftRestartAttemptsRef.current < 2 && (micLooksLive || engineSawAudio)) {
        speechSoftRestartAttemptsRef.current += 1
        log("speech_soft_restart_attempt", {
          attempt: speechSoftRestartAttemptsRef.current,
          micLooksLive,
          engineSawAudio,
        })
        try {
          recRef.current?.stop()
        } catch {
          /* ignore */
        }
      }
    }, 12000)
    return () => {
      window.clearTimeout(id)
    }
  }, [active, enginePhase, resultEventCount, platform, log])

  useEffect(() => {
    if (platform !== "chromium" || !active) return
    const id = window.setInterval(() => {
      if (
        speechCaptionInstanceGenRef.current === 0 ||
        speechCaptionInstanceGenRef.current !== liveSpeechCaptionEffectGeneration
      ) {
        return
      }
      const snap = stallSnapshotRef.current
      log("mic_sample", {
        micLevel: snap.mic,
        enginePhase,
        resultEventCount: snap.results,
        speechStartCount: snap.speech,
      })

      // Mid-session: Chrome often stops firing `onresult` while `enginePhase` stays listening; the
      // 12s watchdog above only runs when zero results ever arrived (`resultEventCount === 0`).
      if (enginePhase === "listening" && recRef.current && snap.results > 0) {
        if (snap.results !== lastHeardResultCountRef.current) {
          lastHeardResultCountRef.current = snap.results
          stagnantResultsSinceRef.current = null
        } else if (stagnantResultsSinceRef.current === null) {
          stagnantResultsSinceRef.current = Date.now()
        } else {
          const staleMs = Date.now() - stagnantResultsSinceRef.current
          const micLikelySpeech = snap.mic > 0.028
          const longBlindStall = staleMs > 95_000 && blindStallKickCountRef.current < 3
          if (
            midSessionStallKickCountRef.current < 18 &&
            ((staleMs > 52_000 && micLikelySpeech) || longBlindStall)
          ) {
            midSessionStallKickCountRef.current += 1
            if (longBlindStall) blindStallKickCountRef.current += 1
            stagnantResultsSinceRef.current = null
            log("speech_mid_session_stall_kick", {
              staleMs,
              micLikelySpeech,
              longBlindStall,
              kicks: midSessionStallKickCountRef.current,
              resultEventCount: snap.results,
            })
            try {
              recRef.current.stop()
            } catch {
              /* ignore */
            }
          }
        }
      }
    }, 3000)
    return () => clearInterval(id)
  }, [active, platform, enginePhase, log])

  useEffect(() => {
    if (!active || !onTranscriptChange) return
    const combined = [finalText.trim(), interim.trim()].filter(Boolean).join(" ").trim()
    onTranscriptChange(combined)
  }, [active, finalText, interim, onTranscriptChange])

  if (!active) return null

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md ring-1 ring-slate-900/[0.04] dark:border-slate-700/90 dark:bg-slate-950 dark:ring-white/[0.06]",
        className,
      )}
    >
      <div className="border-b border-[var(--border)] bg-[var(--cc-accent-soft)]/40 px-3 py-2 dark:border-[var(--border)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
          Live text
        </p>
      </div>
      <div className="p-3 sm:p-4">
        {platform === "chromium" && (supported === true || supported === null) ? (
          <div
            className="flex min-h-[5.5rem] max-h-[220px] flex-col overflow-y-auto rounded-xl bg-[var(--sidebar-accent)]/25 px-3 py-3 text-[15px] leading-relaxed text-[var(--cc-text)]"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Live captions"
          >
            {speechError ? (
              <p className="text-sm text-red-700 dark:text-red-300">{speechError}</p>
            ) : supported === null ? null : (
              <>
                {finalText ? <span className="text-[var(--cc-text)]">{finalText}</span> : null}
                {interim ? (
                  <span className="text-[var(--cc-accent-dark)]">
                    {finalText ? " " : ""}
                    {interim}
                  </span>
                ) : null}
              </>
            )}
          </div>
        ) : speechError ? (
          <p className="text-sm text-red-700 dark:text-red-300">{speechError}</p>
        ) : platform !== "chromium" && platform !== "pending" ? (
          <p className="text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Full transcript appears here when you stop. Live typing needs Chrome or Edge on desktop.
          </p>
        ) : null}
      </div>
    </div>
  )
}
