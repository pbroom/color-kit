'use client';

import { type ReactNode } from 'react';
import { ColorContext } from '@/hooks/color-context';
import { useColor, type UseColorOptions } from '@/hooks/use-color';

export interface ColorProps extends UseColorOptions {
  children: ReactNode;
}

export function Color({ children, ...colorOptions }: ColorProps) {
  const colorState = useColor(colorOptions);

  return (
    <ColorContext.Provider value={colorState}>{children}</ColorContext.Provider>
  );
}
