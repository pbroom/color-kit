import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app.js';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
