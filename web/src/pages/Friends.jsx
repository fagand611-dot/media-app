import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api.js';
import { Empty, Loading, useApi } from '../components/ui.jsx';

export default function Friends() {
  const state = useApi('/friends');
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [msg, setMsg] = useState(null);

  const search = async (e) => {
    e.preventDefault();
    setResults((await api.get(`/users/search${qs({ q })}`)).users);
  };
  const act = async (fn, text) => {
    try {
      await fn();
      setMsg(text);
      state.reload();
    } catch (e) {
      setMsg(e.message);
    }
  };
  const request = (username) => act(() => api.post('/friends/request', { username }), `Request sent to ${username}`);

  return (
    <>
      <h1>Friends</h1>
      <p className="muted">Friends see your ratings, reviews and friends-only lists, and their scores feed into your recommendations, weighted by how closely your tastes match.</p>
      {msg && <p className="notice">{msg}</p>}
      <form className="searchbar" onSubmit={search}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find people by username or name" />
        <button>Find</button>
      </form>
      {results && (
        results.length ? (
          <ul className="people">
            {results.map((u) => (
              <li key={u.id}>
                <Link to={`/u/${u.username}`}><b>{u.display_name}</b> <span className="muted">@{u.username}</span></Link>
                <button onClick={() => request(u.username)}>Add friend</button>
              </li>
            ))}
          </ul>
        ) : <Empty>Nobody found.</Empty>
      )}

      <Loading state={state}>
        {({ friends, incoming, outgoing }) => (
          <>
            {incoming.length > 0 && (
              <>
                <h2>Requests</h2>
                <ul className="people">
                  {incoming.map((u) => (
                    <li key={u.id}>
                      <Link to={`/u/${u.username}`}><b>{u.display_name}</b> <span className="muted">@{u.username}</span></Link>
                      <div className="row">
                        <button className="primary" onClick={() => act(() => api.post(`/friends/${u.id}/accept`), `You and ${u.display_name} are now friends`)}>Accept</button>
                        <button className="ghost" onClick={() => act(() => api.del(`/friends/${u.id}`), 'Request declined')}>Decline</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h2>Your friends</h2>
            {friends.length ? (
              <ul className="people">
                {friends.map((u) => (
                  <li key={u.id}>
                    <Link to={`/u/${u.username}`}><b>{u.display_name}</b> <span className="muted">@{u.username}</span></Link>
                    <span className="taste-match" style={{ '--p': u.match }}>{u.match}% taste match</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No friends yet. Search above, or share your username: they can add you too.</Empty>
            )}
            {outgoing.length > 0 && (
              <>
                <h3>Pending</h3>
                <ul className="people">
                  {outgoing.map((u) => (
                    <li key={u.id}>
                      <span>{u.display_name} <span className="muted">@{u.username}</span></span>
                      <button className="ghost" onClick={() => act(() => api.del(`/friends/${u.id}`), 'Request cancelled')}>Cancel</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Loading>
    </>
  );
}
