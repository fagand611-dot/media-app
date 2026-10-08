import { useState } from 'react';
import { api, qs } from '../api.js';
import { Empty, ItemCard, Loading, MediumTabs, useApi } from '../components/ui.jsx';

export default function Radar() {
  const [medium, setMedium] = useState(null);
  const state = useApi(`/radar${qs({ medium })}`);
  const [msg, setMsg] = useState(null);

  const refresh = async () => {
    setMsg('Checking for new releases…');
    try {
      const r = await api.post('/radar/refresh');
      setMsg(r.errors.length ? `Problem: ${r.errors.map((e) => `${e.provider}: ${e.error}`).join('; ')}` : `${r.added} new titles added.`);
      state.reload();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const update = (id, entry) =>
    state.setData((d) => ({
      ...d,
      radar: entry?.state === 'dismissed'
        ? d.radar.filter((r) => r.item.id !== id)
        : d.radar.map((r) => (r.item.id === id ? { ...r, watching: entry?.state === 'want' } : r)),
    }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Radar</h1>
          <p className="muted">Upcoming, announced and in-production work, ranked by your taste. Watch a title to keep it at the top.</p>
        </div>
        {state.data?.canRefresh && <button onClick={refresh}>↻ Pull latest from TMDB</button>}
      </div>
      {msg && <p className="notice">{msg}</p>}
      <MediumTabs value={medium} onChange={setMedium} />
      <Loading state={state}>
        {({ radar, canRefresh }) => (
          <>
            {!canRefresh && radar.some((r) => r.item.is_demo) && (
              <p className="notice">
                These are <b>sample</b> upcoming titles. Set <code>TMDB_API_KEY</code> on the server to fill Radar with real upcoming films and series.
              </p>
            )}
            {radar.length ? (
              <div className="grid">
                {radar.map((r) => (
                  <ItemCard
                    key={r.item.id}
                    item={r.item}
                    match={r.match}
                    entry={r.watching ? { state: 'want' } : null}
                    onChange={(e) => update(r.item.id, e)}
                  >
                    {r.item.description && <p className="desc">{r.item.description}</p>}
                  </ItemCard>
                ))}
              </div>
            ) : (
              <Empty>Nothing on the radar yet.</Empty>
            )}
          </>
        )}
      </Loading>
    </>
  );
}
