/**
 * Detects default/starter C++ submissions so we do not apply the "substantive attempt"
 * minimum score floor (e.g. 45% in relaxed mode) to template-only code.
 *
 * Must stay aligned with student editor defaults in `components/quiz-taker.tsx`
 * (Trailblazer template, empty Scholar).
 */

/** Trailblazer default for code_write — same string as quiz-taker TRAILBLAZER_TEMPLATE */
export const CPP_CODE_WRITE_TRAILBLAZER_TEMPLATE = `#include <iostream>
using namespace std;

int main() {
    //Your code goes in here....
    return 0;
}`

function stripCppBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ")
}

function stripCppLineComments(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      const i = line.indexOf("//")
      return i >= 0 ? line.slice(0, i) : line
    })
    .join("\n")
}

function normalizeCppLike(src: string): string {
  let t = stripCppBlockComments(src)
  t = stripCppLineComments(t)
  return t.replace(/\s+/g, " ").trim().toLowerCase()
}

/** After comment removal, Trailblazer template becomes this canonical form. */
const NORMALIZED_TRAILBLAZER = normalizeCppLike(CPP_CODE_WRITE_TRAILBLAZER_TEMPLATE)

/**
 * True if `main`'s body is empty or only `return 0` / `return 0;` (after comment strip).
 */
function cppMainBodyIsTrivialReturnOnly(strippedNoBlockLineComments: string): boolean {
  const m = strippedNoBlockLineComments.match(/int\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/im)
  if (!m) return false
  const body = stripCppLineComments(m[1] || "")
    .replace(/\s+/g, " ")
    .trim()
  return body === "" || /^return\s+0\s*;?$/.test(body)
}

/**
 * Any obvious logic beyond boilerplate (I/O, control flow, calls, declarations in main).
 */
function hasMeaningfulCppBeyondBoilerplate(src: string): boolean {
  const stripped = stripCppLineComments(stripCppBlockComments(src))
  const withoutMain = stripped.replace(/int\s+main\s*\([^)]*\)\s*\{[\s\S]*\}/i, "")
  const scan = `${stripped} ${withoutMain}`
  return /\b(cout|cin|cerr|clog|printf|scanf|sprintf|getline|stringstream|for\s*\(|while\s*\(|do\s*\{|if\s*\(|switch\s*\(|case\s+|else\b|break\s*;|continue\s*;)/i.test(
    scan,
  )
}

/**
 * Returns true when the submission looks like the built-in starter only (no real solution).
 */
export function isLikelyUnmodifiedStarterCode(code: string): boolean {
  const raw = String(code ?? "").trim()
  if (raw.length === 0) return true

  const n = normalizeCppLike(raw)
  if (n === NORMALIZED_TRAILBLAZER) return true

  // Common variants: same structure, comment text differs or spacing differs slightly
  if (
    n ===
    "#include <iostream> using namespace std; int main() { return 0; }"
  ) {
    return true
  }

  // iostream + main + return 0 only, no I/O or logic
  if (
    /^#include\s*<iostream>\s*using namespace std;\s*int main\s*\(\s*\)\s*\{\s*return\s+0;\s*\}\s*$/i.test(
      n,
    )
  ) {
    return true
  }

  if (hasMeaningfulCppBeyondBoilerplate(raw)) return false

  return (
    /#include\s*<iostream>/i.test(raw) &&
    /using namespace std\s*;/i.test(raw) &&
    /int\s+main\s*\(\s*\)/i.test(raw) &&
    cppMainBodyIsTrivialReturnOnly(stripCppBlockComments(raw))
  )
}
