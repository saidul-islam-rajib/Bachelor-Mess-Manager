#requires -Version 5.1
<#
    Registers a daily Windows Scheduled Task that runs the backup.
    Run once, from an elevated PowerShell, in the project root:

        powershell -ExecutionPolicy Bypass -File scripts\schedule-backup.ps1

    Remove it again with:

        Unregister-ScheduledTask -TaskName "BachelorPoint-DailyBackup" -Confirm:$false
#>

param(
    [string]$TaskName = 'BachelorPoint-DailyBackup',
    [string]$At = '02:30',
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node was not found on PATH.' }

$script = Join-Path $ProjectRoot 'scripts\backup-db.js'
if (-not (Test-Path $script)) { throw "Backup script not found at $script" }

$logDir = Join-Path $ProjectRoot 'backups'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$command = "& '$node' '$script' *>> '$logDir\backup.log'"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded" `
    -WorkingDirectory $ProjectRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $At

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -MultipleInstances IgnoreNew

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description 'Daily Bachelor Point database backup with rotation.' `
    -RunLevel Limited | Out-Null

Write-Host "Registered '$TaskName' to run every day at $At."
Write-Host "  project : $ProjectRoot"
Write-Host "  log     : $logDir\backup.log"
Write-Host ""
Write-Host "Run it now to confirm it works:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
