import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { useMeta, useToast } from '../context.jsx';
import { ErrorBox, Loading, PageHead, fmt, fmtBytes, fmtDateTime } from '../components/common.jsx';

const ACCESS_COLORS = { open: 'var(--ok)', institutional: 'var(--accent)', restricted: 'var(--bad)', embargo: 'var(--warn)', metadata_only: 'var(--info)' };

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar" key={r.label}>
          <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div className="track"><div className="fill" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          <span className="num">{fmt(r.count)}</span>
        </div>
      ))}
    </div>
  );
}

function Columns({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <>
      <div className="cols">{rows.map((r) => <div className="col" key={r.label}><span>{fmt(r.count)}</span><div style={{ height: `${(r.count / max) * 100}%` }} /></div>)}</div>
      <div className="cols-x">{rows.map((r) => <span key={r.label}>{r.label}</span>)}</div>
    </>
  );
}

export default function Reports() {
  const meta = useMeta();
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/reports/summary');
  const [fixity, setFixity] = useState(null);
  const [checking, setChecking] = useState(false);

  async function runFixity() {
    setChecking(true);
    try {
      const r = await api('/reports/fixity', { method: 'POST' });
      setFixity(r);
      toast(r.failed.length ? `${r.failed.length} file(s) failed the check` : `All ${r.checked} files passed`);
      reload();
    } finally {
      setChecking(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const d = data;
  const total = d.totals.items || 1;
  const p = d.preservation;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead eyebrow="Reports and analytics" title="Repository dashboard"><span className="muted small">Generated {fmtDateTime(d.generatedAt)}</span></PageHead>

      <div className="tiles">
        <div className="tile lead"><b>{fmt(d.totals.items)}</b><span>Published items</span></div>
        <div className="tile"><b>{fmt(d.totals.byAccess.open ?? 0)}</b><span>Open access</span></div>
        <div className="tile"><b>{fmt(d.totals.byAccess.restricted ?? 0)}</b><span>Restricted</span></div>
        <div className="tile"><b>{fmt(d.totals.byAccess.embargo ?? 0)}</b><span>Under embargo</span></div>
        <div className="tile"><b>{fmt(d.totals.contributors)}</b><span>Contributors</span></div>
        <Link className="tile" to="/review" style={{ textDecoration: 'none', color: 'inherit' }}><b>{fmt(d.workflow.inReview)}</b><span>Awaiting review →</span></Link>
      </div>

      <div className="dash-grid">
        <section className="panel">
          <h2 className="h-sec">Access levels</h2>
          <div className="stackbar">
            {Object.entries(d.totals.byAccess).map(([k, n]) => <div key={k} title={`${meta.accessLevels?.[k]?.label}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: ACCESS_COLORS[k] }} />)}
          </div>
          <div className="legend">
            {Object.entries(d.totals.byAccess).map(([k, n]) => <span key={k}><i style={{ background: ACCESS_COLORS[k] }} />{meta.accessLevels?.[k]?.label} <b>{((n / total) * 100).toFixed(1)}%</b></span>)}
          </div>
          <h3 className="h-sec" style={{ marginTop: 18 }}>Downloads by access level</h3>
          <Bars rows={Object.entries(d.usageByAccess).map(([k, v]) => ({ label: meta.accessLevels?.[k]?.label ?? k, count: v.downloads }))} />
        </section>
        <section className="panel"><h2 className="h-sec">Items by collection</h2><Bars rows={d.byCollection} /></section>
        <section className="panel"><h2 className="h-sec">Items by college / office</h2><Bars rows={d.byCollege} /></section>
        <section className="panel">
          <h2 className="h-sec">Submissions per year</h2>
          <Columns rows={d.submissionsByYear.map((r) => ({ label: String(r.year), count: r.count }))} />
          <h3 className="h-sec" style={{ marginTop: 18 }}>Collection growth, last 12 months</h3>
          <Columns rows={d.growth.map((r) => ({ label: r.month.slice(5), count: r.count }))} />
        </section>
        <section className="panel">
          <h2 className="h-sec">Submission and approval</h2>
          <ul className="health">
            <li><span>In review now</span><b className="num">{fmt(d.workflow.inReview)}</b></li>
            <li><span>Returned to authors, waiting</span><b className="num">{fmt(d.workflow.returned)}</b></li>
            <li><span>Published this month</span><b className="num">{fmt(d.workflow.approvedThisMonth)}</b></li>
            <li><span>Median days, submission to publication</span><b className="num">{d.workflow.medianDaysToPublish ?? '—'}</b></li>
            <li><span>Submissions ever returned for changes</span><b className="num">{d.workflow.returnRate}%</b></li>
            <li><span>Active contributors (12 months)</span><b className="num">{fmt(d.totals.activeContributors)}</b></li>
          </ul>
        </section>
        <section className="panel">
          <h2 className="h-sec">Most searched (90 days)</h2>
          {d.topSearches.length ? <Bars rows={d.topSearches.map((s) => ({ label: s.query, count: s.count }))} /> : <div className="muted small">No searches yet.</div>}
        </section>
        <section className="panel">
          <h2 className="h-sec">Preservation health</h2>
          <ul className="health">
            <li><span>Stored files</span><span>{fmt(p.files)} files · {fmtBytes(p.bytes)}</span></li>
            <li><span>Fixity (checksum) failures</span><span className={`pill ${p.failedFixity ? 's-bad' : 's-ok'}`}>{p.failedFixity ? `${p.failedFixity} failed` : 'None'}</span></li>
            <li><span>Last fixity check</span><span>{p.lastFixityCheck ? fmtDateTime(p.lastFixityCheck) : 'Never'}</span></li>
            <li><span>Formats at risk</span><span>{p.formatsAtRisk.length ? p.formatsAtRisk.map((f) => `${f.count} ${f.type}`).join(', ') : <span className="pill s-ok">None</span>}</span></li>
            <li><span>Last backup</span><span>{p.lastBackup ?? <span className="pill s-warn">No backup yet</span>}</span></li>
          </ul>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" disabled={checking} onClick={runFixity}>{checking ? 'Checking files…' : 'Run fixity check now'}</button>
          </div>
          {fixity && (
            <div className={`alert ${fixity.failed.length ? 'error' : 'ok'}`} style={{ marginTop: 10 }}>
              Checked {fixity.checked} files: {fixity.ok} passed{fixity.failed.length ? `, ${fixity.failed.length} failed` : ''}.
              {fixity.failed.length > 0 && <ul>{fixity.failed.map((x) => <li key={x.itemId + x.file}>{x.title}: {x.file} ({x.problem})</li>)}</ul>}
            </div>
          )}
          <p className="muted small" style={{ marginBottom: 0 }}>Make a backup from the server with <span className="mono">npm run backup</span>.</p>
        </section>
      </div>

      <div className="dash-grid">
        {[['Most downloaded', d.topDownloaded, 'downloads'], ['Most viewed', d.topViewed, 'views']].map(([title, rows, key]) => (
          <section key={title}>
            <h2 className="h-sec">{title}</h2>
            <div className="table-wrap"><table className="data" style={{ minWidth: 0 }}>
              <thead><tr><th>Title</th><th className="num" style={{ textTransform: 'capitalize' }}>{key}</th></tr></thead>
              <tbody>{rows.map((it) => <tr key={it.id}><td><Link to={`/items/${it.id}`}>{it.title}</Link></td><td className="num">{fmt(it[key])}</td></tr>)}</tbody>
            </table></div>
          </section>
        ))}
      </div>
    </div>
  );
}
