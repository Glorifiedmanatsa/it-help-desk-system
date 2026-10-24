import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, download } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ErrorBox, PageLoader, PriorityBadge, SlaBadge, StatusBadge } from '../components/ui.jsx';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  SLA_LABELS,
  STATUS_LABELS,
  formatBytes,
  formatDateTime,
  isStaff,
} from '../lib/labels.js';
import { ACCEPTED_FILES, checkFiles } from './NewTicket.jsx';

// Button text for each status change, depending on where the ticket is now.
function transitionLabel(from, to) {
  if (to === 'IN_PROGRESS') return from === 'RESOLVED' ? 'Reopen — still not fixed' : from === 'WAITING_ON_USER' ? 'Resume work' : 'Start work';
  if (to === 'WAITING_ON_USER') return 'Wait for user reply';
  if (to === 'RESOLVED') return 'Resolve…';
  if (to === 'CLOSED') return 'Close — it’s fixed';
  return STATUS_LABELS[to];
}

function describeHistory(entry) {
  const { fieldChanged: field, oldValue: from, newValue: to } = entry;
  switch (field) {
    case 'created':
      return 'created the ticket';
    case 'status':
      return `changed status from ${STATUS_LABELS[from] ?? from} to ${STATUS_LABELS[to] ?? to}`;
    case 'assigned_to':
      return from ? `reassigned the ticket from ${from} to ${to}` : `assigned the ticket to ${to}`;
    case 'priority':
      return from ? `changed priority from ${PRIORITY_LABELS[from]} to ${PRIORITY_LABELS[to]}` : `set priority to ${PRIORITY_LABELS[to]}`;
    case 'resolution_notes':
      return 'added resolution notes';
    case 'comment':
      return 'added a comment';
    case 'internal_note':
      return 'added an internal note';
    case 'attachment':
      return `attached ${to}`;
    default:
      return `updated ${field}`;
  }
}

