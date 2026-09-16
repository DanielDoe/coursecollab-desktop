import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileCppSource } from './compiler'
import { SOURCE_FILE_NAME } from './limits'
import type { CompilerInfo } from './types'

const SMOKE_CPP = `#include <iostream>
int main() {
  std::cout << 42;
  return 0;
}
`

export async function verifyCppToolchain(compiler: CompilerInfo): Promise<boolean> {
  if (!compiler.available || !compiler.path) return false
  const workspaceDir = await mkdtemp(join(tmpdir(), 'coursecollab-cpp-verify-'))
  try {
    await writeFile(join(workspaceDir, SOURCE_FILE_NAME), SMOKE_CPP, 'utf8')
    const result = await compileCppSource(compiler, {
      sessionId: 'toolchain-verify',
      sourceCode: SMOKE_CPP,
      workspaceDir,
      emit: () => undefined,
    })
    if (!result.success || !result.outputPath) return false
    return existsSync(join(workspaceDir, result.outputPath))
  } catch {
    return false
  } finally {
    await rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
