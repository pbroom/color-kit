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
      <div className={`docs-preview-shell ${className}`}>{children}</div>
    </div>
  );
}
