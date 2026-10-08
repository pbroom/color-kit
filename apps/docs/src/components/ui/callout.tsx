import type { ReactNode } from 'react';
import { CircleAlert, Info, Lightbulb, TriangleAlert } from 'lucide-react';

export type CalloutTone = 'note' | 'tip' | 'warning' | 'caution';

/**
 * `<Callout tone="note">`: an aside for information that would break the
 * flow of prose.
 *
 * Contract:
 * - `tone` sets the label and icon, never a hue: the chrome stays
 *   achromatic so color in the docs is always data. `note` (default) for
 *   context, `tip` for a better way, `warning` for a trap, `caution` for
 *   data loss or wrong output.
 * - `title` replaces the default label (the tone name).
 * - Children are MDX/React flow content.
 */
export interface CalloutProps {
  tone?: CalloutTone;
  title?: string;
  children: ReactNode;
}

const TONES: Record<CalloutTone, { label: string; Icon: typeof Info }> = {
  note: { label: 'Note', Icon: Info },
  tip: { label: 'Tip', Icon: Lightbulb },
  warning: { label: 'Warning', Icon: TriangleAlert },
  caution: { label: 'Caution', Icon: CircleAlert },
};

export function Callout({ tone = 'note', title, children }: CalloutProps) {
  const { label, Icon } = TONES[tone];
  return (
    <aside className="callout" data-tone={tone} aria-label={title ?? label}>
      <p className="callout__label">
        <Icon aria-hidden="true" size={14} strokeWidth={2} />
        {title ?? label}
      </p>
      <div className="callout__body">{children}</div>
    </aside>
  );
}
