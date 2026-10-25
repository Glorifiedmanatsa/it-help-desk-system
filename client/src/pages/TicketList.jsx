import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Icon } from '../components/icons.jsx';
import { CategoryBadge, EmptyState, ErrorBox, PageHeader, Pagination, Person, PriorityBadge, SlaBadge, StatusBadge } from '../components/ui.jsx';
import { ACTIVE_STATUSES, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, formatDateTime, isStaff } from '../lib/labels.js';

const PAGE_SIZE = 20;

function useStaffList(enabled) {
  const [staff, setStaff] = useState([]);
  useEffect(() => {
    if (enabled) api('/users/staff').then((data) => setStaff(data.items)).catch(() => {});
  }, [enabled]);
  return staff;
}

function Select({ label, value, onChange, options, allLabel = 'All' }) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function TicketList({ mode }) {
  const staffView = mode === 'all';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const staff = useStaffList(staffView);
  const [search, setSearch] = useState(params.get('q') ?? '');

  // Filters live in the URL so they survive refresh and the back button.
  const filters = {
    status: params.get('status') ?? (staffView ? ACTIVE_STATUSES : ''),
    priority: params.get('priority') ?? '',
    category: params.get('category') ?? '',
    assignedTo: params.get('assignedTo') ?? '',
    q: params.get('q') ?? '',
    sort: params.get('sort') ?? 'createdAt',
    order: params.get('order') ?? 'desc',
    page: Number(params.get('page') ?? 1),
  };
  const queryKey = params.toString();

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.q) setFilter('q', search);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api('/tickets', { query: { ...filters, mine: !staffView, pageSize: PAGE_SIZE } })
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, staffView]);

  const statusOptions = [[ACTIVE_STATUSES, 'Active (not closed)'], ...Object.entries(STATUS_LABELS)];
  const assigneeOptions = [['me', 'Me'], ['unassigned', 'Unassigned'], ...staff.filter((s) => s.id !== user.id).map((s) => [String(s.id), s.name])];

  return (
    <div>
      <PageHeader
        title={staffView ? 'All tickets' : 'My tickets'}
        subtitle={staffView ? 'Everything reported to IT.' : 'Tickets you have submitted.'}
        actions={
          <Link className="btn btn-primary" to="/tickets/new">
            <Icon name="plus" size={16} /> New ticket
          </Link>
        }
      />

      <div className="filters toolbar">
        <label className="filter filter-search">
          <span>Search</span>
          <input type="search" placeholder="Title or HD-0001" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Select label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={statusOptions} />
        {staffView && (
          <>
            <Select label="Priority" value={filters.priority} onChange={(v) => setFilter('priority', v)}
              options={Object.entries(PRIORITY_LABELS)} />
            <Select label="Assigned to" value={filters.assignedTo} onChange={(v) => setFilter('assignedTo', v)}
              options={assigneeOptions} allLabel="Anyone" />
          </>
        )}
        <Select label="Category" value={filters.category} onChange={(v) => setFilter('category', v)}
          options={Object.entries(CATEGORY_LABELS)} />
        <label className="filter">
          <span>Sort by</span>
          <select value={`${filters.sort}:${filters.order}`} onChange={(e) => {
            const [sort, order] = e.target.value.split(':');
            const next = new URLSearchParams(params);
            next.set('sort', sort);
            next.set('order', order);
            next.delete('page');
            setParams(next, { replace: true });
          }}>
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="priority:desc">Priority (high → low)</option>
            <option value="priority:asc">Priority (low → high)</option>
            <option value="updatedAt:desc">Recently updated</option>
            <option value="status:asc">Status</option>
          </select>
        </label>
      </div>

      <ErrorBox error={error} />
      {!data && !error && <p className="muted">Loading tickets…</p>}
      {data && data.items.length === 0 && (
        <EmptyState title="No tickets match these filters">
          {!staffView && (
            <Link className="btn btn-primary" to="/tickets/new">
              Report a problem
            </Link>
          )}
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="table-card">
            <div className="table-card-header">
              <span className="result-count">
                {data.total} ticket{data.total === 1 ? '' : 's'}
              </span>
            </div>
            <table className="table ticket-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Category</th>
                  {staffView && <th>Submitted by</th>}
                  <th>Assigned to</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((ticket) => (
                  <tr key={ticket.id} className="clickable" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                    <td data-label="Ticket">
                      <Link className="ticket-key-link" to={`/tickets/${ticket.id}`} onClick={(e) => e.stopPropagation()}>
                        {ticket.code}
                      </Link>
                    </td>
                    <td data-label="Title" className="cell-title">
                      {ticket.title}
                      {ticket._count.attachments > 0 && (
                        <span className="attach-flag" title="Has attachments">
                          <Icon name="paperclip" size={14} />
                          <span className="sr-only">Has attachments</span>
                        </span>
                      )}
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td data-label="Priority">
                      <div className="badge-stack">
                        <PriorityBadge priority={ticket.priority} suggested={ticket.suggestedUrgency} />
                        {isStaff(user) && <SlaBadge sla={ticket.sla} />}
                      </div>
                    </td>
                    <td data-label="Category">
                      <CategoryBadge category={ticket.category} />
                    </td>
                    {staffView && (
                      <td data-label="Submitted by">
                        <Person user={ticket.submittedBy} />
                      </td>
                    )}
                    <td data-label="Assigned to">
                      <Person user={ticket.assignedTo} fallback="Unassigned" />
                    </td>
                    <td data-label="Created" className="nowrap">
                      {formatDateTime(ticket.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setFilter('page', p)} />
        </>
      )}
    </div>
  );
}
