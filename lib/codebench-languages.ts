import { stripCodebenchProbeComments } from "@/lib/codebench-strip-probe-comments"

export type CodebenchLanguageId = "cpp" | "c" | "python"

export type CodebenchLanguage = {
  id: CodebenchLanguageId
  label: string
  monacoLanguage: string
  fileName: string
  /** Value sent to CodeBench API routes */
  apiLanguage: string
  defaultCode: string
}

export const CODEBENCH_LANGUAGE_STORAGE_KEY = "codebench_language_id"

export const CODEBENCH_LANGUAGES: CodebenchLanguage[] = [
  {
    id: "cpp",
    label: "C++",
    monacoLanguage: "cpp",
    fileName: "main.cpp",
    apiLanguage: "cpp",
    defaultCode: `#include <iostream>
using namespace std;

int main() {
    // Your code goes here

    return 0;
}`,
  },
  {
    id: "c",
    label: "C",
    monacoLanguage: "c",
    fileName: "main.c",
    apiLanguage: "c",
    defaultCode: `#include <stdio.h>

int main(void) {
    /* Your code goes here */

    return 0;
}`,
  },
  {
    id: "python",
    label: "Python",
    monacoLanguage: "python",
    fileName: "main.py",
    apiLanguage: "python",
    defaultCode: `# Python starter template
def main():
    # Your code goes here
    pass

if __name__ == "__main__":
    main()`,
  },
]

export const DEFAULT_CODEBENCH_LANGUAGE_ID: CodebenchLanguageId = "cpp"

export const CODEBENCH_LANGUAGE_OPTIONS: { id: CodebenchLanguageId; label: string }[] = CODEBENCH_LANGUAGES.map(
  (language) => ({ id: language.id, label: language.label }),
)

const SELECTABLE = new Set<string>(CODEBENCH_LANGUAGES.map((language) => language.id))

export function isCodebenchLanguageId(id: string | null | undefined): id is CodebenchLanguageId {
  return Boolean(id && SELECTABLE.has(id))
}

/** Maps leftover stored ids (JavaScript, Auto-detect, …) onto the three supported languages. */
export function normalizeCodebenchLanguageId(id: string | null | undefined): CodebenchLanguageId {
  if (isCodebenchLanguageId(id)) return id
  const raw = String(id ?? "").trim().toLowerCase()
  if (raw === "c++" || raw === "cplusplus") return "cpp"
  if (raw === "py" || raw === "python3") return "python"
  return DEFAULT_CODEBENCH_LANGUAGE_ID
}

function normalizeForCompare(source: string): string {
  return source.replace(/\s+/g, " ").trim()
}

export function isCodebenchBoilerplate(code: string, languageId: CodebenchLanguageId): boolean {
  const lang = getCodebenchLanguage(languageId)
  return normalizeForCompare(code) === normalizeForCompare(lang.defaultCode)
}

/**
 * A live snapshot must not replace code the student already typed with the
 * empty starter template. That happens when the editor remounts and posts
 * before the saved snapshot is restored.
 */
function compactCode(source: string): string {
  return source.replace(/\s+/g, " ").trim()
}

/**
 * A live editor sometimes remounts and posts a short fresh buffer over a
 * program the student already saved. Keep the saved program when the new
 * text is much shorter and does not still contain that work.
 */
export function isAbruptLiveCodeReset(
  existing: string,
  incoming: string,
  languageId: CodebenchLanguageId,
): boolean {
  if (isCodebenchBoilerplate(existing, languageId)) return false
  const previous = compactCode(existing)
  const next = compactCode(incoming)
  if (previous.length < 160) return false
  if (next.length >= previous.length * 0.75) return false
  const sliceStart = Math.min(90, Math.floor(previous.length / 3))
  const needle = previous.slice(sliceStart, sliceStart + 48)
  if (needle.length >= 24 && next.includes(needle)) return false
  return true
}

export function codebenchLiveCodeToPersist(
  existing: string | null | undefined,
  incoming: string,
  languageId: string | null | undefined,
): string {
  const previous = typeof existing === "string" ? existing : ""
  if (!incoming.trim()) return previous.trim() ? previous : incoming
  const lang = normalizeCodebenchLanguageId(languageId)
  if (previous.trim() && isCodebenchBoilerplate(incoming, lang) && !isCodebenchBoilerplate(previous, lang)) {
    return previous
  }
  if (previous.trim() && isAbruptLiveCodeReset(previous, incoming, lang)) return previous
  return incoming
}

