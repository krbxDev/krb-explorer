# Sets Nova Explorer as the default file manager.
# Run as current user — no admin needed.

$exe = "$env:LOCALAPPDATA\Nova Explorer\nova-explorer.exe"

if (!(Test-Path $exe)) {
    Write-Error "Nova Explorer not found at $exe — please install it first."
    exit 1
}

$cmd = "`"$exe`" `"%1`""

# Registry: open folders / directories / drives
$keys = @(
    "HKCU:\SOFTWARE\Classes\Folder\shell\open\command",
    "HKCU:\SOFTWARE\Classes\Directory\shell\open\command",
    "HKCU:\SOFTWARE\Classes\Drive\shell\open\command"
)

foreach ($key in $keys) {
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name "(default)" -Value $cmd
    Write-Host "Set $key"
}

# AutoHotkey script: remap Win+E
$ahkDir  = "$env:APPDATA\NovaExplorer"
$ahkFile = "$ahkDir\WinE.ahk"
New-Item -ItemType Directory -Path $ahkDir -Force | Out-Null

# Write AHK v2 script line by line to avoid heredoc brace issues
$ahkLines = @(
    "#Requires AutoHotkey v2.0",
    "#NoTrayIcon",
    "; Remap Win+E to open Nova Explorer",
    "#e::",
    "    Run(`"`"" + $exe + "`"`")"
)
$ahkLines | Out-File -FilePath $ahkFile -Encoding utf8
Write-Host "Written AHK script: $ahkFile"

# Find AutoHotkey executable
$ahkExe = Get-ChildItem "C:\Program Files\AutoHotkey" -Filter "AutoHotkey*.exe" -Recurse -ErrorAction SilentlyContinue |
          Where-Object { $_.Name -notlike "*UX*" } |
          Select-Object -First 1 -ExpandProperty FullName

if ($ahkExe) {
    # Kill any existing WinE instance
    Get-Process -Name "AutoHotkey*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Process $ahkExe -ArgumentList "`"$ahkFile`"" -WindowStyle Hidden
    Write-Host "AHK script launched (Win+E remapped)"

    # Add to Windows startup via VBScript (no console flash on login)
    $startupDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
    $vbsFile    = "$startupDir\NovaExplorerWinE.vbs"
    $vbsContent = "Set WshShell = CreateObject(""WScript.Shell"")" + [Environment]::NewLine +
                  "WshShell.Run Chr(34) & """ + $ahkExe + """ & Chr(34) & "" "" & Chr(34) & """ + $ahkFile + """ & Chr(34), 0, False"
    $vbsContent | Out-File -FilePath $vbsFile -Encoding ascii
    Write-Host "Startup entry created: $vbsFile"
} else {
    Write-Warning "AutoHotkey not found — Win+E remap skipped. Folder double-clicks still work."
}

Write-Host ""
Write-Host "Done! Nova Explorer is now your default file manager."
Write-Host "  - Folder/drive double-clicks open Nova Explorer"
Write-Host "  - Win+E opens Nova Explorer"
Write-Host "  - Persists across reboots"
Write-Host ""
Write-Host "To undo: powershell -File scripts\undo-default.ps1"
