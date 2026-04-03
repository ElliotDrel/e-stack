#!/usr/bin/env node

/**
 * tracker-tools.cjs — Data service layer for github-issues-update skill.
 *
 * Commands:
 *   parse-tracker <path>                  Parse tracker.md into structured JSON
 *   compile-report --temp-dir <dir> --date <YYYY-MM-DD>  Build overview from result files
 *   update-tracker --tracker <path> --temp-dir <dir> --date <YYYY-MM-DD>  Apply changes
 *   init-temp                             Create temp directory, print path
 *   validate --temp-dir <dir> --tracker <path> --expected <N>  Check completeness
 *   startup --tracker <path>              Auth, parse tracker, discover new/reopened issues
 *   fetch-issues --temp-dir <dir> --issues <json-file>  Parallel gh api fetches per issue
 *   build-tracker --temp-dir <dir> --template <path> --username <name> --tracker <path>  Compose tracker from result files
 *
 * Zero dependencies. Deterministic output. The agent calls this; it cannot "forget".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execSync } = require('child_process');

// ─── CLI Router ─────────────────────────────────────────────────────────────

const [,, command, ...rawArgs] = process.argv;

const commands = {
  'parse-tracker': cmdParseTracker,
  'compile-report': cmdCompileReport,
  'update-tracker': cmdUpdateTracker,
  'init-temp': cmdInitTemp,
  'validate': cmdValidate,
  'startup': cmdStartup,
  'fetch-issues': cmdFetchIssues,
  'build-tracker': cmdBuildTracker,
};

if (!command || !commands[command]) {
  console.error(`Usage: tracker-tools.cjs <command> [options]`);
  console.error(`Commands: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

// Parse --flag value pairs from rawArgs
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = val;
    } else if (!flags._positional) {
      flags._positional = args[i];
    }
  }
  return flags;
}

const flags = parseFlags(rawArgs);

(async () => {
  try {
    await commands[command](flags);
  } catch (err) {
    console.error(`Error in ${command}: ${err.message}`);
    process.exit(1);
  }
})();

// ─── Frontmatter Parser ────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    // Boolean
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    // Number
    else if (/^\d+$/.test(val)) val = parseInt(val, 10);
    // Comma-separated list
    else if (val.includes(',') && !val.startsWith('"')) {
      val = val.split(',').map(s => s.trim()).filter(Boolean);
    }
    // Strip surrounding quotes
    else if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }

    meta[key] = val;
  }

  const body = content.slice(match[0].length).trim();
  return { meta, body };
}

// ─── Tracker Parser ─────────────────────────────────────────────────────────

function parseTrackerFile(content) {
  const result = {
    username: null,
    active_issues: [],
    closed_issues: [],
    raw: content,
  };

  // Extract username
  const userMatch = content.match(/GitHub username:\s*\*\*(.+?)\*\*/);
  if (userMatch) result.username = userMatch[1];

  // Split into Active and Closed sections
  const activeSectionMatch = content.match(
    /## Active Issues[^\n]*\n([\s\S]*?)(?=\n## (?!Active)|$)/
  );
  const closedSectionMatch = content.match(
    /## Closed[^\n]*\n([\s\S]*?)(?=\n## (?!Closed)|$)/
  );

  if (activeSectionMatch) {
    result.active_issues = parseIssueSections(activeSectionMatch[1]);
  }
  if (closedSectionMatch) {
    result.closed_issues = parseClosedSections(closedSectionMatch[1]);
  }

  return result;
}

