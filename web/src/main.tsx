import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/syne/index.css';
import '@fontsource-variable/space-grotesk/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import '@fontsource-variable/cinzel/index.css';
import '@fontsource-variable/eb-garamond/index.css';
import '@fontsource-variable/caveat/index.css';
import '@fontsource-variable/fraunces/index.css';
import '@fontsource-variable/fredoka/index.css';
import './styles/themes.css';
import './styles/base.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
