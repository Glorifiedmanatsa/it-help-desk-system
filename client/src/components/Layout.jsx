import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS, isStaff } from '../lib/labels.js';

function navItemsFor(user) {
  if (!isStaff(user)) {
    return [
      { to: '/tickets/new', label: 'New ticket' },
      { to: '/my-tickets', label: 'My tickets' },
    ];
  }
  const items = [
    { to: '/tickets', label: 'All tickets', end: true },
    { to: '/knowledge', label: 'Knowledge base' },
    { to: '/tickets/new', label: 'New ticket' },
  ];
  if (user.role === 'ADMIN') {
    items.push({ to: '/admin/users', label: 'Users' }, { to: '/admin/reports', label: 'Reports' });
  }
  return items;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">HD</span> IT Help Desk
          </Link>
          <button
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">Toggle menu</span>☰
          </button>
          <nav id="main-nav" className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Main">
            {navItemsFor(user).map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            ))}
            <div className="user-box">
              <span className="user-name">
                {user.name} <span className="role-pill">{ROLE_LABELS[user.role]}</span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
