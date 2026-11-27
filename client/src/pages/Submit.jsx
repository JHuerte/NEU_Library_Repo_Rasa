import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useMeta, useToast } from '../context.jsx';
import { ErrorBox, Field, Loading, fmtBytes, fmtDate } from '../components/common.jsx';

const STEPS = ['Describe', 'Upload file', 'Access & license', 'Review & submit'];
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;
const splitKeywords = (s) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

export default function Submit() {
  const { id } = useParams();
  const { user } = useAuth();
  const meta = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [existing, setExisting] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [f, setF] = useState({
    title: '', authors: user?.name ?? '', adviser: '', year: String(new Date().getFullYear()),
    documentType: user?.role === 'faculty' ? 'Research Article' : 'Thesis', collectionId: '',
    collegeId: user?.college ?? '', department: user?.department ?? '',
    keywords: '', abstract: '', accessLevel: 'open', embargoUntil: '', license: false,
  });
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api(`/items/${id}`).then(({ item }) => {
      setExisting(item);
      setF({
        title: item.title, authors: item.authors.join('\n'), adviser: item.adviser ?? '', year: String(item.year),
        documentType: item.documentType, collectionId: item.collection?.id ?? '', collegeId: item.college?.id ?? '',
        department: item.department ?? '', keywords: item.keywords.join(', '), abstract: item.abstract,
        accessLevel: item.accessLevel, embargoUntil: item.embargoUntil ? item.embargoUntil.slice(0, 10) : '', license: false,
      });
    }).catch(setLoadError);
  }, [id]);

  if (loadError) return <ErrorBox error={loadError} />;
  if (id && !existing) return <Loading />;
  if (existing && existing.status !== 'returned') {
    return <div className="alert info">This submission is not waiting for changes, so it can't be edited. <Link to="/my-submissions">Back to My submissions</Link></div>;
  }

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((s) => ({ ...s, [k]: v, ...(k === 'collegeId' ? { department: '' } : {}) }));
  };
  const college = meta.colleges?.find((c) => c.id === f.collegeId);
  const limit = meta.abstractWordLimit ?? 300;
  const maxMb = meta.maxUploadMb ?? 200;

  function check(s) {
    const e = {};
    if (s === 1) {
      if (!f.title.trim()) e.title = 'Enter the title as it appears on the title page.';
      if (!f.authors.trim()) e.authors = 'Add at least one author.';
      if (!/^\d{4}$/.test(f.year)) e.year = 'Enter a 4-digit year.';
      if (!f.collectionId) e.collectionId = 'Choose a collection.';
      if (!f.collegeId) e.collegeId = 'Choose your college or office.';
      if (!f.abstract.trim()) e.abstract = 'Paste the abstract.';
      else if (words(f.abstract) > limit) e.abstract = `Shorten the abstract to ${limit} words.`;
      if (splitKeywords(f.keywords).length < 3) e.keywords = 'Add at least 3 keywords.';
    }
    if (s === 2 && !file && !existing) e.file = 'Choose the PDF to upload.';
    if (s === 2 && file && !/\.pdf$/i.test(file.name)) e.file = 'Upload a PDF file.';
    else if (s === 2 && file && file.size > maxMb * 1024 * 1024) e.file = `This file is ${fmtBytes(file.size)}. The limit is ${maxMb} MB, so compress the PDF first.`;
    if (s === 3) {
      if (f.accessLevel === 'embargo' && !(f.embargoUntil && new Date(f.embargoUntil) > new Date())) e.embargoUntil = 'Choose a date in the future.';
      if (!f.license) e.license = 'You must accept the license to deposit.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => { if (check(step)) setStep(step + 1); };

  async function submit(e) {
    e.preventDefault();
    if (![1, 2, 3].every((s) => { const ok = check(s); if (!ok) setStep(s); return ok; })) return;
    setBusy(true);
    setServerError(null);
    const fd = new FormData();
    const authors = f.authors.split('\n').map((a) => a.trim()).filter(Boolean).join('\n');
    Object.entries({ ...f, authors, keywords: splitKeywords(f.keywords).join(', '), license: String(f.license) })
      .forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('file', file);
    try {
      const { item } = await api(id ? `/submissions/${id}` : '/submissions', { method: id ? 'PUT' : 'POST', form: fd });
      toast(item.status === 'returned' ? 'Submitted, but automatic checks found problems. See the notes.' : 'Submitted. A librarian will review it.');
      navigate('/my-submissions');
    } catch (err) {
      setServerError(err);
      setErrors(err.fields ?? {});
    } finally {
      setBusy(false);
    }
  }

  const accessChoices = Object.entries(meta.accessLevels ?? {}).filter(([k]) => k !== 'metadata_only');

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <div className="eyebrow">Deposit</div>
        <h1 className="h-page">{existing ? 'Fix and resubmit' : 'Submit a research output'}</h1>
      </div>
      {existing && (
        <div className="alert warn">
          <b>Changes requested:</b> {existing.history.filter((h) => h.action === 'returned').at(-1)?.note}
        </div>
      )}
      <ol className="stepper">
        {STEPS.map((s, i) => <li key={s} className={i + 1 < step ? 'done' : i + 1 === step ? 'cur' : ''}>{s}</li>)}
      </ol>

      <form className="panel stack tight" onSubmit={submit} noValidate>
        {step === 1 && (
          <>
            <Field label="Title" error={errors.title}><input id="sub-title" type="text" value={f.title} onChange={set('title')} /></Field>
            <div className="grid2">
              <Field label="Authors" hint="One per line: Last name, First name" error={errors.authors}>
                <textarea id="sub-authors" rows={3} value={f.authors} onChange={set('authors')} style={{ minHeight: 72 }} />
              </Field>
              <div className="stack tight">
                <Field label="Adviser" hint="Last name, First name"><input id="sub-adviser" type="text" value={f.adviser} onChange={set('adviser')} /></Field>
                <Field label="Year" error={errors.year}><input id="sub-year" type="number" value={f.year} onChange={set('year')} /></Field>
              </div>
              <Field label="Document type" error={errors.documentType}>
                <select id="sub-type" value={f.documentType} onChange={set('documentType')}>{meta.docTypes?.map((t) => <option key={t}>{t}</option>)}</select>
              </Field>
              <Field label="Collection" error={errors.collectionId}>
                <select id="sub-collection" value={f.collectionId} onChange={set('collectionId')}>
                  <option value="">Choose…</option>
                  {meta.collections?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="College / office" error={errors.collegeId}>
                <select id="sub-college" value={f.collegeId} onChange={set('collegeId')}>
                  <option value="">Choose…</option>
                  {meta.colleges?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Program / department">
                <select id="sub-dept" value={f.department} onChange={set('department')} disabled={!college}>
                  <option value="">Choose…</option>
                  {college?.departments.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Keywords" hint="Separate with commas. The librarian assigns the subject heading." error={errors.keywords}>
              <input id="sub-keywords" type="text" value={f.keywords} onChange={set('keywords')} placeholder="e.g. RFID, self-checkout, library automation" />
            </Field>
            <Field label="Abstract" error={errors.abstract} hint={`${words(f.abstract)} of ${limit} words`}>
              <textarea id="sub-abstract" rows={7} value={f.abstract} onChange={set('abstract')} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div
              className={`drop${over ? ' over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
            >
              <b>Drop your final PDF here</b>
              <span className="muted small">PDF only, up to {maxMb} MB. Include the signed approval sheet.</span>
              <label className="btn">Choose file<input id="sub-file" type="file" accept="application/pdf,.pdf" hidden onChange={(e) => setFile(e.target.files[0] ?? null)} /></label>
            </div>
            {errors.file && <div className="alert error">{errors.file}</div>}
            {file && (
              <div className="filebox"><span className="ext">PDF</span><div style={{ flex: 1, minWidth: 0 }}><b>{file.name}</b><div className="muted">{fmtBytes(file.size)}</div></div>
                <button type="button" className="btn small" onClick={() => setFile(null)}>Remove</button></div>
            )}
            {existing && !file && (
              <p className="muted small" style={{ margin: 0 }}>Current file: {existing.files.at(-1)?.name} (version {existing.files.at(-1)?.version}). Upload a new one only if you changed the document.</p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="radio-cards">
              {accessChoices.map(([k, v]) => (
                <label key={k}><input type="radio" name="sub-access" value={k} checked={f.accessLevel === k} onChange={set('accessLevel')} /><span><b>{v.label}</b>{v.description}</span></label>
              ))}
            </div>
            {f.accessLevel === 'embargo' && (
              <div style={{ maxWidth: 280 }}>
                <Field label="Embargo ends" hint="Usually 1 to 2 years, for patents or pending publication" error={errors.embargoUntil}>
                  <input id="sub-embargo" type="date" value={f.embargoUntil} onChange={set('embargoUntil')} />
                </Field>
              </div>
            )}
            <label className="check">
              <input id="sub-license" type="checkbox" checked={f.license} onChange={set('license')} />
              <span>I grant NEU a non-exclusive license to preserve and distribute this work in the NEU Library Repository, and I confirm I have the right to deposit it.</span>
            </label>
            {errors.license && <div className="alert error">{errors.license}</div>}
          </>
        )}

        {step === 4 && (
          <>
            <table className="meta-table"><tbody>
              {[
                ['Title', f.title], ['Authors', f.authors], ['Type', f.documentType],
                ['Collection', meta.collections?.find((c) => c.id === f.collectionId)?.name],
                ['College', college?.name], ['Program', f.department], ['Adviser', f.adviser], ['Year', f.year],
                ['Keywords', splitKeywords(f.keywords).join('; ')],
                ['File', file ? `${file.name} (${fmtBytes(file.size)})` : existing ? `${existing.files.at(-1)?.name} (unchanged)` : '—'],
                ['Access', `${meta.accessLevels?.[f.accessLevel]?.label}${f.accessLevel === 'embargo' && f.embargoUntil ? ` until ${fmtDate(f.embargoUntil)}` : ''}`],
              ].map(([k, v]) => <tr key={k}><th>{k}</th><td style={{ whiteSpace: 'pre-line' }}>{v}</td></tr>)}
            </tbody></table>
            <p className="muted small" style={{ margin: 0 }}>After you submit, automatic checks run first. Then a librarian reviews the metadata and file, and an administrator gives final approval. You can follow each step under My submissions.</p>
            <ErrorBox error={serverError} />
          </>
        )}

        <div className="row between" style={{ marginTop: 12 }}>
          <button type="button" className="btn" disabled={step === 1} onClick={() => setStep(step - 1)}>Back</button>
          {step < 4
            ? <button type="button" className="btn primary" onClick={next}>Continue</button>
            : <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Submitting…' : existing ? 'Resubmit for review' : 'Submit for review'}</button>}
        </div>
      </form>
    </div>
  );
}
