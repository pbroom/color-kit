# PR Review Automation

Use this guide to automate reviews after PR open/synchronize while keeping the same severity-first format and **publishing rules as the skill**: post findings automatically (no approval step), inline where line-specific, and in the review body otherwise.

Implemented example in this repo:

- workflow: `.github/workflows/pr-review-bot.yml`
- generator: `scripts/generate_pr_review.sh`

## Publishing behavior (must match skill)

- **No approval gate** — post the review as soon as the review run completes.
- **Inline comments** — for every finding that has a specific file and line (in PR head): post one review comment via API with `path`, `line`, `body`.
- **Review body** — post one review that includes: (1) list of inline locations (path:line — title), (2) full text of any finding that is not line-specific, (3) Open questions / assumptions, (4) Change summary.

Use either the **Reviews API** (one POST with `body` + `comments` array) or post the body with `gh pr review --comment --body-file review.md` then post each inline comment with `gh api .../pulls/.../comments` (commit_id, path, line, body).

## Option A: CI generates review artifact

Use CI to generate `review.md` (and optionally a structured JSON with findings + line numbers) and upload as an artifact. Useful for debugging; for full parity with the skill, also post the review (body + inlines) to the PR.

## Option B: CI posts one review (body + inline comments)

Use a workflow triggered by `pull_request` (`opened`, `synchronize`, `reopened`) to:

- generate findings in the skill's required format, with file and line for each finding where applicable
- build the review body (non-inline findings, open questions, change summary; optional "Inline comments" list)
- submit one review via GitHub API with `body` + `comments` (array of `{ path, line, body }` for line-specific findings)

### Minimal workflow skeleton

```yaml
name: pr-review-bot

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Generate review body and, if supported, structured data (e.g. JSON) with path/line/body for inline comments.
      - name: Generate structured review
        run: |
          bash scripts/generate_pr_review.sh

      # Post one review: body + inline comments (no approval step).
      - name: Post PR review
        uses: actions/github-script@v7
        with:
          script: |
            // Build review payload: body (from review.md or equivalent) + comments array for line-specific findings.
            // POST repos/:owner/:repo/pulls/:number/reviews with { body, event: 'COMMENT', comments }.
            // See .github/workflows/pr-review-bot.yml for full script.
```

## Inline comment API

For each line-specific finding, one comment object:

- `path` (required) — file path from repo root, e.g. `packages/react/src/line.tsx`
- `line` (required) — line number in the **head** version of the file
- `body` (required) — markdown: [SEV-x] title, Risk, Fix, Test

When posting comments outside the Reviews API (e.g. `POST .../pulls/.../comments`), also send `commit_id` (PR head SHA). Use one comment per finding; keep body focused.
