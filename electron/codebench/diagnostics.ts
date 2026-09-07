import type { CompilerDiagnostic } from './types'

const DIAGNOSTIC_RE =
  /^(.*?):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.+)$/

export function parseCompilerDiagnostics(text: string): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = []
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(DIAGNOSTIC_RE)
    if (!match) continue
    const severityRaw = match[4]
    const severity: CompilerDiagnostic['severity'] =
      severityRaw === 'fatal error' ? 'fatal' : (severityRaw as CompilerDiagnostic['severity'])
    diagnostics.push({
      file: sanitizeStudentPath(match[1] ?? 'main.cpp'),
      line: Number(match[2]),
      column: Number(match[3]),
      severity,
      message: match[5] ?? '',
      raw: sanitizeStudentOutput(raw),
    })
  }
  return diagnostics
}

export function sanitizeStudentPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const base = normalized.split('/').pop()
  return base && base.length > 0 ? base : 'main.cpp'
}

export function sanitizeStudentOutput(text: string, workspaceDir?: string): string {
  let next = text
  if (workspaceDir) {
    const variants = [workspaceDir, workspaceDir.replace(/\\/g, '/'), workspaceDir.replace(/\//g, '\\')]
    for (const variant of variants) {
      if (!variant) continue
      next = next.split(variant).join('')
    }
    next = next.replace(/^[/\\]+/gm, '')
  }
  next = next.replace(/(?:[A-Za-z]:)?(?:[\\/][^\\/:\n]+){2,}[\\/](main\.cpp)/g, '$1')
  return next
}
