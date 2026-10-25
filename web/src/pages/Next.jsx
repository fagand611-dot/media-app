import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api.js';
import Icon, { SAVE_ICON, SPOT_ICON } from '../components/Icon.jsx';
import { useActions } from '../components/actions.jsx';
import { Empty, Loading, PageHead, useApi } from '../components/ui.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
const plus = (n) => iso(new Date(Date.now() + n * 864e5));

// Quick date ranges. A trip uses the date inputs instead.
const WHEN = {
  tomorrow: { label: 'Tomorrow', range: () => [plus(1), plus(1)] },
  weekend: {
    label: 'This weekend',
    range: () => {
      const d = new Date().getDay(); // 0 Sun … 6 Sat
      const toSat = d === 0 ? -1 : 6 - d;
      return [plus(Math.max(0, toSat)), plus(toSat + 1)];
    },
  },
  fortnight: { label: 'Next 2 weeks', range: () => [plus(0), plus(14)] },
  trip: { label: 'Trip dates', range: null },
};

const KIND_LABEL = { event: 'Events', place: 'Places', product: 'Things to buy' };
const KIND_SUB = {
  event: 'On while you’re there, matched to what you save',
  place: 'Spots that fit your saves, including ones that just opened',
  product: 'In shops in the city, or shipping there',
};

