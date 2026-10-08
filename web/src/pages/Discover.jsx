import { useState } from 'react';
import { Link } from 'react-router-dom';
import { qs } from '../api.js';
import { Empty, ItemCard, Loading, MediumTabs, useApi } from '../components/ui.jsx';

export default function Discover() {
  const [medium, setMedium] = useState(null);
  const state = useApi(`/recommendations${qs({ medium, limit: 24 })}`);

  // Remove an item from the feed once you act on it; the next reload re-ranks.
  const drop = (id) => state.setData((d) => ({ ...d, recommendations: d.recommendations.filter((r) => r.item.id !== id) }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Browse recommendations</h1>
          <p className="muted">Every recommendation in one ranked list, filterable by medium. Each rating or skip sharpens the next batch.</p>
        </div>
        <button onClick={state.reload}>↻ Refresh</button>
      </div>
      <MediumTabs value={medium} onChange={setMedium} />
      <Loading state={state}>
        {({ recommendations }) =>
          recommendations.length ? (
            <div className="grid">
              {recommendations.map((r) => (
                <ItemCard key={r.item.id} item={r.item} match={r.match} reasons={r.reasons} onChange={() => drop(r.item.id)} />
              ))}
            </div>
          ) : (
            <Empty>
              You've worked through everything here. <Link to="/search">Search</Link> to add more titles to the catalogue.
            </Empty>
          )
        }
      </Loading>
    </>
  );
}
