import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileCppSource } from './compiler'
import { CODEBENCH_LIMITS, SOURCE_FILE_NAME } from './limits'
import type { CompilerInfo } from './types'

const SMOKE_CPP = `#include <iostream>
int main() {
  std::cout << 42;
  return 0;
}
`

export type ToolchainVerifyResult = { ok: true } | { ok: false; detail: string }

function verifyFailureDetail(stderr: string, stdout: string): string {
  const lines = `${stderr}\n${stdout}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const interesting = lines.filter((line) =>
    /error:|unknown architecture|undefined symbol|cannot find|not found|fatal|dll/i.test(line),
  )
  const picked = (interesting.length > 0 ? interesting : lines).slice(0, 8)
  return (picked.join('\n') || 'The compiler failed a test compile.').slice(0, 800)
}

export async function verifyCppToolchain(
  compiler: CompilerInfo,
  timeoutMs: number = CODEBENCH_LIMITS.verifyCompileTimeoutMs,
): Promise<ToolchainVerifyResult> {
  if (!compiler.available || !compiler.path) {
    return { ok: false, detail: 'Compiler not found' }
  }
  const workspaceDir = await mkdtemp(join(tmpdir(), 'coursecollab-cpp-verify-'))
  try {
    await writeFile(join(workspaceDir, SOURCE_FILE_NAME), SMOKE_CPP, 'utf8')
    const result = await compileCppSource(compiler, {
      sessionId: 'toolchain-verify',
      sourceCode: SMOKE_CPP,
      workspaceDir,
      timeoutMs,
      emit: () => undefined,
    })
    if (!result.success || !result.outputPath || !existsSync(join(workspaceDir, result.outputPath))) {
      return { ok: false, detail: verifyFailureDetail(result.stderr, result.stdout) }
    }
    return { ok: true }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The compiler failed a test compile.'
    return { ok: false, detail: detail.slice(0, 240) }
  } finally {
    await rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