function parseIssueSections(sectionContent) {
  const issues = [];
  // Split by ### headers
  const parts = sectionContent.split(/(?=^### )/m).filter(p => p.trim());

  for (const part of parts) {
    // Skip HTML comments
    if (part.trim().startsWith('<!--')) continue;

    const issue = parseIssueBlock(part);
    if (issue) issues.push(issue);
  }
  return issues;
}

function parseIssueBlock(block) {
  // Parse header: ### owner/repo#NUMBER — Title
  const headerMatch = block.match(
    /^### ([^/]+)\/([^#]+)#(\d+)\s*[—–-]\s*(.+)/m
  );
  if (!headerMatch) return null;

  const issue = {
    owner: headerMatch[1].trim(),
    repo: headerMatch[2].trim(),
    number: parseInt(headerMatch[3], 10),
    title: headerMatch[4].trim(),
    role: extractField(block, 'Role'),
    filed: extractField(block, 'Filed'),
    last_check_date: null,
    status_summary: extractField(block, 'Status as of'),
    what_to_check: extractField(block, 'What to check'),
    related: extractListField(block, 'Related'),
    upstream: extractUpstream(block),
    duplicates: extractNestedItems(block, 'Duplicates found'),
    adjacent: extractNestedItems(block, 'Adjacent issues found'),
    next_steps: extractField(block, 'Next steps \\(now\\)'),
    future: extractField(block, 'Future'),
  };

  // Extract last check date from "Status as of YYYY-MM-DD:"
  const dateMatch = block.match(/\*\*Status as of (\d{4}-\d{2}-\d{2})\*\*/);
  if (dateMatch) issue.last_check_date = dateMatch[1];

  // Extract History field (multi-line: bullet list under **History:**)
  issue.history = extractHistoryField(block);

  return issue;
}

function extractField(block, fieldName) {
  const re = new RegExp(`\\*\\*${fieldName}(?:\\s+\\S+)?[.:]*\\*\\*\\s*(.+)`, 'i');
  const match = block.match(re);
  return match ? match[1].trim() : null;
}

function extractListField(block, fieldName) {
  const val = extractField(block, fieldName);
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

function extractUpstream(block) {
  const val = extractField(block, 'Upstream');
  if (!val || val.toLowerCase() === 'n/a' || val === 'none') return null;
  const match = val.match(/([^/]+)\/([^#]+)#(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
}

function extractNestedItems(block, sectionName) {
  const items = [];
  const re = new RegExp(`\\*\\*${sectionName}[^*]*\\*\\*[:\\s]*\\n([\\s\\S]*?)(?=\\n- \\*\\*[A-Z]|$)`, 'i');
  const match = block.match(re);
  if (!match) return items;

  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const itemMatch = line.match(/^\s+-\s+\*\*#?(\d+)\*\*\s*[—–-]\s*(.+)/);
    if (itemMatch) {
      items.push({
        number: parseInt(itemMatch[1], 10),
        detail: itemMatch[2].trim(),
      });
    }
  }
  return items;
}

/**
 * Extract history entries from an issue block.
 * Matches all "  - **YYYY-MM-DD:** ..." lines under "**History:**".
 * Returns array of strings like "**2026-03-15:** Filed issue".
 */
function extractHistoryField(block) {
  // Find **History:** and collect indented bullet lines until next top-level field or section
  const historyStart = block.search(/- \*\*History:\*\*/);
  if (historyStart === -1) return [];

  const afterHistory = block.slice(historyStart);
  // Collect lines after the **History:** line that match date bullets
  const lines = afterHistory.split(/\r?\n/);
  const entries = [];
  let started = false;
  for (const line of lines) {
    if (!started) {
      if (/- \*\*History:\*\*/.test(line)) { started = true; }
      continue;
    }
    // Match indented date bullets: "  - **YYYY-MM-DD:** ..."
    const bullet = line.match(/^\s+-\s+(\*\*\d{4}-\d{2}-\d{2}\*\*:.+)/);
    if (bullet) {
      entries.push(bullet[1].trim());
    } else if (line.match(/^- \*\*[A-Z]/) || line.match(/^### /)) {
      // Next top-level field or section header — stop
      break;
    }
  }
  return entries;
}

function parseClosedSections(sectionContent) {
  const issues = [];
  const parts = sectionContent.split(/(?=^### )/m).filter(p => p.trim());

  for (const part of parts) {
    if (part.trim().startsWith('<!--')) continue;
    const headerMatch = part.match(
      /^### ([^/]+)\/([^#]+)#(\d+)\s*[—–-]\s*(.+)/m
    );
    if (!headerMatch) continue;

    const lines = part.split(/\r?\n/).slice(1).filter(l => l.trim().startsWith('-'));
    issues.push({
      owner: headerMatch[1].trim(),
      repo: headerMatch[2].trim(),
      number: parseInt(headerMatch[3], 10),
      title: headerMatch[4].trim(),
      resolution: lines.map(l => l.replace(/^-\s*/, '').trim()).join(' '),
    });
  }
  return issues;
}

// ─── Report Compiler ────────────────────────────────────────────────────────

function compileOverviewReport(tempDir, date) {
  const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    return { error: 'No result files found in temp directory' };
  }

  const issueResults = [];
  let generalResult = null;

  for (const file of files) {
    const content = fs.readFileSync(path.join(tempDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    if (meta.type === 'general') {
      generalResult = { meta, body };
    } else if (meta.type === 'issue') {
      issueResults.push({ meta, body, file });
    }
  }

  // Sort: activity first, then by update recency
  const withActivity = issueResults.filter(r => r.meta.has_activity === true);
  const noActivity = issueResults.filter(r => r.meta.has_activity !== true);

  // Count repos
  const repos = new Set(issueResults.map(r => `${r.meta.owner}/${r.meta.repo}`));

  // Build report
  let report = '';

  report += `## GitHub Issues Check-In — ${date}\n\n`;
  report += `**Tracking ${issueResults.length} active issues across ${repos.size} repos**`;

  // Find oldest check date for "last check"
  const checkDates = issueResults
    .map(r => r.meta.last_check_date)
    .filter(Boolean)
    .sort();
  if (checkDates.length > 0) {
    report += ` | Last check: ${checkDates[0]}`;
  }
  report += '\n\n---\n\n';

  // ── Issues with Activity ──
  if (withActivity.length > 0) {
    report += '### Issues with Activity\n\n';
    for (const r of withActivity) {
      report += buildIssueDetailBlock(r);
    }
  }

  // ── No Activity ──
  if (noActivity.length > 0) {
    report += '### No Activity\n\n';
    report += '| Issue | Last activity |\n';
    report += '|-------|---------------|\n';
    for (const r of noActivity) {
      const lastDate = r.meta.last_comment_date || r.meta.last_check_date || 'unknown';
      report += `| ${r.meta.owner}/${r.meta.repo}#${r.meta.number} — ${r.meta.title} | ${lastDate} |\n`;
    }
    report += '\n---\n\n';
  }

  // ── General Check Sections ──
  if (generalResult) {
    const body = generalResult.body;

    // New Issues
    const newIssuesSection = extractSection(body, 'New Issues');
    if (newIssuesSection && newIssuesSection.trim() !== 'None') {
      report += '### New Issues Not in Tracker\n\n';
      report += newIssuesSection + '\n\n---\n\n';
    } else {
      report += `### New Issues Not in Tracker\n\nNo new issues found since last check.\n\n---\n\n`;
    }

    // Reopened
    const reopenedSection = extractSection(body, 'Reopened');
    if (reopenedSection && reopenedSection.trim() !== 'None') {
      report += '### Reopened Issues\n\n';
      report += reopenedSection + '\n\n---\n\n';
    }

    // Closed Status
    const closedSection = extractSection(body, 'Closed Status');
    if (closedSection) {
      report += '### Closed Issues Status\n\n';
      report += closedSection + '\n\n---\n\n';
    }
  }

  // ── Upstream Status ──
  const upstreamResults = issueResults.filter(r => {
    const upstreamSection = extractSection(r.body, 'Upstream');
    return upstreamSection && upstreamSection.trim() !== 'N/A' && upstreamSection.trim() !== 'None';
  });
  if (upstreamResults.length > 0) {
    report += '### Upstream Status\n\n';
    report += '| Upstream issue | State | Impact |\n';
    report += '|----------------|-------|--------|\n';
    for (const r of upstreamResults) {
      const section = extractSection(r.body, 'Upstream');
      report += `| ${r.meta.owner}/${r.meta.repo}#${r.meta.number} | ${section.trim()} |\n`;
    }
    report += '\n---\n\n';
  }

  // ── Summary ──
  const actionItems = withActivity.reduce((count, r) => {
    const steps = extractSection(r.body, 'Next Steps');
    if (steps) count += (steps.match(/^- \[/gm) || []).length;
    return count;
  }, 0);

  report += '### Summary\n\n';
  report += `**Action items:** ${actionItems}\n`;
  if (withActivity.length > 0) {
    const needAttention = withActivity.slice(0, 3).map(
      r => `${r.meta.owner}/${r.meta.repo}#${r.meta.number}`
    );
    report += `**Issues needing attention:** ${needAttention.join(', ')}\n`;
  }
  if (noActivity.length > 0) {
    report += `**All quiet:** ${noActivity.length} issues with no activity\n`;
  }

  return { report, issue_count: issueResults.length, activity_count: withActivity.length };
}

function buildIssueDetailBlock(r) {
  let block = '';
  block += `#### ${r.meta.owner}/${r.meta.repo}#${r.meta.number} — ${r.meta.title}\n`;
  block += `| Field | Value |\n`;
  block += `|-------|-------|\n`;
  block += `| **State** | ${r.meta.state || 'Open'}${r.meta.state_changed ? ' [changed]' : ''} |\n`;
  if (r.meta.labels) {
    const labels = Array.isArray(r.meta.labels) ? r.meta.labels.join(', ') : r.meta.labels;
    block += `| **Labels** | ${labels} |\n`;
  }
  block += `| **Your role** | ${r.meta.role || 'Unknown'} |\n\n`;

  // Activity section
  const activity = extractSection(r.body, 'Activity');
  if (activity) {
    block += `**What happened:**\n${activity}\n\n`;
  }

  // Duplicates
  const dupes = extractSection(r.body, 'Known');
  const newFinds = extractSection(r.body, 'New finds');
  const hasDupes = dupes && !/^(none|no changes)\.?$/i.test(dupes.trim());
  const hasNewFinds = newFinds && !/^(none|none found|skipped)\.?/i.test(newFinds.trim());
  if (hasDupes || hasNewFinds) {
    block += `**Duplicates & related:**\n`;
    if (hasDupes) block += `- Known dupes — ${dupes.trim()}\n`;
    if (hasNewFinds) block += `- New finds — ${newFinds.trim()}\n`;
    block += '\n';
  }

  // Next Steps
  const steps = extractSection(r.body, 'Next Steps');
  if (steps) {
    block += `**Next steps:**\n${steps}\n\n`;
  }

  // Watch For
  const watch = extractSection(r.body, 'Watch For');
  if (watch) {
    block += `**Watch for:**\n${watch}\n\n`;
  }

  block += '---\n\n';
  return block;
}

function extractSection(body, headerPattern) {
  // Match ## Header or ### Header, capture until next ## or end
  const re = new RegExp(
    `^#{2,4}\\s+(?:[^\\n]*?${headerPattern}[^\\n]*)\\n([\\s\\S]*?)(?=^#{2,4}\\s|$)`,
    'mi'
  );
  const match = body.match(re);
  return match ? match[1].trim() : null;
}

// ─── Tracker Updater ────────────────────────────────────────────────────────

function applyTrackerUpdates(trackerContent, tempDir, date) {
  const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.md'));
  let updated = trackerContent;
  const changes = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(tempDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    if (meta.type !== 'issue') continue;

    const issueKey = `${meta.owner}/${meta.repo}#${meta.number}`;

    // Find this issue's section in the tracker
    const sectionRe = new RegExp(
      `(### ${escapeRegex(meta.owner)}/${escapeRegex(meta.repo)}#${meta.number}\\s*[—–-][^\\n]*\\n[\\s\\S]*?)(?=\\n### |\\n## |$)`,
      'm'
    );
    const sectionMatch = updated.match(sectionRe);
    if (!sectionMatch) continue;

    let section = sectionMatch[1];
    const originalSection = section;

    // Update "Status as of" date and summary
    const trackerUpdates = extractSection(body, 'Tracker Updates');
    if (trackerUpdates) {
      const statusLine = trackerUpdates.match(/^status_summary:\s*(.+)/m);
      if (statusLine) {
        section = section.replace(
          /\*\*Status as of \d{4}-\d{2}-\d{2}\*\*:\s*.+/,
          `**Status as of ${date}:** ${statusLine[1].trim()}`
        );
      }

      const watchLine = trackerUpdates.match(/^what_to_check:\s*(.+)/m);
      if (watchLine) {
        section = section.replace(
          /\*\*What to check\*\*:\s*.+/,
          `**What to check:** ${watchLine[1].trim()}`
        );
      }
    }

    // Handle state change: open → closed (move to Closed section)
    if (meta.state === 'closed' && meta.state_changed) {
      // Remove from active
      updated = updated.replace(originalSection, '');
      // Add to closed
      const closedEntry = `### ${issueKey} — ${meta.title}\n- Closed as of ${date}. ${meta.close_reason || ''}\n\n`;
      updated = updated.replace(
        /(## Closed[^\n]*\n)/,
        `$1\n${closedEntry}`
      );
      changes.push(`Moved ${issueKey} to Closed`);
      continue;
    }

    // Add new duplicates
    if (trackerUpdates) {
      const newDupeLines = [];
      const dupeRe = /new_duplicate:\s*#?(\d+)\s*[—–-]\s*(.+)/gm;
      let dupeMatch;
      while ((dupeMatch = dupeRe.exec(trackerUpdates)) !== null) {
        newDupeLines.push(`  - **#${dupeMatch[1]}** — ${dupeMatch[2].trim()}`);
      }
      if (newDupeLines.length > 0) {
        const dupeHeader = `**Duplicates found (${date}):**`;
        if (section.includes('Duplicates found')) {
          // Append to existing duplicates section
          section = section.replace(
            /(Duplicates found[^*]*\*\*:?\s*\n(?:\s+-[^\n]*\n)*)/,
            `$1${dupeHeader}\n${newDupeLines.join('\n')}\n`
          );
        } else {
          // Add before Next steps
          section = section.replace(
            /(\*\*Next steps)/,
            `- ${dupeHeader}\n${newDupeLines.join('\n')}\n- $1`
          );
        }
        changes.push(`Added ${newDupeLines.length} duplicates to ${issueKey}`);
      }
    }

    // Append history entries from result file
    if (trackerUpdates) {
      const newHistoryEntries = [];
      const historyRe = /^history_entry:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)/gm;
      let hm;
      while ((hm = historyRe.exec(trackerUpdates)) !== null) {
        newHistoryEntries.push({ date: hm[1], desc: hm[2].trim() });
      }

      if (newHistoryEntries.length > 0) {
        const historyHeaderIdx = section.indexOf('- **History:**');
        if (historyHeaderIdx !== -1) {
          // History section exists — collect existing entries for dedup
          const afterHeader = section.slice(historyHeaderIdx);
          const existingLines = afterHeader.split(/\r?\n/);
          const existingTexts = new Set();
          for (const line of existingLines.slice(1)) {
            const m = line.match(/^\s+-\s+\*\*(\d{4}-\d{2}-\d{2})\*\*:\s*(.+)/);
            if (m) existingTexts.add(`${m[1]}|${m[2].trim()}`);
            else if (line.match(/^- \*\*[A-Z]/) || line.match(/^### /)) break;
          }

          // Build lines to append (deduped)
          const toAppend = newHistoryEntries
            .filter(e => !existingTexts.has(`${e.date}|${e.desc}`))
            .map(e => `  - **${e.date}:** ${e.desc}`);

          if (toAppend.length > 0) {
            // Find the last history bullet line position and insert after it
            // We'll insert the new lines before the next top-level field after **History:**
            const historyBlock = section.slice(historyHeaderIdx);
            const historyLines = historyBlock.split(/\r?\n/);
            let lastBulletLine = 0;
            for (let li = 1; li < historyLines.length; li++) {
              if (/^\s+-\s+\*\*\d{4}-\d{2}-\d{2}\*\*:/.test(historyLines[li])) {
                lastBulletLine = li;
              } else if (/^- \*\*[A-Z]/.test(historyLines[li]) || /^### /.test(historyLines[li])) {
                break;
              }
            }
            // Insert toAppend after lastBulletLine
            historyLines.splice(lastBulletLine + 1, 0, ...toAppend);
            const newHistoryBlock = historyLines.join('\n');
            section = section.slice(0, historyHeaderIdx) + newHistoryBlock;
            changes.push(`Appended ${toAppend.length} history entries to ${issueKey}`);
          }
        } else {
          // No history section yet — insert before trailing newline / end of section
          const insertPoint = section.lastIndexOf('\n');
          const historyLines = ['- **History:**'];
          for (const e of newHistoryEntries) {
            historyLines.push(`  - **${e.date}:** ${e.desc}`);
          }
          section = section.slice(0, insertPoint) + '\n' + historyLines.join('\n') + section.slice(insertPoint);
          changes.push(`Added History section with ${newHistoryEntries.length} entries to ${issueKey}`);
        }
      }
    }

    if (section !== originalSection) {
      updated = updated.replace(originalSection, section);
      changes.push(`Updated ${issueKey}`);
    }
  }

  // Handle new issues from general check
  const generalFile = files.find(f => f.startsWith('general'));
  if (generalFile) {
    const content = fs.readFileSync(path.join(tempDir, generalFile), 'utf8');
    const { body } = parseFrontmatter(content);
    const newIssues = extractSection(body, 'New Issues to Add');
    if (newIssues) {
      // Append raw entries before the Closed section
      updated = updated.replace(
        /(## Closed)/,
        `${newIssues.trim()}\n\n$1`
      );
      changes.push('Added new issues to tracker');
    }
  }

  return { content: updated, changes };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Command Implementations ────────────────────────────────────────────────

function cmdParseTracker(flags) {
  const filePath = flags._positional || flags.tracker;
  if (!filePath) {
    console.error('Usage: parse-tracker <path-to-tracker>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({ exists: false, error: 'Tracker file not found' }));
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) {
    console.log(JSON.stringify({ exists: true, empty: true }));
    return;
  }

  const parsed = parseTrackerFile(content);
  console.log(JSON.stringify({
    exists: true,
    empty: false,
    username: parsed.username,
    active_count: parsed.active_issues.length,
    closed_count: parsed.closed_issues.length,
    active_issues: parsed.active_issues,
    closed_issues: parsed.closed_issues,
    all_tracked_numbers: [
      ...parsed.active_issues.map(i => `${i.owner}/${i.repo}#${i.number}`),
      ...parsed.closed_issues.map(i => `${i.owner}/${i.repo}#${i.number}`),
    ],
    oldest_check_date: parsed.active_issues
      .map(i => i.last_check_date)
      .filter(Boolean)
      .sort()[0] || null,
  }, null, 2));
}

function cmdCompileReport(flags) {
  const tempDir = flags['temp-dir'];
  const date = flags.date;

  if (!tempDir || !date) {
    console.error('Usage: compile-report --temp-dir <dir> --date <YYYY-MM-DD>');
    process.exit(1);
  }

  if (!fs.existsSync(tempDir)) {
    console.error(`Temp directory not found: ${tempDir}`);
    process.exit(1);
  }

  const result = compileOverviewReport(tempDir, date);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  // Write report to temp dir as well for validation
  fs.writeFileSync(path.join(tempDir, '_compiled-report.md'), result.report, 'utf8');

  // Output the report to stdout
  console.log(result.report);

  // Write metadata to stderr for the agent to parse
  console.error(JSON.stringify({
    issue_count: result.issue_count,
    activity_count: result.activity_count,
    report_file: path.join(tempDir, '_compiled-report.md'),
  }));
}

function cmdUpdateTracker(flags) {
  const trackerPath = flags.tracker;
  const tempDir = flags['temp-dir'];
  const date = flags.date;

  if (!trackerPath || !tempDir || !date) {
    console.error('Usage: update-tracker --tracker <path> --temp-dir <dir> --date <YYYY-MM-DD>');
    process.exit(1);
  }

  if (!fs.existsSync(trackerPath)) {
    console.error(`Tracker file not found: ${trackerPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(trackerPath, 'utf8');
  const { content: updated, changes } = applyTrackerUpdates(content, tempDir, date);

  if (changes.length === 0) {
    console.log(JSON.stringify({ updated: false, changes: [] }));
    return;
  }

  fs.writeFileSync(trackerPath, updated, 'utf8');
  console.log(JSON.stringify({ updated: true, changes }));
}

function cmdInitTemp(flags) {
  const prefix = 'giu-checkin-';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  console.log(tempDir);
}

function cmdValidate(flags) {
  const tempDir = flags['temp-dir'];
  const trackerPath = flags.tracker;
  const expected = parseInt(flags.expected || '0', 10);

  if (!tempDir) {
    console.error('Usage: validate --temp-dir <dir> [--tracker <path>] [--expected <N>]');
    process.exit(1);
  }

  const checks = {
    temp_dir_exists: fs.existsSync(tempDir),
    result_files: [],
    report_compiled: false,
    tracker_valid: null,
    all_issues_checked: null,
  };

  if (checks.temp_dir_exists) {
    const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.md'));
    checks.result_files = files;
    checks.report_compiled = files.includes('_compiled-report.md');

    const issueFiles = files.filter(f => f.startsWith('issue-'));
    checks.all_issues_checked = expected > 0
      ? issueFiles.length >= expected
      : issueFiles.length > 0;
  }

  if (trackerPath && fs.existsSync(trackerPath)) {
    const content = fs.readFileSync(trackerPath, 'utf8');
    const today = flags.date || new Date().toISOString().split('T')[0];
    checks.tracker_valid = content.includes(`Status as of ${today}`);
  }

  const passed = checks.temp_dir_exists
    && checks.report_compiled
    && checks.all_issues_checked !== false;

  console.log(JSON.stringify({ passed, checks }, null, 2));
}

// ─── Async Helper ──────────────────────────────────────────────────────────

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/**
 * Run promises in batches to avoid rate limits.
 * @param {Array<() => Promise>} tasks - Array of functions returning promises
 * @param {number} concurrency - Max concurrent tasks
 * @returns {Promise<Array>} Results in same order as tasks
 */
async function batchRun(tasks, concurrency = 15) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
  }
  return results;
}

// ─── Command: startup ──────────────────────────────────────────────────────

async function cmdStartup(flags) {
  const trackerPath = flags.tracker;
  if (!trackerPath) {
    console.error('Usage: startup --tracker <path>');
    process.exit(1);
  }

  // Step 1: Check gh auth
  let username = null;
  try {
    const authOutput = execSync('gh auth status 2>&1', { encoding: 'utf8' });
    const userMatch = authOutput.match(/Logged in to github\.com.*account\s+(\S+)/i)
      || authOutput.match(/Logged in to github\.com\s+as\s+(\S+)/i)
      || authOutput.match(/account\s+(\S+)/i);
    if (userMatch) username = userMatch[1];
  } catch (err) {
    console.log(JSON.stringify({ script_ok: true, auth: false }));
    return;
  }

  if (!username) {
    // Try alternate extraction from gh api
    try {
      username = execSync('gh api user --jq .login', { encoding: 'utf8' }).trim();
    } catch (_) {
      console.log(JSON.stringify({ script_ok: true, auth: false }));
      return;
    }
  }

  // Step 2: Parse tracker (or set empty defaults if no tracker)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  let trackerExists = false;
  let parsed = { username: null, active_issues: [], closed_issues: [], raw: '' };

  if (fs.existsSync(trackerPath)) {
    const content = fs.readFileSync(trackerPath, 'utf8');
    if (content.trim()) {
      trackerExists = true;
      parsed = parseTrackerFile(content);
      // Default null last_check_date to 30 days ago
      for (const issue of parsed.active_issues) {
        if (!issue.last_check_date) issue.last_check_date = thirtyDaysAgo;
      }
    }
  }

  const oldestCheckDate = parsed.active_issues
    .map(i => i.last_check_date)
    .filter(Boolean)
    .sort()[0] || thirtyDaysAgo;

  const allTrackedNumbers = [
    ...parsed.active_issues.map(i => `${i.owner}/${i.repo}#${i.number}`),
    ...parsed.closed_issues.map(i => `${i.owner}/${i.repo}#${i.number}`),
  ];

  // Step 3: Run two gh api search queries in parallel (always, even without tracker)
  const searchDate = oldestCheckDate;
  const openQuery = `search/issues?q=involves:${username}+is:open+updated:>${searchDate}&per_page=100`;
  const closedQuery = `search/issues?q=involves:${username}+is:closed+closed:>${thirtyDaysAgo}&per_page=50`;

  let openResults = [];
  let closedResults = [];

  try {
    const [openRaw, closedRaw] = await Promise.all([
      execAsync(`gh api "${openQuery}" --jq ".items"`),
      execAsync(`gh api "${closedQuery}" --jq ".items"`),
    ]);
    openResults = JSON.parse(openRaw || '[]');
    closedResults = JSON.parse(closedRaw || '[]');
  } catch (err) {
    // Non-fatal: proceed with empty results
    openResults = [];
    closedResults = [];
  }

  // Step 4: Identify new, reopened, recently closed
  function issueKey(item) {
    const urlParts = (item.repository_url || '').split('/');
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];
    return `${owner}/${repo}#${item.number}`;
  }

  function issueInfo(item) {
    const urlParts = (item.repository_url || '').split('/');
    return {
      owner: urlParts[urlParts.length - 2],
      repo: urlParts[urlParts.length - 1],
      number: item.number,
      title: item.title,
      state: item.state,
      updated_at: item.updated_at,
      created_at: item.created_at,
      html_url: item.html_url,
      labels: (item.labels || []).map(l => l.name),
      user: item.user ? item.user.login : null,
    };
  }

  const trackedSet = new Set(allTrackedNumbers);
  const closedNumbers = new Set(
    parsed.closed_issues.map(i => `${i.owner}/${i.repo}#${i.number}`)
  );

  const newIssues = openResults
    .filter(item => !trackedSet.has(issueKey(item)))
    .map(issueInfo);

  const reopenedIssues = openResults
    .filter(item => closedNumbers.has(issueKey(item)))
    .map(issueInfo);

  const recentlyClosed = closedResults.map(issueInfo);

  console.log(JSON.stringify({
    script_ok: true,
    auth: true,
    username,
    tracker_exists: trackerExists,
    tracker_path: trackerPath,
    tracker_data: {
      username: parsed.username,
      active_issues: parsed.active_issues,
      closed_issues: parsed.closed_issues,
      all_tracked_numbers: allTrackedNumbers,
      oldest_check_date: oldestCheckDate,
      raw: parsed.raw,
    },
    new_issues: newIssues,
    reopened_issues: reopenedIssues,
    recently_closed: recentlyClosed,
  }, null, 2));
}

// ─── Command: fetch-issues ─────────────────────────────────────────────────

async function cmdFetchIssues(flags) {
  const tempDir = flags['temp-dir'];
  const issuesFile = flags.issues;

  if (!tempDir || !issuesFile) {
    console.error('Usage: fetch-issues --temp-dir <dir> --issues <json-file>');
    process.exit(1);
  }

  if (!fs.existsSync(issuesFile)) {
    console.error(`Issues file not found: ${issuesFile}`);
    process.exit(1);
  }

  const issues = JSON.parse(fs.readFileSync(issuesFile, 'utf8'));
  const errors = [];
  const files = [];

  // Build all fetch tasks
  const allTasks = [];
  const taskMap = []; // Maps task index to { issueIdx, type }

  // Fetch raw JSON from gh api (no --jq — process in Node to avoid Windows quoting issues)
  function ghFetch(endpoint) {
    return execAsync(`gh api ${endpoint}`)
      .then(raw => JSON.parse(raw || '{}'))
      .catch(e => ({ _error: e.message }));
  }

  for (let i = 0; i < issues.length; i++) {
    const iss = issues[i];
    const { owner, repo, number, last_check_date, known_dupes, upstream } = iss;
    const issueEndpoint = `repos/${owner}/${repo}/issues/${number}`;

    // Issue data (single call — extract metadata + body + author in Node)
    allTasks.push(() => ghFetch(issueEndpoint));
    taskMap.push({ issueIdx: i, type: 'issue' });

    // Comments (all of them — filter by date in Node)
    allTasks.push(() => execAsync(`gh api ${issueEndpoint}/comments --paginate`)
      .then(raw => JSON.parse(raw || '[]'))
      .catch(e => ({ _error: e.message })));
    taskMap.push({ issueIdx: i, type: 'comments' });

    // Known dupe state checks
    const dupes = known_dupes || [];
    for (const dupe of dupes) {
      const dupeMatch = String(dupe).match(/(?:([^/]+)\/([^#]+))?#?(\d+)/);
      if (dupeMatch) {
        const dOwner = dupeMatch[1] || owner;
        const dRepo = dupeMatch[2] || repo;
        const dNumber = dupeMatch[3];
        allTasks.push(() => ghFetch(`repos/${dOwner}/${dRepo}/issues/${dNumber}`));
        taskMap.push({ issueIdx: i, type: 'dupe', dupeKey: `${dOwner}/${dRepo}#${dNumber}` });
      }
    }

    // Upstream check
    if (upstream) {
      const uMatch = String(upstream).match(/([^/]+)\/([^#]+)#(\d+)/);
      if (uMatch) {
        allTasks.push(() => ghFetch(`repos/${uMatch[1]}/${uMatch[2]}/issues/${uMatch[3]}`));
        taskMap.push({ issueIdx: i, type: 'upstream' });
      }
    }
  }

  // Run all tasks with batching (max 15 concurrent)
  const results = await batchRun(allTasks, 15);

  // Organize results by issue — process raw API responses in Node
  const issueData = issues.map(() => ({
    metadata: null,
    body: null,
    comments: null,
    dupe_states: {},
    upstream_state: null,
    cross_references: [],
    urls: [],
  }));

  for (let t = 0; t < results.length; t++) {
    const { issueIdx, type, dupeKey } = taskMap[t];
    const raw = results[t];

    switch (type) {
      case 'issue': {
        // Extract metadata and body from the single issue response
        if (raw && !raw._error) {
          issueData[issueIdx].metadata = {
            state: raw.state,
            labels: (raw.labels || []).map(l => l.name),
            comments: raw.comments,
            updated: raw.updated_at,
            created: raw.created_at,
            html_url: raw.html_url,
          };
          issueData[issueIdx].body = {
            title: raw.title,
            body: raw.body,
            author: raw.user ? raw.user.login : null,
          };
        } else {
          issueData[issueIdx].metadata = raw;
          issueData[issueIdx].body = raw;
        }
        break;
      }
      case 'comments': {
        // Filter comments by last_check_date in Node
        const iss = issues[issueIdx];
        if (Array.isArray(raw)) {
          const filtered = iss.last_check_date
            ? raw.filter(c => c.created_at > iss.last_check_date)
            : raw;
          issueData[issueIdx].comments = filtered.map(c => ({
            author: c.user ? c.user.login : null,
            date: c.created_at ? c.created_at.split('T')[0] : null,
            body: c.body,
          }));
        } else {
          issueData[issueIdx].comments = raw;
        }
        break;
      }
      case 'dupe': {
        if (raw && !raw._error) {
          issueData[issueIdx].dupe_states[dupeKey] = {
            state: raw.state,
            updated: raw.updated_at,
          };
        } else {
          issueData[issueIdx].dupe_states[dupeKey] = raw;
        }
        break;
      }
      case 'upstream': {
        if (raw && !raw._error) {
          issueData[issueIdx].upstream_state = {
            state: raw.state,
            labels: (raw.labels || []).map(l => l.name),
            updated: raw.updated_at,
          };
        } else {
          issueData[issueIdx].upstream_state = raw;
        }
        break;
      }
    }
  }

  // Post-process: extract cross_references and urls from body + comments
  for (let i = 0; i < issues.length; i++) {
    const data = issueData[i];
    const allText = collectText(data);

    // Extract #NUMBER and owner/repo#NUMBER patterns
    const crossRefs = new Set();
    const refRe = /(?:([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+))?#(\d+)/g;
    let m;
    while ((m = refRe.exec(allText)) !== null) {
      crossRefs.add(m[1] ? `${m[1]}#${m[2]}` : `#${m[2]}`);
    }
    data.cross_references = [...crossRefs];

    // Extract URLs
    const urlSet = new Set();
    const urlRe = /https?:\/\/[^\s)>\]"']+/g;
    while ((m = urlRe.exec(allText)) !== null) {
      urlSet.add(m[0].replace(/[.,;:]+$/, ''));
    }
    data.urls = [...urlSet];

    // Write raw JSON per issue
    const iss = issues[i];
    const outFile = path.join(tempDir, `raw-${iss.owner}-${iss.repo}-${iss.number}.json`);
    try {
      fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf8');
      files.push(outFile);
    } catch (err) {
      errors.push(`Failed to write ${outFile}: ${err.message}`);
    }
  }

  console.log(JSON.stringify({ fetched: files.length, files, errors }));
}

/**
 * Collect all text content from issue data for cross-reference/URL extraction.
 */
function collectText(data) {
  const parts = [];
  if (data.body) {
    if (typeof data.body === 'string') parts.push(data.body);
    else if (data.body.body) parts.push(data.body.body);
  }
  if (data.comments) {
    if (typeof data.comments === 'string') parts.push(data.comments);
    else if (Array.isArray(data.comments)) {
      for (const c of data.comments) {
        if (typeof c === 'string') parts.push(c);
        else if (c && c.body) parts.push(c.body);
      }
    }
  }
  return parts.join('\n');
}

// ─── Command: build-tracker ────────────────────────────────────────────────

function cmdBuildTracker(flags) {
  const tempDir = flags['temp-dir'];
  const templatePath = flags.template;
  const username = flags.username;
  const trackerPath = flags.tracker;
  const closedJsonPath = flags['closed-json'];

  if (!tempDir || !templatePath || !username || !trackerPath) {
    console.error('Usage: build-tracker --temp-dir <dir> --template <path> --username <name> --tracker <path> [--closed-json <path>]');
    process.exit(1);
  }

  // Step 1: Read template
  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }
  let tracker = fs.readFileSync(templatePath, 'utf8');

  // Step 2: Replace USERNAME_HERE
  tracker = tracker.replace(/USERNAME_HERE/g, username);

  // Step 3: Read all issue-*.md result files from temp dir
  if (!fs.existsSync(tempDir)) {
    console.error(`Temp directory not found: ${tempDir}`);
    process.exit(1);
  }

  const resultFiles = fs.readdirSync(tempDir).filter(f =>
    f.startsWith('issue-') && f.endsWith('.md')
  );

  const entries = [];
  for (const file of resultFiles) {
    const content = fs.readFileSync(path.join(tempDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(content);
    if (meta.type !== 'issue') continue;

    // Build tracker entry from result file
    const entry = buildTrackerEntry(meta, body);
    entries.push(entry);
  }

  // Step 4: Insert active entries into tracker
  const activeEntriesText = entries.join('\n');
  tracker = tracker.replace(
    /(## Active Issues[^\n]*\n)([\s\S]*?)(## Closed)/,
    `$1\n${activeEntriesText}\n$3`
  );

  // Step 5: Handle closed issues if provided
  let closedCount = 0;
  if (closedJsonPath && fs.existsSync(closedJsonPath)) {
    const closedIssues = JSON.parse(fs.readFileSync(closedJsonPath, 'utf8'));
    closedCount = closedIssues.length;
    let closedText = '';
    for (const ci of closedIssues) {
      closedText += `### ${ci.owner}/${ci.repo}#${ci.number} — ${ci.title}\n`;
      closedText += `- ${ci.resolution || 'Closed.'}\n\n`;
    }
    if (closedText) {
      tracker = tracker.replace(
        /(## Closed[^\n]*\n)/,
        `$1\n${closedText}`
      );
    }
  }

  // Step 6: Write tracker
  fs.writeFileSync(trackerPath, tracker, 'utf8');

  console.log(JSON.stringify({
    written: true,
    path: trackerPath,
    active_count: entries.length,
    closed_count: closedCount,
  }));
}

/**
 * Build a tracker entry string from result file frontmatter and body.
 */
function buildTrackerEntry(meta, body) {
  const lines = [];
  lines.push(`### ${meta.owner}/${meta.repo}#${meta.number} — ${meta.title}`);

  // Role
  lines.push(`- **Role:** ${meta.role || 'Unknown'}`);

  // Filed
  if (meta.filed) {
    lines.push(`- **Filed:** ${meta.filed}`);
  }

  // Status — from ## Status Summary + labels
  const statusSummary = extractSection(body, 'Status Summary') || 'Open.';
  const labels = meta.labels
    ? (Array.isArray(meta.labels) ? meta.labels.join(', ') : meta.labels)
    : '';
  const trackerUpdates = extractSection(body, 'Tracker Updates') || '';
  const statusLine = trackerUpdates.match(/^status_summary:\s*(.+)/m);
  const statusText = statusLine
    ? statusLine[1].trim()
    : `${meta.state || 'Open'}. Labels: ${labels}. ${statusSummary.split('\n')[0]}`;
  const dateStr = new Date().toISOString().split('T')[0];
  lines.push(`- **Status as of ${dateStr}:** ${statusText}`);

  // What to check — from ## Watch For or tracker updates
  const watchLine = trackerUpdates.match(/^what_to_check:\s*(.+)/m);
  const watchFor = watchLine
    ? watchLine[1].trim()
    : (extractSection(body, 'Watch For') || 'Monitor for updates.').split('\n')[0].replace(/^-\s*/, '');
  lines.push(`- **What to check:** ${watchFor}`);

  // Related — from ## Cross-References
  const crossRefs = extractSection(body, 'Cross-References');
  if (crossRefs && crossRefs.trim() !== 'None' && crossRefs.trim() !== 'None found.') {
    lines.push(`- **Related:** ${crossRefs.split('\n')[0].trim()}`);
  }

  // Upstream
  const upstream = extractSection(body, 'Upstream');
  if (upstream && upstream.trim() !== 'N/A' && upstream.trim() !== 'None') {
    lines.push(`- **Upstream:** ${upstream.split('\n')[0].trim()}`);
  }

  // Key Context -> workaround / future
  const keyContext = extractSection(body, 'Key Context');
  if (keyContext && keyContext.trim() !== 'N/A') {
    // Check for workaround
    const workaroundMatch = keyContext.match(/[Ww]orkaround:?\s*(.+)/);
    if (workaroundMatch) {
      lines.push(`- **Workaround:** ${workaroundMatch[1].trim()}`);
    }
  }

  // Duplicates from ## Duplicates and Related
  const dupeSection = extractSection(body, 'Duplicates and Related')
    || extractSection(body, 'Known');
  if (dupeSection) {
    const dupeLines = dupeSection.split('\n').filter(l => l.match(/^\s*-?\s*[#*]/));
    if (dupeLines.length > 0) {
      lines.push(`- **Duplicates found (${dateStr}):**`);
      for (const dl of dupeLines) {
        const cleaned = dl.replace(/^[\s-]*/, '  - ');
        lines.push(cleaned);
      }
    }
  }

  // Next steps
  const nextSteps = extractSection(body, 'Next Steps');
  if (nextSteps && nextSteps.trim() !== 'None' && nextSteps.trim() !== 'None — no action needed.') {
    lines.push(`- **Next steps (now):** ${nextSteps.split('\n')[0].replace(/^-\s*\[.\]\s*/, '').trim()}`);
  } else {
    lines.push(`- **Next steps (now):** None — no action needed.`);
  }

  // Future — from Key Context
  if (keyContext && keyContext.trim() !== 'N/A') {
    lines.push(`- **Future:** ${keyContext.split('\n')[0].replace(/^-\s*/, '').trim()}`);
  }

  // History — from history_entry lines in Tracker Updates
  const historyEntries = [];
  if (trackerUpdates) {
    const historyRe = /^history_entry:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)/gm;
    let hm;
    while ((hm = historyRe.exec(trackerUpdates)) !== null) {
      historyEntries.push(`  - **${hm[1]}:** ${hm[2].trim()}`);
    }
  }
  if (historyEntries.length === 0) {
    // Default entry on initial build
    historyEntries.push(`  - **${dateStr}:** Added to tracker`);
  }
  lines.push(`- **History:**`);
  for (const he of historyEntries) {
    lines.push(he);
  }

  lines.push('');
  return lines.join('\n');
}
