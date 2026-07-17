import { TooltipProvider } from '@color-kit/control-kit';
import { Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeSwitcher } from '../../../components/theme-switcher.js';
import {
  LabPageSlotProvider,
  useLabPageSlotContent,
} from '../lab-page-slots.js';
import type { LabPageKey, LabPageNavigationItem } from '../types.js';

export const LAB_PANEL_SCROLL_AREA_CLASS =
  'h-full w-full min-w-0 max-w-full overflow-hidden [&>[data-radix-scroll-area-viewport]]:w-full [&>[data-radix-scroll-area-viewport]]:min-w-0 [&>[data-radix-scroll-area-viewport]]:max-w-full [&>[data-radix-scroll-area-viewport]]:overflow-x-hidden [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full [&>[data-radix-scroll-area-viewport]>div]:!min-w-0 [&>[data-radix-scroll-area-viewport]>div]:!max-w-full';

export type LabPageFrameProps = {
  activePage: LabPageKey;
  onPageChange: (page: LabPageKey) => void;
  pages: readonly LabPageNavigationItem[];
  children: ReactNode;
};

function PagesPanel({
  activePage,
  onPageChange,
  pages,
}: {
  activePage: LabPageKey;
  onPageChange: (page: LabPageKey) => void;
  pages: readonly LabPageNavigationItem[];
}) {
  const [isSiteNavOpen, setIsSiteNavOpen] = useState(false);

  return (
    <div className="absolute left-4 top-4 z-20 w-[190px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={
            isSiteNavOpen ? 'Hide site navigation' : 'Show site navigation'
          }
          aria-expanded={isSiteNavOpen}
          aria-controls="lab-site-nav"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white/65 outline-none transition-[background-color,color] hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-[#5288db]"
          onClick={() => setIsSiteNavOpen((current) => !current)}
        >
          <Menu aria-hidden="true" className="size-4" />
        </button>
        <Link
          to="/"
          className="flex min-w-0 items-center rounded-lg px-1 py-1 font-[var(--font-brand)] text-[15px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#5288db]"
        >
          <span className="truncate">color kit</span>
        </Link>
        <div className="ml-auto [&_[data-slot=button]]:size-8 [&_[data-slot=button]]:min-h-8 [&_[data-slot=button]]:rounded-xl [&_[data-slot=button]]:text-white/65 [&_[data-slot=button]]:hover:bg-white/8 [&_[data-slot=button]]:hover:text-white">
          <ThemeSwitcher />
        </div>
      </div>
      <nav
        id="lab-site-nav"
        aria-label="Site navigation"
        className="mt-3"
        hidden={!isSiteNavOpen}
      >
        <div className="space-y-0.5">
          {[
            { label: 'Docs', to: '/docs/introduction' },
            { label: 'Components', to: '/docs/components/color-area' },
            { label: 'Registry', to: '/docs/shadcn-registry' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex w-full items-center rounded-lg px-1 py-1.5 text-left text-sm font-medium text-white/55 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#5288db]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="mt-3 space-y-0.5">
        {pages.map((page) => {
          const isActive = activePage === page.value;
          return (
            <button
              key={page.value}
              type="button"
              className={`flex w-full items-center rounded-lg px-1 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#5288db] ${
                isActive
                  ? 'font-semibold text-white'
                  : 'font-medium text-white/55 hover:text-white/80'
              }`}
              aria-pressed={isActive}
              onClick={() => onPageChange(page.value)}
            >
              {page.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LabHeaderExit() {
  return (
    <div
      aria-hidden="true"
      className="ck-lab-header-exit pointer-events-none fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl [animation:ck-lab-header-slide-up_320ms_ease-out_forwards]"
    >
      <div className="mx-auto flex h-14 w-full max-w-[1560px] items-center justify-between gap-4 px-4">
        <div className="docs-brand">
          <span className="docs-brand-dot" />
          Color Kit
        </div>
      </div>
    </div>
  );
}

function LabPagePreviewFallback() {
  return (
    <div className="size-full min-h-[320px] animate-pulse rounded-[24px] bg-white/[0.04]" />
  );
}

function LabPagePropertiesFallback() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
      <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
      <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>
  );
}

function LabPageFrameContent({
  activePage,
  onPageChange,
  pages,
  children,
}: LabPageFrameProps) {
  const { panelTooltipProviderProps, preview, properties } =
    useLabPageSlotContent();

  return (
    <div className="min-h-screen overflow-hidden bg-[#171717]">
      <LabHeaderExit />

      <main className="h-screen min-h-screen min-w-0 bg-[#171717] [--ck-lab-segmented-active-bg:#171717] text-white lg:overflow-hidden">
        <div className="grid min-h-screen min-w-0 grid-cols-1 lg:h-full lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative flex min-h-[420px] min-w-0 items-center justify-center overflow-hidden px-6 py-10 lg:min-h-0 lg:py-14">
            <PagesPanel
              activePage={activePage}
              onPageChange={onPageChange}
              pages={pages}
            />
            {preview ?? <LabPagePreviewFallback />}
          </section>

          <aside className="min-w-0 max-w-full overflow-hidden border-t border-white/8 p-3 lg:min-h-0 lg:border-t-0 lg:p-4">
            <div className="h-full w-full min-w-0 max-w-full overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.03] [--ck-lab-segmented-active-bg:color-mix(in_srgb,#171717_97%,white_3%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur lg:min-h-0">
              <ScrollArea className={LAB_PANEL_SCROLL_AREA_CLASS}>
                <TooltipProvider
                  delayDuration={panelTooltipProviderProps.delayDuration}
                  skipDelayDuration={
                    panelTooltipProviderProps.skipDelayDuration
                  }
                >
                  <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden p-4">
                    {properties ?? <LabPagePropertiesFallback />}
                  </div>
                </TooltipProvider>
              </ScrollArea>
            </div>
          </aside>
        </div>
      </main>
      {children}
    </div>
  );
}

export function LabPageFrame(props: LabPageFrameProps) {
  return (
    <LabPageSlotProvider>
      <LabPageFrameContent {...props} />
    </LabPageSlotProvider>
  );
}
