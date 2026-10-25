import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS, isStaff } from '../lib/labels.js';
import { Avatar } from './ui.jsx';
import { Icon } from './icons.jsx';

function navSectionsFor(user) {
  if (!isStaff(user)) {
    return [
      {
        title: 'Help center',
        items: [
          { to: '/tickets/new', label: 'Report a problem', icon: 'plus' },
          { to: '/my-tickets', label: 'My tickets', icon: 'inbox' },
        ],
      },
    ];
  }
  const sections = [
    {
      title: 'Service desk',
      items: [
        { to: '/tickets', label: 'All tickets', icon: 'queue', end: true },
        { to: '/tickets?assignedTo=me', label: 'My tickets', icon: 'inbox', myQueue: true },
        { to: '/tickets/new', label: 'New ticket', icon: 'plus' },
      ],
    },
    { title: 'Knowledge', items: [{ to: '/knowledge', label: 'Knowledge base', icon: 'book' }] },
  ];
  if (user.role === 'ADMIN') {
    sections.push({
      title: 'Administration',
      items: [
        { to: '/admin/users', label: 'Users', icon: 'users' },
        { to: '/admin/reports', label: 'Reports', icon: 'chart' },
      ],
    });
  }
  return sections;
}

export function Brand({ className = '' }) {
  return (
    <Link to="/" className={`brand ${className}`}>
      <span className="brand-mark" aria-hidden="true">HD</span>
      <span className="brand-text">
        IT Help Desk
        <span className="brand-sub">Service management</span>
      </span>
    </Link>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

  // "All tickets" and "My tickets" share /tickets; the assignee filter decides which is highlighted.
  const onMyQueue = location.pathname === '/tickets' && new URLSearchParams(location.search).get('assignedTo') === 'me';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`app-shell ${menuOpen ? 'nav-open' : ''}`}>
      <aside id="sidebar" className="sidebar">
        <Brand />
        <nav className="sidebar-nav" aria-label="Main">
          {navSectionsFor(user).map((section) => (
            <div key={section.title} className="nav-section">
              <p className="nav-section-title">{section.title}</p>
              {section.items.map((item) =>
                item.myQueue ? (
                  <Link key={item.to} to={item.to} className={`nav-link ${onMyQueue ? 'active' : ''}`}
                    aria-current={onMyQueue ? 'page' : undefined}>
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </Link>
                ) : (
                  <NavLink key={item.to} to={item.to} end={item.end}
                    className={({ isActive }) => `nav-link ${isActive && !(item.to === '/tickets' && onMyQueue) ? 'active' : ''}`}>
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Avatar name={user.name} size="sm" />
          <div className="sidebar-user">
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-role">{ROLE_LABELS[user.role]}</span>
          </div>
          <button className="icon-btn icon-btn-dark" onClick={handleLogout} title="Sign out">
            <Icon name="logout" size={18} />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-btn menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
            <span className="sr-only">Toggle navigation</span>
          </button>
          <span className="topbar-title">{isStaff(user) ? 'IT Service Desk' : 'IT Help Center'}</span>
          <div className="topbar-user">
            <span className="topbar-user-text">
              <span className="topbar-user-name">{user.name}</span>
              <span className="role-pill">{ROLE_LABELS[user.role]}</span>
            </span>
            <Avatar name={user.name} />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
