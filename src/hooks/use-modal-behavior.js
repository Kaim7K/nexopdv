import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let activeScrollLocks = 0;
let scrollSnapshot = null;

function lockBackgroundScroll() {
  activeScrollLocks += 1;
  if (activeScrollLocks > 1) return;

  const root = document.documentElement;
  const body = document.body;
  /** @type {HTMLElement | null} */
  const scrollContainer = document.querySelector('[data-app-scroll-container]');

  scrollSnapshot = {
    rootOverflow: root.style.overflow,
    rootOverscroll: root.style.overscrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyOverscroll: body.style.overscrollBehavior,
    scrollContainer,
    containerOverflow: scrollContainer?.style.overflow,
    containerOverscroll: scrollContainer?.style.overscrollBehavior,
  };

  root.style.overflow = 'hidden';
  root.style.overscrollBehavior = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  if (scrollContainer) {
    scrollContainer.style.overflow = 'hidden';
    scrollContainer.style.overscrollBehavior = 'none';
  }
  body.dataset.modalOpen = 'true';
}

function unlockBackgroundScroll() {
  activeScrollLocks = Math.max(0, activeScrollLocks - 1);
  if (activeScrollLocks || !scrollSnapshot) return;

  const root = document.documentElement;
  const body = document.body;
  root.style.overflow = scrollSnapshot.rootOverflow;
  root.style.overscrollBehavior = scrollSnapshot.rootOverscroll;
  body.style.overflow = scrollSnapshot.bodyOverflow;
  body.style.overscrollBehavior = scrollSnapshot.bodyOverscroll;
  if (scrollSnapshot.scrollContainer?.isConnected) {
    scrollSnapshot.scrollContainer.style.overflow = scrollSnapshot.containerOverflow || '';
    scrollSnapshot.scrollContainer.style.overscrollBehavior = scrollSnapshot.containerOverscroll || '';
  }
  delete body.dataset.modalOpen;
  scrollSnapshot = null;
}

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
    lockBackgroundScroll();

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
      unlockBackgroundScroll();
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [active, closeOnEscape]);

  return modalRef;
}
