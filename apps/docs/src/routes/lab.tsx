import { useState } from 'react';
import { LAB_PAGE_NAVIGATION, LazyActiveLabPage } from './lab/page-registry.js';
import { LabPageFrame, type LabPageKey } from './lab/shared.js';

function appendVisitedPage(
  pages: readonly LabPageKey[],
  page: LabPageKey,
): readonly LabPageKey[] {
  return pages.includes(page) ? pages : [...pages, page];
}

export function LabPage() {
  const [activePage, setActivePage] = useState<LabPageKey>('plane');
  const [visitedPages, setVisitedPages] = useState<readonly LabPageKey[]>([
    'plane',
  ]);

  const handlePageChange = (page: LabPageKey) => {
    setActivePage(page);
    setVisitedPages((pages) => appendVisitedPage(pages, page));
  };

  return (
    <LabPageFrame
      activePage={activePage}
      onPageChange={handlePageChange}
      pages={LAB_PAGE_NAVIGATION}
    >
      {visitedPages.map((page) => (
        <LazyActiveLabPage
          key={page}
          activePage={page}
          isActive={page === activePage}
        />
      ))}
    </LabPageFrame>
  );
}
