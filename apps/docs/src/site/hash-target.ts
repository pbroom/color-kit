/**
 * Bring the `#hash` target into view: open every `<details>` that is (or
 * holds) it, so an API row or an anchor inside its panel is visible, then
 * scroll to it. Returns whether the target exists yet (route content can
 * arrive after the navigation that asked for it).
 */
export function revealHashTarget(hash: string): boolean {
  const raw = hash.replace(/^#/, '');
  if (!raw) return false;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // Keep the raw fragment.
  }
  const target = document.getElementById(id);
  if (!target) return false;
  let details = target.closest('details');
  while (details) {
    details.open = true;
    details = details.parentElement?.closest('details') ?? null;
  }
  target.scrollIntoView();
  return true;
}
