## Summary

<!-- What changed and why. Link the issue this closes, if any. -->

## Checklist

- [ ] One logical change, with Conventional Commit messages (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- [ ] `pnpm lint` passes (including `react-hooks` and React Compiler rules for touched React files)
- [ ] `pnpm build` passes, including DTS output
- [ ] `pnpm test` passes, with new or updated tests for changed behavior (core math changes need tests)
- [ ] `pnpm format:check` passes
- [ ] `pnpm size` stays within budget, if runtime code changed
- [ ] `pnpm check:artifacts` passes, if package exports or packaging changed
- [ ] Changeset added with `pnpm changeset` (targeting `color-kit`, `minor` for breaking changes while pre-1.0), or this change is not user-visible
- [ ] Docs updated (`apps/docs` page or README) for new or changed public API

## Notes for reviewers

<!-- Anything that needs extra attention: tradeoffs, follow-ups, screenshots for docs or UI changes. -->