function StaffControls({ ticket, user, staff, run, busy }) {
  const [assigneeId, setAssigneeId] = useState('');
  const canAssign = ticket.status !== 'CLOSED' && (!ticket.assignedTo || user.role === 'ADMIN');
  const others = staff.filter((s) => s.id !== ticket.assignedTo?.id);

  return (
    <div className="side-section">
      <h3>Triage</h3>
      {canAssign && (
        <div className="control">
          <label htmlFor="assignee">{ticket.assignedTo ? 'Reassign to' : 'Assign to'}</label>
          <div className="inline-form">
            <select id="assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Choose staff…</option>
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.id === user.id ? ' (me)' : ''}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" disabled={!assigneeId || busy}
              onClick={() => run(`/tickets/${ticket.id}/assign`, { assigneeId: Number(assigneeId) }, 'PATCH').then(() => setAssigneeId(''))}>
              Assign
            </button>
          </div>
          {!ticket.assignedTo && staff.some((s) => s.id === user.id) && (
            <button className="btn btn-link" disabled={busy}
              onClick={() => run(`/tickets/${ticket.id}/assign`, { assigneeId: user.id }, 'PATCH')}>
              Assign to me
            </button>
          )}
        </div>
      )}
      {ticket.status !== 'CLOSED' && (
        <div className="control">
          <label htmlFor="priority">Confirmed priority</label>
          <select id="priority" value={ticket.priority ?? ''} disabled={busy}
            onChange={(e) => run(`/tickets/${ticket.id}/priority`, { priority: e.target.value }, 'PATCH')}>
            {!ticket.priority && <option value="">Not set (suggested {PRIORITY_LABELS[ticket.suggestedUrgency]})</option>}
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label} — respond within {SLA_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function StatusActions({ ticket, run, busy }) {
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState(ticket.resolutionNotes ?? '');
  if (ticket.allowedTransitions.length === 0) return null;

  const change = (status, extra = {}) => run(`/tickets/${ticket.id}/status`, { status, ...extra }, 'PATCH');

  return (
    <div className="side-section">
      <h3>Status</h3>
      {!resolving && (
        <div className="button-stack">
          {ticket.allowedTransitions.map((to) => (
            <button key={to} disabled={busy}
              className={`btn ${to === 'RESOLVED' || to === 'CLOSED' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => (to === 'RESOLVED' ? setResolving(true) : change(to))}>
              {transitionLabel(ticket.status, to)}
            </button>
          ))}
        </div>
      )}
      {resolving && (
        <form className="form" onSubmit={(e) => {
          e.preventDefault();
          change('RESOLVED', { resolutionNotes: notes }).then((ok) => ok && setResolving(false));
        }}>
          <label>
            Resolution notes <span className="muted">(required — the user will see these)</span>
            <textarea rows={5} required maxLength={10000} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What was wrong and how it was fixed" />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setResolving(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy || !notes.trim()}>
              Mark resolved
            </button>
          </div>
        </form>
      )}
      {ticket.status === 'RESOLVED' && ticket.allowedTransitions.includes('CLOSED') && (
        <p className="hint">You can reopen within 7 days of the ticket being resolved.</p>
      )}
    </div>
  );
}

function Comments({ ticket, user, run, busy }) {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const staff = isStaff(user);

  const submit = async (event) => {
    event.preventDefault();
    const ok = await run(`/tickets/${ticket.id}/comments`, { body, isInternal }, 'POST');
    if (ok) {
      setBody('');
      setIsInternal(false);
    }
  };

  return (
    <section className="card">
      <h2>Conversation</h2>
      {ticket.comments.length === 0 && <p className="muted">No comments yet.</p>}
      <ol className="comments">
        {ticket.comments.map((c) => (
          <li key={c.id} className={`comment ${c.isInternal ? 'internal' : ''}`}>
            <div className="comment-meta">
              <strong>{c.author.name}</strong>
              {c.author.role !== 'EMPLOYEE' && <span className="role-pill">IT</span>}
              {c.isInternal && <span className="badge badge-internal">Internal note</span>}
              <span className="muted">{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="comment-body">{c.body}</p>
          </li>
        ))}
      </ol>
      {ticket.status !== 'CLOSED' ? (
        <form className="form" onSubmit={submit}>
          <label>
            <span className="sr-only">Add a comment</span>
            <textarea rows={3} required maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={isInternal ? 'Internal note — only IT staff will see this' : 'Write a reply…'} />
          </label>
          <div className="form-actions spread">
            {staff ? (
              <label className="checkbox">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                Internal note (hidden from the submitter)
              </label>
            ) : (
              <span />
            )}
            <button className="btn btn-primary" disabled={busy || !body.trim()}>
              {isInternal ? 'Add note' : 'Send reply'}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">This ticket is closed. Submit a new ticket if the problem comes back.</p>
      )}
    </section>
  );
}

function Attachments({ ticket, run, busy }) {
  const [error, setError] = useState(null);

  const upload = async (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    const problem = checkFiles(files);
    setError(problem);
    if (problem || files.length === 0) return;
    const body = new FormData();
    files.forEach((file) => body.append('attachments', file));
    await run(`/tickets/${ticket.id}/attachments`, body, 'POST');
  };

  const get = (a) => download(`/tickets/${ticket.id}/attachments/${a.id}`, null, a.originalName).catch(setError);

  return (
    <div className="side-section">
      <h3>Attachments</h3>
      <ErrorBox error={error} />
      {ticket.attachments.length === 0 && <p className="muted">None</p>}
      <ul className="attachment-list">
        {ticket.attachments.map((a) => (
          <li key={a.id}>
            <button className="btn btn-link" onClick={() => get(a)}>
              {a.originalName}
            </button>{' '}
            <span className="muted">{formatBytes(a.size)}</span>
          </li>
        ))}
      </ul>
      {ticket.status !== 'CLOSED' && (
        <label className="btn btn-ghost btn-sm file-button">
          + Add files
          <input type="file" multiple accept={ACCEPTED_FILES} onChange={upload} disabled={busy} />
        </label>
      )}
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [ticket, setTicket] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const staffUser = isStaff(user);

  const load = useCallback(() => {
    setError(null);
    return api(`/tickets/${id}`).then(setTicket).catch(setError);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (staffUser) api('/users/staff').then((d) => setStaff(d.items)).catch(() => {});
  }, [staffUser]);

  // Every action returns the refreshed ticket. Resolves true on success.
  const run = async (path, body, method) => {
    setBusy(true);
    setActionError(null);
    try {
      setTicket(await api(path, { method, body }));
      return true;
    } catch (err) {
      setActionError(err);
      if (err.status === 409) load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="narrow">
        <ErrorBox error={error} />
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (!ticket) return <PageLoader />;

  const canSaveToKb = staffUser && ['RESOLVED', 'CLOSED'].includes(ticket.status) && !ticket.knowledgeArticle;

  return (
    <div className="ticket-page">
      <div className="ticket-heading">
        <Link to={staffUser ? '/tickets' : '/my-tickets'} className="back-link">
          ← {staffUser ? 'All tickets' : 'My tickets'}
        </Link>
        <p className="ticket-code">{ticket.code}</p>
        <h1>{ticket.title}</h1>
        <div className="badge-row">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} suggested={ticket.suggestedUrgency} />
          {staffUser && <SlaBadge sla={ticket.sla} verbose />}
        </div>
      </div>

      {location.state?.created && (
        <div className="alert alert-success">Ticket submitted. We’ll email you when IT picks it up.</div>
      )}
      <ErrorBox error={actionError} />

      <div className="ticket-layout">
        <div className="ticket-main">
          <section className="card">
            <h2>Description</h2>
            <p className="prewrap">{ticket.description}</p>
          </section>

          {ticket.resolutionNotes && (
            <section className="card card-resolution">
              <h2>Resolution</h2>
              <p className="prewrap">{ticket.resolutionNotes}</p>
              {ticket.resolvedAt && <p className="muted">Resolved {formatDateTime(ticket.resolvedAt)}</p>}
            </section>
          )}

          <Comments ticket={ticket} user={user} run={run} busy={busy} />

          <section className="card">
            <h2>Timeline</h2>
            <ol className="timeline">
              {ticket.history.map((h) => (
                <li key={h.id} className={h.fieldChanged === 'internal_note' ? 'internal' : ''}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{h.changedBy.name}</strong> {describeHistory(h)}
                    <div className="muted small">{formatDateTime(h.changedAt)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="ticket-side card">
          <dl className="details">
            <dt>Submitted by</dt>
            <dd>{ticket.submittedBy.name}</dd>
            <dt>Assigned to</dt>
            <dd>{ticket.assignedTo?.name ?? <span className="muted">Unassigned</span>}</dd>
            <dt>Category</dt>
            <dd>{CATEGORY_LABELS[ticket.category]}</dd>
            <dt>Suggested urgency</dt>
            <dd>{PRIORITY_LABELS[ticket.suggestedUrgency]}</dd>
            <dt>Created</dt>
            <dd>{formatDateTime(ticket.createdAt)}</dd>
            {ticket.firstResponseAt && (
              <>
                <dt>First response</dt>
                <dd>{formatDateTime(ticket.firstResponseAt)}</dd>
              </>
            )}
            {ticket.closedAt && (
              <>
                <dt>Closed</dt>
                <dd>{formatDateTime(ticket.closedAt)}</dd>
              </>
            )}
          </dl>

          <StatusActions key={ticket.status} ticket={ticket} run={run} busy={busy} />
          {staffUser && <StaffControls ticket={ticket} user={user} staff={staff} run={run} busy={busy} />}
          <Attachments ticket={ticket} run={run} busy={busy} />

          {staffUser && (ticket.knowledgeArticle || canSaveToKb) && (
            <div className="side-section">
              <h3>Knowledge base</h3>
              {ticket.knowledgeArticle ? (
                <Link to={`/knowledge/${ticket.knowledgeArticle.id}`}>{ticket.knowledgeArticle.title}</Link>
              ) : (
                <button className="btn btn-secondary btn-block" onClick={() => navigate(`/knowledge/new?ticket=${ticket.id}`)}>
                  Save to knowledge base
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
