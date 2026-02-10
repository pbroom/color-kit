'use client';

import { type ReactNode } from 'react';
import { ColorContext } from '@/hooks/color-context';
import { useColor, type UseColorOptions } from '@/hooks/use-color';

export interface ColorProviderProps extends UseColorOptions {
  children: ReactNode;
}

export function ColorProvider({
  children,
  ...colorOptions
}: ColorProviderProps) {
  const colorState = useColor(colorOptions);

  return (
    <ColorContext.Provider value={colorState}>{children}</ColorContext.Provider>
  );
}
