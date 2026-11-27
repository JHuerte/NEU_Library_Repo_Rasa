import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useMeta, isStaff } from '../context.jsx';
import Chatbot from './Chatbot.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const meta = useMeta();
  const navigate = useNavigate();
  const role = user?.role;
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname, user]);

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/search', label: 'Search' },
    { to: '/browse', label: 'Browse' },
    user && { to: '/submit', label: 'Submit' },
    user && { to: '/my-submissions', label: 'My submissions' },
    isStaff(user) && { to: '/review', label: 'Review queue' },
    role === 'admin' && { to: '/reports', label: 'Reports' },
    isStaff(user) && { to: '/admin', label: 'Admin' },
  ].filter(Boolean);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link to="/" className="brand">
            <div className="mark">NEU</div>
            <div>{meta.repositoryName ?? 'NEU Library Repository'}<small>Institutional repository</small></div>
          </Link>
          <button type="button" className="menu-btn" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
            Menu
          </button>
          <nav className={`main${menuOpen ? ' open' : ''}`} id="main-nav" aria-label="Main">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>)}
          </nav>
          <div className="usermenu">
            {user ? (
              <>
                <div className="who">{user.name}<small>{user.role}</small></div>
                <button type="button" onClick={async () => { await logout(); navigate('/'); }}>Sign out</button>
              </>
            ) : (
              <Link className="btnlink" to="/login">Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <main className="wrap"><Outlet /></main>
      <footer className="site">
        <div className="wrap">
          <span>{meta.repositoryName} · NEU Library</span>
          <span>Permanent links use the handle prefix <span className="mono">{meta.handlePrefix}</span></span>
        </div>
      </footer>
      <Chatbot />
    </>
  );
}
