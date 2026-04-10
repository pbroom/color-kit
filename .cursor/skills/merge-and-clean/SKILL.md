---
name: merge-and-clean
description: After explicit user approval, dry-run merge readiness, perform the merge if all gates pass, and clean eligible Codex worktrees and branches with a dry-run-first workflow.
---

# Merge And Clean

Use this skill only after the user has reviewed the PR and explicitly approved merge and cleanup.

## Preconditions

Confirm all of the following before acting:

- the user explicitly asked to merge
- the target PR is known, or the current branch maps to a PR
- `gh auth status` succeeds
- you are not bypassing branch protection or approvals unless the user explicitly asked
- if `greptile.json` enables a Greptile status check, it is either already green or you are explicitly waiting for it before merge

## Step 1: Dry-Run Merge Readiness

Follow the safe merge workflow from:

- `/Users/peterbroomfield/.codex/skills/gh-safe-merge-ready-pr/SKILL.md`

Start with the dry run only. Do not perform the merge yet.

Expected outcome:

- PR is open
- PR is not draft
- PR is mergeable
- required checks are green
- approvals are satisfied
- review threads are resolved
- Greptile status is green when configured

If any gate fails, stop and report the failed gates plus the smallest next action.

If Greptile is still pending:

- wait for it like any other required check
- if no Greptile review started and the PR should be reviewed, trigger once with `gh pr comment {PR_NUMBER} --body "@greptileai"`

## Step 2: Perform Merge Only After Approval

If the dry run is clean and the user asked to merge, perform the merge using the safe merge workflow.

Rules:

- Never use admin bypass unless the user explicitly asks.
- Keep the default safe merge behavior unless the user asked for a different method.
- Report the PR URL, merge method, and whether the branch was deleted.

## Step 3: Dry-Run Cleanup

After a successful merge, do not immediately delete worktrees or branches.

Follow the cleanup workflow from:

- `/Users/peterbroomfield/.codex/skills/git-clean-codex-worktrees/SKILL.md`

Start with dry-run mode and inspect:

- worktrees planned for removal
- branches planned for deletion
- skipped items
- manual follow-ups

## Step 4: Execute Cleanup

Only execute cleanup when the dry run matches intent.

Default cleanup policy:

- stay scoped to this repository
- prefer safe branch deletion
- do not force delete merged PR branches unless the user explicitly asks
- only remove attached Codex worktrees when the user wants them pruned

## Output

Return:

- merged PR URL
- merge method used
- whether Greptile was part of the readiness gate
- cleanup dry-run summary
- deleted worktrees and branches, if execution happened
- any skipped cleanup items that need manual review

## Guardrails

- Never merge without a dry run in the same turn.
- Never auto-clean before a cleanup dry run.
- Fail closed if GitHub metadata is ambiguous.
- Stop and ask if cleanup output includes anything unexpected.
