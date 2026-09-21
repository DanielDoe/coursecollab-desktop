import { app } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * After OTA or a moved install folder, desktop/Start shortcuts may still point at an old
 * CourseCollab.exe (common on Surface / ARM64 classroom PCs). Repair on each packaged launch.
 */
export function scheduleWindowsShortcutRepair(): void {
  if (process.platform !== 'win32' || !app.isPackaged) return

  app.whenReady().then(() => {
    void repairWindowsCourseCollabShortcuts().catch(() => {
      // Non-fatal — app still runs from Start/search or direct exe path.
    })
  })
}

async function repairWindowsCourseCollabShortcuts(): Promise<void> {
  const exe = process.execPath.replace(/'/g, "''")
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$exe = '${exe}'
$dir = Split-Path -LiteralPath $exe
$wsh = New-Object -ComObject WScript.Shell
$paths = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'CourseCollab.lnk'),
  (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\\CourseCollab\\CourseCollab.lnk'),
  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\CourseCollab\\CourseCollab.lnk')
)
foreach ($lnk in $paths) {
  $folder = Split-Path -LiteralPath $lnk
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  $sc = $wsh.CreateShortcut($lnk)
  $icon = $exe + ',0'
  $needsSave = (-not (Test-Path -LiteralPath $lnk)) -or
    ($sc.TargetPath -ne $exe) -or
    ($sc.WorkingDirectory -ne $dir) -or
    ($sc.IconLocation -ne $icon)
  if ($needsSave) {
    $sc.TargetPath = $exe
    $sc.WorkingDirectory = $dir
    $sc.IconLocation = $icon
    $sc.Description = 'CourseCollab'
    $sc.Save()
  }
}
`.trim()

  await execFileAsync(
    process.env.SystemRoot
      ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
      : 'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, timeout: 15_000 },
  )
}
