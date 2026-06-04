#!/usr/bin/env node
// @version 1.0.0
// PostToolUse hook: nudges toward the repo-search skill when GitHub is involved.
// Fires on every WebFetch or WebSearch that touches a github.com URL.

const SKILL_NAME = "estack-repo-search";

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  try { run(input); } catch { /* never break the tool */ }
  process.exit(0);
});

function emitNudge() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `GitHub repo detected. For deeper code questions, consider the ${SKILL_NAME} skill — it clones and greps the repo locally, which is usually faster and more accurate than web fetching multiple GitHub pages.`
    }
  }) + "\n");
}

function run(raw) {
  let payload;
  try { payload = JSON.parse(raw); } catch { return; }

  const tool = payload.tool_name;
  if (tool !== "WebFetch" && tool !== "WebSearch") return;

  if (/github\.com/i.test(raw)) emitNudge();
}
