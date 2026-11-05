import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** @type {null | (() => void)} */
let activeTooltip = null;

/**
 * @param {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   label: string,
 *   variant?: 'default' | 'danger',
 *   compact?: boolean,
 *   wrapperClassName?: string
 * }} props
 */
export default function IconButton({ label, children, variant = 'default', compact = false, wrapperClassName = '', className = '', onFocus, onBlur, onClick, ...props }) {
  const anchor = useRef(null);
  const bubble = useRef(null);
  const hideTimer = useRef(null);
  const id = useId();
  const [position, setPosition] = useState(null);
  const dismissSelf = useRef(() => setPosition(null));
  const hovered = useRef(false);
  const focused = useRef(false);

  const show = () => {
    if (activeTooltip !== dismissSelf.current) activeTooltip?.();
    activeTooltip = dismissSelf.current;
    window.clearTimeout(hideTimer.current);
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const below = rect.top < 64;
    setPosition({
      left: Math.max(12, Math.min(rect.left + rect.width / 2, window.innerWidth - 12)),
      top: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
  };
  const hideIfInactive = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!hovered.current && !focused.current) setPosition(null);
    }, 120);
  };

  useEffect(() => () => {
    window.clearTimeout(hideTimer.current);
    if (activeTooltip === dismissSelf.current) activeTooltip = null;
  }, []);

  useLayoutEffect(() => {
    if (!position) return;
    const rect = bubble.current?.getBoundingClientRect();
    if (!rect) return;
    const shift = rect.left < 8 ? 8 - rect.left : rect.right > window.innerWidth - 8 ? window.innerWidth - 8 - rect.right : 0;
    if (Math.abs(shift) > 1) setPosition(current => ({ ...current, left: current.left + shift }));
    if (rect.top < 8 && !position.below) {
      setPosition(current => ({ ...current, below: true, top: anchor.current.getBoundingClientRect().bottom + 8 }));
    }
  }, [position]);

  useEffect(() => {
    if (!position) return undefined;
    const dismiss = () => setPosition(null);
    const move = () => { if (focused.current && activeTooltip === dismissSelf.current) show(); else dismiss(); };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    window.addEventListener('scroll', move, true);
    window.addEventListener('resize', move);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('scroll', move, true);
      window.removeEventListener('resize', move);
      window.removeEventListener('keydown', escape, true);
    };
  }, [position]);

  return (
    <span
      ref={anchor}
      className={`icon-action ${compact ? 'icon-action-compact' : ''} ${wrapperClassName}`}
      onMouseEnter={() => { hovered.current = true; show(); }}
      onMouseLeave={() => { hovered.current = false; hideIfInactive(); }}
    >
      <button
        {...props}
        type={props.type || 'button'}
        aria-label={label}
        aria-describedby={position ? id : undefined}
        className={`icon-button ${variant === 'danger' ? 'icon-button-danger' : ''} ${className}`}
        onFocus={(event) => { focused.current = true; show(); onFocus?.(event); }}
        onBlur={(event) => { focused.current = false; hideIfInactive(); onBlur?.(event); }}
        onClick={(event) => { setPosition(null); onClick?.(event); }}
      >
        {children}
      </button>
      {position && createPortal(
        <span
          id={id}
          ref={bubble}
          role="tooltip"
          className={`action-tooltip ${position.below ? 'action-tooltip-below' : ''}`}
          style={{ left: position.left, top: position.top }}
          onMouseEnter={() => { hovered.current = true; window.clearTimeout(hideTimer.current); }}
          onMouseLeave={() => { hovered.current = false; hideIfInactive(); }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
