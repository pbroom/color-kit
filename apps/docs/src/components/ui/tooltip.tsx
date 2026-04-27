import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

const DEFAULT_TOOLTIP_DELAY_DURATION = 450;
const DEFAULT_TOOLTIP_SKIP_DELAY_DURATION = 300;

interface TooltipAnimationContextValue {
  disableCloseAnimation: boolean;
  disableOpenAnimation: boolean;
  isHandoffRef: React.MutableRefObject<boolean>;
  noteClose: () => void;
  noteOpen: () => void;
  prepareForOpen: () => void;
  subscribeToHandoff: (listener: () => void) => () => void;
}

const TooltipAnimationContext =
  React.createContext<TooltipAnimationContextValue | null>(null);

function TooltipProvider({
  delayDuration = DEFAULT_TOOLTIP_DELAY_DURATION,
  skipDelayDuration = DEFAULT_TOOLTIP_SKIP_DELAY_DURATION,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  const isHandoffRef = React.useRef(false);
  const hasOpenTooltipRef = React.useRef(false);
  const closeTimerRef = React.useRef<number | null>(null);
  const handoffListenersRef = React.useRef<Set<() => void>>(new Set());

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const subscribeToHandoff = React.useCallback((listener: () => void) => {
    handoffListenersRef.current.add(listener);
    return () => {
      handoffListenersRef.current.delete(listener);
    };
  }, []);

  const prepareForOpen = React.useCallback(() => {
    const isHandoff =
      hasOpenTooltipRef.current || closeTimerRef.current !== null;

    isHandoffRef.current = isHandoff;
    clearCloseTimer();

    if (isHandoff) {
      for (const listener of handoffListenersRef.current) {
        listener();
      }
    }
  }, [clearCloseTimer]);

  const noteOpen = React.useCallback(() => {
    hasOpenTooltipRef.current = true;
    clearCloseTimer();
  }, [clearCloseTimer]);

  const noteClose = React.useCallback(() => {
    hasOpenTooltipRef.current = false;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      isHandoffRef.current = false;
      closeTimerRef.current = null;
    }, skipDelayDuration);
  }, [clearCloseTimer, skipDelayDuration]);

  React.useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  const contextValue = React.useMemo(
    () => ({
      disableCloseAnimation: false,
      disableOpenAnimation: false,
      isHandoffRef,
      noteClose,
      noteOpen,
      prepareForOpen,
      subscribeToHandoff,
    }),
    [noteClose, noteOpen, prepareForOpen, subscribeToHandoff],
  );

  return (
    <TooltipAnimationContext.Provider value={contextValue}>
      <TooltipPrimitive.Provider
        data-slot="tooltip-provider"
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
        {...props}
      />
    </TooltipAnimationContext.Provider>
  );
}

function Tooltip({
  children,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const tooltipAnimation = React.useContext(TooltipAnimationContext);
  const [disableCloseAnimation, setDisableCloseAnimation] =
    React.useState(false);
  const [disableOpenAnimation, setDisableOpenAnimation] = React.useState(false);
  const isOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!tooltipAnimation) {
      return;
    }

    return tooltipAnimation.subscribeToHandoff(() => {
      if (isOpenRef.current) {
        setDisableCloseAnimation(true);
      }
    });
  }, [tooltipAnimation]);

  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      onOpenChange={(open) => {
        isOpenRef.current = open;
        if (open) {
          const shouldDisableOpenAnimation =
            tooltipAnimation?.isHandoffRef.current ?? false;
          setDisableCloseAnimation(false);
          setDisableOpenAnimation(shouldDisableOpenAnimation);
          tooltipAnimation?.noteOpen();
        } else {
          tooltipAnimation?.noteClose();
        }
        onOpenChange?.(open);
      }}
      {...props}
    >
      <TooltipAnimationContext.Provider
        value={
          tooltipAnimation
            ? {
                ...tooltipAnimation,
                disableCloseAnimation,
                disableOpenAnimation,
              }
            : null
        }
      >
        {children}
      </TooltipAnimationContext.Provider>
    </TooltipPrimitive.Root>
  );
}

function TooltipTrigger({
  onPointerEnter,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const tooltipAnimation = React.useContext(TooltipAnimationContext);

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      onPointerEnter={(event) => {
        tooltipAnimation?.prepareForOpen();
        onPointerEnter?.(event);
      }}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const tooltipAnimation = React.useContext(TooltipAnimationContext);
  const disableCloseAnimation =
    tooltipAnimation?.disableCloseAnimation ?? false;
  const disableOpenAnimation = tooltipAnimation?.disableOpenAnimation ?? false;

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background',
          disableOpenAnimation
            ? 'animate-none'
            : 'animate-in fade-in-0 zoom-in-95',
          disableCloseAnimation
            ? 'data-[state=closed]:animate-none'
            : 'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
