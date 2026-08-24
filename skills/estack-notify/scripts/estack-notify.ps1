# Toggle estack-notify for the CURRENT session. Invoked by the /estack-notify skill.
#   estack-notify.ps1            -> arm for this session (same as 'on')
#   estack-notify.ps1 off        -> disarm for this session
#   estack-notify.ps1 status     -> report without changing anything
# Session identity comes from CLAUDE_CODE_SESSION_ID, the same id the Stop hook
# receives, so arming never affects any other session.
# ASCII only: PowerShell 5.1 parses BOM-less files as ANSI.

param(
    [ValidateSet('status', 'on', 'off')]
    [string]$Action = 'on',
    [string]$SessionId = $env:CLAUDE_CODE_SESSION_ID
)

. (Join-Path $PSScriptRoot 'estack-notify-lib.ps1')

if (-not $SessionId) {
    Write-Output 'estack-notify: cannot resolve the current session id (CLAUDE_CODE_SESSION_ID is unset).'
    exit 1
}

$flag = Get-EstackNotifyFlagPath -SessionId $SessionId

switch ($Action) {
    'on' {
        $already = Test-Path $flag
        Remove-StaleEstackNotifyFlags
        Set-Content -Path $flag -Value @(
            "session=$SessionId",
            "cwd=$((Get-Location).Path)",
            "armed=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        ) -Encoding ascii
        if ($already) {
            Write-Output 'estack-notify was already ON for this session. A desktop toast fires at the end of every turn.'
        } else {
            Write-Output 'estack-notify ON for this session. A desktop toast fires at the end of every turn.'
        }
        Write-Output "Session: $SessionId"
        Write-Output "Flag:    $flag"
        Write-Output "Turn it off with /estack-notify off. It stays on if you resume this session."
    }
    'off' {
        if (Test-Path $flag) {
            Remove-Item $flag -Force
            Write-Output 'estack-notify OFF for this session.'
        } else {
            Write-Output 'estack-notify was already off for this session.'
        }
        Write-Output "Session: $SessionId"
    }
    'status' {
        if (Test-Path $flag) {
            Write-Output 'estack-notify: ON for this session (toast at the end of every turn).'
            Write-Output "Flag: $flag"
        } else {
            Write-Output 'estack-notify: OFF for this session. Turn it on with /estack-notify.'
        }
        Write-Output "Session: $SessionId"
    }
}
exit 0
