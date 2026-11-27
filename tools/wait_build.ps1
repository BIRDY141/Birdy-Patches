[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'
$repo = 'BIRDY141/Birdy-Patches'
$sha = (git rev-parse HEAD).Trim()
$tok = $null
try {
    $c = (('protocol=https' + [char]10 + 'host=github.com' + [char]10) | & git credential fill 2>$null)
    foreach ($l in $c) {
        if ($l -match '^password=(.+)$') { $tok = $Matches[1]; break }
    }
} catch {}
$hdr = @{ 'User-Agent' = 'BirdyTV-Deploy'; 'Accept' = 'application/vnd.github+json' }
if ($tok) { $hdr['Authorization'] = ('Bearer ' + $tok) }
Write-Host ('[GitHub Build] Checking release.yml for ' + $repo + ' (SHA: ' + $sha.Substring(0,7) + ')...')
$run = $null
$waitEnd = (Get-Date).AddSeconds(40)
while ((Get-Date) -lt $waitEnd -and -not $run) {
    try {
        $r = Invoke-RestMethod -Uri ('https://api.github.com/repos/' + $repo + '/actions/workflows/release.yml/runs?head_sha=' + $sha + '&per_page=5') -Headers $hdr
        if ($r.workflow_runs.Count -gt 0) { $run = $r.workflow_runs[0]; break }
    } catch {}
    Write-Host '[GitHub Build] Waiting for workflow run to register...'
    Start-Sleep 10
}
if (-not $run) {
    $r = Invoke-RestMethod -Uri ('https://api.github.com/repos/' + $repo + '/actions/workflows/release.yml/runs?branch=main&per_page=1') -Headers $hdr
    if ($r.workflow_runs.Count -gt 0) { $run = $r.workflow_runs[0] }
}
if (-not $run) {
    Write-Host '[ERROR] No GitHub Actions runs found.'
    exit 1
}
$end = (Get-Date).AddMinutes(15)
while ($run.status -ne 'completed') {
    if ((Get-Date) -ge $end) {
        Write-Host ('[ERROR] Timed out waiting for build #' + $run.run_number)
        exit 1
    }
    Write-Host ('[GitHub Build] Run #' + $run.run_number + ' is ' + $run.status + '... waiting 20s')
    Start-Sleep 20
    $run = Invoke-RestMethod -Uri $run.url -Headers $hdr
}
if ($run.conclusion -eq 'success') {
    Write-Host ('[OK] GitHub build #' + $run.run_number + ' succeeded: ' + $run.html_url)
    exit 0
} else {
    Write-Host ('[ERROR] GitHub build #' + $run.run_number + ' FAILED (' + $run.conclusion + '): ' + $run.html_url)
    exit 1
}
