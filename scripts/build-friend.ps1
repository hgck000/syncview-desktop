param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Require-Command([string]$Name, [string]$Hint) {
  if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing $Name. $Hint"
  }
}

function Find-InnoCompiler {
  $command = Get-Command iscc.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @()
  if (${env:ProgramFiles(x86)}) {
    $candidates += (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe")
  }
  if ($env:ProgramFiles) {
    $candidates += (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
  }
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  return $null
}

Require-Command "git" "Install Git for Windows first."
Require-Command "npm" "Install Node.js 22 (or newer) first."
Require-Command "py.exe" "Install Python 3.11 from python.org first."

$pythonVersion = ""
try {
  $pythonVersion = (& py.exe -3.11 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null)
} catch {
  # Give a short, actionable error below instead of the py launcher message.
}
if ($LASTEXITCODE -ne 0 -or $pythonVersion.Trim() -ne "3.11") {
  throw "Python 3.11 is required for the same Windows package environment as GitHub CI. Install Python 3.11, then rerun this script."
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $latestTag = ""
  try {
    $latestTag = (& git describe --tags --abbrev=0).Trim()
  } catch {
    # Report a friendlier version-selection error below.
  }
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($latestTag)) {
    throw "Could not determine a version from git tags. Run with -Version 3.1.1 (for example)."
  }
  $Version = $latestTag.TrimStart('v', 'V')
} else {
  $Version = $Version.TrimStart('v', 'V')
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Version must use x.y.z format, got '$Version'."
}

$tag = "v$Version"
$buildVenv = Join-Path $repoRoot ".venv-build"
$venvPython = Join-Path $buildVenv "Scripts\python.exe"
$venvPyInstaller = Join-Path $buildVenv "Scripts\pyinstaller.exe"
$previousCoffeeFlag = [Environment]::GetEnvironmentVariable("VITE_ENABLE_COFFEE", "Process")

Write-Host "== SyncView friend build $tag ==" -ForegroundColor Cyan
Write-Host "Coffee/QR: disabled"

try {
  Push-Location (Join-Path $repoRoot "frontend")
  try {
    npm ci
    npm run test
    npm run type-check
    npm run lint

    $env:VITE_ENABLE_COFFEE = "false"
    npm run build
  } finally {
    Pop-Location
  }

  # public/ assets are copied verbatim by Vite. The UI is disabled at compile
  # time above; remove the unused QR too so it is absent from the friend app.
  $builtQr = Join-Path $repoRoot "frontend\dist\syncview-qr.png"
  if (Test-Path $builtQr) {
    Remove-Item -Force $builtQr
  }
  if (Test-Path $builtQr) {
    throw "Coffee QR is still present in the friend frontend build."
  }
} finally {
  if ($null -eq $previousCoffeeFlag) {
    Remove-Item Env:VITE_ENABLE_COFFEE -ErrorAction SilentlyContinue
  } else {
    $env:VITE_ENABLE_COFFEE = $previousCoffeeFlag
  }
}

Write-Host "Building Windows backend..." -ForegroundColor Cyan
if (!(Test-Path $venvPython)) {
  & py.exe -3.11 -m venv $buildVenv
}
$venvVersion = (& $venvPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')").Trim()
if ($venvVersion -ne "3.11") {
  throw "Build environment must use Python 3.11, got $venvVersion. Delete .venv-build and rerun."
}

& $venvPython -m pip install --upgrade pip wheel setuptools
& $venvPython -m pip install -r backend\requirements.txt
& $venvPython -m pip install pyinstaller
& $venvPython -m pip check
& $venvPython -m unittest discover -s backend\tests -v

$env:SYNCVIEW_VERSION = $tag
try {
  & $venvPyInstaller --clean --noconfirm SyncView.spec
} finally {
  Remove-Item Env:SYNCVIEW_VERSION -ErrorAction SilentlyContinue
}

$requiredFiles = @(
  "dist\SyncView\SyncView.exe",
  "dist\SyncView\_internal\frontend\dist\index.html"
)
foreach ($file in $requiredFiles) {
  if (!(Test-Path $file)) {
    throw "Missing packaged file: $file"
  }
}
if (Test-Path "dist\SyncView\_internal\frontend\dist\syncview-qr.png") {
  throw "Coffee QR unexpectedly reached the packaged app."
}

$versionInfo = (Get-Item "dist\SyncView\SyncView.exe").VersionInfo
if ($versionInfo.CompanyName -ne "hgck000" -or $versionInfo.ProductName -ne "SyncView") {
  throw "SyncView.exe is missing publisher/product metadata."
}

Write-Host "Building installer and portable ZIP..." -ForegroundColor Cyan
$innoCompiler = Find-InnoCompiler
if (!$innoCompiler) {
  $choco = Get-Command choco.exe -ErrorAction SilentlyContinue
  if ($choco) {
    & $choco.Source install innosetup -y
    $innoCompiler = Find-InnoCompiler
  }
}
if (!$innoCompiler) {
  throw "Inno Setup 6 is required. Install it (or run 'choco install innosetup -y') and rerun."
}

$webViewBootstrapper = Join-Path $repoRoot "assets\MicrosoftEdgeWebView2Setup.exe"
Invoke-WebRequest `
  -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" `
  -OutFile $webViewBootstrapper
$webViewSignature = Get-AuthenticodeSignature $webViewBootstrapper
if ($webViewSignature.Status -ne "Valid") {
  throw "WebView2 bootstrapper signature is not valid: $($webViewSignature.Status)"
}

New-Item -ItemType Directory -Force "Output" | Out-Null
$friendSetup = "Output\SyncView-$Version-Friend-Setup.exe"
$friendZip = "Output\SyncView-$tag-Friend-win64.zip"
Remove-Item -Force $friendSetup -ErrorAction SilentlyContinue
Remove-Item -Force $friendZip -ErrorAction SilentlyContinue

& $innoCompiler "/DMyAppVersion=$Version" "/DMyAppOutputSuffix=-Friend" ".\installer.iss"
if (!(Test-Path $friendSetup)) {
  throw "Missing $friendSetup"
}

Compress-Archive `
  -Path ".\dist\SyncView\*" `
  -DestinationPath $friendZip `
  -CompressionLevel Optimal `
  -Force
if (!(Test-Path $friendZip)) {
  throw "Missing $friendZip"
}

Write-Host ""
Write-Host "Friend build complete:" -ForegroundColor Green
Write-Host "  $friendSetup"
Write-Host "  $friendZip"
Write-Host "Coffee/QR remains enabled by default for normal GitHub/CI builds."
