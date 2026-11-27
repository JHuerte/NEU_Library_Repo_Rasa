import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, useApi } from '../api.js';
import { useMeta, useToast } from '../context.jsx';
import { AccessPill, ErrorBox, Field, Loading, StagePill, StageProgress, fmtBytes, fmtDateTime } from '../components/common.jsx';

const CHECKLISTS = {
  metadata_review: ['Title and authors match the title page', 'Abstract is complete and under the word limit', 'Subject heading assigned', 'Keywords are specific and spelled correctly', 'Adviser and program verified'],
  content_verification: ['PDF opens and is the final approved version', 'Signed approval sheet is included', 'No pages missing or out of order', 'No confidential personal data exposed'],
  librarian_approval: ['Collection and document type are correct', 'Access level matches the signed agreement', 'Embargo date (if any) is correct'],
  admin_approval: ['Librarian review is complete', 'Item is ready to publish under the NEU Library Repository'],
};

const toForm = (it) => ({
  title: it.title, authors: it.authors.join('\n'), adviser: it.adviser ?? '', year: String(it.year), documentType: it.documentType,
  collectionId: it.collection?.id ?? '', collegeId: it.college?.id ?? '', department: it.department ?? '', subject: it.subject ?? '',
  keywords: it.keywords.join(', '), abstract: it.abstract, accessLevel: it.accessLevel,
  embargoUntil: it.embargoUntil ? it.embargoUntil.slice(0, 10) : '',
});