/** Heuristic language detection from editor contents. */
export function detectCodebenchLanguageFromCode(code: string): CodebenchLanguageId {
  const sample = code.trim()
  if (!sample) return "cpp"

  const rules: { id: CodebenchLanguageId; score: number }[] = []
  const add = (id: CodebenchLanguageId, score: number, match: boolean) => {
    if (match) rules.push({ id, score })
  }

  add("cpp", 14, /#include\s*[<"](iostream|vector|string|map|set|algorithm)/.test(sample))
  add("cpp", 12, /\busing namespace std\b/.test(sample) || /\bstd::\w+/.test(sample))
  add("c", 14, /#include\s*[<"](stdio\.h|stdlib\.h|string\.h|math\.h)/.test(sample))
  add("c", 8, /\bprintf\s*\(|\bscanf\s*\(/.test(sample))
  add("python", 12, /^(\s*(def |class |import |from ))/m.test(sample) || /if __name__\s*==\s*['"]__main__['"]/.test(sample))
  add("python", 6, /:\s*$/m.test(sample) && !/[;{}]/.test(sample.slice(0, 120)))

  if (!rules.length) return "cpp"
  rules.sort((a, b) => b.score - a.score)
  return rules[0]!.id
}

export function resolveEffectiveCodebenchLanguageId(
  languageId: string,
  code: string,
): CodebenchLanguageId {
  if (languageId === "autodetect") {
    return detectCodebenchLanguageFromCode(code)
  }
  return normalizeCodebenchLanguageId(languageId)
}

export function resolveEffectiveCodebenchLanguage(languageId: string, code: string): CodebenchLanguage {
  return getCodebenchLanguage(resolveEffectiveCodebenchLanguageId(languageId, code))
}

export function editorCodeForLanguage(
  targetLanguageId: string,
  options?: { preferTemplate?: boolean },
): string {
  const id = normalizeCodebenchLanguageId(targetLanguageId)
  if (!options?.preferTemplate) {
    const saved = readStoredCodebenchCode(id)
    if (saved?.trim()) return saved
  }
  return getCodebenchLanguage(id).defaultCode
}

export function getCodebenchLanguage(id: string | null | undefined): CodebenchLanguage {
  const normalized = normalizeCodebenchLanguageId(id)
  return CODEBENCH_LANGUAGES.find((language) => language.id === normalized) ?? CODEBENCH_LANGUAGES[0]!
}

const CODEBENCH_CODE_PREFIX = "codebench_last_code_"

function codeStorageKey(languageId: CodebenchLanguageId): string {
  return `${CODEBENCH_CODE_PREFIX}${languageId}`
}

/** Saved editor buffer for a language (per-language keys only). */
export function readStoredCodebenchCode(languageId: string): string | null {
  if (typeof window === "undefined") return null
  const perLanguage = localStorage.getItem(codeStorageKey(normalizeCodebenchLanguageId(languageId)))
  if (perLanguage?.trim()) return stripCodebenchProbeComments(perLanguage)
  return null
}

export function writeStoredCodebenchCode(languageId: string, code: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(
    codeStorageKey(normalizeCodebenchLanguageId(languageId)),
    stripCodebenchProbeComments(code),
  )
}

const EXTENSION_TO_LANGUAGE: Record<string, CodebenchLanguageId> = {
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  c: "c",
  h: "c",
  py: "python",
}

export function extensionForLanguage(languageId: string): string {
  const fileName = getCodebenchLanguage(languageId).fileName
  const ext = fileName.split(".").pop()
  return ext || "txt"
}

export function languageIdFromFileName(fileName: string): CodebenchLanguageId {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  return EXTENSION_TO_LANGUAGE[ext] ?? "cpp"
}

export function isUntitledCodebenchName(name: string): boolean {
  return /^(untitled(?:[-_\s]?\d+)?|new[-_\s]?file)(\.[a-z0-9]+)?$/i.test(name.trim())
}

export function readStoredCodebenchLanguageId(): CodebenchLanguageId {
  if (typeof window === "undefined") return DEFAULT_CODEBENCH_LANGUAGE_ID
  return normalizeCodebenchLanguageId(localStorage.getItem(CODEBENCH_LANGUAGE_STORAGE_KEY))
}

export function resolveCodebenchEditorCode(languageId: string): string {
  return editorCodeForLanguage(languageId)
}
