import { useState } from 'react';
import { Link } from 'react-router-dom';
import { qs } from '../api.js';
import { Empty, ItemCard, Loading, MediumTabs, STATE_LABEL, useApi } from '../components/ui.jsx';

const STATES = ['done', 'want', 'in_progress', 'dismissed'];

export default function Library() {
  const [st, setSt] = useState('done');
  const [medium, setMedium] = useState(null);
  const state = useApi(`/library${qs({ state: st })}`);

  return (
    <>
      <h1>Your library</h1>
      <div className="tabs">
        {STATES.map((s) => (
          <button key={s} className={st === s ? 'on' : ''} onClick={() => setSt(s)}>{s === 'done' ? 'Rated & done' : STATE_LABEL[s]}</button>
        ))}
      </div>
      <MediumTabs value={medium} onChange={setMedium} all="All media" />
      <Loading state={state}>
        {({ entries }) => {
          const shown = entries.filter((e) => !medium || e.item.medium === medium);
          return shown.length ? (
            <div className="grid">
              {shown.map((e) => (
                <ItemCard key={e.item.id} item={e.item} entry={e} onChange={state.reload}>
                  {e.review && <p className="desc quote">“{e.review}”</p>}
                </ItemCard>
              ))}
            </div>
          ) : (
            <Empty>Nothing here yet. <Link to="/">Discover</Link> something.</Empty>
          );
        }}
      </Loading>
    </>
  );
}
