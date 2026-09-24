export const CODEBENCH_LIMITS = {
  maxSourceBytes: 256 * 1024,
  maxInputWriteBytes: 8 * 1024,
  maxOutputBytes: 1_048_576,
  outputRateWindowMs: 400,
  outputRateMaxBytes: 256 * 1024,
  maxConcurrentSessions: 1,
  compileTimeoutMs: 30_000,
  /** A system compiler that cannot compile should fail fast so we can use the installed toolchain. */
  systemVerifyTimeoutMs: 90_000,
  /** First Zig compile builds its cache and can take longer than a student rerun. */
  verifyCompileTimeoutMs: 180_000,
  /** Wall-clock cap. Waiting on cin does not use a shorter idle timeout. */
  runTimeoutMs: 15 * 60 * 1000,
  staleWorkspaceMs: 2 * 60 * 60 * 1000,
  sessionIdPattern: /^[A-Za-z0-9-]{8,80}$/,
} as const

export const CONTROLLED_COMPILE_ARGS = ['-std=c++17', '-O0', '-Wall', '-Wextra'] as const
export const CONTROLLED_MSVC_ARGS = ['/nologo', '/EHsc', '/std:c++17', '/W3'] as const

export const SOURCE_FILE_NAME = 'main.cpp'
export const UNIX_OUTPUT_NAME = 'program'
export const WIN_OUTPUT_NAME = 'program.exe'
