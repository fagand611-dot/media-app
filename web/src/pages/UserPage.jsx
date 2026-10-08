import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Cover, Empty, Loading, MediumBadge, STATE_LABEL, Score, timeAgo, useApi } from '../components/ui.jsx';
import { ListGrid } from './Lists.jsx';
import { TagCloud } from './Taste.jsx';

export default function UserPage() {
  const { username } = useParams();
  const state = useApi(`/users/${username}`);

  return (
    <Loading state={state}>
      {({ user, relationship, match, taste, recent, favourites, lists }) => (
        <>
          <div className="page-head">
            <div>
              <h1>{user.display_name}</h1>
              <p className="muted">@{user.username}{relationship === 'friend' && match != null && <> · <b>{match}%</b> taste match with you</>}</p>
            </div>
            <Relationship rel={relationship} user={user} reload={state.reload} />
          </div>

          {taste && (
            <section className="panel">
              <h2>Taste</h2>
              <TagCloud tags={taste.likes} />
            </section>
          )}

          {favourites?.length > 0 && (
            <>
              <h2>Favourites</h2>
              <div className="shelf">
                {favourites.map((e) => (
                  <Link key={e.item.id} to={`/item/${e.item.id}`} className="shelf-item" title={e.item.title}>
                    <Cover item={e.item} />
                    <span>{e.item.title}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <h2>Lists</h2>
          {lists.length ? <ListGrid lists={lists} /> : <Empty>No lists you can see.</Empty>}

          {recent ? (
            <>
              <h2>Recent activity</h2>
              <ul className="activity">
                {recent.map((e) => (
                  <li key={e.item.id}>
                    <MediumBadge medium={e.item.medium} />
                    <Link to={`/item/${e.item.id}`}><b>{e.item.title}</b></Link>
                    {e.score ? <Score score={e.score} /> : <span className="badge">{STATE_LABEL[e.state]}</span>}
                    <span className="muted small">{timeAgo(e.updated_at)}</span>
                    {e.review && <p className="quote">“{e.review}”</p>}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            relationship !== 'self' && <Empty>Ratings and reviews are only visible to friends.</Empty>
          )}
        </>
      )}
    </Loading>
  );
}

function Relationship({ rel, user, reload }) {
  const call = (p) => p.then(reload);
  if (rel === 'self') return <Link to="/taste" className="button">Your Taste DNA</Link>;
  if (rel === 'friend') return <button className="ghost" onClick={() => confirm(`Remove ${user.display_name} as a friend?`) && call(api.del(`/friends/${user.id}`))}>Friends ✓</button>;
  if (rel === 'requested') return <button disabled>Request sent</button>;
  if (rel === 'incoming') return <button className="primary" onClick={() => call(api.post(`/friends/${user.id}/accept`))}>Accept friend request</button>;
  return <button className="primary" onClick={() => call(api.post('/friends/request', { username: user.username }))}>Add friend</button>;
}
