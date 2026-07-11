import { useEffect } from 'react';

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
}

function setCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!url) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

export function usePageMetadata({
  title,
  description = '',
  robots = 'noindex, nofollow',
  canonicalPath = '',
  imagePath = '',
  structuredData = null,
}) {
  useEffect(() => {
    if (title) document.title = title;
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title || 'Nexo PDV' });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title || 'Nexo PDV' });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });

    const origin = window.location.origin;
    const canonical = canonicalPath ? new URL(canonicalPath, origin).toString() : '';
    setCanonical(canonical);
    if (canonical) upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    if (imagePath) {
      const image = new URL(imagePath, origin).toString();
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
    }

    const scriptId = 'nexo-structured-data';
    document.getElementById(scriptId)?.remove();
    if (structuredData) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [canonicalPath, description, imagePath, robots, structuredData, title]);
}
