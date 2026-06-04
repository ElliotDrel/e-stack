#!/usr/bin/env node
/**
 * update-skill-feedback.cjs
 *
 * Syncs the ## Skill Feedback section in every skills/estack-* /SKILL.md
 * from the canonical template at scripts/skill-feedback-template.md.
 *
 * Usage:
 *   node scripts/update-skill-feedback.cjs          # update all skills
 *   node scripts/update-skill-feedback.cjs --check  # verify all skills match (exit 1 if any differ)
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(__dirname, 'skill-feedback-template.md');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
// Matches the feedback section start (with or without a preceding ---)
// and everything after it, so duplicates are collapsed in one pass.
const SECTION_REGEX = /\n+(?:---\s*\n+)?## Skill Feedback[\s\S]*/;

const isCheck = process.argv.includes('--check');

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

const skillDirs = fs.readdirSync(SKILLS_DIR).filter(name => {
  return name.startsWith('estack-') &&
    fs.statSync(path.join(SKILLS_DIR, name)).isDirectory();
});

let allMatch = true;

for (const dirName of skillDirs) {
  const skillFile = path.join(SKILLS_DIR, dirName, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    console.warn(`  SKIP  ${dirName} — no SKILL.md found`);
    continue;
  }

  const original = fs.readFileSync(skillFile, 'utf8');

  // Extract skill name from frontmatter (name: estack-xxx)
  const nameMatch = original.match(/^name:\s*(\S+)/m);
  const skillName = nameMatch ? nameMatch[1] : dirName;

  const rendered = template.replace(/\{\{SKILL_NAME\}\}/g, skillName);
  // Template already includes "---\n\n## Skill Feedback" — just add a leading newline separator
  const renderedSection = '\n' + rendered.trimEnd() + '\n';

  // Find existing feedback section (any format) and replace to EOF.
  // Using a regex ensures duplicates are collapsed in one pass.
  const sectionMatch = original.search(SECTION_REGEX);
  let updated;
  if (sectionMatch !== -1) {
    updated = original.slice(0, sectionMatch) + renderedSection;
  } else {
    // No section yet — append
    updated = original.trimEnd() + '\n' + renderedSection;
  }

  if (isCheck) {
    if (updated !== original) {
      console.error(`  DIFF  ${skillName} — feedback section is out of sync`);
      allMatch = false;
    } else {
      console.log(`    OK  ${skillName}`);
    }
  } else {
    if (updated === original) {
      console.log(`    OK  ${skillName} (already up to date)`);
    } else {
      fs.writeFileSync(skillFile, updated, 'utf8');
      console.log(`UPDATED  ${skillName}`);
    }
  }
}

if (isCheck) {
  if (!allMatch) {
    console.error('\nSome skills are out of sync. Run: node scripts/update-skill-feedback.cjs');
    process.exit(1);
  } else {
    console.log('\nAll skill feedback sections match the template.');
  }
}
