import type { ReactNode } from 'react';

export function DemoFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="demo-frame">
      <p className="demo-frame__label">{label}</p>
      {children}
    </div>
  );
}
