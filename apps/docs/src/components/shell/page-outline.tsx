import { useEffect, useState, type RefObject } from 'react';

interface OutlineItem {
  id: string;
  text: string;
  level: 2 | 3;
}

function sameOutline(a: OutlineItem[], b: OutlineItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, index) => item.id === b[index]!.id && item.text === b[index]!.text,
    )
  );
}

/**
 * "On this page": the `h2[id]`/`h3[id]` headings of the article, read from
 * the DOM so MDX and TSX (API) pages share it. It renders empty on the server
 * and fills in after hydration; the column's width is reserved either way, so
 * nothing shifts. The heading nearest the top of the viewport is marked.
 */
export function PageOutline({
  articleRef,
  pathname,
}: {
  articleRef: RefObject<HTMLElement | null>;
  pathname: string;
}) {
  const [items, setItems] = useState<OutlineItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) {
      return;
    }
    let frame = 0;
    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Array.from(
          article.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'),
        ).map((heading) => ({
          id: heading.id,
          text: heading.textContent?.trim() ?? '',
          level: heading.tagName === 'H2' ? (2 as const) : (3 as const),
        }));
        setItems((previous) => (sameOutline(previous, next) ? previous : next));
      });
    };
    scan();
    // Route content can stream in after a lazy chunk resolves.
    const mutations = new MutationObserver(scan);
    mutations.observe(article, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
    };
  }, [articleRef, pathname]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = items.find((item) => visible.has(item.id));
        if (first) setActiveId(first.id);
      },
      { rootMargin: '-64px 0px -60% 0px' },
    );
    for (const item of items) {
      const heading = document.getElementById(item.id);
      if (heading) observer.observe(heading);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="page-outline">
      {items.length > 0 ? (
        <nav aria-labelledby="page-outline-title">
          <p id="page-outline-title" className="page-outline__title">
            On this page
          </p>
          <ul className="page-outline__list">
            {items.map((item) => (
              <li key={item.id} data-level={item.level}>
                <a
                  href={`#${item.id}`}
                  className="page-outline__link"
                  aria-current={item.id === activeId ? 'location' : undefined}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
