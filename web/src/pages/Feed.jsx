import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Cover, Empty, Loading, MediumBadge, Score, timeAgo, useApi } from '../components/ui.jsx';

const VERB = { want: 'wants to check out', in_progress: 'is into', done: 'finished' };

export default function Feed() {
  const state = useApi('/feed');
  return (
    <>
      <h1>Feed</h1>
      <p className="muted">What your friends have been watching, reading, listening to and listing.</p>
      <Loading state={state}>
        {({ events }) =>
          events.length ? (
            <ul className="feed">
              {events.map((e, i) =>
                e.kind === 'list' ? (
                  <li key={`l${e.list.id}-${i}`}>
                    <div className="feed-icon"><Icon name="list" /></div>
                    <div>
                      <Link to={`/u/${e.user.username}`}><b>{e.user.display_name}</b></Link> updated a list{' '}
                      <Link to={`/lists/${e.list.id}`}><b>{e.list.title}</b></Link> <span className="muted">({e.list.count} items)</span>
                      {e.list.description && <p className="muted small">{e.list.description}</p>}
                      <div className="muted small">{timeAgo(e.at)}</div>
                    </div>
                  </li>
                ) : (
                  <li key={`e${e.user.id}-${e.item.id}`}>
                    <Link to={`/item/${e.item.id}`} className="feed-cover"><Cover item={e.item} /></Link>
                    <div>
                      <Link to={`/u/${e.user.username}`}><b>{e.user.display_name}</b></Link>{' '}
                      {e.score ? 'rated' : VERB[e.state]}{' '}
                      <Link to={`/item/${e.item.id}`}><b>{e.item.title}</b></Link> <Score score={e.score} />
                      <div><MediumBadge medium={e.item.medium} /> <span className="muted small">{timeAgo(e.at)}</span></div>
                      {e.review && <p className="quote">“{e.review}”</p>}
                    </div>
                  </li>
                )
              )}
            </ul>
          ) : (
            <Empty>Nothing yet. <Link to="/friends">Add some friends</Link> to fill your feed.</Empty>
          )
        }
      </Loading>
    </>
  );
}
