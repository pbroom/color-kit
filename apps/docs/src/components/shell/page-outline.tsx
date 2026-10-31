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
 * "On this page": the `h2[id]`/`h3[id]` headings of the article, plus any
 * `[id][data-outline]` target such as an API table row, read from
 * the DOM so MDX and TSX (API) pages share it. Anything inside a
 * `[data-outline-ignore]` region (an API row's panel) is left out. It renders empty on the server
 * and fills in after hydration; the column's width is reserved either way, so
 * nothing shifts. The item scrolled up to its anchor line is marked.
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
          article.querySelectorAll<HTMLElement>(
            'h2[id], h3[id], [id][data-outline]',
          ),
        )
          .filter((target) => !target.closest('[data-outline-ignore]'))
          .map((target) => ({
            id: target.id,
            // Non-heading targets (API table rows) name themselves.
            text: target.dataset.outline ?? target.textContent?.trim() ?? '',
            level: target.tagName === 'H3' ? (3 as const) : (2 as const),
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
    // The current item is the last one whose top has reached the line it
    // scrolls to (the page's scroll-padding-top plus its scroll-margin-top). Checking "first one in a band"
    // instead marked the row above a sidebar jump's target, which still
    // peeks into the band when rows are short.
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const padding =
          parseFloat(
            getComputedStyle(document.documentElement).scrollPaddingTop,
          ) || 0;
        let current: string | null = items[0]?.id ?? null;
        for (const item of items) {
          const target = document.getElementById(item.id);
          if (!target) continue;
          const line =
            padding +
            (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
          if (target.getBoundingClientRect().top <= line + 4) {
            current = item.id;
          } else {
            break;
          }
        }
        setActiveId(current);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('hashchange', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('hashchange', update);
    };
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
