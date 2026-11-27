import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, useApi, qs } from '../api.js';
import { useAuth, useToast } from '../context.jsx';
import { ErrorBox, Loading, PageHead, StagePill, fmtDate } from '../components/common.jsx';

function AccessRequests() {
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi(`/review/access-requests?status=${status}`);
  const toast = useToast();
  async function decide(id, decision) {
    await api(`/review/access-requests/${id}`, { method: 'POST', body: { decision } });
    toast(decision === 'approved' ? 'Access granted' : 'Request denied');
    reload();
  }
  return (
    <div className="stack tight">
      <div className="row">
        {['pending', 'approved', 'denied', 'all'].map((s) => (
          <button key={s} type="button" className={`btn small ${status === s ? 'primary' : ''}`} onClick={() => setStatus(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
        ))}
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : !data?.requests.length ? <div className="empty">No {status === 'all' ? '' : status} access requests.</div> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Item</th><th>Requested by</th><th>Reason</th><th>Date</th><th>Decision</th></tr></thead>
          <tbody>{data.requests.map((r) => (
            <tr key={r.id}>
              <td><Link to={`/items/${r.item?.id}`}>{r.item?.title}</Link></td>
              <td>{r.user?.name}<div className="muted small">{r.user?.email} · {r.user?.role}</div></td>
              <td>{r.reason}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
              <td>{r.status === 'pending' ? (
                <div className="row"><button type="button" className="btn small primary" onClick={() => decide(r.id, 'approved')}>Approve</button>
                  <button type="button" className="btn small danger" onClick={() => decide(r.id, 'denied')}>Deny</button></div>
              ) : <span className={`pill ${r.status === 'approved' ? 's-ok' : 's-bad'}`} style={{ textTransform: 'capitalize' }}>{r.status}</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

export default function ReviewQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'submissions';
  const status = params.get('status') ?? 'in_review';
  const stage = params.get('stage') ?? '';
  const { data, loading, error } = useApi(tab === 'submissions' ? `/review/queue${qs({ status, stage })}` : null);
  const setP = (patch) => setParams({ tab, status, stage, ...patch });

  const manual = data?.stageCounts.filter((s) => !['submitted', 'published'].includes(s.key)) ?? [];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead eyebrow={user.role === 'admin' ? 'Repository administrator' : 'Librarian'} title="Review queue" />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'submissions'} onClick={() => setParams({ tab: 'submissions' })}>Submissions</button>
        <button type="button" role="tab" aria-selected={tab === 'requests'} onClick={() => setParams({ tab: 'requests' })}>Access requests{data?.pendingRequests ? ` (${data.pendingRequests})` : ''}</button>
      </div>

      {tab === 'requests' ? <AccessRequests /> : (
        <>
          <div className="pipeline" aria-label="Items in review by stage">
            {manual.map((s) => (
              <button key={s.key} type="button" className={`stage ${s.count ? 'hot' : ''}`} aria-pressed={stage === s.key && status === 'in_review'}
                onClick={() => setP({ status: 'in_review', stage: stage === s.key ? '' : s.key })}>
                <span>{s.label}</span><b>{s.count}</b><span className="muted" style={{ textTransform: 'capitalize' }}>{s.who}</span>
              </button>
            ))}
          </div>
          <div className="row">
            <button type="button" className={`btn small ${status === 'in_review' ? 'primary' : ''}`} onClick={() => setP({ status: 'in_review' })}>In review</button>
            <button type="button" className={`btn small ${status === 'returned' ? 'primary' : ''}`} onClick={() => setP({ status: 'returned', stage: '' })}>Returned to author{data ? ` (${data.returnedCount})` : ''}</button>
          </div>
          <ErrorBox error={error} />
          {loading && !data ? <Loading /> : !data?.items.length ? <div className="empty">Nothing here. The queue is clear.</div> : (
            <div className="table-wrap"><table className="data">
              <thead><tr><th>Submission</th><th>Submitted by</th><th>Stage</th><th>Received</th><th>Your action</th></tr></thead>
              <tbody>{data.items.map((it) => (
                <tr key={it.id} className="click" onClick={() => navigate(`/review/${it.id}`)}>
                  <td><Link to={`/review/${it.id}`} onClick={(e) => e.stopPropagation()}><b>{it.title}</b></Link><div className="muted small">{it.documentType} · {it.department}</div></td>
                  <td>{it.submittedBy?.name}<div className="muted small" style={{ textTransform: 'capitalize' }}>{it.submittedBy?.role}</div></td>
                  <td><StagePill item={it} />{it.issues?.length > 0 && <div className="small" style={{ color: 'var(--bad)', marginTop: 4 }}>{it.issues.length} issue{it.issues.length > 1 ? 's' : ''}</div>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(it.submittedAt)}</td>
                  <td className="small">{it.canApprove ? <span className="pill s-info">Ready for you</span> : it.status === 'returned' ? 'Waiting for author' : 'Admin approval'}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}
    </div>
  );
}
