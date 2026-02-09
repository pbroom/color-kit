import { type ReactNode } from 'react';

interface ComponentPreviewProps {
  children: ReactNode;
  className?: string;
}

/**
 * Renders a live component demo inside a styled container.
 * Used in MDX docs to showcase color-kit components.
 */
export function ComponentPreview({
  children,
  className = '',
}: ComponentPreviewProps) {
  return (
    <div className="not-prose my-6">
      <div
        className={`relative rounded-lg border border-border bg-card p-8 flex items-center justify-center min-h-[200px] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
