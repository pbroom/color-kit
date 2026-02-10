#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ACTIVE_HEADING = '## Active Agent Learnings (Top 10 Evergreen)';
const ACTIVE_POINTER = '- Full history lives in `AGENTS.learnings.archive.md`.';
const MAX_ACTIVE = 10;
const ENTRY_REGEX = /^- \*\*(\d{4}-\d{2}-\d{2}) [—-] (.+?)\*\*: (.+)$/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const agentsPath = path.join(repoRoot, 'AGENTS.md');
const archivePath = path.join(repoRoot, 'AGENTS.learnings.archive.md');

function usage() {
  console.log(
    `Usage:\n  node scripts/agent-learning.mjs add --title "..." --lesson "..." [--active]`,
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function localDateString(date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseEntryLine(line) {
  const match = line.match(ENTRY_REGEX);
  if (!match) {
    return null;
  }
  return {
    date: match[1],
    title: match[2],
    lesson: match[3],
  };
}

function formatEntry(entry) {
  return `- **${entry.date} — ${entry.title}**: ${entry.lesson}`;
}

function parseEntries(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEntryLine(line);
    if (parsed) {
      entries.push(parsed);
    }
  }
  return entries;
}

function renderArchive(entries) {
  return [
    '# Agent Learnings Archive',
    '',
    '## Purpose',
    '',
    'This archive is the source of truth for reusable agent learnings in this repository.',
    '`AGENTS.md` keeps only the top 10 active evergreen learnings for high-signal context.',
    '',
    '## Entry Format',
    '',
    '- `- **YYYY-MM-DD — Short title**: One or two sentence actionable lesson.`',
    '',
    '## Entries',
    '',
    ...entries.map(formatEntry),
    '',
  ].join('\n');
}

function readFileOrFail(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`Failed to read ${filePath}: ${error.message}`);
  }
}

function writeFileOrFail(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    fail(`Failed to write ${filePath}: ${error.message}`);
  }
}

function getSectionBounds(lines, heading) {
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }

  return { start, end };
}

function parseActiveEntries(agentsText) {
  const lines = agentsText.split(/\r?\n/);
  const bounds = getSectionBounds(lines, ACTIVE_HEADING);
  if (!bounds) {
    fail(`Missing active learnings section heading: ${ACTIVE_HEADING}`);
  }

  const sectionLines = lines.slice(bounds.start + 1, bounds.end);
  const entries = [];
  for (const line of sectionLines) {
    const parsed = parseEntryLine(line);
    if (parsed) {
      entries.push(parsed);
    }
  }

  return { lines, bounds, entries };
}

function replaceActiveSection(agentsLines, bounds, entries) {
  const newSection = [
    ACTIVE_HEADING,
    '',
    ACTIVE_POINTER,
    '',
    ...entries.map(formatEntry),
  ];

  const updated = [
    ...agentsLines.slice(0, bounds.start),
    ...newSection,
    ...agentsLines.slice(bounds.end),
  ].join('\n');

  return `${updated.replace(/\s+$/u, '')}\n`;
}

function parseArgs(argv) {
  const command = argv[2];
  if (command !== 'add') {
    usage();
    fail('Only the "add" command is supported.');
  }

  let title = '';
  let lesson = '';
  let active = false;

  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      continue;
    }
    if (arg === '--title') {
      title = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--lesson') {
      lesson = argv[i + 1] ?? '';
      i += 1;
      continue;
    }
    if (arg === '--active') {
      active = true;
      continue;
    }
    usage();
    fail(`Unknown argument: ${arg}`);
  }

  title = title.trim();
  lesson = lesson.trim();

  if (!title) {
    fail('Missing required --title value.');
  }
  if (!lesson) {
    fail('Missing required --lesson value.');
  }

  return { title, lesson, active };
}

function main() {
  const { title, lesson, active } = parseArgs(process.argv);

  const archiveText = readFileOrFail(archivePath);
  const archiveEntries = parseEntries(archiveText);
  const newEntry = {
    date: localDateString(new Date()),
    title,
    lesson,
  };

  const existingArchiveIndex = archiveEntries.findIndex(
    (entry) => entry.title === title,
  );
  if (existingArchiveIndex >= 0) {
    archiveEntries[existingArchiveIndex] = newEntry;
  } else {
    archiveEntries.push(newEntry);
  }
  writeFileOrFail(archivePath, renderArchive(archiveEntries));

  if (active) {
    const agentsText = readFileOrFail(agentsPath);
    const { lines, bounds, entries } = parseActiveEntries(agentsText);

    const existingActiveIndex = entries.findIndex(
      (entry) => entry.title === title,
    );
    if (existingActiveIndex >= 0) {
      entries.splice(existingActiveIndex, 1);
    }

    entries.unshift(newEntry);
    const trimmed = entries.slice(0, MAX_ACTIVE);
    const updatedAgents = replaceActiveSection(lines, bounds, trimmed);
    writeFileOrFail(agentsPath, updatedAgents);
  }

  console.log(`Recorded learning: ${title}`);
  if (active) {
    console.log('Promoted to active learnings.');
  }
}

main();
