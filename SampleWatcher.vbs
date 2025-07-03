' ────────────────────────────────────────────────────────────────
' THIS IS NOT A VIRUS
' This script should be in %USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
' Original: https://github.com/dadodasyra/SamplerImporter/blob/main/SampleWatcher.vbs
'
' Look at the  %USERPROFILE%\SampleWatcher script to understand why
'  SampleWatcher.vbs  –  invisible launcher for the PowerShell
'                       watcher script
'  ▸ Sets the working directory to %USERPROFILE%\SampleWatcher
'  ▸ Starts powershell.exe completely hidden
'  ▸ Skips launch if a copy is already running
' ────────────────────────────────────────────────────────────────
' ── 1.  build the full path to the script ────────────────────────────────
Dim sh, fso, ps1, watchFolder
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

watchFolder = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\SampleWatcher"
ps1         = watchFolder & "\SampleWatcher.ps1"      ' edit if spelling differs

' ── 2.  quick logfile in the same folder (few bytes) ─────────────────────
Dim log
log = watchFolder & "\launcher.log"
Sub WriteLog(msg)
  With CreateObject("Scripting.FileSystemObject").OpenTextFile(log, 8, True)
    .WriteLine Now & "  " & msg
    .Close
  End With
End Sub

' ── 3.  abort if .ps1 missing ────────────────────────────────────────────
If Not fso.FileExists(ps1) Then
  WriteLog "ABORT  .ps1 not found: " & ps1
  WScript.Quit
End If

' ── 4.  single-instance check  (powershell only) ─────────────────────────
Dim svc, col, already
Set svc = GetObject("winmgmts:\\.\root\cimv2")
Set col = svc.ExecQuery( _
  "SELECT * FROM Win32_Process WHERE Name='powershell.exe' " & _
  "AND CommandLine LIKE '%SampleWatcher.ps1%'")
already = col.Count

If already > 0 Then
  WriteLog "SKIP   watcher already running (" & already & " instance)"
  WScript.Quit
End If

' ── 5.  start PowerShell hidden, working dir = watchFolder ──────────────
sh.CurrentDirectory = watchFolder
Dim cmd
cmd = "powershell.exe -NoLogo -NoProfile -WindowStyle Hidden " & _
      "-ExecutionPolicy Bypass -File """ & ps1 & """"

WriteLog "START  " & cmd
sh.Run cmd, 0, False       ' 0 = hidden   False = don’t wait
