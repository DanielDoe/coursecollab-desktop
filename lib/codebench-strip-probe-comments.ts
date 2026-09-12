/** Test-only comments injected during live-classroom checks. Never part of student work. */
const PROBE_LINE =
  /^[ \t]*\/\/[ \t]*(?:KEYSTROKE PROBE|E2E LIVE|LIVE CHECK)[ \t]+\d+[ \t]*$/gm
const STREAM_CHECK_LINE = /^[ \t]*\/\/[ \t]*stream-check[ \t]*$/gm

export function stripCodebenchProbeComments(source: string): string {
  if (!source) return source
  const next = source.replace(PROBE_LINE, "").replace(STREAM_CHECK_LINE, "")
  return next.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n")
}