export default function ReviewItem() {
  const { id } = useParams();
  const meta = useMeta();
  const toast = useToast();
  const { data, loading, error, setData } = useApi(`/review/items/${id}`);
  const item = data?.item;
  const [f, setF] = useState(null);
  const [checked, setChecked] = useState({});
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (item) setF(toForm(item)); }, [item]);
  useEffect(() => { setChecked({}); }, [item?.stage]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!f) return <Loading />;

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value, ...(k === 'collegeId' ? { department: '' } : {}) }));
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(item));
  const college = meta.colleges?.find((c) => c.id === f.collegeId);
  const checklist = CHECKLISTS[item.stage] ?? [];
  const allChecked = checklist.every((_, i) => checked[i]);
  const file = item.files.at(-1);
  const fieldErrors = actionError?.fields ?? {};

  async function run(fn, success) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fn();
      setData(res);
      toast(success(res.item));
      setNote('');
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => api(`/review/items/${id}`, {
    method: 'PATCH',
    body: { ...f, authors: f.authors.split('\n').map((a) => a.trim()).filter(Boolean).join('\n'), keywords: f.keywords },
  }), () => 'Metadata saved');
  const approve = () => run(() => api(`/review/items/${id}/approve`, { method: 'POST', body: { note } }),
    (it) => (it.status === 'published' ? `Published as hdl:${it.handle}` : `Moved to ${meta.stages.find((s) => s.key === it.stage)?.label}`));
  const giveBack = () => run(() => api(`/review/items/${id}/return`, { method: 'POST', body: { note } }), () => 'Returned to the author with your notes');

  return (
    <div className="stack" style={{ gap: 20 }}>
      <nav className="crumbs"><Link to="/review">Review queue</Link><span>{item.title.slice(0, 60)}{item.title.length > 60 ? '…' : ''}</span></nav>
      <div className="row between">
        <div className="row"><StagePill item={item} /><AccessPill level={item.accessLevel} />{item.handle && <span className="mono muted">hdl:{item.handle}</span>}</div>
        <Link className="btn small" to={`/items/${item.id}`}>View public record</Link>
      </div>
      <StageProgress item={item} />

      <div className="review-layout">
        <section className="panel stack tight">
          <h2 className="h-sec" style={{ margin: 0 }}>Catalog record</h2>
          <Field label="Title" error={fieldErrors.title}><input id="rv-title" type="text" value={f.title} onChange={set('title')} /></Field>
          <div className="grid2">
            <Field label="Authors" hint="One per line" error={fieldErrors.authors}><textarea id="rv-authors" rows={3} value={f.authors} onChange={set('authors')} style={{ minHeight: 72 }} /></Field>
            <div className="stack tight">
              <Field label="Adviser"><input id="rv-adviser" type="text" value={f.adviser} onChange={set('adviser')} /></Field>
              <Field label="Year" error={fieldErrors.year}><input id="rv-year" type="number" value={f.year} onChange={set('year')} /></Field>
            </div>
            <Field label="Subject heading" hint="Assigned by the librarian"><input id="rv-subject" type="text" value={f.subject} onChange={set('subject')} placeholder="e.g. Library and Information Science" /></Field>
            <Field label="Keywords" hint="Comma-separated"><input id="rv-keywords" type="text" value={f.keywords} onChange={set('keywords')} /></Field>
            <Field label="Document type"><select id="rv-type" value={f.documentType} onChange={set('documentType')}>{meta.docTypes?.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Collection"><select id="rv-collection" value={f.collectionId} onChange={set('collectionId')}>{meta.collections?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="College / office"><select id="rv-college" value={f.collegeId} onChange={set('collegeId')}>{meta.colleges?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Program / department"><select id="rv-dept" value={f.department} onChange={set('department')}><option value="">—</option>{college?.departments.map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Field label="Access level"><select id="rv-access" value={f.accessLevel} onChange={set('accessLevel')}>{Object.entries(meta.accessLevels ?? {}).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            {f.accessLevel === 'embargo' && <Field label="Embargo ends" error={fieldErrors.embargoUntil}><input id="rv-embargo" type="date" value={f.embargoUntil} onChange={set('embargoUntil')} /></Field>}
          </div>
          <Field label="Abstract"><textarea id="rv-abstract" rows={6} value={f.abstract} onChange={set('abstract')} /></Field>
          <div className="row">
            <button type="button" className="btn primary" disabled={!dirty || busy} onClick={save}>Save changes</button>
            {dirty && <button type="button" className="btn ghost" onClick={() => setF(toForm(item))}>Discard changes</button>}
          </div>

          <h2 className="h-sec" style={{ margin: '12px 0 0' }}>Files</h2>
          {item.files.slice().reverse().map((fl) => (
            <div key={fl.id} className="filebox">
              <span className="ext">PDF</span>
              <div style={{ flex: 1, minWidth: 0 }}><b>{fl.name}</b><div className="muted">Version {fl.version} · {fmtBytes(fl.size)} · uploaded {fmtDateTime(fl.uploadedAt)}</div>
                <div className="mono muted" style={{ fontSize: 11, wordBreak: 'break-all' }}>SHA-256 {fl.sha256}</div></div>
              <a className="btn small" href={`/api/items/${item.id}/files/${fl.id}?inline=1`} target="_blank" rel="noreferrer">Open</a>
            </div>
          ))}
        </section>

        <aside className="stack tight">
          <div className="panel stack tight">
            <div><div className="muted small">Submitted by</div><b>{item.submittedBy?.name}</b> <span className="muted small">({item.submittedBy?.role}) · {item.submittedBy?.email}</span></div>
            {item.issues?.length > 0 && <div className="alert error"><b>Automatic check issues</b><ul>{item.issues.map((x) => <li key={x}>{x}</li>)}</ul></div>}

            {(item.canApprove || item.canReturn) && (
              <>
                {checklist.length > 0 && (
                  <div>
                    <h2 className="h-sec" style={{ marginBottom: 4 }}>Checklist</h2>
                    {checklist.map((c, i) => (
                      <label key={c} className="check"><input id={`rv-chk-${i}`} type="checkbox" checked={Boolean(checked[i])} onChange={(e) => setChecked((s) => ({ ...s, [i]: e.target.checked }))} /> {c}</label>
                    ))}
                  </div>
                )}
                <Field label="Note" hint="Required when returning. Optional when approving." error={fieldErrors.note}>
                  <textarea id="rv-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please upload the signed approval sheet." style={{ minHeight: 70 }} />
                </Field>
                {dirty && <div className="alert warn">Save or discard your metadata changes first.</div>}
                <ErrorBox error={actionError} />
                <div className="row">
                  {item.canApprove && (
                    <button type="button" className="btn primary" disabled={busy || dirty || !allChecked} onClick={approve} title={allChecked ? '' : 'Complete the checklist first'}>
                      {item.stage === 'admin_approval' ? 'Approve and publish' : 'Approve'}
                    </button>
                  )}
                  {item.canReturn && <button type="button" className="btn danger" disabled={busy || dirty} onClick={giveBack}>Return to author</button>}
                </div>
              </>
            )}
            {!item.canApprove && item.status === 'in_review' && item.stage === 'admin_approval' && (
              <div className="alert info">Waiting for final approval by a repository administrator.</div>
            )}
            {item.status === 'returned' && <div className="alert warn">Returned to the author. It comes back to this queue when they resubmit.</div>}
            {item.status === 'published' && <div className="alert ok">Published. You can still correct the catalog record.</div>}
          </div>

          <div className="panel">
            <h2 className="h-sec">Workflow history</h2>
            <ol className="trail">
              {item.history.slice().reverse().map((h, i) => (
                <li key={i} className={h.action === 'returned' ? 'returned' : ''}>
                  <div><b style={{ textTransform: 'capitalize' }}>{h.action}</b> · {h.byName}
                    <div className="when">{meta.stages?.find((s) => s.key === h.stage)?.label} · {fmtDateTime(h.at)}</div>
                    {h.note && <div>{h.note}</div>}</div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
