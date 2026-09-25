import type { ReactNode } from 'react';

export function DemoFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-6 rounded-xl border border-border/70 bg-card/40 p-4 shadow-xs">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
