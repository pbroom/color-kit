import { ComponentPreview } from './component-preview.js';
import { ApiTable } from './api-table.js';
import type { ComponentDocData } from '@/content/components/component-docs-data';
import { createElement } from 'react';

export function ComponentDocPage({ doc }: { doc: ComponentDocData }) {
  const Demo = doc.demo;

  return (
    <article data-doc-content="">
      <p className="docs-kicker">React Primitive</p>
      <h1 id="overview">{doc.title}</h1>
      <p className="docs-lede">{doc.summary}</p>
      <p>{doc.description}</p>

      <section id="installation">
        <h2>Installation</h2>
        <p>Install from npm or pull the source via the shadcn registry.</p>
        <div className="docs-install-grid">
          <div>
            <p className="docs-code-label">npm / pnpm</p>
            <pre>
              <code>pnpm add @color-kit/react @color-kit/core</code>
            </pre>
          </div>
          <div>
            <p className="docs-code-label">shadcn registry</p>
            <pre>
              <code>{`npx shadcn add ${doc.registryName} --registry color-kit`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section id="features">
        <h2>Features</h2>
        <ul>
          {doc.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section id="demo">
        <h2>Demo</h2>
        <ComponentPreview>
          {createElement(Demo, {
            ...(doc.supportsPropertiesPanel
              ? { inspectorDriven: true as const }
              : {}),
          })}
        </ComponentPreview>
      </section>

      <section id="anatomy">
        <h2>Anatomy</h2>
        <pre>
          <code>{doc.anatomy}</code>
        </pre>
      </section>

      <section id="usage">
        <h2>Usage</h2>
        <pre>
          <code>{doc.usage}</code>
        </pre>
      </section>

      <section id="api-reference">
        <h2>API Reference</h2>
        <ApiTable rows={doc.props} />
      </section>

      <section id="accessibility">
        <h2>Accessibility</h2>
        <ul>
          {doc.accessibility.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section id="helpers">
        <h2>Non-UI API Helpers</h2>
        {doc.helperApis.length > 0 ? (
          <ul>
            {doc.helperApis.map((api) => (
              <li key={api}>
                <code>{api}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>This primitive does not currently require helper functions.</p>
        )}
      </section>
    </article>
  );
}
