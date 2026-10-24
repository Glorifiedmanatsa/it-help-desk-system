import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { EmptyState, ErrorBox, PageHeader, Pagination } from '../components/ui.jsx';
import { CATEGORY_LABELS, formatDate } from '../lib/labels.js';

const PAGE_SIZE = 12;

export default function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ q: '', category: '', page: 1 });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery((prev) => (prev.q === search ? prev : { ...prev, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api('/knowledge-articles', { query: { ...query, pageSize: PAGE_SIZE } })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div>
      <PageHeader
        title="Knowledge base"
        subtitle="Solutions from past tickets. Visible to IT staff only."
        actions={
          <Link className="btn btn-primary" to="/knowledge/new">
            + New article
          </Link>
        }
      />
      <div className="filters card">
        <label className="filter filter-search">
          <span>Search</span>
          <input type="search" placeholder="Title, problem, solution or tag" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="filter">
          <span>Category</span>
          <select value={query.category} onChange={(e) => setQuery({ ...query, category: e.target.value, page: 1 })}>
            <option value="">All</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ErrorBox error={error} />
      {data && data.items.length === 0 && (
        <EmptyState title="No articles found">
          <p className="muted">Resolve a ticket and use “Save to knowledge base” to add one.</p>
        </EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="article-grid">
            {data.items.map((article) => (
              <Link key={article.id} to={`/knowledge/${article.id}`} className="card article-card">
                <span className="badge badge-neutral">{CATEGORY_LABELS[article.category]}</span>
                <h2>{article.title}</h2>
                <p className="article-excerpt">{article.problem}</p>
                <div className="tag-row">
                  {article.tags.map((tag) => (
                    <span key={tag} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
                <p className="muted small">
                  {article.createdBy.name} · updated {formatDate(article.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setQuery({ ...query, page })} />
        </>
      )}
    </div>
  );
}
