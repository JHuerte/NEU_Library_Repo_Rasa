import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useMeta } from '../context.jsx';

export const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtBytes = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function AccessPill({ level }) {
  const meta = useMeta();
  return <span className={`pill a-${level}`}>{meta.accessLevels?.[level]?.label ?? level}</span>;
}

export function StagePill({ item }) {
  const meta = useMeta();
  if (item.status === 'returned') return <span className="pill s-warn">Changes requested</span>;
  if (item.status === 'published') return <span className="pill s-ok">Published</span>;
  const label = meta.stages?.find((s) => s.key === item.stage)?.label ?? item.stage;
  return <span className="pill s-info">{label}</span>;
}

export function StageProgress({ item }) {
  const meta = useMeta();
  const stages = meta.stages ?? [];
  const idx = stages.findIndex((s) => s.key === item.stage);
  return (
    <div className="progress" aria-label={`Stage ${idx + 1} of ${stages.length}`}>
      {stages.map((s, i) => (
        <span key={s.key} title={s.label} className={item.status === 'returned' && i === idx ? 'flag' : i <= idx ? 'done' : ''} />
      ))}
    </div>
  );
}

export function ResultRow({ item }) {
  return (
    <article className="result">
      <div className="row"><span className="chip">{item.documentType}</span><AccessPill level={item.accessLevel} /></div>
      <h3><Link to={`/items/${item.id}`}>{item.title}</Link></h3>
      <div className="by">{item.authors.join('; ')} · {item.year} · {item.department || item.college?.name}</div>
      <p>{item.abstract}</p>
      {item.handle && <div className="mono muted">hdl:{item.handle}</div>}
    </article>
  );
}

export function Loading({ what = 'Loading' }) {
  return <div className="empty">{what}…</div>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="alert error" role="alert">{error.message ?? String(error)}</div>;
}

export function Field({ label, error, hint, children }) {
  return (
    <label className={`field${error ? ' invalid' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="err">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return <div className="alert warn">Your account ({user.role}) does not have access to this page.</div>;
  }
  return children;
}

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="row between" style={{ alignItems: 'flex-end' }}>
      <div><div className="eyebrow">{eyebrow}</div><h1 className="h-page">{title}</h1></div>
      {children}
    </div>
  );
}
