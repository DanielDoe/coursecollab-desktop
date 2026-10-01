; An arm64-only installer extracts nothing on an Intel/AMD PC (electron-builder only
; unpacks app-arm64.7z when IsNativeARM64), yet still "finishes" and leaves shortcuts
; to a CourseCollab.exe that was never copied. Stop before touching anything.
; The x64 installer is safe everywhere: Windows on ARM runs it under emulation.
!macro customInit
  !ifdef APP_ARM64
    !ifndef APP_64
      ${IfNot} ${IsNativeARM64}
        MessageBox MB_OK|MB_ICONSTOP "This CourseCollab installer is for Windows on ARM (Snapdragon) PCs only.$\r$\n$\r$\nThis PC needs the Windows 64-bit (x64) installer from course-collab.com." /SD IDOK
        SetErrorLevel 2
        Quit
      ${EndIf}
    !endif
  !endif
!macroend

; Write a unique install stamp at *install* time (not build time) so a
; reinstall cannot inherit a completion file from the previous copy.
!macro customInstall
  Push $0
  Push $1
  Push $2
  StrCpy $1 ""
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "[guid]::NewGuid().ToString()"'
  Pop $0
  Pop $1
  StrCmp $0 "0" 0 cc_setup_fallback
  StrCmp $1 "" cc_setup_fallback 0
  Goto cc_setup_write
  cc_setup_fallback:
    System::Call "kernel32::GetTickCount()i.r1"
    StrCpy $1 "$1-$HWNDPARENT"
  cc_setup_write:
    ClearErrors
    CreateDirectory "$INSTDIR\resources"
    FileOpen $2 "$INSTDIR\resources\install-instance.json" w
    IfErrors cc_shortcuts
    FileWrite $2 '{"id":"'
    FileWrite $2 $1
    FileWrite $2 '"}'
    FileClose $2

  ; Working directory MUST be $INSTDIR before CreateShortCut. Without SetOutPath,
  ; the .lnk "Start in" folder is the installer temp dir and Windows shows
  ; "Missing Shortcut / searching for CourseCollab.exe" on Finish or desktop click.
  ; Do not pass empty "" extra args — NSIS can shift those and drop the target path.
  ; Launch the exe directly so Finish / silent OTA never ExecShell a stale .lnk.
  cc_shortcuts:
    SetOutPath "$INSTDIR"
    StrCpy $0 "$INSTDIR\CourseCollab.exe"
    IfFileExists "$0" cc_exe_present 0
      MessageBox MB_OK|MB_ICONSTOP "CourseCollab could not be installed: CourseCollab.exe was not copied to $INSTDIR.$\r$\n$\r$\nDownload the Windows 64-bit (x64) installer from course-collab.com and run it again." /SD IDOK
      SetErrorLevel 2
      Abort
    cc_exe_present:
    CreateDirectory "$SMPROGRAMS\CourseCollab"
    CreateShortCut "$SMPROGRAMS\CourseCollab\CourseCollab.lnk" "$0" "" "$0" 0
    CreateShortCut "$DESKTOP\CourseCollab.lnk" "$0" "" "$0" 0
    ; Lets users rebuild Desktop/Start shortcuts from the install folder itself.
    CreateShortCut "$INSTDIR\Create Desktop Shortcut.lnk" "$0" "--create-desktop-shortcut" "$0" 0
    ; Recreating the .lnk wipes AppUserModelID. Without it, Windows taskbar
    ; ignores the exe icon and shows the Electron default.
    WinShell::SetLnkAUMI "$SMPROGRAMS\CourseCollab\CourseCollab.lnk" "${APP_ID}"
    WinShell::SetLnkAUMI "$DESKTOP\CourseCollab.lnk" "${APP_ID}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    StrCpy $launchLink "$0"
  Pop $2
  Pop $1
  Pop $0
!macroend

; Uninstall removes only the setup markers so the next install runs
; first-run checks again. Session data stays unless the user wipes AppData.
!macro customUnInstall
  Delete "$APPDATA\CourseCollab\codebench-setup.json"
  Delete "$APPDATA\CourseCollab\install-instance.json"
!macroend
