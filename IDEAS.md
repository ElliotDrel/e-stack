# Ideas

Future additions and improvements for this repo.

---

1. **Claude Code startup hook** — Auto-run `git pull` + `sync.sh` every time a Claude Code session starts. Lightweight, no background process. Keeps local skills in sync with GitHub automatically.

2. **Windows Scheduled Task** — Run `git pull && bash sync.sh` on a recurring interval via Task Scheduler. Fully hands-off, syncs even when Claude Code isn't open.
