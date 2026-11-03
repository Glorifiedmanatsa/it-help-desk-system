import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Icon } from '../components/icons.jsx';
import { CategoryBadge, ErrorBox, PageLoader, PanelSection, Person } from '../components/ui.jsx';
import { formatDateTime } from '../lib/labels.js';

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
    <article>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/knowledge">Knowledge base</Link>
        <Icon name="chevronRight" size={14} />
        <span aria-current="page">Article</span>
      </nav>
      <ErrorBox error={error} />
      <div className="page-header">
        <div>
          <h1>{article.title}</h1>
          <div className="badge-row">
            <CategoryBadge category={article.category} />
            {article.tags.map((tag) => (
              <span key={tag} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="page-actions">
          {article.canEdit && (
            <Link className="btn btn-secondary" to={`/knowledge/${article.id}/edit`}>
              <Icon name="edit" size={15} /> Edit
            </Link>
          )}
          {article.canDelete && (
            <button className="btn btn-danger" onClick={remove}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
        </div>
      </div>
      <div className="layout-panel">
        <div>
          <section className="card">
            <h2>Problem</h2>
            <p className="prewrap">{article.problem}</p>
          </section>
          <section className="card card-resolution">
            <h2>
              <Icon name="check" /> Solution
            </h2>
            <p className="prewrap">{article.solution}</p>
          </section>
        </div>
        <aside className="info-panel" aria-label="Article information">
          <PanelSection title="Details">
            <dl className="details">
              <dt>Author</dt>
              <dd>
                <Person user={article.createdBy} />
              </dd>
              <dt>Category</dt>
              <dd>
                <CategoryBadge category={article.category} />
              </dd>
              <dt>Created</dt>
              <dd>{formatDateTime(article.createdAt)}</dd>
              <dt>Updated</dt>
              <dd>{formatDateTime(article.updatedAt)}</dd>
            </dl>
          </PanelSection>
          {article.ticket && (
            <PanelSection title="Source ticket">
              <Link className="kb-link" to={`/tickets/${article.ticket.id}`}>
                <Icon name="ticket" /> <strong>{article.ticket.code}</strong> {article.ticket.title}
              </Link>
            </PanelSection>
          )}
        </aside>
      </div>
    </article>
  );
}
