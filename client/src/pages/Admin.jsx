import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useApi, qs } from '../api.js';
import { useAuth, useMeta, useToast } from '../context.jsx';
import { ErrorBox, Field, Loading, PageHead, fmtDate, fmtDateTime } from '../components/common.jsx';

function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useApi(`/admin/users${qs({ q: query })}`);
  const [actionError, setActionError] = useState(null);

  async function update(u, patch) {
    setActionError(null);
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: patch });
      toast(`Updated ${u.name}`);
      reload();
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <div className="stack tight">
      <form className="row" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
        <input id="user-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" style={{ maxWidth: 320 }} />
        <button className="btn">Search</button>
      </form>
      <ErrorBox error={error || actionError} />
      {loading && !data ? <Loading /> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Name</th><th>College</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>{data?.users.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b><div className="muted small">{u.email}</div></td>
              <td className="small">{u.college ?? '—'}<div className="muted">{u.department}</div></td>
              <td>
                <select aria-label={`Role for ${u.name}`} value={u.role} disabled={u.id === me.id} onChange={(e) => update(u, { role: e.target.value })} style={{ width: 'auto' }}>
                  {['student', 'faculty', 'librarian', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td>
                {u.id === me.id ? <span className="muted small">You</span> : (
                  <button type="button" className={`btn small ${u.active ? '' : 'primary'}`} onClick={() => update(u, { active: !u.active })}>{u.active ? 'Deactivate' : 'Reactivate'}</button>
                )}
              </td>
              <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDate(u.createdAt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

const EMPTY_FAQ = { question: '', keywords: '', answer: '', related: [], links: [], isSamplePolicy: false, order: 0 };

function HelpAnswers() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/faq');
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startEdit = (f) => { setEditing({ ...f, keywords: f.keywords.join(', ') }); setFormError(null); setConfirmDelete(false); };
  const set = (k) => (e) => setEditing((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    setFormError(null);
    try {
      await api(editing.id ? `/faq/${editing.id}` : '/faq', { method: editing.id ? 'PUT' : 'POST', body: editing });
      toast(editing.id ? 'Answer updated' : 'Answer added');
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err);
    }
  }
  async function remove() {
    await api(`/faq/${editing.id}`, { method: 'DELETE' });
    toast('Answer deleted');
    setEditing(null);
    reload();
  }

  if (loading && !data) return <Loading />;
  const errs = formError?.fields ?? {};
  const samples = data?.faqs.filter((f) => f.isSamplePolicy).length ?? 0;

  return (
    <div className="stack tight">
      <ErrorBox error={error} />
      {samples > 0 && <div className="alert warn">{samples} answers still use sample policies. Replace them with NEU Library's actual rules, then untick “Sample policy”.</div>}
      <div className="row between"><span className="muted small">These answers power the Library help assistant. People's questions are matched against the keywords.</span>
        <button type="button" className="btn primary" onClick={() => startEdit(EMPTY_FAQ)}>Add answer</button></div>

      {editing && (
        <form className="panel stack tight" onSubmit={save}>
          <Field label="Question" error={errs.question}><input id="faq-question" type="text" value={editing.question} onChange={set('question')} placeholder="How do I borrow a book?" /></Field>
          <Field label="Keywords" hint="Comma-separated words people might type, in English or Filipino. Words match from their start (“renew” matches “renewal”)." error={errs.keywords}>
            <input id="faq-keywords" type="text" value={editing.keywords} onChange={set('keywords')} placeholder="borrow, loan, hiram" />
          </Field>
          <Field label="Answer" hint="Leave a blank line between paragraphs. Start a line with “- ” for a bullet point." error={errs.answer}>
            <textarea id="faq-answer" rows={8} value={editing.answer} onChange={set('answer')} />
          </Field>
          <label className="check"><input id="faq-sample" type="checkbox" checked={editing.isSamplePolicy} onChange={set('isSamplePolicy')} /> Sample policy (shows a “confirm with the circulation desk” note)</label>
          <ErrorBox error={formError && !Object.keys(errs).length ? formError : null} />
          <div className="row between">
            <div className="row"><button className="btn primary">Save</button><button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button></div>
            {editing.id && (confirmDelete
              ? <div className="row small">Delete this answer? <button type="button" className="btn small danger" onClick={remove}>Delete</button><button type="button" className="btn small" onClick={() => setConfirmDelete(false)}>Keep</button></div>
              : <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>Delete</button>)}
          </div>
        </form>
      )}

      <div className="table-wrap"><table className="data">
        <thead><tr><th>Question</th><th>Keywords</th><th /></tr></thead>
        <tbody>{data?.faqs.map((f) => (
          <tr key={f.id}>
            <td><b>{f.question}</b>{f.isSamplePolicy && <> <span className="pill s-warn">Sample policy</span></>}</td>
            <td className="small muted">{f.keywords.join(', ')}</td>
            <td><button type="button" className="btn small" onClick={() => startEdit(f)}>Edit</button></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function Collections() {
  const meta = useMeta();
  const toast = useToast();
  const [f, setF] = useState({ name: '', description: '', subtypes: '' });
  const [error, setError] = useState(null);
  async function add(e) {
    e.preventDefault();
    setError(null);
    try {
      await api('/admin/collections', { method: 'POST', body: { ...f, subtypes: f.subtypes.split(',').map((s) => s.trim()).filter(Boolean) } });
      toast('Collection added');
      setF({ name: '', description: '', subtypes: '' });
      meta.refreshMeta();
    } catch (err) {
      setError(err);
    }
  }
  return (
    <div className="stack tight">
      <div className="table-wrap"><table className="data">
        <thead><tr><th>Collection</th><th>Sub-collections</th><th className="num">Items</th></tr></thead>
        <tbody>{meta.collections?.map((c) => (
          <tr key={c.id}><td><Link to={`/search?collection=${c.id}`}><b>{c.name}</b></Link><div className="muted small">{c.description}</div></td>
            <td className="small">{c.subtypes.join(', ')}</td><td className="num">{c.itemCount}</td></tr>
        ))}</tbody>
      </table></div>
      <form className="panel stack tight" onSubmit={add}>
        <h2 className="h-sec" style={{ margin: 0 }}>Add a collection</h2>
        <div className="grid2">
          <Field label="Name"><input id="col-name" type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Sub-collections" hint="Comma-separated"><input id="col-subtypes" type="text" value={f.subtypes} onChange={(e) => setF({ ...f, subtypes: e.target.value })} /></Field>
        </div>
        <Field label="Description"><input id="col-desc" type="text" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <ErrorBox error={error} />
        <div><button className="btn primary">Add collection</button></div>
      </form>
    </div>
  );
}

function Activity() {
  const meta = useMeta();
  const { data, loading, error } = useApi('/admin/activity');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="dash-grid">
      <section className="panel"><h2 className="h-sec">Workflow events</h2>
        <ol className="trail">{data.workflow.map((e, i) => (
          <li key={i} className={e.action === 'returned' ? 'returned' : ''}><div>
            <b style={{ textTransform: 'capitalize' }}>{e.action}</b> · {e.by} · <Link to={`/items/${e.itemId}`}>{e.title}</Link>
            <div className="when">{meta.stages?.find((s) => s.key === e.stage)?.label} · {fmtDateTime(e.at)}</div></div></li>
        ))}</ol>
      </section>
      <section className="panel"><h2 className="h-sec">Recent downloads</h2>
        {data.downloads.length ? <ul className="health">{data.downloads.map((d, i) => <li key={i}><span>{d.title}</span><span className="muted small">{d.by} · {fmtDateTime(d.at)}</span></li>)}</ul> : <div className="muted small">No downloads yet.</div>}
      </section>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = user.role === 'admin';
  const tabs = [isAdmin && ['users', 'Users'], ['help', 'Help answers'], isAdmin && ['collections', 'Collections'], isAdmin && ['activity', 'System activity']].filter(Boolean);
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : tabs[0][0];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHead eyebrow={isAdmin ? 'Repository administrator' : 'Librarian'} title="Administration" />
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}>{l}</button>)}
      </div>
      {tab === 'users' && <Users />}
      {tab === 'help' && <HelpAnswers />}
      {tab === 'collections' && <Collections />}
      {tab === 'activity' && <Activity />}
    </div>
  );
}
