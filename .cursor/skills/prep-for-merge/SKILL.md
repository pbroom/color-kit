---
name: prep-for-merge
description: Submit the current effort as a stacked PR, gather GitHub review and Greptile signals, apply focused fixes, and stop at merge-ready without merging.
---

# Prep For Merge

Use this skill when the user wants to move the current effort from local work to a merge-ready PR, while keeping merge and cleanup as separate approval steps.

## Goals

1. Submit the current effort safely.
2. Gather GitHub review, Greptile, and CI signals.
3. Apply only clear, focused fixes.
4. Re-validate and re-watch CI until the PR is green or clearly blocked.
5. Stop before merge.

## Preflight

Run these checks first:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
gh auth status
```

Rules:

- If the branch is `main` or `master`, stop and create a feature branch first.
- Capture the starting `HEAD` SHA before making any fixes so rollback is straightforward.
- If `.agent-context` exists, respect its branch/worktree scope.
- Prefer isolated worktrees for long-lived PR babysitting.
- If `greptile.json` is present, treat Greptile as a first-class review signal instead of an optional extra.

## Step 1: Submit The PR

### Clean working tree

If the current worktree is already clean, prefer the repo wrapper:

```bash
pnpm pr:stack
```

This keeps the repo's Graphite preflight, tracking, and PR metadata refresh in one place.

### Dirty working tree

If the worktree has local changes, do not improvise raw `git`/`gt` commands. Route through the existing scoped submit workflow:

- Follow `/Users/peterbroomfield/.cursor/skills/effort-pr-stacker/SKILL.md`

The goal is to submit only the current effort, not unrelated local work.

## Step 2: Resolve The Current PR

After submit, resolve the PR for the current branch:

```bash
gh pr view --json number,url,title,baseRefName,headRefName,headRefOid,isDraft
gh pr checks
```

Keep the PR number, URL, base branch, head SHA, and draft state for all later steps.

## Step 3: Gather Signals

Collect all review sources before fixing anything:

### Greptile status and review

If the repo has `greptile.json`, check for Greptile's status check and review comments:

```bash
gh pr checks {PR_NUMBER}
gh pr view {PR_NUMBER} --comments
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments
```

If the PR is ready for review and Greptile has not reviewed yet, trigger it once:

```bash
gh pr comment {PR_NUMBER} --body "@greptileai"
```

Use this manual trigger sparingly:

- draft PR that needs early feedback
- fresh commit landed but Greptile review has not appeared yet
- repo indexing/config changed and you need one explicit rerun

Do not spam repeated `@greptileai` comments while a review is already pending.

### Sticky review bot comment

The repo also posts a sticky heuristic review comment. Inspect it too:

```bash
gh pr view --comments
```

Treat the bot as a low-cost heuristic companion to Greptile, not the final source of truth.

### Review comments and summaries

Fetch unresolved review context from humans and bots:

```bash
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/comments
gh api repos/{owner}/{repo}/pulls/{PR_NUMBER}/reviews
gh api repos/{owner}/{repo}/issues/{PR_NUMBER}/comments
```

### CI status

Use GitHub checks plus failed logs:

```bash
gh pr checks {PR_NUMBER}
gh run list --branch "$(git branch --show-current)" --limit 5
gh run view <run-id> --log-failed
```

When CI and summaries disagree, trust `gh run view --log-failed`.

## Step 4: Fix Actionable Findings

Only apply clear, actionable fixes:

- Greptile findings that point to a real bug, regression, missing test, or integration issue
- human review feedback that requests a code or test change
- CI failures with a concrete failing command or stack trace
- small regression fixes you can validate locally

Pause and ask the user when:

- reviewer intent is ambiguous
- a fix requires product or API design judgment
- Greptile is likely wrong and the tradeoff needs a human call
- CI looks flaky after one retry
- a merge conflict changes behavior, not just text

### Review feedback

If comments are actionable, follow:

- `/Users/peterbroomfield/.cursor/skills/pr-comment-resolver/SKILL.md`

Skip that step when comments are only approvals, questions, or stale threads.

### CI loop

Prefer a watcher rather than repeatedly polling by hand:

- Launch the `ci-watcher` subagent when you expect a longer wait loop.
- Use `/Users/peterbroomfield/.cursor/plugins/cache/cursor-public/cursor-team-kit/08c2bbe2ae8a022a21dc6c32faf611f14a6e8343/skills/loop-on-ci/SKILL.md` when you are fixing and rechecking in a tight loop.

Keep each push scoped to one failure cause when possible.

## Step 5: Run Targeted Regression Checks

After every fix pass, and once again when CI is green, run the repo validator:

```bash
pnpm pr:validate
```

Useful flags:

```bash
pnpm pr:validate -- --dry-run
pnpm pr:validate -- --base origin/main
```

Validation rules:

- Always run the validator instead of guessing which package commands matter.
- Trust the printed validation profile in the output and include it in your summary.
- If changed files touch `apps/docs`, `packages/react`, or other UI-facing surfaces, consider one quick `browser-use` smoke pass after local validation.

## Step 6: Stop At Merge-Ready

Do not merge in this skill.

Return one of:

- `merge-ready`: PR link, current branch, validation profile run, GitHub check status, Greptile status, and any residual risks.
- `blocked`: exact blocking comments/checks, latest failed run URL, whether Greptile is still pending or needs a manual trigger, and the next smallest useful action.

## Guardrails

- Do not auto-merge.
- Do not auto-clean worktrees or branches.
- Prefer `pnpm pr:stack` over raw `gt submit`.
- Prefer the repo validator over ad hoc build/test command selection.
- Use `gh run view --log-failed` as the source of truth for failing GitHub Actions jobs.
- Treat Greptile status/comments as part of review readiness when `greptile.json` enables them.
