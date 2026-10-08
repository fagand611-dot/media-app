import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Cover, Empty, Loading, useApi } from '../components/ui.jsx';

export default function Lists() {
  const state = useApi('/lists');
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lists</h1>
          <p className="muted">Collections that mix media, like "Rainy Sunday" or "Gateway to house music". Share them with friends or keep them private.</p>
        </div>
        <button className="primary" onClick={() => setCreating(!creating)}>{creating ? 'Close' : '+ New list'}</button>
      </div>
      {creating && <NewList />}
      <Loading state={state}>
        {({ mine, friends, public: pub }) => (
          <>
            <h2>Yours</h2>
            {mine.length ? <ListGrid lists={mine} /> : <Empty>No lists yet.</Empty>}
            <h2>From friends</h2>
            {friends.length ? <ListGrid lists={friends} showOwner /> : <Empty>Your friends haven't shared any lists yet.</Empty>}
            {pub.length > 0 && (
              <>
                <h2>Public</h2>
                <ListGrid lists={pub} showOwner />
              </>
            )}
          </>
        )}
      </Loading>
    </>
  );
}

export function ListGrid({ lists, showOwner }) {
  return (
    <div className="list-grid">
      {lists.map((l) => (
        <Link key={l.id} to={`/lists/${l.id}`} className="list-card">
          <div className="mosaic">
            {(l.covers || []).map((c, i) => <Cover key={i} item={c} />)}
          </div>
          <div>
            <b>{l.title}</b>
            <div className="muted small">
              {l.count} item{l.count === 1 ? '' : 's'}
              {showOwner && ` · by ${l.owner_name}`} · {l.visibility}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function NewList() {
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', description: '', visibility: 'friends' });
  const submit = async (e) => {
    e.preventDefault();
    const { list } = await api.post('/lists', f);
    navigate(`/lists/${list.id}`);
  };
  return (
    <form className="panel form-grid" onSubmit={submit}>
      <label>Title<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Folk for long drives" /></label>
      <label>Who can see it
        <select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}>
          <option value="friends">Friends</option>
          <option value="public">Everyone</option>
          <option value="private">Just me</option>
        </select>
      </label>
      <label className="span">Description<textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="span"><button className="primary">Create list</button></div>
    </form>
  );
}
