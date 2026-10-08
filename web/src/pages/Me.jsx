import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import Icon from '../components/Icon.jsx';
import { useApi } from '../components/ui.jsx';
import { useTheme } from '../theme.js';

const LINKS = [
  ['/library', 'Library', 'bookmark', 'Rated, wanted and in progress'],
  ['/lists', 'Lists', 'list', 'Your lists and your friends’'],
  ['/friends', 'Friends', 'users', 'Requests and taste matches'],
  ['/taste', 'Taste DNA', 'sparkle', 'What drives your picks, and tune it'],
  ['/search', 'Search & add', 'search', 'Find anything, or add it by hand'],
];

// Account hub: the phone's "Me" tab, and the avatar menu on desktop.
export default function Me() {
  const { user, logout } = useAuth();
  const taste = useApi('/taste');
  const friends = useApi('/friends');
  const [theme, setTheme] = useTheme();
  const counts = taste.data?.counts;

  return (
    <div className="me-page">
      <div className="me-head">
        <div className="avatar-lg">{user.display_name[0].toUpperCase()}</div>
        <div>
          <h1>{user.display_name}</h1>
          <Link to={`/u/${user.username}`} className="muted">@{user.username} · view profile</Link>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><b>{counts?.rated ?? '–'}</b><span>rated</span></div>
        <div className="stat"><b>{friends.data?.friends.length ?? '–'}</b><span>friends</span></div>
        <div className="stat"><b>{taste.data?.likes[0]?.label ?? '–'}</b><span>top taste</span></div>
      </div>

      {friends.data?.incoming.length > 0 && (
        <Link to="/friends" className="notice-link">
          <Icon name="users" /> {friends.data.incoming.length} friend request{friends.data.incoming.length > 1 ? 's' : ''} waiting <Icon name="chevron" />
        </Link>
      )}

      <nav className="menu">
        {LINKS.map(([to, label, icon, hint]) => (
          <Link key={to} to={to}>
            <span className="menu-icon"><Icon name={icon} /></span>
            <span className="menu-text"><b>{label}</b><small>{hint}</small></span>
            <Icon name="chevron" className="muted" />
          </Link>
        ))}
      </nav>

      <section className="card-plain">
        <span className="label">Appearance</span>
        <div className="seg seg-full" role="radiogroup" aria-label="Theme">
          {[['system', 'Auto', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([v, l, i]) => (
            <button key={v} role="radio" aria-checked={theme === v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>
              <Icon name={i} size={16} /> {l}
            </button>
          ))}
        </div>
      </section>

      <button className="btn btn-ghost signout" onClick={logout}><Icon name="logout" size={18} /> Sign out</button>
    </div>
  );
}
