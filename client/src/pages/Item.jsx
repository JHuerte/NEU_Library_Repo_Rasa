import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useApi, qs } from '../api.js';
import { useAuth, useMeta, useToast, isStaff } from '../context.jsx';
import { AccessPill, StagePill, ErrorBox, Loading, fmt, fmtDate, fmtDateTime, fmtBytes } from '../components/common.jsx';

const INSTITUTION = 'NEU';

function citation(it, style, repo) {
  const a = it.authors;
  const h = `hdl:${it.handle ?? 'pending'}`;
  if (style === 'APA') return <>{a.join(', & ')} ({it.year}). <i>{it.title}</i> [{it.documentType}, {INSTITUTION}]. {repo}. {h}</>;
  if (style === 'MLA') return <>{a[0]}{a.length > 2 ? ', et al' : a.length === 2 ? `, and ${a[1]}` : ''}. <i>{it.title}</i>. {it.year}. {INSTITUTION}, {it.documentType}. {repo}, {h}.</>;
  return <>{a.join(', and ')}. “{it.title}.” {it.documentType}, {INSTITUTION}, {it.year}. {h}.</>;
}

function RequestAccess({ item, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/items/${item.id}/access-requests`, { method: 'POST', body: { reason } });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send} className="stack tight">
      <label className="field"><span>Why do you need access?</span>
        <textarea id="access-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Related literature for my thesis on student retention" />
      </label>
      <ErrorBox error={error} />
      <div><button className="btn primary" disabled={busy}>Send request</button></div>
    </form>
  );
}

function AccessBox({ item, access, reload }) {
  const { user } = useAuth();
  const toast = useToast();
  const file = item.files.at(-1);
  const signIn = <Link className="btn primary" to={`/login?next=/items/${item.id}`}>Sign in with your NEU account</Link>;

  if (access.ok && file) {
    const url = `/api/items/${item.id}/files/${file.id}`;
    return (
      <>
        <div className="filebox">
          <span className="ext">{file.name.split('.').pop().toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0 }}><b>{file.name}</b><div className="muted">{fmtBytes(file.size)} · version {file.version}</div></div>
        </div>
        <div className="row">
          <a className="btn primary" href={url}>Download</a>
          {file.mimeType === 'application/pdf' && <a className="btn" href={`${url}?inline=1`} target="_blank" rel="noreferrer">Read online</a>}
        </div>
      </>
    );
  }
  switch (access.reason) {
    case 'sign_in':
      return <><p className="small" style={{ margin: 0 }}>{item.accessLevel === 'restricted' ? 'This document is restricted. Sign in to request access.' : 'Full text is available to NEU students, faculty and staff.'}</p>{signIn}</>;
    case 'request':
      return (
        <>
          <p className="small" style={{ margin: 0 }}>This document contains sensitive or confidential material. Tell the library why you need it and a librarian will review your request.{access.denied ? ' Your previous request was not approved.' : ''}</p>
          <RequestAccess item={item} onDone={() => { toast('Request sent. The library will review it.'); reload(); }} />
        </>
      );
    case 'pending':
      return <p className="small" style={{ margin: 0 }}>Your access request is being reviewed by the library. Check back here later.</p>;
    case 'embargo':
      return <p className="small" style={{ margin: 0 }}>The author has placed this work under embargo. Full text opens on <b>{fmtDate(access.until)}</b>.</p>;
    case 'metadata_only':
      return <p className="small" style={{ margin: 0 }}>Only the catalog record is online. Ask Special Collections at the library to arrange access to the original materials.</p>;
    default:
      return <p className="small" style={{ margin: 0 }}>{user ? 'The full text is not available.' : 'Sign in to see access options.'}</p>;
  }
}

export default function ItemPage() {
  const { id } = useParams();
  const meta = useMeta();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/items/${id}`);
  const [tab, setTab] = useState('overview');
  const [style, setStyle] = useState('APA');

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const { item, access } = data;
  const staff = isStaff(user);

  const dc = [
    ['Title', 'dc.title', item.title],
    ['Author', 'dc.contributor.author', item.authors.join('\n')],
    item.adviser && ['Adviser', 'dc.contributor.advisor', item.adviser],
    ['Date issued', 'dc.date.issued', item.year],
    ['Abstract', 'dc.description.abstract', item.abstract],
    ['Document type', 'dc.type', item.documentType],
    item.subject && ['Subject', 'dc.subject', item.subject],
    ['Keywords', 'dc.subject.keyword', item.keywords.join('; ')],
    ['Academic program', 'local.program', item.department],
    ['College / department', 'local.department', item.college?.name],
    ['Collection', 'local.collection', item.collection?.name],
    ['Publisher', 'dc.publisher', item.publisher],
    ['Language', 'dc.language', item.language],
    item.handle && ['Identifier', 'dc.identifier.uri', `hdl:${item.handle}`],
    item.files.at(-1) && ['Format', 'dc.format.mimetype', item.files.at(-1).mimeType],
    ['Access level', 'local.access', `${meta.accessLevels?.[item.accessLevel]?.label}${item.embargoUntil ? ` until ${fmtDate(item.embargoUntil)}` : ''}`],
    item.rights && ['Rights', 'dc.rights', item.rights],
    ...Object.entries(item.extra ?? {}).map(([k, v]) => [k, `local.${k}`, v]),
  ].filter(Boolean);

  const tabs = [['overview', 'Overview'], ['metadata', 'Full metadata'], ['cite', 'Cite'], item.history && ['history', 'Workflow history']].filter(Boolean);

  async function copyCitation() {
    const text = document.getElementById('cite-text').innerText;
    try {
      await navigator.clipboard.writeText(text);
      toast('Citation copied');
    } catch {
      window.getSelection().selectAllChildren(document.getElementById('cite-text'));
      toast('Press Ctrl+C to copy the selected citation');
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/browse">Browse</Link>
        {item.college && <Link to={`/search${qs({ college: item.college.id })}`}>{item.college.name}</Link>}
        {item.department && <Link to={`/search${qs({ department: item.department })}`}>{item.department}</Link>}
        {item.collection && <Link to={`/search${qs({ collection: item.collection.id })}`}>{item.collection.name}</Link>}
        <span>{item.year}</span>
      </nav>

      {item.status !== 'published' && (
        <div className="alert warn">This record is not public yet. Status: <StagePill item={item} />{staff && <> · <Link to={`/review/${item.id}`}>Open in review queue</Link></>}</div>
      )}

      <div className="item-layout">
        <article className="stack" style={{ gap: 18, minWidth: 0 }}>
          <div className="row"><span className="chip">{item.documentType}</span><AccessPill level={item.accessLevel} /></div>
          <h1 className="item-title">{item.title}</h1>
          <div>{item.authors.join('; ')}{item.adviser && <span className="muted"> · Adviser: {item.adviser}</span>}</div>
          <div className="tabs" role="tablist">
            {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === 'overview' && (
            <>
              <div><h2 className="h-sec">Abstract</h2><p className="abstract">{item.abstract}</p></div>
              <div className="row">{item.keywords.map((k) => <Link key={k} className="chip" to={`/search${qs({ q: k, field: 'keyword' })}`}>{k}</Link>)}</div>
            </>
          )}
          {tab === 'metadata' && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="meta-table"><tbody>
                  {dc.map(([label, key, value]) => (
                    <tr key={key}><th>{label}<code>{key}</code></th><td style={{ whiteSpace: 'pre-line' }}>{value}</td></tr>
                  ))}
                </tbody></table>
              </div>
              <p className="muted small" style={{ margin: 0 }}>Fields follow Dublin Core, with <span className="mono">local.*</span> fields for NEU-specific data.</p>
            </>
          )}
          {tab === 'cite' && (
            <div className="stack tight">
              <div className="row">{['APA', 'MLA', 'Chicago'].map((s) => <button key={s} type="button" className={`btn ${style === s ? 'primary' : ''}`} onClick={() => setStyle(s)}>{s}</button>)}</div>
              <div className="cite" id="cite-text">{citation(item, style, meta.repositoryName)}</div>
              <div><button type="button" className="btn" onClick={copyCitation}>Copy citation</button></div>
            </div>
          )}
          {tab === 'history' && (
            <ol className="trail">
              {item.history.map((h, i) => (
                <li key={i} className={h.action === 'returned' ? 'returned' : ''}>
                  <div><b style={{ textTransform: 'capitalize' }}>{h.action}</b> · {meta.stages?.find((s) => s.key === h.stage)?.label} · {h.byName}
                    <div className="when">{fmtDateTime(h.at)}</div>{h.note && <div>{h.note}</div>}</div>
                </li>
              ))}
            </ol>
          )}
        </article>

        <aside className="stack tight">
          <div className="panel stack tight"><h2 className="h-sec" style={{ margin: 0 }}>Full text</h2><AccessBox item={item} access={access} reload={reload} /></div>
          <div className="panel">
            <h2 className="h-sec">Usage</h2>
            <dl className="kv"><dt>Views</dt><dd>{fmt(item.views)}</dd><dt>Downloads</dt><dd>{fmt(item.downloads)}</dd>{item.publishedAt && <><dt>Published</dt><dd>{fmtDate(item.publishedAt)}</dd></>}</dl>
          </div>
          {item.handle && (
            <div className="panel">
              <h2 className="h-sec">Permanent link</h2>
              <Link className="mono" style={{ wordBreak: 'break-all' }} to={`/handle/${item.handle}`}>hdl:{item.handle}</Link>
              <p className="muted small" style={{ margin: '8px 0 0' }}>This identifier will not change, even if the file is replaced or migrated.</p>
            </div>
          )}
          {staff && <Link className="btn" to={`/review/${item.id}`}>Edit record (librarian)</Link>}
        </aside>
      </div>
    </div>
  );
}

export function HandleRedirect() {
  const { prefix, number } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  useEffect(() => {
    api(`/items/by-handle/${prefix}/${number}`).then((d) => navigate(`/items/${d.id}`, { replace: true })).catch(setError);
  }, [prefix, number, navigate]);
  return error ? <ErrorBox error={error} /> : <Loading what="Resolving handle" />;
}
