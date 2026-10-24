import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ErrorBox, PageHeader } from '../components/ui.jsx';
import { ROLE_LABELS, formatDate } from '../lib/labels.js';

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [filters, setFilters] = useState({ q: '', role: '' });
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      api('/users', { query: filters }).then((d) => setUsers(d.items)).catch(setError);
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const update = async (user, body) => {
    setSavingId(user.id);
    setError(null);
    try {
      const { user: updated } = await api(`/users/${user.id}`, { method: 'PATCH', body });
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Change roles and deactivate accounts. Deactivated users can no longer sign in." />
      <div className="filters card">
        <label className="filter filter-search">
          <span>Search</span>
          <input type="search" placeholder="Name or email" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </label>
        <label className="filter">
          <span>Role</span>
          <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
            <option value="">All</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorBox error={error} />
      {users && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const self = user.id === me.id;
              const saving = savingId === user.id;
              return (
                <tr key={user.id} className={user.isActive ? '' : 'row-inactive'}>
                  <td data-label="Name">
                    {user.name} {self && <span className="muted">(you)</span>}
                  </td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Role">
                    <select aria-label={`Role for ${user.name}`} value={user.role} disabled={self || saving}
                      onChange={(e) => update(user, { role: e.target.value })}>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Status">
                    <div className="inline-form">
                      <span className={`badge ${user.isActive ? 'sla-ok' : 'badge-neutral'}`}>{user.isActive ? 'Active' : 'Deactivated'}</span>
                      {!self && (
                        <button className={`btn btn-sm ${user.isActive ? 'btn-ghost' : 'btn-secondary'}`} disabled={saving}
                          onClick={() => update(user, { isActive: !user.isActive })}>
                          {user.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td data-label="Joined">{formatDate(user.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
