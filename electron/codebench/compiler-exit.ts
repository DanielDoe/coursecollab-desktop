/** Windows NTSTATUS values Node reports as unsigned or signed 32-bit exit codes. */
const STATUS_ACCESS_VIOLATION = new Set([3221225477, -1073741819])
const STATUS_DLL_NOT_FOUND = new Set([3221225781, -1073741515])
const STATUS_STACK_BUFFER_OVERRUN = new Set([3221226505, -1073740791])

/**
 * A compiler that exits without printing anything leaves the terminal blank.
 * Windows hides the usual DLL and crash dialogs because the process is spawned
 * with windowsHide, so the exit code is the only signal.
 */
export function silentCompilerExitMessage(exitCode: number | null): string {
  if (exitCode != null && STATUS_DLL_NOT_FOUND.has(exitCode)) {
    return "The C++ compiler could not start because a compiler library (DLL) was missing. Use Retry setup in CodeBench, then run again."
  }
  if (
    exitCode != null &&
    (STATUS_ACCESS_VIOLATION.has(exitCode) || STATUS_STACK_BUFFER_OVERRUN.has(exitCode))
  ) {
    return "The C++ compiler crashed before it printed an error. Use Retry setup in CodeBench, then run again."
  }
  if (exitCode == null) {
    return "The C++ compiler stopped before it printed an error. Use Retry setup in CodeBench, then run again."
  }
  return `The C++ compiler exited with code ${exitCode} and did not print an error. Use Retry setup in CodeBench, then run again.`
}
