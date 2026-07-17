import { Diff, MousePointer2, Option } from 'lucide-react';

export const TOGGLE_GROUP_ITEMS = [
  {
    value: 'plane',
    label: 'Plane',
    icon: <Option aria-hidden="true" className="size-3.5" strokeWidth={1.75} />,
  },
  {
    value: 'input',
    label: 'Input',
    icon: (
      <MousePointer2
        aria-hidden="true"
        className="size-3.5"
        strokeWidth={1.75}
      />
    ),
  },
  {
    value: 'copy',
    label: 'Copy',
    icon: <Diff aria-hidden="true" className="size-3.5" strokeWidth={1.75} />,
  },
];

export const TOGGLE_BUTTON_ICON = (
  <svg
    aria-hidden="true"
    className="size-3.5"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="1.5"
  >
    <path d="M4.5 2.5H2.5v2" />
    <path d="M9.5 2.5h2v2" />
    <path d="M11.5 9.5v2h-2" />
    <path d="M2.5 9.5v2h2" />
  </svg>
);
