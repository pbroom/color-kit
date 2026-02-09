# Codex Workspace Guidance

This file defines top-level guidance for Codex in this repository.

## Branch Safety

- Never commit directly to `main` or `master`.
- Before commit-worthy changes, verify the branch with `git branch --show-current`.
- If you are on `main`/`master`, create a feature branch before proceeding (prefer `codex/<topic>` naming in Codex).

## Branch / PR Workflow

- Prefer one logical change per branch and keep branches reviewable.
- Use Conventional Commit style messages (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- If Graphite is configured, prefer `gt` workflow (`gt create`, `gt modify`, `gt submit --stack`).
- If Graphite is unavailable or unsynced, fall back to plain `git` + `gh`.

## Parallel Work

- Use `git worktree` isolation for parallel or potentially conflicting development tracks.
- Skip worktrees for read-only exploration and trivial, low-conflict edits.

## Reflection and Learnings

- At the end of non-trivial tasks, record reusable lessons in `## Agent Learnings`.
- Add only non-duplicative, broadly useful entries.
- Format:
  - `- **YYYY-MM-DD — Short title**: One or two sentence actionable lesson.`

## Agent Learnings
