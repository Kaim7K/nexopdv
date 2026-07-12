const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|heic|heif|jfif|jpe?g|png|svg|webp)(\?|#|$)/i;

export function isLikelyImageUrl(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^data:image\//i.test(text)) return true;
  if (!/^https?:\/\//i.test(text)) return false;
  try {
    const url = new URL(text);
    return IMAGE_EXTENSIONS.test(url.pathname) || Boolean(url.search) || Boolean(url.hash);
  } catch {
    return false;
  }
}

export function watchClipboardForImageUrl(onPaste) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    return () => {};
  }

  let active = true;
  let completed = false;

  const cleanup = () => {
    if (!active) return;
    active = false;
    window.removeEventListener('focus', handleActiveState);
    document.removeEventListener('visibilitychange', handleActiveState);
  };

  const handleActiveState = () => {
    if (!active || completed) return;
    const isVisible = document.visibilityState === 'visible';
    if (!isVisible && document.hasFocus && !document.hasFocus()) return;
    window.setTimeout(async () => {
      if (!active || completed) return;
      try {
        const text = await navigator.clipboard.readText();
        if (!active || completed) return;
        if (!isLikelyImageUrl(text)) return;
        completed = true;
        cleanup();
        onPaste(String(text).trim());
      } catch {
        // O navegador pode bloquear o clipboard; nesse caso seguimos sem autofill.
      }
    }, 120);
  };

  window.addEventListener('focus', handleActiveState);
  document.addEventListener('visibilitychange', handleActiveState);
  return cleanup;
}

export async function readClipboardImageUrl() {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    throw new Error('Seu navegador nao permite acessar a area de transferencia.');
  }
  const text = String(await navigator.clipboard.readText() || '').trim();
  if (!isLikelyImageUrl(text)) {
    throw new Error('A area de transferencia nao contem uma URL valida de imagem.');
  }
  return text;
}
