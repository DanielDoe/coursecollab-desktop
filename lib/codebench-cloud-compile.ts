import { resolveStudentDatabaseId, studentApiFetch } from "@/lib/auth"

export type CloudCompileResult = {
  ok: boolean
  stdout: string
  stderr: string
  compileOutput: string
  error: string | null
}

/**
 * Last-resort C++ compile when the desktop app cannot find a local compiler.
 * Requires a student session; faculty Run stays on the local toolchain.
 */
export async function compileCppInCloud(code: string): Promise<CloudCompileResult | null> {
  const studentId = resolveStudentDatabaseId()
  if (!studentId) return null
  try {
    const response = await studentApiFetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, studentId, stdin: "" }),
    })
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean
      stdout?: string
      stderr?: string
      compile_output?: string
      error?: string
      output?: string
    }
    const stderr = String(data.stderr ?? data.compile_output ?? "")
    const compileOutput = String(data.compile_output ?? "")
    const stdout = String(data.stdout ?? "")
    if (!response.ok || data.success === false) {
      return {
        ok: false,
        stdout,
        stderr: stderr || String(data.error ?? data.output ?? "Cloud compile failed."),
        compileOutput,
        error: typeof data.error === "string" ? data.error : "Cloud compile failed.",
      }
    }
    return { ok: true, stdout, stderr, compileOutput, error: null }
  } catch {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      compileOutput: "",
      error: "Could not reach the cloud C++ compiler.",
    }
  }
}
