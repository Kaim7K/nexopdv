import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * @param {{onClose?: () => void, disabled?: boolean, closeOnEscape?: boolean, active?: boolean}} options
 */
export function useModalBehavior({ onClose, disabled = false, closeOnEscape = true, active = true } = {}) {
  const modalRef = useRef(null);
  const closeRef = useRef(onClose);
  const disabledRef = useRef(disabled);
  closeRef.current = onClose;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!active) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const modal = modalRef.current;
      if (!modal || modal.contains(document.activeElement)) return;
      const initial = modal.querySelector('[autofocus]') || modal.querySelector(FOCUSABLE);
      initial?.focus();
    }, 0);

    const handleKeyDown = event => {
      const modal = modalRef.current;
      if (!modal) return;
      if (event.key === 'Escape' && closeOnEscape && !disabledRef.current) {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll(FOCUSABLE)].filter(element => !element.hidden && element.getClientRects().length);
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [active, closeOnEscape]);

  return modalRef;
}
