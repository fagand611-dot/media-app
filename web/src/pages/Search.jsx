import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { Cover, Empty, ItemCard, MEDIA, MediumBadge, MediumTabs, useApi } from '../components/ui.jsx';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const medium = params.get('medium') || null;
  const [input, setInput] = useState(q);
  const [external, setExternal] = useState(null);
  const [extBusy, setExtBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const local = useApi(q.length >= 2 ? `/search${qs({ q, medium })}` : null);
  const navigate = useNavigate();

  useEffect(() => setExternal(null), [q, medium]);

  const submit = (e) => {
    e.preventDefault();
    setParams(qs({ q: input.trim(), medium }).slice(1));
  };

  const searchOnline = async () => {
    setExtBusy(true);
    try {
      setExternal(await api.get(`/search${qs({ q, medium, external: 1 })}`));
    } catch (e) {
      setExternal({ external: [], errors: [{ provider: 'search', error: e.message }] });
    } finally {
      setExtBusy(false);
    }
  };

  const importItem = async (r) => {
    if (r.local_id) return navigate(`/item/${r.local_id}`);
    const { item } = await api.post('/items', r);
    navigate(`/item/${item.id}`);
  };

  return (
    <>
      <div className="page-head">
        <h1>Search</h1>
        <button onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close' : '+ Add something by hand'}</button>
      </div>
      {showAdd && <ManualAdd onAdded={(item) => navigate(`/item/${item.id}`)} />}
      <form className="searchbar" onSubmit={submit}>
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Title, director, author, artist…" />
        <button className="primary">Search</button>
      </form>
      <MediumTabs value={medium} onChange={(m) => setParams(qs({ q, medium: m }).slice(1))} />

      {q.length >= 2 && local.data && (
        <>
          <h2>In Tastemate</h2>
          {local.data.local.length ? (
            <div className="grid">
              {local.data.local.map((item) => <ItemCard key={item.id} item={item} hideActions />)}
            </div>
          ) : (
            <Empty>No matches in the catalogue yet.</Empty>
          )}

          <div className="page-head">
            <h2>Online</h2>
            {!external && (
              <button onClick={searchOnline} disabled={extBusy}>
                {extBusy ? 'Searching…' : `Search ${local.data.providers?.length ? local.data.providers.join(', ') : 'online'}`}
              </button>
            )}
          </div>
          {external && (
            <>
              {external.errors?.map((e) => <p key={e.provider} className="error small">{e.provider}: {e.error}</p>)}
              {external.external.length ? (
                <ul className="ext-results">
                  {external.external.map((r) => (
                    <li key={`${r.source}:${r.external_id}`}>
                      <Cover item={r} />
                      <div>
                        <MediumBadge medium={r.medium} /> <b>{r.title}</b>{' '}
                        <span className="muted">{[r.creators.join(', '), r.year].filter(Boolean).join(' · ')}</span>
                        <div className="muted small">{[...r.genres, ...r.moods].join(' · ') || 'no tags'} · via {r.source}</div>
                      </div>
                      <button onClick={() => importItem(r)}>{r.local_id ? 'Open' : 'Add'}</button>
                    </li>
                  ))}
                </ul>
              ) : (
                !external.errors?.length && <Empty>No online results.</Empty>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function ManualAdd({ onAdded }) {
  const tax = useApi('/taxonomy');
  const [f, setF] = useState({ medium: 'movie', title: '', year: '', creators: '', genres: [], moods: [], status: 'released', release_date: '', description: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { item } = await api.post('/items', {
        ...f,
        year: f.year ? Number(f.year) : null,
        creators: f.creators.split(',').map((s) => s.trim()).filter(Boolean),
      });
      onAdded(item);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!tax.data) return null;
  return (
    <form className="panel form-grid" onSubmit={submit}>
      <label>Type
        <select value={f.medium} onChange={(e) => setF({ ...f, medium: e.target.value, genres: [] })}>
          {Object.entries(MEDIA).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
      </label>
      <label>Title<input required value={f.title} onChange={set('title')} /></label>
      <label>Year<input type="number" value={f.year} onChange={set('year')} /></label>
      <label>{f.medium === 'music' ? 'Artist(s)' : f.medium === 'book' ? 'Author(s)' : 'Director / creator(s)'}
        <input value={f.creators} onChange={set('creators')} placeholder="Comma-separated" />
      </label>
      <label>Status
        <select value={f.status} onChange={set('status')}>
          <option value="released">Released</option>
          <option value="upcoming">Upcoming</option>
          <option value="in_production">In production</option>
          <option value="announced">Announced</option>
        </select>
      </label>
      {f.status !== 'released' && <label>Release date<input type="date" value={f.release_date} onChange={set('release_date')} /></label>}
      <div className="span">
        <span className="label">Genres</span>
        <div className="chips">
          {tax.data.genres[f.medium].map((g) => (
            <button type="button" key={g} className={`chip ${f.genres.includes(g) ? 'on' : ''}`} onClick={() => toggle('genres', g)}>{g}</button>
          ))}
        </div>
      </div>
      <div className="span">
        <span className="label">Moods</span>
        <div className="chips">
          {tax.data.moods.map((m) => (
            <button type="button" key={m} className={`chip mood ${f.moods.includes(m) ? 'on' : ''}`} onClick={() => toggle('moods', m)}>{m}</button>
          ))}
        </div>
      </div>
      <label className="span">Description<textarea rows={2} value={f.description} onChange={set('description')} /></label>
      {error && <p className="error span">{error}</p>}
      <div className="span"><button className="primary">Add to catalogue</button></div>
    </form>
  );
}
