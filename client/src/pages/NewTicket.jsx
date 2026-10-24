import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorBox, PageHeader } from '../components/ui.jsx';
import { CATEGORY_LABELS, PRIORITY_HINTS, PRIORITY_LABELS, formatBytes } from '../lib/labels.js';

export const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.docx';
export const MAX_FILE_MB = 5;
export const MAX_FILES = 5;

// Mirrors the server's checks so users get instant feedback; the server re-checks everything.
export function checkFiles(files) {
  if (files.length > MAX_FILES) return `You can attach at most ${MAX_FILES} files`;
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_FILES.split(',').includes(ext)) return `"${file.name}" is not allowed. Use PDF, PNG, JPG or DOCX.`;
    if (file.size > MAX_FILE_MB * 1024 * 1024) return `"${file.name}" is larger than ${MAX_FILE_MB}MB`;
  }
  return null;
}

export default function NewTicket() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', category: '', suggestedUrgency: 'MEDIUM', description: '' });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  const onFiles = (event) => {
    const chosen = [...event.target.files];
    const problem = checkFiles(chosen);
    setError(problem);
    setFiles(problem ? [] : chosen);
    if (problem) event.target.value = '';
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    files.forEach((file) => body.append('attachments', file));
    try {
      const ticket = await api('/tickets', { method: 'POST', body });
      navigate(`/tickets/${ticket.id}`, { state: { created: true } });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="narrow">
      <PageHeader title="Report a problem" subtitle="Tell IT what’s wrong. You’ll get email updates as your ticket progresses." />
      <form className="card form" onSubmit={submit}>
        <ErrorBox error={error} />
        <label>
          Short summary
          <input required minLength={5} maxLength={200} placeholder="e.g. Laptop won’t connect to Wi-Fi" {...field('title')} />
        </label>
        <div className="form-row">
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
            How urgent is it?
            <select {...field('suggestedUrgency')}>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} — {PRIORITY_HINTS[value]}
                </option>
              ))}
            </select>
            <span className="hint">IT will confirm the final priority.</span>
          </label>
        </div>
        <label>
          Description
          <textarea required minLength={10} maxLength={10000} rows={7}
            placeholder="What happened? When did it start? Any error messages?" {...field('description')} />
        </label>
        <label>
          Attachments <span className="muted">(optional)</span>
          <input type="file" multiple accept={ACCEPTED_FILES} onChange={onFiles} />
          <span className="hint">
            Up to {MAX_FILES} files, {MAX_FILE_MB}MB each. PDF, PNG, JPG or DOCX.
          </span>
        </label>
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.name}>
                {file.name} <span className="muted">({formatBytes(file.size)})</span>
              </li>
            ))}
          </ul>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
