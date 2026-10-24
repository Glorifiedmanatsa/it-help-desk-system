import { Link } from 'react-router-dom';
import { PRIORITY_LABELS, STATUS_LABELS, formatDateTime } from '../lib/labels.js';

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
      {message}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority, suggested }) {
  if (!priority) {
    return (
      <span className="badge priority-unset" title="Priority not confirmed by IT yet">
        Suggested: {PRIORITY_LABELS[suggested]}
      </span>
    );
  }
  return <span className={`badge priority-${priority.toLowerCase()}`}>{PRIORITY_LABELS[priority]}</span>;
}

// Status color always ships with an icon and a label, never color alone.
export function SlaBadge({ sla, verbose = false }) {
  if (sla.breached) {
    return (
      <span className="badge sla-breached" title={`First response target was ${formatDateTime(sla.dueAt)}`}>
        <span aria-hidden="true">⚠</span> SLA breached
      </span>
    );
  }
  if (!verbose) return null;
  return sla.responded ? (
    <span className="badge sla-ok">
      <span aria-hidden="true">✓</span> SLA met
    </span>
  ) : (
    <span className="badge sla-pending">
      <span aria-hidden="true">◷</span> Respond by {formatDateTime(sla.dueAt)}
    </span>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Previous
      </button>
      <span className="muted">
        Page {page} of {pages}
      </span>
      <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </nav>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}

export const TicketLink = ({ ticket }) => <Link to={`/tickets/${ticket.id}`}>{ticket.code}</Link>;
