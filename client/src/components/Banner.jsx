// A "Signal lost"-voiced message strip. Used for errors, warnings, and notes.
export default function Banner({ kind = 'error', title, hint, children, onClose }) {
  return (
    <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span aria-hidden>{kind === 'error' ? '▚' : kind === 'warn' ? '△' : 'ℹ'}</span>
      <div style={{ flex: 1 }}>
        {title && <div className="b-title">{title}</div>}
        {children}
        {hint && <div className="b-hint">{hint}</div>}
      </div>
      {onClose && (
        <button className="iconbtn sm" onClick={onClose} aria-label="Dismiss" style={{ width: 26, height: 26 }}>×</button>
      )}
    </div>
  );
}
