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
$appId = 'com.coursecollab.desktop'
$wsh = New-Object -ComObject WScript.Shell
$paths = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'CourseCollab.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'CourseCollab.lnk'),
  (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\\CourseCollab\\CourseCollab.lnk'),
  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\CourseCollab\\CourseCollab.lnk'),
  (Join-Path $env:APPDATA 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar\\CourseCollab.lnk')
)
Get-ChildItem -LiteralPath (Join-Path $env:APPDATA 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar') -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object { $paths += $_.FullName }
$paths = $paths | Select-Object -Unique
$fixed = @()
foreach ($lnk in $paths) {
  $folder = Split-Path -LiteralPath $lnk
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  $existed = Test-Path -LiteralPath $lnk
  $sc = $wsh.CreateShortcut($lnk)
  if ($existed -and $sc.TargetPath -and ($sc.TargetPath -notlike '*\\CourseCollab.exe')) { continue }
  $icon = $exe + ',0'
  $sc.TargetPath = $exe
  $sc.WorkingDirectory = $dir
  $sc.IconLocation = $icon
  $sc.Description = 'CourseCollab'
  $sc.Save()
  $fixed += $lnk
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CourseCollabShortcutAppId {
  [StructLayout(LayoutKind.Sequential, Pack = 4)]
  public struct PropertyKey { public Guid fmtid; public uint pid; }
  [StructLayout(LayoutKind.Explicit)]
  public struct PropVariant {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr pointerValue;
    public static PropVariant FromString(string value) {
      var pv = new PropVariant();
      pv.vt = 31;
      pv.pointerValue = Marshal.StringToCoTaskMemUni(value);
      return pv;
    }
  }
  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
  public interface IPropertyStore {
    uint GetCount(out uint cProps);
    uint GetAt(uint iProp, out PropertyKey pkey);
    uint GetValue(ref PropertyKey key, out PropVariant pv);
    uint SetValue(ref PropertyKey key, ref PropVariant pv);
    uint Commit();
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  static extern int SHGetPropertyStoreFromParsingName(string pszPath, IntPtr pbc, uint flags, ref Guid riid, out IPropertyStore ppv);
  public static void Apply(string path, string appId) {
    var iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
    IPropertyStore store;
    if (SHGetPropertyStoreFromParsingName(path, IntPtr.Zero, 2, ref iid, out store) != 0 || store == null) return;
    var key = new PropertyKey { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
    var value = PropVariant.FromString(appId);
    store.SetValue(ref key, ref value);
    store.Commit();
    Marshal.FreeCoTaskMem(value.pointerValue);
  }
}
'@
foreach ($lnk in $fixed) {
  if (Test-Path -LiteralPath $lnk) { [CourseCollabShortcutAppId]::Apply($lnk, $appId) }
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
