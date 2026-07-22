$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repository = "hgck000/syncview-desktop"
$releaseApi = "https://api.github.com/repos/$repository/releases/latest"
$headers = @{
    Accept = "application/vnd.github+json"
    "User-Agent" = "SyncView-Installer"
}

try {
    Write-Host "Finding the latest SyncView release..."
    $release = Invoke-RestMethod -Uri $releaseApi -Headers $headers
    $asset = $release.assets |
        Where-Object { $_.name -match '^SyncView-\d+\.\d+\.\d+-Setup\.exe$' } |
        Select-Object -First 1

    if (-not $asset) {
        throw "The latest release does not contain a Windows installer."
    }

    $downloadPath = Join-Path $env:TEMP $asset.name
    Write-Host "Downloading $($asset.name)..."
    Invoke-WebRequest `
        -Uri $asset.browser_download_url `
        -Headers $headers `
        -OutFile $downloadPath

    Write-Host "Starting SyncView installer..."
    $installer = Start-Process -FilePath $downloadPath -Wait -PassThru
    exit $installer.ExitCode
} catch {
    Write-Error $_
    exit 1
}
