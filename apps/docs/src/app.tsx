import { Routes, Route } from 'react-router';
import { DocsLayout } from './components/docs-layout.js';
import { HomePage } from './routes/index.js';
import { DocsPage } from './routes/docs.js';

export function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="docs" element={<DocsLayout />}>
        <Route path=":slug" element={<DocsPage />} />
        <Route path=":category/:slug" element={<DocsPage />} />
      </Route>
    </Routes>
  );
}
