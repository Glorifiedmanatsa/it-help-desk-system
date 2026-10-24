import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { homePathFor, useAuth } from './auth/AuthContext.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { Layout } from './components/Layout.jsx';
import { STAFF_ROLES } from './lib/labels.js';
import { Login, Register } from './pages/AuthPages.jsx';
import NewTicket from './pages/NewTicket.jsx';
import TicketList from './pages/TicketList.jsx';
import TicketDetail from './pages/TicketDetail.jsx';
import KnowledgeBase from './pages/KnowledgeBase.jsx';
import ArticleView from './pages/ArticleView.jsx';
import ArticleForm from './pages/ArticleForm.jsx';
import Users from './pages/Users.jsx';
import Reports from './pages/Reports.jsx';

function Home() {
  const { user } = useAuth();
  return <Navigate to={homePathFor(user)} replace />;
}

function Forbidden() {
  return (
    <div className="status-page">
      <p className="status-code">403</p>
      <h1>You don’t have access to this page</h1>
      <p className="muted">This area is limited to a different role. If you think that’s wrong, contact an administrator.</p>
      <Link className="btn btn-primary" to="/">
        Go to my home page
      </Link>
    </div>
  );
}

function NotFound() {
  return (
    <div className="status-page">
      <p className="status-code">404</p>
      <h1>Page not found</h1>
      <Link className="btn btn-primary" to="/">
        Go to my home page
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="tickets/new" element={<NewTicket />} />
        <Route path="my-tickets" element={<TicketList mode="mine" />} />
        <Route path="tickets/:id" element={<TicketDetail />} />

        <Route element={<RequireAuth roles={STAFF_ROLES} />}>
          <Route path="tickets" element={<TicketList mode="all" />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="knowledge/new" element={<ArticleForm />} />
          <Route path="knowledge/:id" element={<ArticleView />} />
          <Route path="knowledge/:id/edit" element={<ArticleForm />} />
        </Route>

        <Route element={<RequireAuth roles={['ADMIN']} />}>
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/reports" element={<Reports />} />
        </Route>

        <Route path="403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
