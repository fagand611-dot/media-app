import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Icon, { MEDIUM_ICON } from './Icon.jsx';
import { saveEntry, useActions } from './actions.jsx';

// `hue` drives the generated posters; each medium has its own colour family.
export const MEDIA = {
  movie: { label: 'Film', plural: 'Film', hue: 12 },
  tv: { label: 'TV', plural: 'TV', hue: 215 },
  book: { label: 'Book', plural: 'Books', hue: 38 },
  music: { label: 'Album', plural: 'Music', hue: 158 },
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
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

export function Loading({ state, children }) {
  if (state.error) return <p className="error">{state.error.message}</p>;
  if (!state.data) return <div className="skeleton" aria-label="Loading"><span /><span /><span /></div>;
  return children(state.data);
}

/**
 * Cover image, or (when there isn't one, or it fails to load) a typographic
 * poster: medium colour, title in serif, and one of a few graphic motifs
 * chosen from the title so posters are easy to tell apart at a glance.
 */
export function Cover({ item, className = '' }) {
  const [failed, setFailed] = useState(false);
  const m = MEDIA[item.medium] || MEDIA.movie;
  if (item.image_url && !failed) {
    return <img className={`cover ${className}`} src={item.image_url} alt="" loading="lazy" onError={() => setFailed(true)} />;
  }
  let h = 0;
  for (const c of item.title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = (m.hue + (h % 36) - 18 + 360) % 360;
  const tone = 24 + (h % 5) * 4; // lightness: 24–40%
  const motif = ['orb', 'bands', 'arc', 'split', 'ring'][h % 5];
  const creator = item.creators?.[0];
  return (
    <div className={`cover poster motif-${motif} ${className}`} style={{ '--h': hue, '--l': `${tone}%` }} aria-hidden>
      <span className="poster-kicker">
        <Icon name={MEDIUM_ICON[item.medium]} size={12} />
        {[m.label, item.year].filter(Boolean).join(' · ')}
      </span>
      <span className="poster-title">{item.title}</span>
      {creator && <span className="poster-by">{creator}</span>}
    </div>
  );
}

export function MediumBadge({ medium }) {
  const m = MEDIA[medium];
  return <span className={`badge m-${medium}`}><Icon name={MEDIUM_ICON[medium]} size={13} /> {m.label}</span>;
}

/** Segmented control for filtering by medium. */
export function MediumTabs({ value, onChange, all = 'All' }) {
  return (
    <div className="seg" role="tablist" aria-label="Filter by medium">
      <button role="tab" aria-selected={!value} className={!value ? 'on' : ''} onClick={() => onChange(null)}>{all}</button>
      {Object.entries(MEDIA).map(([k, m]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          <Icon name={MEDIUM_ICON[k]} size={15} /> <span>{m.plural}</span>
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
  return <span className={`score ${tier}`}><Icon name="star" size={12} />{score}</span>;
}

export function Reasons({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <ul className="reasons">
      {reasons.map((r, i) =>
        r.type === 'because' ? (
          <li key={i}>
            <Icon name="heart" size={14} /> <span>Because you loved <Link to={`/item/${r.itemId}`}>{r.title}</Link>
            {r.tags?.length ? <span className="muted"> · {r.tags.join(', ')}</span> : null}</span>
          </li>
        ) : r.type === 'tags' ? (
          <li key={i}><Icon name="sparkle" size={14} /> <span>Matches your taste for <b>{r.tags.join(', ')}</b></span></li>
        ) : (
          <li key={i} className="friend"><Icon name="users" size={14} /> <span>{r.name} rated it <b>{r.score}/10</b></span></li>
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
 * Item card for grids. Tapping the poster opens the item; the buttons give
 * one-tap Want / Not for me, and Rate opens the quick-action sheet.
 * `entry` is the user's library entry, if any; onChange(entry | null) fires after a change.
 */
export function ItemCard({ item, entry, match, reasons, children, onChange, hideActions }) {
  const { open, toast } = useActions();
  const [busy, setBusy] = useState(false);
  const save = async (body) => {
    setBusy(true);
    try {
      onChange?.(await saveEntry(item, body, toast));
    } finally {
      setBusy(false);
    }
  };
  const upcoming = item.status !== 'released';
  const wanting = entry?.state === 'want';
  return (
    <article className={`card ${entry?.state === 'dismissed' ? 'dim' : ''}`}>
      <Link to={`/item/${item.id}`} className="card-cover">
        <Cover item={item} />
        {match != null && <span className="match">{match}% match</span>}
      </Link>
      <div className="card-body">
        <div className="card-meta">
          <MediumBadge medium={item.medium} />
          {upcoming && <span className="badge status"><Icon name="clock" size={12} /> {STATUS_LABEL[item.status]}{item.release_date ? ` · ${item.release_date}` : ''}</span>}
          {item.is_demo && <span className="badge demo" title="Sample data, not a real title">demo</span>}
        </div>
        <h3><Link to={`/item/${item.id}`}>{item.title}</Link></h3>
        <p className="sub">{[item.creators.slice(0, 2).join(', '), item.year].filter(Boolean).join(' · ')}</p>
        <Reasons reasons={reasons} />
        {children}
        {!hideActions && (
          <div className="actions">
            {!entry?.score && (
              <button disabled={busy} className={`btn btn-sm ${wanting ? 'btn-soft on' : 'btn-outline'}`} onClick={() => save(wanting ? null : { state: 'want' })}>
                <Icon name={wanting ? 'check' : upcoming ? 'bell' : 'plus'} size={16} />
                {upcoming ? (wanting ? 'Watching' : 'Watch') : wanting ? 'Wanted' : 'Want'}
              </button>
            )}
            {!upcoming && (
              <button disabled={busy} className="btn btn-sm btn-outline" onClick={() => open(item, entry, onChange)}>
                <Icon name="star" size={16} /> {entry?.score ? entry.score : 'Rate'}
              </button>
            )}
            {!entry && (
              <button disabled={busy} className="icon-btn" aria-label="Not for me" title="Not for me" onClick={() => save({ state: 'dismissed' })}>
                <Icon name="x" size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** Page title block: serif heading, optional intro line and actions on the right. */
export function PageHead({ title, intro, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {intro && <p className="intro">{intro}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
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
