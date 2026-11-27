# Installer for the "AAI Instructor Report" Chrome extension (Windows)
# - copies the extension to %LOCALAPPDATA%\AAIReport\aai-bilan (permanent location)
# - copies that path to the clipboard
# - opens Chrome on chrome://extensions and File Explorer on the folder
# Chrome no longer allows fully automatic installation of an extension outside
# the Chrome Web Store: "Load unpacked" still has to be clicked by hand.

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Install - AAI Instructor Report'

function Step($t) { Write-Host ''; Write-Host $t -ForegroundColor Cyan }

$source = Join-Path $PSScriptRoot 'aai-bilan'
$target = Join-Path $env:LOCALAPPDATA 'AAIReport\aai-bilan'

if (-not (Test-Path (Join-Path $source 'manifest.json'))) {
    Write-Host "The 'aai-bilan' folder was not found next to the installer." -ForegroundColor Red
    Write-Host 'Unzip the whole package before running Installer.bat.'
    Read-Host 'Press Enter to close'
    exit 1
}

$update = Test-Path (Join-Path $target 'manifest.json')

Step '1/3  Copying the extension'
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
Write-Host "    Extension copied to: $target" -ForegroundColor Green

Step '2/3  Path copied to the clipboard'
Set-Clipboard -Value $target
Write-Host '    You can paste it with Ctrl+V.' -ForegroundColor Green

Step '3/3  Opening Chrome'
$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions/'
    Write-Host '    Chrome is open on the extensions page.' -ForegroundColor Green
} else {
    Write-Host '    Chrome not found: open it and type chrome://extensions in the address bar.' -ForegroundColor Yellow
}
Start-Process explorer.exe -ArgumentList "`"$target`""

Write-Host ''
Write-Host '==============================================================' -ForegroundColor Cyan
if ($update) {
    Write-Host ' UPDATE: the files have been replaced.' -ForegroundColor White
    Write-Host ''
    Write-Host ' In chrome://extensions, click the circular arrow (Reload)'
    Write-Host ' on the "AAI Instructor Report" card. That''s it.'
} else {
    Write-Host ' 3 CLICKS LEFT IN CHROME:' -ForegroundColor White
    Write-Host ''
    Write-Host '  1. Turn on "Developer mode" (switch at the top right).'
    Write-Host '  2. Click "Load unpacked".'
    Write-Host '  3. In the window that opens, click the address bar, paste (Ctrl+V),'
    Write-Host '     press Enter, then "Select Folder".'
    Write-Host ''
    Write-Host ' Then reload your Technical Instructor page on the AAI portal'
    Write-Host ' and click "My AAI report" at the bottom right.'
}
Write-Host ''
Write-Host ' Do not delete this folder:' -ForegroundColor Yellow
Write-Host "   $target" -ForegroundColor Yellow
Write-Host ' Chrome reads it every time it starts.' -ForegroundColor Yellow
Write-Host '==============================================================' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Press Enter to close this window'
