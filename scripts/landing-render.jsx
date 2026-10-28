import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import Landing, { getLandingStructuredData } from '../src/pages/Landing';

// Deliberately excludes App, auth providers, API clients and private routes.
export function renderLanding() {
  return {
    html: renderToString(<StaticRouter location="/"><Landing /></StaticRouter>),
    structuredData: getLandingStructuredData(),
  };
}
