import { useRef, useState, useSyncExternalStore } from 'react';
import { Check, Copy } from 'lucide-react';

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

const MANAGERS: readonly PackageManager[] = ['pnpm', 'npm', 'yarn', 'bun'];
const STORAGE_KEY = 'color-kit-docs-package-manager';
const CHANGE_EVENT = 'color-kit:package-manager';
let selectedManager: PackageManager | undefined;

const VERBS: Record<PackageManager, string> = {
  pnpm: 'pnpm add',
  npm: 'npm install',
  yarn: 'yarn add',
  bun: 'bun add',
};

function readManager(): PackageManager {
  if (selectedManager !== undefined) return selectedManager;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (MANAGERS.includes(stored as PackageManager)) {
      return stored as PackageManager;
    }
  } catch {
    // Storage blocked: default.
  }
  return 'pnpm';
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    selectedManager = undefined;
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function chooseManager(manager: PackageManager): void {
  selectedManager = manager;
  try {
    window.localStorage.setItem(STORAGE_KEY, manager);
  } catch {
    // Not persisted; still switches for this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * `<InstallLine />`: the install command with a package-manager toggle.
 *
 * Contract:
 * - `packages`: what to install, default `['color-kit']`.
 * - `tag`: dist-tag appended to every package, default `'next'` (pre-1.0,
 *   the docs track `color-kit@next`). Pass `null` for none.
 * - `dev`: install as a dev dependency.
 * - The chosen manager persists and syncs across every InstallLine on the
 *   site. Prerendered HTML shows pnpm; the stored choice applies after
 *   hydration without a mismatch.
 */
export interface InstallLineProps {
  packages?: string[];
  tag?: string | null;
  dev?: boolean;
}

export function InstallLine({
  packages = ['color-kit'],
  tag = 'next',
  dev = false,
}: InstallLineProps) {
  const manager = useSyncExternalStore<PackageManager>(
    subscribe,
    readManager,
    () => 'pnpm',
  );
  const [copied, setCopied] = useState(false);
  const commandRef = useRef<HTMLElement>(null);
  const specs = packages.map((name) => (tag ? `${name}@${tag}` : name));
  const devFlag = dev ? (manager === 'npm' ? ' --save-dev' : ' -D') : '';
  const command = `${VERBS[manager]}${devFlag} ${specs.join(' ')}`;

  const copy = () => {
    const text = commandRef.current?.textContent ?? command;
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="install-line">
      <div
        className="install-line__managers"
        data-pagefind-ignore=""
        role="group"
        aria-label="Package manager"
      >
        {MANAGERS.map((name) => (
          <button
            key={name}
            type="button"
            className="install-line__manager"
            aria-pressed={name === manager}
            onClick={() => chooseManager(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="install-line__command">
        <span className="install-line__prompt" aria-hidden="true">
          $
        </span>
        <code ref={commandRef}>{command}</code>
        <button
          type="button"
          className="code-block__copy"
          onClick={copy}
          data-pagefind-ignore=""
        >
          {copied ? (
            <Check aria-hidden="true" size={14} strokeWidth={2} />
          ) : (
            <Copy aria-hidden="true" size={14} strokeWidth={1.75} />
          )}
          <span className="visually-hidden">Copy install command</span>
          <span className="code-block__copied" aria-live="polite">
            {copied ? 'Copied' : ''}
          </span>
        </button>
      </div>
    </div>
  );
}
