import { Link } from 'react-router-dom';
import { useApi } from '../api.js';
import { useMeta } from '../context.jsx';
import { ErrorBox, Loading, PageHead, StagePill, StageProgress, fmtDate } from '../components/common.jsx';

export default function MySubmissions() {
  const meta = useMeta();
  const { data, loading, error } = useApi('/submissions/mine');

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead eyebrow="Deposit" title="My submissions"><Link className="btn primary" to="/submit">New submission</Link></PageHead>
      <ErrorBox error={error} />
      {loading && <Loading />}
      {data && !data.items.length && <div className="empty">You haven't submitted anything yet. <Link to="/submit">Submit your first research output</Link>.</div>}
      {data?.items.map((it) => {
        const lastReturn = it.history.filter((h) => h.action === 'returned').at(-1);
        const stageLabel = meta.stages?.find((s) => s.key === it.stage)?.label;
        return (
          <div key={it.id} className="panel">
            <div className="row between">
              <Link to={`/items/${it.id}`} style={{ font: '600 17px/1.3 var(--f-display)', color: 'var(--ink)' }}>{it.title}</Link>
              <StagePill item={it} />
            </div>
            <StageProgress item={it} />
            <div className="small muted">
              Submitted {fmtDate(it.submittedAt)}
              {it.status === 'in_review' && ` · Now at: ${stageLabel}`}
              {it.status === 'published' && <> · Published {fmtDate(it.publishedAt)} · <span className="mono">hdl:{it.handle}</span></>}
            </div>
            {it.status === 'returned' && (
              <div className="alert warn" style={{ marginTop: 10 }}>
                <b>Changes requested by {lastReturn?.byName}:</b> {lastReturn?.note}
                {it.issues?.length > 0 && <ul>{it.issues.map((x) => <li key={x}>{x}</li>)}</ul>}
                <div style={{ marginTop: 8 }}><Link className="btn small" to={`/submit/${it.id}`}>Fix and resubmit</Link></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
