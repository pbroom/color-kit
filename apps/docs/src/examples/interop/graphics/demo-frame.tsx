import type { ReactNode } from 'react';

/**
 * A demo's label and body. Demos render inside `<Example>`, which draws the
 * frame, so this adds no border of its own.
 */
export function DemoFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="example-demo">
      <p className="example-demo__label">{label}</p>
      {children}
    </div>
  );
}
