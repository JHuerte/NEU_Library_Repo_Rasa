import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useMeta } from '../context.jsx';
import { ErrorBox, Field } from '../components/common.jsx';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

export function Login() {
  const { login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth panel stack tight">
      <div><div className="eyebrow">NEU account</div><h1 className="h-page">Sign in</h1></div>
      <form className="stack tight" onSubmit={submit}>
        <Field label="Email"><input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <ErrorBox error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="small muted" style={{ margin: 0 }}>New student or faculty member? <Link to="/register">Create an account</Link></p>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const meta = useMeta();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student', collegeId: '', department: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, ...(k === 'collegeId' ? { department: '' } : {}) }));
  const college = meta.colleges?.find((c) => c.id === f.collegeId);
  const errs = error?.fields ?? {};

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(f);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth panel stack tight" style={{ maxWidth: 520 }}>
      <div><div className="eyebrow">NEU account</div><h1 className="h-page">Create an account</h1></div>
      <form className="stack tight" onSubmit={submit}>
        <Field label="Full name" hint="Last name, first name" error={errs.name}><input id="reg-name" type="text" value={f.name} onChange={set('name')} placeholder="Dela Cruz, Juan" /></Field>
        <Field label="Email" error={errs.email}><input id="reg-email" type="email" autoComplete="username" value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters" error={errs.password}><input id="reg-password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <div className="radio-cards">
          {[['student', 'Student', 'Submit approved theses and capstone projects'], ['faculty', 'Faculty / researcher', 'Deposit publications and research outputs']].map(([v, l, d]) => (
            <label key={v}><input type="radio" name="reg-role" value={v} checked={f.role === v} onChange={set('role')} /><span><b>{l}</b>{d}</span></label>
          ))}
        </div>
        <div className="grid2">
          <Field label="College" error={errs.collegeId}>
            <select id="reg-college" value={f.collegeId} onChange={set('collegeId')}>
              <option value="">Choose…</option>
              {meta.colleges?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Program / department">
            <select id="reg-dept" value={f.department} onChange={set('department')} disabled={!college}>
              <option value="">Choose…</option>
              {college?.departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
        </div>
        <ErrorBox error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="small muted" style={{ margin: 0 }}>Librarian and administrator accounts are set up by the repository administrator. Already registered? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
