import type { PlacementAlign, PlacementSide } from '../types.js';

export const PLACEMENT_GRID_OPTIONS: Array<{
  side: PlacementSide;
  align: PlacementAlign;
  label: string;
  gridColumn: string;
  gridRow: string;
}> = [
  {
    side: 'top',
    align: 'start',
    label: 'Top start',
    gridColumn: '2',
    gridRow: '1',
  },
  {
    side: 'top',
    align: 'center',
    label: 'Top center',
    gridColumn: '3',
    gridRow: '1',
  },
  {
    side: 'top',
    align: 'end',
    label: 'Top end',
    gridColumn: '4',
    gridRow: '1',
  },
  {
    side: 'right',
    align: 'start',
    label: 'Right start',
    gridColumn: '5',
    gridRow: '2',
  },
  {
    side: 'right',
    align: 'center',
    label: 'Right center',
    gridColumn: '5',
    gridRow: '3',
  },
  {
    side: 'right',
    align: 'end',
    label: 'Right end',
    gridColumn: '5',
    gridRow: '4',
  },
  {
    side: 'bottom',
    align: 'end',
    label: 'Bottom end',
    gridColumn: '4',
    gridRow: '5',
  },
  {
    side: 'bottom',
    align: 'center',
    label: 'Bottom center',
    gridColumn: '3',
    gridRow: '5',
  },
  {
    side: 'bottom',
    align: 'start',
    label: 'Bottom start',
    gridColumn: '2',
    gridRow: '5',
  },
  {
    side: 'left',
    align: 'end',
    label: 'Left end',
    gridColumn: '1',
    gridRow: '4',
  },
  {
    side: 'left',
    align: 'center',
    label: 'Left center',
    gridColumn: '1',
    gridRow: '3',
  },
  {
    side: 'left',
    align: 'start',
    label: 'Left start',
    gridColumn: '1',
    gridRow: '2',
  },
];
