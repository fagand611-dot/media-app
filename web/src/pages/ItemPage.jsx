import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Cover, Loading, MediumBadge, STATE_LABEL, STATUS_LABEL, Score, ScorePicker, Tags, timeAgo, useApi } from '../components/ui.jsx';

export default function ItemPage() {
  const { id } = useParams();
  const state = useApi(`/items/${id}`);
  return (
    <Loading state={state}>
      {(d) => <ItemView {...d} reload={state.reload} />}
    </Loading>
  );
}

function ItemView({ item, mine, friends, community, lists, reload }) {
  const released = item.status === 'released';
  return (
    <div className="item-page">
      <div className="item-hero">
        <Cover item={item} className="big" />
        <div>
          <div className="card-meta">
            <MediumBadge medium={item.medium} />
            {!released && <span className="badge status">{STATUS_LABEL[item.status]}{item.release_date ? ` · ${item.release_date}` : ''}</span>}
            {item.is_demo && <span className="badge demo">sample data</span>}
          </div>
          <h1>{item.title}</h1>
          <p className="sub">{[item.creators.join(', '), item.year].filter(Boolean).join(' · ')}</p>
          <Tags item={item} />
          {item.description && <p className="desc">{item.description}</p>}
          {community.count > 0 && (
            <p className="muted">Tastemate average <Score score={community.avg} /> from {community.count} rating{community.count > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      <div className="item-cols">
        <section className="panel">
          <h2>{released ? 'Your take' : 'Track it'}</h2>
          <MyEntry item={item} mine={mine} onSaved={reload} />
          <AddToList itemId={item.id} />
        </section>

        <section>
          <h2>Friends</h2>
          {friends.length ? (
            <ul className="reviews">
              {friends.map((f) => (
                <li key={f.id}>
                  <div className="review-head">
                    <Link to={`/u/${f.username}`}><b>{f.display_name}</b></Link>
                    {f.score ? <Score score={f.score} /> : <span className="badge">{STATE_LABEL[f.state]}</span>}
                    <span className="muted small">{timeAgo(f.updated_at)}</span>
                  </div>
                  {f.review && <p>{f.review}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">None of your friends have logged this yet.</p>
          )}
          {lists.length > 0 && (
            <>
              <h3>On lists</h3>
              <ul className="plain">
                {lists.map((l) => (
                  <li key={l.id}><Link to={`/lists/${l.id}`}>{l.title}</Link> <span className="muted">by {l.owner_name}</span></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function MyEntry({ item, mine, onSaved }) {
  const released = item.status === 'released';
  const [score, setScore] = useState(mine?.score ?? null);
  const [review, setReview] = useState(mine?.review ?? '');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setScore(mine?.score ?? null);
    setReview(mine?.review ?? '');
  }, [mine]);

  const put = async (body) => {
    await api.put(`/library/${item.id}`, body);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved();
  };
  const remove = async () => {
    await api.del(`/library/${item.id}`);
    onSaved();
  };

  return (
    <div className="my-entry">
      <div className="state-buttons">
        {(released ? ['want', 'in_progress', 'done', 'dismissed'] : ['want', 'dismissed']).map((s) => (
          <button key={s} className={mine?.state === s ? 'on' : ''} onClick={() => put({ state: s })}>
            {!released && s === 'want' ? '🔔 Watch for it' : STATE_LABEL[s]}
          </button>
        ))}
        {mine && <button className="ghost" onClick={remove}>Clear</button>}
      </div>
      {released && (
        <>
          <span className="label">Score</span>
          <ScorePicker value={score} onChange={setScore} />
          <span className="label">Review <span className="muted">(friends can see it)</span></span>
          <textarea rows={4} value={review} onChange={(e) => setReview(e.target.value)} placeholder="What stuck with you?" />
          <button className="primary" onClick={() => put({ score, review, state: score || review ? 'done' : mine?.state ?? 'done' })}>
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </>
      )}
    </div>
  );
}

function AddToList({ itemId }) {
  const lists = useApi('/lists');
  const [listId, setListId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  if (!lists.data) return null;
  const mine = lists.data.mine;
  const add = async () => {
    if (!listId) return;
    await api.post(`/lists/${listId}/items`, { itemId, note });
    setMsg('Added ✓');
    setNote('');
  };
  return (
    <div className="add-to-list">
      <span className="label">Add to a list</span>
      {mine.length ? (
        <div className="row">
          <select value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">Choose a list…</option>
            {mine.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          <button onClick={add} disabled={!listId}>Add</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      ) : (
        <p className="muted small">You don't have any lists yet. <Link to="/lists">Create one</Link>.</p>
      )}
    </div>
  );
}
