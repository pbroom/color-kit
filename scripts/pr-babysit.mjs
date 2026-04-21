#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const STATE_FILE = path.join(
  process.cwd(),
  '.cursor',
  'hooks',
  'state',
  'pr-babysit.json',
);
const ARM_COMMAND_RE = /\b(?:pnpm\s+pr:stack|gh\s+pr\s+create|gt\s+submit)\b/;
const KEEP_DRAFT_RE = /\b(?:--draft|--keep-draft)\b/;
const WAIT_MS_PENDING = 60_000;
const WAIT_MS_IDLE = 300_000;
const WAIT_MS_RETRY = 120_000;
const PASSING_CONCLUSIONS = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const REVIEW_THREAD_QUERY =
  'query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved isOutdated comments(first:20){nodes{id url createdAt path author{login}}}}}}}}';

function shellText(command, args) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function shellJson(command, args) {
  const output = shellText(command, args);
  return output ? JSON.parse(output) : null;
}

function tryShellJson(command, args) {
  try {
    return shellJson(command, args);
  } catch {
    return null;
  }
}

function tryShellText(command, args) {
  try {
    return shellText(command, args);
  } catch {
    return '';
  }
}

function readState() {
  if (!existsSync(STATE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function removeState() {
  if (existsSync(STATE_FILE)) {
    rmSync(STATE_FILE);
  }
}

function readStdinJson() {
  const input = readFileSync(0, 'utf8').trim();
  if (!input) {
    return {};
  }

  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const options = {
    json: false,
    reason: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--reason' && index + 1 < argv.length) {
      options.reason = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function getCurrentBranch() {
  return tryShellText('git', ['branch', '--show-current']);
}

function getRepoSlug() {
  const repoView = shellJson('gh', ['repo', 'view', '--json', 'name,owner']);
  return {
    owner: repoView.owner.login,
    repo: repoView.name,
  };
}

function findOpenPrNumber(branch) {
  const prs = tryShellJson('gh', [
    'pr',
    'list',
    '--head',
    branch,
    '--state',
    'open',
    '--json',
    'number',
  ]);

  if (!Array.isArray(prs) || prs.length === 0) {
    return null;
  }

  return prs[0].number;
}

function normalizeCheck(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  if (item.__typename === 'StatusContext') {
    const state = item.state ?? '';

    return {
      name: item.context ?? 'status-context',
      status: state === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED',
      conclusion: state,
      detailsUrl: item.targetUrl ?? '',
      workflowName: item.context ?? '',
      startedAt: '',
      completedAt: '',
    };
  }

  return {
    name: item.name ?? 'check-run',
    status: item.status ?? '',
    conclusion: item.conclusion ?? '',
    detailsUrl: item.detailsUrl ?? '',
    workflowName: item.workflowName ?? '',
    startedAt: item.startedAt ?? '',
    completedAt: item.completedAt ?? '',
  };
}

function sortByTimestamp(items, key) {
  return [...items].sort((left, right) => {
    const leftValue = left[key] ?? '';
    const rightValue = right[key] ?? '';
    return leftValue.localeCompare(rightValue);
  });
}

function summarizeReviewComment(comment) {
  return {
    id: String(comment.id ?? ''),
    url: comment.html_url ?? comment.url ?? '',
    author: comment.user?.login ?? '',
    updatedAt: comment.updated_at ?? comment.created_at ?? '',
    path: comment.path ?? '',
  };
}

function summarizeIssueComment(comment) {
  return {
    id: String(comment.id ?? ''),
    url: comment.html_url ?? comment.url ?? '',
    author: comment.user?.login ?? '',
    updatedAt: comment.updated_at ?? comment.created_at ?? '',
  };
}

function summarizeReview(review) {
  return {
    id: String(review.id ?? ''),
    url: review.html_url ?? '',
    author: review.user?.login ?? '',
    state: review.state ?? '',
    submittedAt: review.submitted_at ?? '',
  };
}

function summarizeThread(thread, index) {
  const comments = sortByTimestamp(
    (thread.comments?.nodes ?? []).map((comment) => ({
      id: String(comment.id ?? ''),
      url: comment.url ?? '',
      createdAt: comment.createdAt ?? '',
      path: comment.path ?? '',
      author: comment.author?.login ?? '',
    })),
    'createdAt',
  );
  const latest = comments.at(-1);

  return {
    id: latest?.id || `thread-${index + 1}`,
    latestUrl: latest?.url ?? '',
    latestCreatedAt: latest?.createdAt ?? '',
    latestAuthor: latest?.author ?? '',
    paths: [
      ...new Set(comments.map((comment) => comment.path).filter(Boolean)),
    ],
    commentIds: comments.map((comment) => comment.id),
    commentCount: comments.length,
  };
}

function buildCommentCursor(items, timestampKey) {
  if (items.length === 0) {
    return '0';
  }

  const latest = items.at(-1);
  return `${items.length}:${latest.id ?? ''}:${latest[timestampKey] ?? ''}`;
}

function buildThreadCursor(threads) {
  if (threads.length === 0) {
    return '0';
  }

  const latest = [...threads]
    .filter((thread) => thread.latestCreatedAt)
    .sort((left, right) =>
      left.latestCreatedAt.localeCompare(right.latestCreatedAt),
    )
    .at(-1);

  return `${threads.length}:${latest?.id ?? ''}:${latest?.latestCreatedAt ?? ''}`;
}

function buildCheckCursor(checks) {
  if (checks.length === 0) {
    return '0';
  }

  return checks
    .map((check) => `${check.name}:${check.status}:${check.conclusion}`)
    .sort()
    .join('|');
}

function isFailingCheck(check) {
  if (!check) {
    return false;
  }

  if (check.status && check.status !== 'COMPLETED') {
    return false;
  }

  return !PASSING_CONCLUSIONS.has(check.conclusion ?? '');
}

function isPendingCheck(check) {
  return Boolean(check?.status) && check.status !== 'COMPLETED';
}

function getSnapshot(
  branch = getCurrentBranch(),
  prNumber = findOpenPrNumber(branch),
) {
  if (!branch || !prNumber) {
    return null;
  }

  const { owner, repo } = getRepoSlug();
  const pr = shellJson('gh', [
    'pr',
    'view',
    String(prNumber),
    '--json',
    'number,url,state,isDraft,reviewDecision,mergeable,headRefOid,baseRefName,headRefName,statusCheckRollup',
  ]);
  const checks = (pr.statusCheckRollup ?? [])
    .map(normalizeCheck)
    .filter(Boolean);
  const unresolvedThreadsData = shellJson('gh', [
    'api',
    'graphql',
    '-f',
    `query=${REVIEW_THREAD_QUERY}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${repo}`,
    '-F',
    `number=${pr.number}`,
  ]);
  const reviewThreads = (
    unresolvedThreadsData.data?.repository?.pullRequest?.reviewThreads?.nodes ??
    []
  )
    .filter((thread) => !thread.isResolved && !thread.isOutdated)
    .map(summarizeThread);
  const reviewComments = sortByTimestamp(
    (
      shellJson('gh', [
        'api',
        `repos/${owner}/${repo}/pulls/${pr.number}/comments?per_page=100`,
      ]) ?? []
    ).map(summarizeReviewComment),
    'updatedAt',
  );
  const issueComments = sortByTimestamp(
    (
      shellJson('gh', [
        'api',
        `repos/${owner}/${repo}/issues/${pr.number}/comments?per_page=100`,
      ]) ?? []
    ).map(summarizeIssueComment),
    'updatedAt',
  );
  const reviews = sortByTimestamp(
    (
      shellJson('gh', [
        'api',
        `repos/${owner}/${repo}/pulls/${pr.number}/reviews?per_page=100`,
      ]) ?? []
    ).map(summarizeReview),
    'submittedAt',
  );
  const failingChecks = checks.filter(isFailingCheck);
  const pendingChecks = checks.filter(isPendingCheck);

  return {
    observedAt: new Date().toISOString(),
    branch,
    repo: {
      owner,
      repo,
    },
    pr: {
      number: pr.number,
      url: pr.url,
      state: pr.state,
      isDraft: Boolean(pr.isDraft),
      reviewDecision: pr.reviewDecision ?? '',
      mergeable: pr.mergeable ?? '',
      headRefOid: pr.headRefOid ?? '',
      baseRefName: pr.baseRefName ?? '',
      headRefName: pr.headRefName ?? branch,
    },
    checks,
    failingChecks,
    pendingChecks,
    reviewThreads,
    reviewComments,
    issueComments,
    reviews,
    cursors: {
      failingChecks: buildCheckCursor(failingChecks),
      pendingChecks: buildCheckCursor(pendingChecks),
      reviewThreads: buildThreadCursor(reviewThreads),
      reviewComments: buildCommentCursor(reviewComments, 'updatedAt'),
      issueComments: buildCommentCursor(issueComments, 'updatedAt'),
      reviews: buildCommentCursor(reviews, 'submittedAt'),
      reviewActivity: [
        buildThreadCursor(reviewThreads),
        buildCommentCursor(reviewComments, 'updatedAt'),
        buildCommentCursor(issueComments, 'updatedAt'),
        buildCommentCursor(reviews, 'submittedAt'),
      ].join('||'),
    },
  };
}

function ensurePublished(
  branch = getCurrentBranch(),
  prNumber = findOpenPrNumber(branch),
  { allowDraft = false } = {},
) {
  const snapshot = getSnapshot(branch, prNumber);

  if (
    !snapshot ||
    snapshot.pr.state !== 'OPEN' ||
    allowDraft ||
    !snapshot.pr.isDraft
  ) {
    return snapshot;
  }

  try {
    shellText('gh', ['pr', 'ready', String(snapshot.pr.number)]);
  } catch {
    return snapshot;
  }

  return getSnapshot(branch, snapshot.pr.number) ?? snapshot;
}

function hasPersistentReviewBlockers(snapshot) {
  return (
    snapshot.reviewThreads.length > 0 ||
    snapshot.pr.reviewDecision === 'CHANGES_REQUESTED'
  );
}

function findCheck(snapshot, name) {
  return snapshot.checks.find((check) => check.name === name) ?? null;
}

function isSuccessfulCheck(check) {
  return Boolean(
    check &&
    check.status === 'COMPLETED' &&
    PASSING_CONCLUSIONS.has(check.conclusion ?? ''),
  );
}

function hasCompletedGreptileReview(snapshot) {
  const greptileCheck = findCheck(snapshot, 'Greptile Review');

  if (!greptileCheck) {
    return true;
  }

  return isSuccessfulCheck(greptileCheck);
}

function isReadyForUserMergeReview(snapshot) {
  return (
    snapshot.pr.state === 'OPEN' &&
    snapshot.pr.isDraft === false &&
    snapshot.pr.mergeable === 'MERGEABLE' &&
    snapshot.pr.reviewDecision !== 'CHANGES_REQUESTED' &&
    snapshot.failingChecks.length === 0 &&
    snapshot.pendingChecks.length === 0 &&
    snapshot.reviewThreads.length === 0 &&
    hasCompletedGreptileReview(snapshot)
  );
}

function isMergeReady(snapshot) {
  return (
    snapshot.pr.state === 'OPEN' &&
    snapshot.pr.isDraft === false &&
    snapshot.pr.mergeable === 'MERGEABLE' &&
    snapshot.pr.reviewDecision === 'APPROVED' &&
    snapshot.failingChecks.length === 0 &&
    snapshot.pendingChecks.length === 0 &&
    snapshot.reviewThreads.length === 0
  );
}

function formatCheckList(checks) {
  return checks.map((check) => `\`${check.name}\``).join(', ');
}

function buildWaitMessage(snapshot, waitMs) {
  if (snapshot.pendingChecks.length > 0) {
    return [
      `PR babysitter is active for #${snapshot.pr.number} (\`${snapshot.branch}\` -> \`${snapshot.pr.baseRefName}\`).`,
      `Current state: waiting on ${snapshot.pendingChecks.length} check(s) (${formatCheckList(snapshot.pendingChecks)}).`,
      `Use \`AwaitShell\` with no \`task_id\` for ${waitMs} ms, then finish the turn. The stop hook will re-check GitHub and continue automatically when checks fail, new review feedback lands, or the PR becomes merge-ready.`,
    ].join(' ');
  }

  const reviewSummary = snapshot.pr.reviewDecision
    ? `review decision is \`${snapshot.pr.reviewDecision}\``
    : 'no new review activity has landed yet';
  const draftSummary = snapshot.pr.isDraft ? ' The PR is still draft.' : '';

  return [
    `PR babysitter is active for #${snapshot.pr.number} (\`${snapshot.branch}\` -> \`${snapshot.pr.baseRefName}\`).`,
    `Current state: checks are green and ${reviewSummary}.${draftSummary}`,
    `Use \`AwaitShell\` with no \`task_id\` for ${waitMs} ms, then finish the turn. The stop hook will re-check GitHub and continue automatically when comments, reviews, or CI state change.`,
  ].join(' ');
}

function buildCiMessage(snapshot) {
  const latestFailureUrl = snapshot.failingChecks[0]?.detailsUrl;

  return [
    `PR babysit update for #${snapshot.pr.number} (\`${snapshot.branch}\` -> \`${snapshot.pr.baseRefName}\`): failing checks are blocking the PR (${formatCheckList(snapshot.failingChecks)}).`,
    latestFailureUrl ? `Latest failure: ${latestFailureUrl}.` : '',
    'Continue the prep-for-merge babysitting workflow now: inspect `gh run view --log-failed` for the latest failed run, apply the smallest focused fix, run `pnpm pr:validate`, push the follow-up, and keep watching.',
    'If you need to stop and ask the user instead, run `pnpm pr:babysit -- pause --reason needs-user` before finishing.',
    'Do not merge automatically.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildReviewMessage(snapshot) {
  const latestThreadUrl = snapshot.reviewThreads[0]?.latestUrl;
  const latestCommentUrl =
    snapshot.reviewComments.at(-1)?.url ||
    snapshot.issueComments.at(-1)?.url ||
    snapshot.reviews.at(-1)?.url;
  const latestFeedbackUrl = latestThreadUrl || latestCommentUrl;
  const reviewState =
    snapshot.pr.reviewDecision === 'CHANGES_REQUESTED'
      ? 'GitHub review state is `CHANGES_REQUESTED`.'
      : snapshot.reviewThreads.length > 0
        ? `${snapshot.reviewThreads.length} unresolved review thread(s) remain.`
        : 'New review activity landed.';

  return [
    `PR babysit update for #${snapshot.pr.number} (\`${snapshot.branch}\` -> \`${snapshot.pr.baseRefName}\`): ${reviewState}`,
    latestFeedbackUrl ? `Latest feedback: ${latestFeedbackUrl}.` : '',
    'Continue now: inspect unresolved review threads/comments, fix only the feedback you agree with, run `pnpm pr:validate`, push any scoped follow-up, and keep watching.',
    'If reviewer intent is ambiguous or a product decision is needed, run `pnpm pr:babysit -- pause --reason needs-user` before finishing.',
    'Do not merge automatically.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildMergeReadyMessage(snapshot) {
  return [
    `PR babysit update for #${snapshot.pr.number} (\`${snapshot.branch}\` -> \`${snapshot.pr.baseRefName}\`): checks are green, unresolved review threads are clear, and GitHub reports \`reviewDecision=APPROVED\`.`,
    'The babysitter has paused automatically because the PR now looks merge-ready.',
    'Review it and, if you want me to merge it, ask me to run the merge-and-clean workflow.',
  ].join(' ');
}

function buildReadyForUserMergeReviewMessage(snapshot) {
  const reviewDecision = snapshot.pr.reviewDecision
    ? ` GitHub reviewDecision is \`${snapshot.pr.reviewDecision}\`.`
    : '';

  return [
    `PR babysit update for #${snapshot.pr.number} (\`${snapshot.branch}\` -> \`${snapshot.pr.baseRefName}\`): CI checks are green, Greptile Review completed successfully, and there are no unresolved non-outdated review threads.`,
    `The babysitter has paused automatically so you can review the PR and decide whether to merge.${reviewDecision}`,
    'If you want me to merge it now, ask me to run the merge-and-clean workflow.',
  ].join(' ');
}

function buildRetryMessage(state, error) {
  const label = state?.prNumber ? `#${state.prNumber}` : 'the active PR';
  const reason =
    error instanceof Error ? error.message : 'unknown GitHub metadata error';

  return [
    `PR babysitter hit a temporary metadata error while checking ${label}: ${reason}.`,
    `Use \`AwaitShell\` with no \`task_id\` for ${WAIT_MS_RETRY} ms, then finish the turn so the stop hook can retry.`,
  ].join(' ');
}

function armState(snapshot = getSnapshot(getCurrentBranch())) {
  if (!snapshot || snapshot.pr.state !== 'OPEN') {
    return null;
  }

  const previous = readState();
  const samePr =
    previous &&
    previous.branch === snapshot.branch &&
    previous.prNumber === snapshot.pr.number;

  const nextState = {
    version: 1,
    mode: 'active',
    branch: snapshot.branch,
    prNumber: snapshot.pr.number,
    prUrl: snapshot.pr.url,
    baseRefName: snapshot.pr.baseRefName,
    armedAt: samePr ? previous.armedAt : snapshot.observedAt,
    updatedAt: snapshot.observedAt,
    pauseReason: '',
    seen: {
      reviewActivityCursor: samePr
        ? previous.seen?.reviewActivityCursor || snapshot.cursors.reviewActivity
        : snapshot.cursors.reviewActivity,
    },
  };

  writeState(nextState);
  return nextState;
}

function pauseState(reason) {
  const state = readState();
  if (!state) {
    return null;
  }

  const nextState = {
    ...state,
    mode: 'paused',
    pauseReason: reason || 'paused',
    updatedAt: new Date().toISOString(),
  };

  writeState(nextState);
  return nextState;
}

function resumeState() {
  const state = readState();
  if (!state) {
    return armState();
  }

  const nextState = {
    ...state,
    mode: 'active',
    pauseReason: '',
    updatedAt: new Date().toISOString(),
  };

  writeState(nextState);
  return nextState;
}

function disarmState() {
  removeState();
}

function buildPausedState(state, snapshot, pauseReason) {
  return {
    ...state,
    mode: 'paused',
    branch: snapshot.branch,
    prNumber: snapshot.pr.number,
    prUrl: snapshot.pr.url,
    baseRefName: snapshot.pr.baseRefName,
    updatedAt: snapshot.observedAt,
    pauseReason,
    seen: {
      reviewActivityCursor: snapshot.cursors.reviewActivity,
    },
  };
}

function evaluateStop(state, { persist = true } = {}) {
  if (!state || state.mode !== 'active') {
    return {};
  }

  try {
    const snapshot = getSnapshot(state.branch, state.prNumber);

    if (!snapshot || snapshot.pr.state !== 'OPEN') {
      if (persist) {
        removeState();
      }
      return {};
    }

    const nextState = {
      ...state,
      branch: snapshot.branch,
      prNumber: snapshot.pr.number,
      prUrl: snapshot.pr.url,
      baseRefName: snapshot.pr.baseRefName,
      updatedAt: snapshot.observedAt,
      seen: {
        reviewActivityCursor: state.seen?.reviewActivityCursor ?? '',
      },
    };

    if (isMergeReady(snapshot)) {
      if (persist) {
        writeState(buildPausedState(state, snapshot, 'merge-ready'));
      }
      return { followup_message: buildMergeReadyMessage(snapshot) };
    }

    if (isReadyForUserMergeReview(snapshot)) {
      if (persist) {
        writeState(buildPausedState(state, snapshot, 'ready-for-merge-review'));
      }
      return {
        followup_message: buildReadyForUserMergeReviewMessage(snapshot),
      };
    }

    if (snapshot.failingChecks.length > 0) {
      if (persist) {
        writeState(nextState);
      }
      return { followup_message: buildCiMessage(snapshot) };
    }

    if (hasPersistentReviewBlockers(snapshot)) {
      if (persist) {
        writeState(nextState);
      }
      return { followup_message: buildReviewMessage(snapshot) };
    }

    if (
      snapshot.cursors.reviewActivity !== nextState.seen.reviewActivityCursor
    ) {
      if (persist) {
        nextState.seen.reviewActivityCursor = snapshot.cursors.reviewActivity;
        writeState(nextState);
      }
      return { followup_message: buildReviewMessage(snapshot) };
    }

    if (persist) {
      writeState(nextState);
    }

    if (snapshot.pendingChecks.length > 0) {
      return { followup_message: buildWaitMessage(snapshot, WAIT_MS_PENDING) };
    }

    return { followup_message: buildWaitMessage(snapshot, WAIT_MS_IDLE) };
  } catch (error) {
    return { followup_message: buildRetryMessage(state, error) };
  }
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function printUsage() {
  process.stdout.write(`Usage: node scripts/pr-babysit.mjs <command> [options]

Commands:
  arm
  pause --reason <text>
  resume
  disarm
  status [--json]
  hook-arm
  hook-stop
`);
}

function runStatusCommand(asJson) {
  const state = readState();
  const snapshot = getSnapshot(state?.branch, state?.prNumber);
  const output = {
    state,
    snapshot,
    activeDecision:
      state?.mode === 'active' && snapshot
        ? evaluateStop(state, { persist: false })
        : {},
  };

  if (asJson) {
    printJson(output);
    return;
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function resolveHookCommand(payload) {
  const candidates = [
    payload.command,
    payload.cmd,
    payload.shell,
    payload.input?.command,
    payload.tool_input?.command,
    payload.toolInput?.command,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function runHookArm() {
  const payload = readStdinJson();
  const command = resolveHookCommand(payload);

  if (!command) {
    if (Object.keys(payload).length > 0) {
      console.error(
        `pr-babysit: afterShellExecution payload missing command field (keys: ${Object.keys(payload).join(', ')})`,
      );
    }
    printJson({});
    return;
  }

  if (!ARM_COMMAND_RE.test(command)) {
    printJson({});
    return;
  }

  const branch = getCurrentBranch();
  const prNumber = findOpenPrNumber(branch);
  const snapshot = ensurePublished(branch, prNumber, {
    allowDraft: KEEP_DRAFT_RE.test(command),
  });

  armState(snapshot);
  printJson({});
}

function runHookStop() {
  const payload = readStdinJson();

  if (payload.status && payload.status !== 'completed') {
    printJson({});
    return;
  }

  printJson(evaluateStop(readState()));
}

const rawArgv = process.argv.slice(2);
const normalizedArgv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv;
const [command = '', ...argv] = normalizedArgv;
const options = parseArgs(argv);

switch (command) {
  case 'arm': {
    const state = armState();
    process.stdout.write(
      state
        ? `Armed PR babysitter for #${state.prNumber}.\n`
        : 'No open PR found for the current branch.\n',
    );
    break;
  }
  case 'pause': {
    const state = pauseState(options.reason);
    process.stdout.write(
      state
        ? `Paused PR babysitter for #${state.prNumber}.\n`
        : 'No active PR babysitter state found.\n',
    );
    break;
  }
  case 'resume': {
    const state = resumeState();
    process.stdout.write(
      state
        ? `Resumed PR babysitter for #${state.prNumber}.\n`
        : 'No open PR found for the current branch.\n',
    );
    break;
  }
  case 'disarm':
    disarmState();
    process.stdout.write('Disarmed PR babysitter.\n');
    break;
  case 'status':
    runStatusCommand(options.json);
    break;
  case 'hook-arm':
    runHookArm();
    break;
  case 'hook-stop':
    runHookStop();
    break;
  default:
    printUsage();
    process.exitCode = command ? 1 : 0;
}
