import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext.jsx';
import { Brand } from '../components/Layout.jsx';
import { Icon } from '../components/icons.jsx';
import { ErrorBox } from '../components/ui.jsx';

const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';
const DEMO_ACCOUNTS = [
  ['Admin', 'admin@helpdesk.test'],
  ['IT staff', 'staff@helpdesk.test'],
  ['Employee', 'employee@helpdesk.test'],
];
const DEMO_PASSWORD = 'Password123!';

const SELLING_POINTS = [
  'Report IT problems and follow them to resolution',
  'Clear priorities and response-time targets',
  'A full history of every change and reply',
];

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <Brand />
        <div className="auth-pitch">
          <h2>IT support, tracked from request to resolution.</h2>
          <ul className="auth-points">
            {SELLING_POINTS.map((point) => (
              <li key={point}>
                <Icon name="check" size={16} /> {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-brand-foot">Internal IT service desk</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}

function useSignedInRedirect() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const from = location.state?.from?.pathname;
  return <Navigate to={from && from !== '/login' ? from : homePathFor(user)} replace />;
}

export function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const redirect = useSignedInRedirect();
  if (redirect) return redirect;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Sign in" subtitle="Use your work account to continue." footer={<>No account yet? <Link to="/register">Create one</Link></>}>
      <form onSubmit={submit} className="form">
        <ErrorBox error={error} />
        <label>
          Email
          <input type="email" autoComplete="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {SHOW_DEMO && (
        <div className="demo-box">
          <p>
            <strong>Demo accounts</strong> (password <code>{DEMO_PASSWORD}</code>)
          </p>
          <div className="demo-buttons">
            {DEMO_ACCOUNTS.map(([label, email]) => (
              <button key={email} type="button" className="btn btn-ghost btn-sm"
                onClick={() => setForm({ email, password: DEMO_PASSWORD })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthCard>
  );
}

export function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const redirect = useSignedInRedirect();
  if (redirect) return redirect;

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    setError(null);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate('/tickets/new');
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const field = (key) => ({ value: form[key], onChange: (e) => setForm({ ...form, [key]: e.target.value }) });

  return (
    <AuthCard title="Create your account" subtitle="New accounts start as employees." footer={<>Already registered? <Link to="/login">Sign in</Link></>}>
      <form onSubmit={submit} className="form">
        <ErrorBox error={error} />
        <label>
          Full name
          <input autoComplete="name" required minLength={2} maxLength={100} {...field('name')} />
        </label>
        <label>
          Work email
          <input type="email" autoComplete="email" required {...field('email')} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="new-password" required minLength={8} maxLength={128} {...field('password')} />
          <span className="hint">At least 8 characters.</span>
        </label>
        <label>
          Confirm password
          <input type="password" autoComplete="new-password" required {...field('confirm')} />
        </label>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
