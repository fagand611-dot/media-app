import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Icon from './Icon.jsx';
import { Cover, MediumBadge, STATUS_LABEL, ScorePicker } from './ui.jsx';

// App-wide quick actions: a sheet for rating / wanting / skipping any item
// (a bottom sheet on phones, a dialog on desktop), plus small toasts.
const Ctx = createContext(null);
export const useActions = () => useContext(Ctx);

export function ActionsProvider({ children }) {
  const [sheet, setSheet] = useState(null); // { item, entry, onChange }
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((text) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);
  const open = useCallback((item, entry, onChange) => setSheet({ item, entry, onChange }), []);

  return (
    <Ctx.Provider value={{ open, toast }}>
      {children}
      {sheet && <QuickSheet {...sheet} toast={toast} onClose={() => setSheet(null)} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="toast"><Icon name="check" size={16} /> {t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}

/** Save a library change and report it; shared by the sheet and inline buttons. */
export async function saveEntry(item, body, toast) {
  if (body === null) {
    await api.del(`/library/${item.id}`);
    toast?.('Removed');
    return null;
  }
  const { entry } = await api.put(`/library/${item.id}`, body);
  if (toast) {
    if (entry.state === 'dismissed') toast('Got it, we’ll show less like this');
    else if (body.score) toast(`Rated ${body.score}/10`);
    else if (entry.state === 'want') toast(item.status === 'released' ? 'Added to Want' : 'Watching for release');
  }
  return entry;
}

function QuickSheet({ item, entry, onChange, onClose, toast }) {
  const [current, setCurrent] = useState(entry || null);
  const ref = useRef(null);
  const released = item.status === 'released';

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = async (body, close = true) => {
    const e = await saveEntry(item, body, toast);
    setCurrent(e);
    onChange?.(e);
    if (close) onClose();
  };
  const wanting = current?.state === 'want';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item.title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <Cover item={item} className="sheet-cover" />
          <div>
            <MediumBadge medium={item.medium} />
            <h3>{item.title}</h3>
            <p className="muted small">
              {[item.creators.slice(0, 2).join(', '), item.year].filter(Boolean).join(' · ')}
              {!released && ` · ${STATUS_LABEL[item.status]}${item.release_date ? ` ${item.release_date}` : ''}`}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>

        {released && (
          <div className="sheet-section">
            <span className="label">{current?.score ? 'Your score' : 'Seen it? Rate it'}</span>
            <ScorePicker value={current?.score ?? null} onChange={(s) => act(s ? { score: s, state: 'done' } : null)} />
          </div>
        )}

        <div className="sheet-actions">
          {!current?.score && (
            <button className={`btn ${wanting ? 'btn-soft on' : 'btn-primary'}`} onClick={() => act(wanting ? null : { state: 'want' })}>
              <Icon name={released ? (wanting ? 'check' : 'plus') : 'bell'} size={18} />
              {released ? (wanting ? 'In your Want list' : 'Want to try') : wanting ? 'Watching' : 'Watch for release'}
            </button>
          )}
          {current?.state !== 'dismissed' && (
            <button className="btn btn-soft" onClick={() => act({ state: 'dismissed' })}>
              <Icon name="x" size={18} /> Not for me
            </button>
          )}
          <Link className="btn btn-ghost" to={`/item/${item.id}`} onClick={onClose}>
            Details & reviews <Icon name="chevron" size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
