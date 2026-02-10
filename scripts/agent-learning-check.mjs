#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ACTIVE_HEADING = '## Active Agent Learnings (Top 10 Evergreen)';
const MAX_ACTIVE = 10;
const ENTRY_REGEX = /^- \*\*(\d{4}-\d{2}-\d{2}) [—-] (.+?)\*\*: (.+)$/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const agentsPath = path.join(repoRoot, 'AGENTS.md');
const archivePath = path.join(repoRoot, 'AGENTS.learnings.archive.md');

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

function readFile(filePath, warnings) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    warnings.push(`Unable to read ${path.basename(filePath)}: ${error.message}`);
    return '';
  }
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const unknown = args.filter((arg) => arg !== '--strict');
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(', ')}`);
    process.exit(1);
  }

  const warnings = [];

  const agentsText = readFile(agentsPath, warnings);
  const archiveText = readFile(archivePath, warnings);

  const archiveEntries = parseEntries(archiveText);
  const archiveTitles = new Set(archiveEntries.map((entry) => entry.title));

  let activeEntries = [];
  if (agentsText) {
    const lines = agentsText.split(/\r?\n/);
    const bounds = getSectionBounds(lines, ACTIVE_HEADING);
    if (!bounds) {
      warnings.push(`Missing active learnings section heading: ${ACTIVE_HEADING}`);
    } else {
      const sectionLines = lines.slice(bounds.start + 1, bounds.end);
      activeEntries = sectionLines
        .map((line) => parseEntryLine(line))
        .filter(Boolean);
    }
  }

  if (activeEntries.length > MAX_ACTIVE) {
    warnings.push(`Active learnings has ${activeEntries.length} entries; maximum is ${MAX_ACTIVE}.`);
  }

  for (const entry of activeEntries) {
    if (!archiveTitles.has(entry.title)) {
      warnings.push(`Active learning missing from archive: "${entry.title}"`);
    }
  }

  if (warnings.length === 0) {
    console.log('Agent learning check passed.');
    process.exit(0);
  }

  for (const warning of warnings) {
    console.log(`WARNING: ${warning}`);
  }

  if (strict) {
    process.exit(1);
  }
  process.exit(0);
}

main();
