import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

interface DeferredMountProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  minHeight?: CSSProperties['minHeight'];
  className?: string;
}

export function DeferredMount({
  children,
  fallback = null,
  rootMargin = '240px 0px',
  minHeight,
  className,
}: DeferredMountProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [shouldMount, setShouldMount] = useState(
    () => typeof IntersectionObserver !== 'function',
  );

  useEffect(() => {
    if (shouldMount) {
      return;
    }

    const node = targetRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMount(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, shouldMount]);

  return (
    <div
      ref={targetRef}
      className={className}
      style={shouldMount || minHeight == null ? undefined : { minHeight }}
    >
      {shouldMount ? children : fallback}
    </div>
  );
}
