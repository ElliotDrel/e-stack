# Stop hook: fire a Windows toast at the end of every turn, but only for a
# session that ran /estack-notify. Every other session exits silently.
# ASCII only: PowerShell 5.1 parses BOM-less files as ANSI.

. (Join-Path $PSScriptRoot 'estack-notify-lib.ps1')

$raw = [Console]::In.ReadToEnd()
$payload = $null
if ($raw) {
    try { $payload = $raw | ConvertFrom-Json }
    catch { Write-Error "estack-notify: unreadable hook payload: $($_.Exception.Message)" }
}

$sessionId = $null
if ($payload -and $payload.session_id) { $sessionId = $payload.session_id }

if (-not (Test-EstackNotifyOn -SessionId $sessionId)) {
    if ($env:ESTACK_NOTIFY_DRYRUN) { Write-Output 'SILENT' }
    exit 0
}

# Test seam: report the decision instead of rendering a toast.
if ($env:ESTACK_NOTIFY_DRYRUN) {
    Write-Output 'TOAST'
    exit 0
}

. (Join-Path $PSScriptRoot 'ClaudeToast.ps1')

$cwd = $null
if ($payload -and $payload.cwd) { $cwd = $payload.cwd }

$transcript = $null
if ($payload -and $payload.transcript_path) { $transcript = $payload.transcript_path }

$name = Get-ClaudeProjectName -Path $cwd
$title = Get-ClaudeSessionTitle -TranscriptPath $transcript
if (-not $title) { $title = 'Claude Code' }

Show-ClaudeToast -Title $name -Subtitle $title -Message 'Turn finished' -WithSnooze
exit 0