// Next: pick a city and dates, get events, places and products ranked by
// everything you've saved, with your own saves as the explanation.
export default function Next() {
  const [city, setCity] = useState(null); // null = server default (home city)
  const [when, setWhen] = useState('fortnight');
  const [trip, setTrip] = useState([plus(7), plus(12)]);
  const [from, to] = when === 'trip' ? trip : WHEN[when].range();
  const state = useApi(`/next${qs({ city, from, to })}`);
  const { toast } = useActions();

  const act = async (spot, action) => {
    if (action === 'save') await api.post(`/spots/${spot.id}/save`);
    else if (action === 'unsave') await api.del(`/spots/${spot.id}/save`);
    else await api.post(`/spots/${spot.id}/dismiss`);
    toast(action === 'save' ? `Saved ${spot.title}` : action === 'unsave' ? 'Removed from your plan' : 'Got it, fewer like this');
    state.reload();
  };

  const setHome = async (c) => {
    await api.put('/settings', { home_city: c });
    toast(`${c} is now your home city`);
    state.reload();
  };

  return (
    <>
      <PageHead title="Next" intro="What to do, see and buy, picked from everything you’ve saved across your apps." />
      <Loading state={state}>
        {(d) => (
          <>
            <div className="next-controls">
              <label className="field">
                <span className="label">Where</span>
                <select value={d.city ?? 'anywhere'} onChange={(e) => setCity(e.target.value)}>
                  {d.cities.map((c) => <option key={c} value={c}>{c}{c === d.homeCity ? ' (home)' : ''}</option>)}
                  <option value="anywhere">Anywhere</option>
                </select>
              </label>
              <div className="field">
                <span className="label">When</span>
                <div className="seg" role="radiogroup" aria-label="When">
                  {Object.entries(WHEN).map(([k, w]) => (
                    <button key={k} role="radio" aria-checked={when === k} className={when === k ? 'on' : ''} onClick={() => setWhen(k)}>{w.label}</button>
                  ))}
                </div>
              </div>
              {when === 'trip' && (
                <div className="row trip-dates">
                  <input type="date" aria-label="From" value={trip[0]} onChange={(e) => setTrip([e.target.value, trip[1] < e.target.value ? e.target.value : trip[1]])} />
                  <span className="muted">to</span>
                  <input type="date" aria-label="To" min={trip[0]} value={trip[1]} onChange={(e) => setTrip([trip[0], e.target.value])} />
                </div>
              )}
              {d.city && d.city !== d.homeCity && (
                <button className="btn btn-sm btn-ghost" onClick={() => setHome(d.city)}><Icon name="home" size={16} /> Make {d.city} home</button>
              )}
            </div>

            {d.profileSize === 0 && (
              <p className="notice">Nothing to go on yet. <Link to="/saves">Import your saves</Link> from Spotify, Instagram or Google Maps and this page fills up.</p>
            )}

            {d.yourSaves.length > 0 && (
              <section className="panel remember">
                <h2><Icon name="bookmark" /> You already saved these in {d.city}</h2>
                <p className="muted small">Easy to forget when you’re planning. They’re from your own lists.</p>
                <ul className="save-chips">
                  {d.yourSaves.map((s) => (
                    <li key={s.id}>
                      <Icon name={SAVE_ICON[s.kind]} size={15} />
                      {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
                      {s.collection && <span className="muted"> · {s.collection}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {['event', 'place', 'product'].map((kind) => {
              const list = d[`${kind}s`];
              return (
                <section key={kind} className="shelf-section">
                  <div className="shelf-head">
                    <div>
                      <h2><Icon name={SPOT_ICON[kind]} /> {KIND_LABEL[kind]}</h2>
                      <p className="shelf-sub">{KIND_SUB[kind]}</p>
                    </div>
                  </div>
                  {list.length ? (
                    <div className="grid">{list.map((x) => <SpotCard key={x.spot.id} {...x} onAct={act} />)}</div>
                  ) : (
                    <Empty>{kind === 'event' ? 'No matching events in these dates. Try a wider range.' : 'Nothing matching here yet.'}</Empty>
                  )}
                </section>
              );
            })}

            {d.saved.length > 0 && (
              <section className="shelf-section">
                <div className="shelf-head"><h2><Icon name="check" /> Your plan</h2></div>
                <ul className="plan">
                  {d.saved.map((s) => (
                    <li key={s.id}>
                      <Icon name={SPOT_ICON[s.spot.kind]} size={16} />
                      <span><b>{s.spot.title}</b> <span className="muted">{spotWhen(s.spot) || s.spot.venue}</span></span>
                      <button className="icon-btn" aria-label="Remove" onClick={() => act(s.spot, 'unsave')}><Icon name="x" size={16} /></button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Loading>
    </>
  );
}

function spotWhen(s) {
  if (s.kind !== 'event' || !s.starts_at) return null;
  const f = (x) => new Date(`${x}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return s.ends_at ? `${f(s.starts_at)} – ${f(s.ends_at)}` : f(s.starts_at);
}

function SpotCard({ spot, match, reasons, onAct }) {
  const [busy, setBusy] = useState(false);
  const go = async (a) => {
    setBusy(true);
    try {
      await onAct(spot, a);
    } finally {
      setBusy(false);
    }
  };
  const when = spotWhen(spot);
  return (
    <article className="card spot-card">
      <div className="spot-top" style={{ '--h': hueFor(spot.title) }}>
        <Icon name={SPOT_ICON[spot.kind]} size={22} />
        <span className="match">{match}% match</span>
      </div>
      <div className="card-body">
        <div className="card-meta">
          {when && <span className="badge status"><Icon name="clock" size={12} /> {when}</span>}
          {spot.price && <span className="badge">{spot.price}</span>}
          {spot.is_demo && <span className="badge demo" title="Sample data, not a real listing">demo</span>}
        </div>
        <h3>{spot.url ? <a href={spot.url} target="_blank" rel="noreferrer">{spot.title}</a> : spot.title}</h3>
        <p className="sub">{[spot.venue, spot.city || 'Online'].filter(Boolean).join(' · ')}</p>
        {spot.description && <p className="desc">{spot.description}</p>}
        <SpotReasons reasons={reasons} />
        <div className="actions">
          <button disabled={busy} className="btn btn-sm btn-outline" onClick={() => go('save')}><Icon name="plus" size={16} /> Save</button>
          <button disabled={busy} className="icon-btn" aria-label="Not for me" title="Not for me" onClick={() => go('dismiss')}><Icon name="x" size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function SpotReasons({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <ul className="reasons">
      {reasons.map((r, i) => {
        if (r.type === 'saves') {
          return r.evidence.slice(0, 2).map((e) => (
            <li key={`${i}-${e.tag}`}>
              <Icon name="sparkle" size={14} />
              <span><b>{e.tag}</b>: {e.sources.map((s) => `${s.n} on ${s.label}`).join(', ')}
                {e.examples[0] && <span className="muted"> · like “{e.examples[0]}”</span>}</span>
            </li>
          ));
        }
        if (r.type === 'creator') return <li key={i}><Icon name="heart" size={14} /> <span>Features <b>{r.name}</b>, who you saved</span></li>;
        if (r.type === 'tags') return <li key={i}><Icon name="sparkle" size={14} /> <span>Fits your taste for <b>{r.tags.join(', ')}</b></span></li>;
        if (r.type === 'friends') return <li key={i} className="friend"><Icon name="users" size={14} /> <span>{r.names.join(', ')} saved it</span></li>;
        if (r.type === 'new') return <li key={i}><Icon name="clock" size={14} /> <span>Just opened{r.days > 0 ? `, ${r.days} days ago` : ''}</span></li>;
        if (r.type === 'gem') return <li key={i}><Icon name="star" size={14} /> <span>Under the radar: you wouldn’t see it pushed elsewhere</span></li>;
        return null;
      })}
    </ul>
  );
}

function hueFor(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}
