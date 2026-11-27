[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

Write-Host "Fetching latest release from BIRDY141/Birdy-Patches..."
$r = Invoke-RestMethod -Uri 'https://api.github.com/repos/BIRDY141/Birdy-Patches/releases/latest'
Write-Host "Latest release: $($r.tag_name)"
$asset = $r.assets | Where-Object { $_.name -like '*.mpp' } | Select-Object -First 1
Write-Host "Downloading $($asset.browser_download_url)..."
for ($try = 1; $try -le 3; $try++) {
    try {
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile "patches.mpp"
        break
    } catch {
        if ($try -eq 3) { throw }
        Write-Host "Download retry $try/3..."
        Start-Sleep 3
    }
}
Write-Host "Downloaded patches.mpp."

$morpheJar = "morphe-cli.jar"
$stockApk = "youtube-tv.apk"
$javaExe = "tools\jdk\bin\java.exe"
$adbExe = "tools\platform-tools\adb.exe"
$outApk = "birdytv-patched.apk"

if (Test-Path $outApk) { Remove-Item $outApk -Force }

Write-Host "Patching APK with $morpheJar..."
& $javaExe -jar $morpheJar patch `
    --patches patches.mpp `
    --out $outApk `
    $stockApk

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $outApk)) {
    Write-Host "[ERROR] Morphe patching failed!"
    exit 1
}
Write-Host "[OK] Patched APK created: $outApk"

$tvIp = "192.168.1.6:5555"
if (Test-Path "tv_ip.txt") {
    $c = (Get-Content "tv_ip.txt").Trim()
    if ($c) { $tvIp = $c }
}
Write-Host "Connecting to TV: $tvIp"
& $adbExe connect $tvIp

Write-Host "Updating BirdyTV on TV..."
$installOut = (& $adbExe install -r $outApk 2>&1)
Write-Host $installOut

Write-Host "Refreshing Android TV Launcher cache..."
& $adbExe shell am force-stop com.google.android.tvlauncher

Write-Host "Launching BirdyTV on TV..."
& $adbExe shell monkey -p app.tvpatches.android.youtube.tv 1
Write-Host "[DONE] Deployed and launched on TV successfully!"
