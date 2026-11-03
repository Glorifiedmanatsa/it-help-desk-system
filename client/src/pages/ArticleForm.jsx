import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../components/icons.jsx';
import { ErrorBox, PageHeader, PageLoader, PanelSection } from '../components/ui.jsx';
import { CATEGORY_LABELS } from '../lib/labels.js';

const EMPTY = { title: '', category: '', problem: '', solution: '', tags: '' };
const parseTags = (text) => text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

// Handles three cases: a new article, a new article pre-filled from a ticket, and editing.
export default function ArticleForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const ticketId = params.get('ticket');
  const navigate = useNavigate();
  const [form, setForm] = useState(id || ticketId ? null : EMPTY);
  const [sourceTicket, setSourceTicket] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id) {
      api(`/knowledge-articles/${id}`)
        .then((a) => {
          if (!a.canEdit) return navigate('/403', { replace: true });
          setSourceTicket(a.ticket);
          setForm({ title: a.title, category: a.category, problem: a.problem, solution: a.solution, tags: a.tags.join(', ') });
        })
        .catch(setError);
    } else if (ticketId) {
      api(`/tickets/${ticketId}`)
        .then((t) => {
          setSourceTicket(t);
          setForm({ title: t.title, category: t.category, problem: t.description, solution: t.resolutionNotes ?? '', tags: '' });
        })
        .catch(setError);
    }
  }, [id, ticketId, navigate]);

  if (error && !form) return <ErrorBox error={error} />;
  if (!form) return <PageLoader />;

  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...form, tags: parseTags(form.tags) };
    try {
      const article = id
        ? await api(`/knowledge-articles/${id}`, { method: 'PATCH', body })
        : await api(ticketId ? `/tickets/${ticketId}/knowledge-article` : '/knowledge-articles', { method: 'POST', body });
      navigate(`/knowledge/${article.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={id ? 'Edit article' : 'New knowledge base article'}
        subtitle={
          sourceTicket && (
            <>
              Based on ticket <Link to={`/tickets/${sourceTicket.id}`}>{sourceTicket.code}</Link>. Remove any personal details before saving.
            </>
          )
        }
      />
      <div className="layout-panel">
        <form className="card form form-card" onSubmit={submit}>
          <ErrorBox error={error} />
          <label>
            Title
            <input required minLength={5} maxLength={200} {...field('title')} />
          </label>
          <label>
            Category
            <select required {...field('category')}>
              <option value="" disabled>
                Choose a category
              </option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Problem
            <textarea required minLength={10} maxLength={10000} rows={5} {...field('problem')} />
          </label>
          <label>
            Solution
            <textarea required minLength={10} maxLength={10000} rows={8} {...field('solution')} />
          </label>
          <label>
            Tags
            <input placeholder="vpn, outlook, password" {...field('tags')} />
            <span className="hint">Comma-separated, up to 10.</span>
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save article'}
            </button>
          </div>
        </form>
        <aside className="info-panel" aria-label="Writing tips">
          {sourceTicket && (
            <PanelSection title="Source ticket">
              <Link className="kb-link" to={`/tickets/${sourceTicket.id}`}>
                <Icon name="ticket" /> <strong>{sourceTicket.code}</strong> {sourceTicket.title}
              </Link>
            </PanelSection>
          )}
          <PanelSection title="Writing a good article">
            <ul className="steps steps-plain">
              <li>Use a title people would search for, e.g. the error message.</li>
              <li>Describe the symptoms in the problem, not the person who had them.</li>
              <li>Write the solution as numbered steps another technician can follow.</li>
              <li>Add a few short tags such as <code>vpn</code> or <code>outlook</code>.</li>
            </ul>
          </PanelSection>
          <PanelSection title="Visibility">
            <p className="panel-note">
              <Icon name="lock" size={14} /> Articles are visible to IT staff and admins only.
            </p>
          </PanelSection>
        </aside>
      </div>
    </div>
  );
}
