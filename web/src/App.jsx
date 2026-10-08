import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Discover from './pages/Discover.jsx';
import Radar from './pages/Radar.jsx';
import Search from './pages/Search.jsx';
import ItemPage from './pages/ItemPage.jsx';
import Library from './pages/Library.jsx';
import Lists from './pages/Lists.jsx';
import ListPage from './pages/ListPage.jsx';
import Friends from './pages/Friends.jsx';
import UserPage from './pages/UserPage.jsx';
import Feed from './pages/Feed.jsx';
import Taste from './pages/Taste.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const NAV = [
  ['/', 'For You'],
  ['/discover', 'Browse'],
  ['/radar', 'Radar'],
  ['/search', 'Search'],
  ['/library', 'Library'],
  ['/lists', 'Lists'],
  ['/feed', 'Feed'],
  ['/friends', 'Friends'],
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const navigate = useNavigate();

  const refresh = useCallback(() => api.get('/me').then((d) => setUser(d.user ?? null)).catch(() => setUser(null)), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    navigate('/');
  };

  if (user === undefined) return <div className="center muted">Loading…</div>;
  if (!user) return <AuthCtx.Provider value={{ user, setUser, refresh }}><Login /></AuthCtx.Provider>;

  return (
    <AuthCtx.Provider value={{ user, setUser, refresh }}>
      <header className="topbar">
        <NavLink to="/" className="brand">✦ Tastemate</NavLink>
        <nav>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
          ))}
        </nav>
        <div className="me">
          <NavLink to="/taste" title="Your Taste DNA">🧬</NavLink>
          <NavLink to={`/u/${user.username}`}>{user.display_name}</NavLink>
          <button className="link" onClick={logout}>Sign out</button>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={user.onboarded ? <Home /> : <Navigate to="/welcome" replace />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/radar" element={<Radar />} />
          <Route path="/search" element={<Search />} />
          <Route path="/item/:id" element={<ItemPage />} />
          <Route path="/library" element={<Library />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/lists/:id" element={<ListPage />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/u/:username" element={<UserPage />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/taste" element={<Taste />} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>
    </AuthCtx.Provider>
  );
}
