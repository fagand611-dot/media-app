import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export const MEDIA = {
  movie: { label: 'Film', plural: 'Films', icon: '🎬', hue: 350 },
  tv: { label: 'TV', plural: 'TV', icon: '📺', hue: 210 },
  book: { label: 'Book', plural: 'Books', icon: '📚', hue: 35 },
  music: { label: 'Album', plural: 'Music', icon: '🎧', hue: 150 },
};

export const STATUS_LABEL = { upcoming: 'Upcoming', in_production: 'In production', announced: 'Announced', released: 'Released' };
export const STATE_LABEL = { want: 'Want', in_progress: 'In progress', done: 'Done', dismissed: 'Not for me' };

/** Load JSON from the API; returns { data, error, loading, reload, setData }. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true }));
    api.get(path).then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => setState({ data: null, error, loading: false })
    );
  }, [path]);
  useEffect(load, [load]);
  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

export function Loading({ state, children }) {
  if (state.error) return <p className="error">{state.error.message}</p>;
  if (!state.data) return <p className="muted">Loading…</p>;
  return children(state.data);
}

/** Cover image, or a generated tile when there isn't one (or it fails to load). */
export function Cover({ item, className = '' }) {
  const [failed, setFailed] = useState(false);
  const m = MEDIA[item.medium] || MEDIA.movie;
  if (item.image_url && !failed) {
    return <img className={`cover ${className}`} src={item.image_url} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  // Stable hue jitter from the title so tiles don't all look the same.
  let h = 0;
  for (const c of item.title) h = (h * 31 + c.charCodeAt(0)) % 360;
  const hue = (m.hue + (h % 50) - 25 + 360) % 360;
  return (
    <div className={`cover gen ${className}`} style={{ '--h': hue }} aria-hidden>
      <span className="gen-icon">{m.icon}</span>
      <span className="gen-title">{item.title}</span>
    </div>
  );
}

export function MediumBadge({ medium }) {
  const m = MEDIA[medium];
  return <span className={`badge m-${medium}`}>{m.icon} {m.label}</span>;
}

export function MediumTabs({ value, onChange, all = 'Everything' }) {
  return (
    <div className="tabs" role="tablist">
      <button role="tab" aria-selected={!value} className={!value ? 'on' : ''} onClick={() => onChange(null)}>{all}</button>
      {Object.entries(MEDIA).map(([k, m]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {m.icon} {m.plural}
        </button>
      ))}
    </div>
  );
}

/** 1–10 score picker. */
export function ScorePicker({ value, onChange, compact }) {
  return (
    <div className={`score-picker ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Score out of 10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={value != null && n <= value ? 'on' : ''}
          style={{ '--n': n }}
          onClick={() => onChange(value === n ? null : n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function Score({ score }) {
  if (score == null) return null;
  const tier = score >= 8 ? 'hi' : score >= 5 ? 'mid' : 'lo';
  return <span className={`score ${tier}`}>{score}<small>/10</small></span>;
}

export function Reasons({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <ul className="reasons">
      {reasons.map((r, i) =>
        r.type === 'because' ? (
          <li key={i}>
            Because you loved <Link to={`/item/${r.itemId}`}>{r.title}</Link>
            {r.tags?.length ? <span className="muted"> · {r.tags.join(', ')}</span> : null}
          </li>
        ) : r.type === 'tags' ? (
          <li key={i}>Matches your taste for <b>{r.tags.join(', ')}</b></li>
        ) : (
          <li key={i} className="friend">👥 {r.name} rated it <b>{r.score}/10</b></li>
        )
      )}
    </ul>
  );
}

export function Tags({ item }) {
  return (
    <div className="tags">
      {item.genres.map((g) => <span key={g} className="tag">{g}</span>)}
      {item.moods.map((m) => <span key={m} className="tag mood">{m}</span>)}
    </div>
  );
}

/**
 * Item card with quick actions. `entry` is the user's library entry, if any.
 * onChange(entry | null) fires after a successful update.
 */
export function ItemCard({ item, entry, match, reasons, children, onChange, hideActions }) {
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(false);
  const save = async (body) => {
    setBusy(true);
    try {
      const { entry: e } = await api.put(`/library/${item.id}`, body);
      onChange?.(e);
    } finally {
      setBusy(false);
      setRating(false);
    }
  };
  const unwant = async () => {
    setBusy(true);
    try {
      await api.del(`/library/${item.id}`);
      onChange?.(null);
    } finally {
      setBusy(false);
    }
  };
  const upcoming = item.status !== 'released';
  return (
    <article className={`card ${entry?.state === 'dismissed' ? 'dim' : ''}`}>
      <Link to={`/item/${item.id}`} className="card-cover">
        <Cover item={item} />
        {match != null && <span className="match">{match}% match</span>}
      </Link>
      <div className="card-body">
        <div className="card-meta">
          <MediumBadge medium={item.medium} />
          {upcoming && <span className="badge status">{STATUS_LABEL[item.status]}{item.release_date ? ` · ${item.release_date}` : ''}</span>}
          {item.is_demo && <span className="badge demo" title="Sample data, not a real title">demo</span>}
        </div>
        <h3><Link to={`/item/${item.id}`}>{item.title}</Link></h3>
        <p className="sub">
          {[item.creators.slice(0, 2).join(', '), item.year].filter(Boolean).join(' · ')}
        </p>
        <Reasons reasons={reasons} />
        {children}
        {!hideActions && (
          <div className="actions">
            {rating ? (
              <ScorePicker compact value={entry?.score} onChange={(s) => save({ score: s, state: s == null ? 'want' : 'done' })} />
            ) : (
              <>
                {!upcoming && (
                  <button disabled={busy} onClick={() => setRating(true)}>
                    {entry?.score ? <>Rated <b>{entry.score}</b></> : '★ Rate'}
                  </button>
                )}
                {!entry?.score && <button disabled={busy} className={entry?.state === 'want' ? 'on' : ''} onClick={() => (entry?.state === 'want' ? unwant() : save({ state: 'want', score: null }))}>
                  {upcoming ? (entry?.state === 'want' ? '✓ Watching' : '🔔 Watch') : entry?.state === 'want' ? '✓ Want' : '+ Want'}
                </button>}
                {!entry && (
                  <button disabled={busy} className="ghost" title="Not for me" onClick={() => save({ state: 'dismissed' })}>✕</button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function timeAgo(iso) {
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  for (const [n, u] of [[86400 * 365, 'y'], [86400 * 30, 'mo'], [86400 * 7, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']]) {
    if (s >= n) return `${Math.floor(s / n)}${u} ago`;
  }
  return 'just now';
}
