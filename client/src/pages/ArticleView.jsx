import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { ErrorBox, PageLoader } from '../components/ui.jsx';
import { CATEGORY_LABELS, formatDateTime } from '../lib/labels.js';

export default function ArticleView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/knowledge-articles/${id}`).then(setArticle).catch(setError);
  }, [id]);

  const remove = async () => {
    if (!window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return;
    try {
      await api(`/knowledge-articles/${id}`, { method: 'DELETE' });
      navigate('/knowledge');
    } catch (err) {
      setError(err);
    }
  };

  if (error && !article) return <ErrorBox error={error} />;
  if (!article) return <PageLoader />;

  return (
    <article className="narrow">
      <Link to="/knowledge" className="back-link">
        ← Knowledge base
      </Link>
      <ErrorBox error={error} />
      <div className="page-header">
        <div>
          <span className="badge badge-neutral">{CATEGORY_LABELS[article.category]}</span>
          <h1>{article.title}</h1>
          <p className="muted">
            By {article.createdBy.name} · updated {formatDateTime(article.updatedAt)}
            {article.ticket && (
              <>
                {' · from '}
                <Link to={`/tickets/${article.ticket.id}`}>{article.ticket.code}</Link>
              </>
            )}
          </p>
        </div>
        <div className="page-actions">
          {article.canEdit && (
            <Link className="btn btn-secondary" to={`/knowledge/${article.id}/edit`}>
              Edit
            </Link>
          )}
          {article.canDelete && (
            <button className="btn btn-danger" onClick={remove}>
              Delete
            </button>
          )}
        </div>
      </div>
      <section className="card">
        <h2>Problem</h2>
        <p className="prewrap">{article.problem}</p>
      </section>
      <section className="card card-resolution">
        <h2>Solution</h2>
        <p className="prewrap">{article.solution}</p>
      </section>
      {article.tags.length > 0 && (
        <div className="tag-row">
          {article.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
