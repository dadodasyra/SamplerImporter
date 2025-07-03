<#
Original: https://github.com/dadodasyra/SamplerImporter/blob/main/SampleWatcher.ps1

Hello IT guy, this is a script that runs automatically to send data to the following google sheet.
This script (and the apps scripts) were made by [REDACTED], an SFA in 2025 when [REDACTED] asked for it.
The data only transits between SMB server to Google servers without any intermediary. It should be safe.
No GMP or confidential data is transfered in this process.

The script runs automatically from the scheduled tasks, it's possible to disable it in Task Scheduler.

For documentation take a look at the button "Documentation" under "Sample Importer" in navbar of the google sheets.
#>

# ──────────────────────────────────────────────────────────
#  CONFIG – edit these constants only
# ──────────────────────────────────────────────────────────
$SharePath          = '%USERDATA%\Documents\SyncedFolder'           # ① folder to watch
$WebAppUrl          = 'https://script.google.com/a/macros/.../dev'  # ② GAS URL
$SecretToken        = 'PRIVATE_TOKEN'                   # ③ same as INBOUND_TOKEN, this is not really a secret
$ScanIntervalMin    = 10                                 # ④ timed rescan freq. (in min)
$GcloudExe          = 'gcloud'                         # full path if not in %PATH%
# ──────────────────────────────────────────────────────────

$StateFile = ".\state.json" #At the same place as the script
New-Item (Split-Path $StateFile) -ItemType Directory -Force | Out-Null

# -----  STATE  -------------------------------------------------------------
function Get-State {
    $init = $false
    if (Test-Path $StateFile) {
        try { return (Get-Content $StateFile -Raw | ConvertFrom-Json) }
        catch { $init = $true }
    } else {
        $init = $true
    }

    # --- first run: mark every existing .txt as "already processed" -------
    if ($init) {
        $allFiles = Get-ChildItem -Path $SharePath -Filter *.txt -File
        $sentList = $allFiles | Select-Object -ExpandProperty FullName
        $lastTs   = ($allFiles | Sort-Object LastWriteTimeUtc | Select -Last 1).LastWriteTimeUtc
        if (-not $lastTs) { $lastTs = [DateTime]'2000-01-01T00:00:00Z' }

        $state = @{
            lastTime = $lastTs
            sent     = $sentList
        }
        $state | ConvertTo-Json | Set-Content $StateFile -Encoding UTF8
        return $state
    }
}
function Save-State($s) { $s | ConvertTo-Json | Set-Content $StateFile -Encoding UTF8 }
$Global:State = Get-State

# -----  GOOGLE ACCESS TOKEN  ────────────────────────────
$Global:Token  = $null
$Global:TokenExp = Get-Date

function Get-AccessToken {
    # refresh if missing or < 5 min left
    if (!$Global:Token -or ((Get-Date) -gt $Global:TokenExp.AddMinutes(-5))) {
        try {
            $tok = & $GcloudExe auth print-access-token 2>$null
            if (-not $tok) { throw "no token" }
            if ($LASTEXITCODE -ne 0 -or -not $tok) {
                throw "gcloud auth print-access-token failed"
            }
            # tokens are 3600 s
            $Global:Token = $tok.Trim()
            $Global:TokenExp = (Get-Date).AddMinutes(55)
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show(
                "SampleWatcher/Importer needs you to sign in to Google Cloud.`n`n" +
                "A browser tab will open.`n" +
                "- Choose your Roche account`n" +
                "- Click Allow to grant Drive access`n`n",
                "SampleWatcher - Google sign-in required",
                0,   # OK button
                64   # information icon
            )
            Write-Host "No valid gcloud credentials, launching login flow..."
            & $GcloudExe auth login --update-adc --enable-gdrive-access
            $tok = & $GcloudExe auth print-access-token 2>$null

            if ($LASTEXITCODE -ne 0 -or -not $tok) {
                throw "gcloud auth print-access-token failed after login"
            }

            $Global:Token = $tok.Trim()
            $Global:TokenExp = (Get-Date).AddMinutes(55)
        }
    }
    return $Global:Token
}

# -----  SEND ONE FILE  ──────────────────────────────────
function Send-File($path) {
    $fileName = [IO.Path]::GetFileName($path)
    Write-Host "Sending $fileName ..."
    $body = @{
        filename = $fileName
        content  = [Convert]::ToBase64String([IO.File]::ReadAllBytes($path))
        token    = $SecretToken
    } | ConvertTo-Json -Compress

    try {
        $headers = @{ Authorization = "Bearer $(Get-AccessToken)" }
        $resp = Invoke-RestMethod -Uri $WebAppUrl -Method POST `
                 -Headers $headers `
                 -Body $body -ContentType 'application/json' -TimeoutSec 30
        Write-Host "Success: $resp"
        $Global:State.sent     += $path
        $Global:State.lastTime  = (Get-Item $path).LastWriteTimeUtc
        Save-State $Global:State
    } 	
    catch {
        Write-Host "Error while sending $fileName : $_"
    }
}

# -----  SCAN FOR NEW FILES  ─────────────────────────────
function Process-Pending {
    $pending = Get-ChildItem -Path $SharePath -Filter *.txt -File |
               Where-Object {
                    -not $Global:State.sent.Contains($_.FullName)
               } | Sort-Object LastWriteTimeUtc
    foreach ($f in $pending) { Send-File $f.FullName }
}

# -----  MAIN LOOP  ──────────────────────────────────────
Add-Type -AssemblyName System.Windows.Forms
Process-Pending

$timer = New-Object Timers.Timer ($ScanIntervalMin*60*1000)
Register-ObjectEvent $timer 'Elapsed' -Action { Process-Pending } | Out-Null
$timer.Start()

Write-Host "Watching $SharePath every $ScanIntervalMin minutes"
while ($true) { Start-Sleep 3600 }
