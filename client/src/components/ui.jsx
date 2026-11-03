import { Link } from 'react-router-dom';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, formatDateTime } from '../lib/labels.js';
import { Icon } from './icons.jsx';

export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <span className="spinner" aria-hidden="true" /> Loading…
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div className="alert alert-error" role="alert">
      <Icon name="alert" />
      <span>{message}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// Initials on a colour derived from the name, so a person keeps the same colour everywhere.
export function Avatar({ name = '', size = 'md' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`avatar avatar-${size} avatar-c${hash % 6}`} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

export function Person({ user, fallback = '—' }) {
  if (!user) return <span className="person person-empty">{fallback}</span>;
  return (
    <span className="person">
      <Avatar name={user.name} size="sm" />
      <span className="person-name">{user.name}</span>
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`badge lozenge status-${status.toLowerCase()}`}>
      <span className="lozenge-dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority, suggested }) {
  if (!priority) {
    return (
      <span className="badge priority priority-unset" title="Priority not confirmed by IT yet">
        <Icon name={`priority-${suggested.toLowerCase()}`} size={14} />
        Suggested: {PRIORITY_LABELS[suggested]}
      </span>
    );
  }
  return (
    <span className={`badge priority priority-${priority.toLowerCase()}`}>
      <Icon name={`priority-${priority.toLowerCase()}`} size={14} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function CategoryBadge({ category }) {
  return <span className="badge badge-category">{CATEGORY_LABELS[category] ?? category}</span>;
}

// Status color always ships with an icon and a label, never color alone.
export function SlaBadge({ sla, verbose = false }) {
  if (sla.breached) {
    return (
      <span className="badge sla-breached" title={`First response target was ${formatDateTime(sla.dueAt)}`}>
        <Icon name="alert" size={13} /> SLA breached
      </span>
    );
  }
  if (!verbose) return null;
  return sla.responded ? (
    <span className="badge sla-ok">
      <Icon name="check" size={13} /> SLA met
    </span>
  ) : (
    <span className="badge sla-pending">
      <Icon name="clock" size={13} /> Respond by {formatDateTime(sla.dueAt)}
    </span>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <Icon name="chevronLeft" size={14} /> Previous
      </button>
      <span className="muted">
        Page {page} of {pages}
      </span>
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next <Icon name="chevronRight" size={14} />
      </button>
    </nav>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="inbox" size={22} />
      </span>
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}

// A titled block inside a right-hand information panel.
export function PanelSection({ title, children, className = '' }) {
  return (
    <section className={`panel-section ${className}`}>
      <h3 className="panel-title">{title}</h3>
      {children}
    </section>
  );
}

export const TicketLink = ({ ticket }) => <Link to={`/tickets/${ticket.id}`}>{ticket.code}</Link>;
