import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import Icon from './components/Icon.jsx';
import { ActionsProvider } from './components/actions.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
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
import Me from './pages/Me.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Desktop top navigation.
const NAV = [
  ['/', 'For You'],
  ['/discover', 'Browse'],
  ['/radar', 'Radar'],
  ['/feed', 'Feed'],
  ['/lists', 'Lists'],
  ['/library', 'Library'],
  ['/friends', 'Friends'],
];

// Phone bottom tabs: the five things people do most. Everything else lives under "Me".
const TABS = [
  ['/', 'For You', 'home'],
  ['/discover', 'Browse', 'compass'],
  ['/radar', 'Radar', 'radar'],
  ['/feed', 'Feed', 'activity'],
  ['/me', 'Me', 'user'],
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [offline, setOffline] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const refresh = useCallback(
    () =>
      api.get('/me').then(
        (d) => {
          setOffline(false);
          setUser(d.user ?? null);
        },
        // No answer, or the dev proxy's 5xx, means the API server isn't running.
        (e) => (!e.status || e.status >= 500 ? setOffline(true) : setUser(null))
      ),
    []
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  // Braces matter: newer browsers return a Promise from scrollTo, and an effect
  // must return nothing (or a cleanup function), or React crashes on unmount.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    navigate('/');
  };

  if (offline) {
    return (
      <div className="crash">
        <h1>Can’t reach the Tastemate server</h1>
        <p className="intro">
          The page loaded, but the server behind it isn’t answering. Check the terminal where you ran <code>npm run dev</code>:
          it should still be running and show “Tastemate API on http://localhost:3001”. If it stopped with an error, fix that and run it again.
        </p>
        <button className="btn btn-primary" onClick={refresh}>Try again</button>
      </div>
    );
  }
  if (user === undefined) return <div className="center"><div className="skeleton"><span /><span /></div></div>;
  if (!user) return <AuthCtx.Provider value={{ user, setUser, refresh, logout }}><Login /></AuthCtx.Provider>;

  return (
    <AuthCtx.Provider value={{ user, setUser, refresh, logout }}>
      <ActionsProvider>
        <header className="topbar">
          <Link to="/" className="brand">tastemate</Link>
          <nav className="topnav">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
            ))}
          </nav>
          <div className="top-actions">
            <NavLink to="/search" className="icon-btn" aria-label="Search"><Icon name="search" /></NavLink>
            <NavLink to="/me" className="avatar-btn" aria-label="Your account">{user.display_name[0].toUpperCase()}</NavLink>
          </div>
        </header>
        <main>
          <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={user.onboarded ? <Home /> : <Navigate to="/welcome" replace />} />
            <Route path="/welcome" element={<Onboarding />} />
            <Route path="/discover" element={<Discover />} />
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
            <Route path="/me" element={<Me />} />
            <Route path="*" element={<p className="muted">Page not found.</p>} />
          </Routes>
          </ErrorBoundary>
        </main>
        <nav className="tabbar" aria-label="Main">
          {TABS.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon name={icon} size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </ActionsProvider>
    </AuthCtx.Provider>
  );
}
