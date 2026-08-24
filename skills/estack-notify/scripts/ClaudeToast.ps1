# Shared Windows toast helper for Claude Code hooks.
# ASCII only: PowerShell 5.1 parses BOM-less files as ANSI.

function Get-ClaudeProjectName {
    param([string]$Path)

    if (-not $Path) { $Path = $env:CLAUDE_PROJECT_DIR }
    if (-not $Path) { return 'Claude Code' }

    $root = $null
    try { $root = (git -C $Path rev-parse --show-toplevel 2>$null) } catch {}
    if ($root) { $root = $root.Trim() }

    if ($root) { return (Split-Path $root -Leaf) }
    return (Split-Path $Path -Leaf)
}

function Get-ClaudeSessionTitle {
    param([string]$TranscriptPath)

    if (-not $TranscriptPath) { return '' }
    if (-not (Test-Path $TranscriptPath)) { return '' }

    $titleLine = Get-Content $TranscriptPath | Where-Object { $_ -match '"type":"ai-title"' } | Select-Object -First 1
    if (-not $titleLine) { return '' }

    try { return ($titleLine | ConvertFrom-Json).aiTitle } catch { return '' }
}

function Show-ClaudeToast {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [string]$Subtitle = 'Claude Code',
        [Parameter(Mandatory = $true)][string]$Message,
        [switch]$WithSnooze
    )

    Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\AppUserModelId\Claude Code' -Name 'DisplayName' -Value 'Claude Code'

    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime]

    $titleEsc    = [System.Security.SecurityElement]::Escape($Title)
    $subtitleEsc = [System.Security.SecurityElement]::Escape($Subtitle)
    $messageEsc  = [System.Security.SecurityElement]::Escape($Message)

    if ($WithSnooze) {
        $actions = @"
  <actions>
    <input id="snoozeTime" type="selection" defaultInput="5">
      <selection id="1" content="1 minute"/>
      <selection id="5" content="5 minutes"/>
      <selection id="15" content="15 minutes"/>
      <selection id="30" content="30 minutes"/>
      <selection id="60" content="1 hour"/>
    </input>
    <action content="Snooze" arguments="snooze" activationType="system" hint-inputId="snoozeTime"/>
  </actions>
"@
    } else {
        $actions = ''
    }

    $xmlDoc = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xmlDoc.LoadXml(@"
<toast scenario="reminder">
  <visual>
    <binding template="ToastGeneric">
      <text>$titleEsc</text>
      <text>$subtitleEsc</text>
      <text>$messageEsc</text>
    </binding>
  </visual>
$actions
</toast>
"@)

    $toast = [Windows.UI.Notifications.ToastNotification]::new($xmlDoc)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show($toast)
}
