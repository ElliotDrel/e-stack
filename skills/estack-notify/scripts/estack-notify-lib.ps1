# Shared state helpers for estack-notify.
# State is keyed by SESSION ID, so arming one session never touches another.
# ASCII only: PowerShell 5.1 parses BOM-less files as ANSI.

function Get-EstackNotifyStateDir {
    $base = $env:USERPROFILE
    if (-not $base) { $base = $HOME }
    $dir = Join-Path $base '.e-stack\estack-notify'
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return $dir
}

function Get-EstackNotifyFlagPath {
    param([Parameter(Mandatory = $true)][string]$SessionId)

    $key = $SessionId.ToLowerInvariant() -replace '[^a-z0-9-]', ''
    if (-not $key) { throw 'estack-notify: empty session id' }

    return (Join-Path (Get-EstackNotifyStateDir) "$key.flag")
}

function Test-EstackNotifyOn {
    param([string]$SessionId)

    if (-not $SessionId) { return $false }
    return (Test-Path (Get-EstackNotifyFlagPath -SessionId $SessionId))
}

function Remove-StaleEstackNotifyFlags {
    param([int]$MaxAgeDays = 30)

    $cutoff = (Get-Date).AddDays(-1 * $MaxAgeDays)
    Get-ChildItem -Path (Get-EstackNotifyStateDir) -Filter '*.flag' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force -ErrorAction SilentlyContinue
}
