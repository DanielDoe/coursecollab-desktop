import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { detectCppCompiler } from "../electron/codebench/compilerDetector"
import { ensureCppToolchain } from "../electron/codebench/toolchain-ensure"
import { prependPath } from "../electron/codebench/toolchain-paths"
import type { CompilerInfo } from "../electron/codebench/types"

function isLocalRequest(req: IncomingMessage): boolean {
  const host = String(req.headers.host || "")
  return host.startsWith("127.0.0.1") || host.startsWith("localhost")
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function compileArgs(compiler: CompilerInfo, outputName: string): string[] {
  if (compiler.compiler === "zig") {
    return ["c++", "main.cpp", "-std=c++17", "-Wall", "-Wextra", "-o", outputName]
  }
  return ["main.cpp", "-std=c++17", "-Wall", "-Wextra", "-o", outputName]
}

function runCommand(
  command: string,
  args: string[],
  cwd?: string,
  timeoutMs = 20_000,
  stdin?: string,
  env?: NodeJS.ProcessEnv,
) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      env: env ?? process.env,
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill()
      resolve({ code: null, stdout, stderr: `${stderr}\nTimed out.`.trim() })
    }, timeoutMs)
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8")
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr: error.message })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
    if (child.stdin) {
      if (stdin) child.stdin.write(stdin)
      child.stdin.end()
    }
  })
}

async function compileAndRun(sourceCode: string, stdin = "") {
  let compiler = await detectCppCompiler()
  if (!compiler.available) {
    compiler = await ensureCppToolchain({ installIfMissing: true })
  }
  if (!compiler.available || !compiler.path) {
    return { success: false, stdout: "", stderr: compiler.setupGuidance, compiler }
  }
  if (Buffer.byteLength(sourceCode, "utf8") > 256 * 1024) {
    return { success: false, stdout: "", stderr: "Source is too large.", compiler }
  }

  const workspace = await mkdtemp(join(tmpdir(), "codebench-vite-"))
  const sourcePath = join(workspace, "main.cpp")
  const outputName = process.platform === "win32" ? "program.exe" : "program"
  const env = prependPath({ ...process.env }, dirname(compiler.path))
  try {
    await writeFile(sourcePath, sourceCode, "utf8")
    const compile = await runCommand(
      compiler.path,
      compileArgs(compiler, outputName),
      workspace,
      30_000,
      undefined,
      env,
    )
    if (compile.code !== 0) {
      return {
        success: false,
        stdout: compile.stdout,
        stderr: compile.stderr || "Compilation failed.",
        compiler,
      }
    }
    const run = await runCommand(join(workspace, outputName), [], workspace, 15_000, stdin, env)
    return {
      success: run.code === 0,
      stdout: run.stdout,
      stderr: run.stderr,
      exitCode: run.code,
      compiler,
    }
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined)
  }
}

export function codebenchDevPlugin(): Plugin {
  return {
    name: "codebench-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || ""
        if (!url.startsWith("/__codebench/")) return next()
        if (!isLocalRequest(req)) {
          sendJson(res, 403, { error: "Local CodeBench compile is only available on localhost." })
          return
        }

        try {
          if (req.method === "GET" && url === "/__codebench/compiler") {
            sendJson(res, 200, await detectCppCompiler())
            return
          }
          if (req.method === "POST" && url === "/__codebench/ensure") {
            sendJson(res, 200, await ensureCppToolchain({ installIfMissing: true }))
            return
          }
          if (req.method === "POST" && url === "/__codebench/run") {
            const raw = await readBody(req)
            const body = raw ? JSON.parse(raw) : {}
            if (typeof body.sourceCode !== "string") {
              sendJson(res, 400, { error: "sourceCode is required." })
              return
            }
            const stdin = typeof body.stdin === "string" ? body.stdin : ""
            sendJson(res, 200, await compileAndRun(body.sourceCode, stdin))
            return
          }
          sendJson(res, 404, { error: "Not found." })
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : "CodeBench compile failed." })
        }
      })
    },
  }
}
