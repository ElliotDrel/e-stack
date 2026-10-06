# Local skill edits saved before cleanup

- Preserve Elliot's local edits found during the October 6, 2026 E-Stack uninstall audit.
- Record why they were saved: Elliot was preparing to uninstall E-Stack for cleanup reasons and wanted to implement his local skill improvements in the actual repository later.
- Keep the original content on the remote branch `backup/local-skill-edits-2026-10-06` so cleanup cannot erase the implementation source.
- Pair each saved skill with a GitHub issue so the review and implementation work can be tracked as tasks.
- Record the stopping point accurately: the audit and remote preservation were authorized; uninstalling and deleting local files were still pending separate authorization.

## Saved content

| Skill | Original updater backup | Snapshot | Changes to implement |
|---|---|---|---|
| Active learning tutor | `~/.estack-backup/estack-active-learning-tutor/` | [Full skill folder](skills/estack-active-learning-tutor/) | Formula-sheet questions that test decisions and understanding; revised guidance for useful in-conversation visuals. |
| Email writer | `~/.estack-backup/estack-email-writer/` | [Full skill folder](skills/estack-email-writer/) | Expanded email coverage, acknowledging obvious weaknesses, update-email exceptions, prepared asks, institutional routing, list sends, and controlled audience variants. |

- Preserve the snapshot files byte for byte, including their original version fields: tutor `1.0.2` and email writer `1.2.0`.
- Verify the eight snapshot files against [SHA256SUMS](SHA256SUMS).
- Compare these snapshots against production `skills/` at the audit baseline, commit `c8fcd7f6d8be06ea47fa3db70a71d2ffe558b3a1` (package version `1.0.77`).
- Note that the active local skills matched npm and GitHub at the audit baseline; the differing edits were preserved in the updater's separate backup folder.
- Keep these archived copies separate from production `skills/`; implementation, versioning, documentation, and release checks belong to the paired tasks.
- Exclude the saved status-line hook and the productivity-coach backup at Elliot's request.
- Exclude credentials and local E-Stack storage data from this remote backup.

## Paired implementation issues

- Track the tutor implementation in [issue #69: saved formula-sheet and visual teaching edits](https://github.com/ElliotDrel/e-stack/issues/69).
- Track the email implementation in [issue #70: saved local email guidance](https://github.com/ElliotDrel/e-stack/issues/70).

## Implementation notes

- Review each preserved change before applying it to the corresponding production skill.
- Validate factual advice in the email snapshot, including provider limits and whether BCC recipient lists can be recovered, before shipping it.
- Follow repository conventions for skill versions, documentation, changelog entries, and validation when implementing the tasks.
- Preserve this branch as the original source even after implementation is complete.
