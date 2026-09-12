/** Shared reply shapes for CodeBench Cora — suggest-fix is fix-only, not a lesson. */

export const CODEBENCH_SUGGEST_FIX_REPLY = `
Under 40 words. Fix only — no teaching, no "why", no questions, no sections, no emojis.

Format exactly:
**Line N:** <what is wrong, ≤8 words>
**Fix:** <exact edit, e.g. add ; after the cout statement>
`.trim()

export const CODEBENCH_FACULTY_SUGGEST_FIX_REPLY = CODEBENCH_SUGGEST_FIX_REPLY

export const CODEBENCH_CONCISE_EXPLAIN_MARKDOWN = `
Keep under 150 words. Use ## Overview (2 sentences), ## Key Steps (3–4 bullets max), ## Watch Out (1 misconception).
`.trim()
