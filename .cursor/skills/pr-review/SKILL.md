---
name: pr-review
description: Reviews pull requests with a bugs-first lens, flags regressions/security/test gaps, and outputs severity-ranked findings with file references. Use when the user asks for a PR review, code review, review feedback, or wants to post structured GitHub PR comments.
---

# PR Review

## Purpose

Use this skill to produce high-signal PR reviews that prioritize correctness and risk over style nits.

## When to apply

Apply when the user asks to:

- review a PR
- review a branch or diff before merge
- check PR feedback quality
- post review comments on GitHub in a consistent format

## Quick workflow

1. Identify review target:
   - PR number (preferred), or
   - current branch diff vs base branch
2. Gather context:
   - `gh pr view <number> --json title,body,baseRefName,headRefName,author,url,headRefOid`
   - `gh pr diff <number>`
   - `gh pr checks <number>` (if CI status matters)
3. Review in this order:
   - correctness and regressions
   - security and data-safety
   - performance and reliability risks
   - missing/weak test coverage
   - maintainability/style (only after risks)
4. Return findings in the required format below, **including file path and line number** for each finding when the issue is tied to a specific line (use the PR head version of the file).
5. **Publish automatically** (no approval step): post inline comments for line-specific findings and a single review comment for the rest, using the publishing steps below.

## Required output format

Always return findings first, ordered by severity. For each finding, **include the line number** (in the PR head file) when the issue is line-specific and you will post it inline:

```markdown
## Findings

- [SEV-1] <Short title> — `path/to/file.ext` (line N, or omit if not line-specific)
  - Risk: <why this matters>
  - Evidence: <behavior, edge case, or snippet>
  - Fix: <specific change>
  - Test: <what test should exist or be updated>

- [SEV-2] <Short title> — `path/to/file.ext` (line N)
  - Risk: ...
  - Evidence: ...
  - Fix: ...
  - Test: ...

## Open Questions / Assumptions

- <question or assumption, if any>

## Change Summary

- <1-3 bullets, only after findings>
```

If no issues are found, state:

- `No blocking findings.`
- `Residual risks/testing gaps: <brief note>`

## Severity rubric

- `SEV-1`: likely production bug, data loss/corruption, auth/security flaw, or clear behavioral regression.
- `SEV-2`: meaningful reliability/performance risk, incorrect edge-case handling, or fragile logic likely to break.
- `SEV-3`: maintainability/test gaps or non-blocking quality concerns.

## Publishing (required, no approval step)

**You must publish findings to GitHub.** Do not ask for approval first. Use one of the two methods below so that line-specific findings appear inline and everything else appears in the review body.

### When to use inline vs body

- **Inline comment:** Use when the finding is tied to a **specific file and line** (e.g. "this condition should use useLayoutEffect"). Include in the finding: `path`, `line` (line number in the PR head file; resolve from the diff or the file at head). Post that finding only as an inline comment at that line.
- **Review body:** Use for findings that are **not line-specific** (e.g. "consider adding a test for pathWithRoundedCorners"), plus **Open questions / assumptions** and **Change summary**. Post these in the single review comment body.

### Method A: One review with body + inline comments (preferred)

1. For each finding, decide: line-specific → record `path` and `line` (in PR head); otherwise → body-only.
2. Build the review **body** (markdown string):
   - Optional: "## Inline comments" — list each line-specific finding as `path:line — [SEV-x] Title`.
   - "## Findings (summary / non-inline)" — full text of every finding that is **not** line-specific (Risk, Evidence, Fix, Test). If all findings are inline, write "See inline comments below."
   - "## Open questions / assumptions" — as in the required output format.
   - "## Change summary" — as in the required output format.
3. Build the **comments** array for the GitHub API: one object per line-specific finding: `{ "path": "<file path from repo root>", "line": <number>, "body": "<markdown: [SEV-x] Title, Risk, Fix, Test>" }`. Use the exact path from the diff (e.g. `packages/react/src/contrast-region-layer.tsx`). Line is the line number in the **head** version of the file.
4. Submit one review with body and comments:
   - Write a JSON payload: `{ "body": "<escaped or multiline body>", "event": "COMMENT", "comments": [ ... ] }`. Prefer writing `body` to a temp file and reading it, or use a here-doc, so newlines are preserved.
   - Run: `gh api repos/<owner>/<repo>/pulls/<number>/reviews --input review_payload.json` (or `-f body=@review_body.md` plus `-f event=COMMENT` and `-f comments=@comments.json` if your CLI supports it; otherwise build one JSON file with body + event + comments and pass with `--input`).
   - Owner/repo: use `gh pr view <number> --json baseRepository -q .baseRepository.owner.login` and `.baseRepository.name`, or `gh repo view --json nameWithOwner -q .nameWithOwner` and split.

### Method B: Body first, then inline comments

If the API for a single review with comments is awkward in your environment:

1. Build `review.md` with the full body (inline list + non-inline findings + open questions + change summary).
2. Run: `gh pr review <number> --comment --body-file review.md`.
3. For each line-specific finding, run: `gh api repos/<owner>/<repo>/pulls/<number>/comments -f body="<comment body>" -f commit_id="<head_sha>" -f path="<path>" -F line=<line>`. Use `gh pr view <number> --json headRefOid -q .headRefOid` for commit_id.

### Rules for comments

- **Inline:** Only for line-specific, actionable findings. One issue per comment; include [SEV-x], short title, Risk, Fix, and optionally Test in the comment body.
- **Body:** All non-line-specific findings, open questions, and change summary. No need to duplicate full text of inline findings in the body if you list them in "Inline comments" with file:line and title.
- Do not ask the user to approve before posting; publish as part of the review workflow.

## Automation note

For automatic reviews on PR open/synchronize events (using this same format), follow `automation.md`.
