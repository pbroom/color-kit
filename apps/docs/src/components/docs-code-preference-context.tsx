import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type DocsCodeLanguage = 'html' | 'tsx';

const STORAGE_KEY = 'color-kit-docs-code-language';

interface DocsCodePreferenceContextValue {
  preferredLanguage: DocsCodeLanguage;
  setPreferredLanguage: (language: DocsCodeLanguage) => void;
}

const DocsCodePreferenceContext =
  createContext<DocsCodePreferenceContextValue | null>(null);

function isDocsCodeLanguage(value: string | null): value is DocsCodeLanguage {
  return value === 'html' || value === 'tsx';
}

function readStoredLanguage(): DocsCodeLanguage {
  if (typeof window === 'undefined') {
    return 'html';
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isDocsCodeLanguage(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors and use default.
  }

  return 'html';
}

export function DocsCodePreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preferredLanguage, setPreferredLanguage] = useState<DocsCodeLanguage>(
    () => readStoredLanguage(),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, preferredLanguage);
    } catch {
      // Ignore storage access errors.
    }
  }, [preferredLanguage]);

  const value = useMemo(
    () => ({
      preferredLanguage,
      setPreferredLanguage,
    }),
    [preferredLanguage],
  );

  return (
    <DocsCodePreferenceContext.Provider value={value}>
      {children}
    </DocsCodePreferenceContext.Provider>
  );
}

export function useDocsCodePreference() {
  const context = useContext(DocsCodePreferenceContext);
  if (!context) {
    throw new Error(
      'useDocsCodePreference must be used within DocsCodePreferenceProvider.',
    );
  }
  return context;
}
