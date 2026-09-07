# CodeBench local C++ execution

On CourseCollab Desktop, CodeBench Run compiles and executes C++ in a program terminal (xterm + PTY). This is the same CodeBench IDE — not a separate product. This is **not** a fully sandboxed execution environment.

## Baseline protections (this phase)

- Isolated temporary workspaces under the OS temp directory
- Spawn-style compiler and process APIs (`shell: false`)
- Controlled compiler arguments only (`-std=c++17 -Wall -Wextra`)
- Explicit IPC (`checkCompiler`, `run`, `writeInput`, `stop`, `resize`)
- No renderer Node access (`contextIsolation: true`, `nodeIntegration: false`)
- Source, input, output, concurrency, and wall-clock limits
- Process tracking, Stop, and workspace cleanup

## What this does not provide

Electron does not sandbox a native executable launched from the main process. A later `ExecutionSandbox` implementation should add a platform strategy (macOS seatbelt, Windows restricted token / AppContainer, Linux namespaces or a remote sandbox).

Do not treat student C++ as trusted code.

## Future toolchain manager

Detection is implemented now. Download, checksum verification, and CourseCollab-managed installs are intentionally not implemented yet.
