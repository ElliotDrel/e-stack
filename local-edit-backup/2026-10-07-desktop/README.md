# Desktop-Elliot skill backups saved during cleanup

- Preserve the updater-saved skill folders found on Desktop-Elliot on October 7, 2026.
- Record Elliot's reason: uninstall E-Stack for cleanup, retain his saved local work remotely, and track review and implementation in paired issues.
- Keep the original files under `updater-backups/`, with their original version fields and exact contents.
- Compare them with the production skills before implementing changes: the desktop's 24 active skills matched the audit baseline, but these backups include older upstream content as well as a local observation.
- Preserve `estack-drive-cli-agent` version `1.0.0`, including its expanded description and a Windows headless-CLI output observation in `references/claude-headless.md`.
- Preserve `estack-read-agent-history` version `4.1.1`, including its expanded description and historical references and script; current production is `4.1.4`, so do not restore the folder wholesale or remove newer resumability support.
- Verify the files against [SHA256SUMS](SHA256SUMS).
- Exclude credentials, the saved status-line hook, and productivity-coach changes, following the original cleanup request.
- Retain the desktop's separate updater backups locally during uninstall.
- Apply the same storage exceptions as the laptop: retain flight-planner data and API-key assignments if present; neither was present on the desktop during this audit.

## Paired tasks

- Track CLI output guidance in [issue #71](https://github.com/ElliotDrel/e-stack/issues/71).
- Track history-snapshot review in [issue #72](https://github.com/ElliotDrel/e-stack/issues/72).
