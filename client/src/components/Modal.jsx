import { useEffect, useRef } from 'react';

// Generic modal shell: closes on Escape, on click outside the panel, and on the
// explicit close button. Focus is trapped loosely by focusing the panel.
export default function Modal({ title, onClose, children, footer, narrow }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    // lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`modal ${narrow ? 'narrow' : ''}`}
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
      >
        {title !== undefined && (
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="iconbtn" onClick={onClose} aria-label="Close">×</button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
