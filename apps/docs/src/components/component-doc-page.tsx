import { createElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ComponentDocData } from '@/content/components/component-docs-data';
import { ApiTable } from './api-table.js';
import { ComponentPreview } from './component-preview.js';

function CommandCard({ label, command }: { label: string; command: string }) {
  return (
    <Card className="h-full border-border/70 bg-card/80 shadow-xs">
      <CardHeader className="pb-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
      </CardHeader>
      <CardContent>
        <pre className="m-0 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-sm">
          <code>{command}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

export function ComponentDocPage({ doc }: { doc: ComponentDocData }) {
  const Demo = doc.demo;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <Badge variant="secondary" className="w-fit">
          React Primitive
        </Badge>
        <div className="space-y-3">
          <h1 id="overview" className="scroll-mt-24">
            {doc.title}
          </h1>
          <p className="text-lg text-muted-foreground">{doc.summary}</p>
          <p>{doc.description}</p>
        </div>
      </header>

      <Separator />

      <section id="installation" className="scroll-mt-24 space-y-4">
        <h2>Installation</h2>
        <p>Install from npm or pull the source via the shadcn registry.</p>
        <div className="not-prose grid gap-4 md:grid-cols-2">
          <CommandCard
            label="npm / pnpm"
            command="pnpm add @color-kit/react @color-kit/core"
          />
          <CommandCard
            label="shadcn registry"
            command={`npx shadcn add ${doc.registryName} --registry color-kit`}
          />
        </div>
      </section>

      <section id="features" className="scroll-mt-24 space-y-4">
        <h2>Features</h2>
        <ul>
          {doc.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section id="demo" className="scroll-mt-24 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0">Demo</h2>
          {doc.supportsPropertiesPanel ? (
            <Badge variant="outline">Live inspector controls</Badge>
          ) : null}
        </div>
        <ComponentPreview>
          {createElement(Demo, {
            ...(doc.supportsPropertiesPanel
              ? { inspectorDriven: true as const }
              : {}),
          })}
        </ComponentPreview>
      </section>

      <section id="anatomy" className="scroll-mt-24 space-y-4">
        <h2>Anatomy</h2>
        <pre>
          <code>{doc.anatomy}</code>
        </pre>
      </section>

      <section id="usage" className="scroll-mt-24 space-y-4">
        <h2>Usage</h2>
        <pre>
          <code>{doc.usage}</code>
        </pre>
      </section>

      <section id="api-reference" className="scroll-mt-24 space-y-4">
        <h2>API Reference</h2>
        <ApiTable rows={doc.props} />
      </section>

      <section id="accessibility" className="scroll-mt-24 space-y-4">
        <h2>Accessibility</h2>
        <ul>
          {doc.accessibility.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="helpers" className="scroll-mt-24 space-y-4">
        <h2>Non-UI API Helpers</h2>
        {doc.helperApis.length > 0 ? (
          <Card className="not-prose border-border/70 bg-card/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Helper functions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="m-0 list-disc space-y-2 pl-5 text-sm">
                {doc.helperApis.map((api) => (
                  <li key={api}>
                    <code>{api}</code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <p>This primitive does not currently require helper functions.</p>
        )}
      </section>
    </div>
  );
}
