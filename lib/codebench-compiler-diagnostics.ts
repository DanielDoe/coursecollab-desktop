export type StudioDiagnostic = {
  file: string
  line: number
  column: number
  severity: "error" | "warning" | "note" | "fatal"
  message: string
  raw: string
}

const DIAGNOSTIC_RE =
  /^(.*?):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.+)$/

export function parseCompilerDiagnosticsText(text: string): StudioDiagnostic[] {
  const diagnostics: StudioDiagnostic[] = []
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(DIAGNOSTIC_RE)
    if (!match) continue
    const severityRaw = match[4]
    const severity: StudioDiagnostic["severity"] =
      severityRaw === "fatal error" ? "fatal" : (severityRaw as StudioDiagnostic["severity"])
    const path = (match[1] ?? "main.cpp").replace(/\\/g, "/")
    const file = path.split("/").pop() || "main.cpp"
    diagnostics.push({
      file,
      line: Number(match[2]),
      column: Number(match[3]),
      severity,
      message: match[5] ?? "",
      raw,
    })
  }
  return diagnostics
}
