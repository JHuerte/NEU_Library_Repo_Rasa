import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../api.js';
import { useMeta } from '../context.jsx';
import { ResultRow, Loading, ErrorBox, Field } from '../components/common.jsx';
import { SearchBar } from './Home.jsx';

const ADV_KEYS = ['author', 'subject', 'yearFrom', 'yearTo'];

export default function Search() {
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [showAdv, setShowAdv] = useState(params.has('adv') || ADV_KEYS.some((k) => params.get(k)));
  const apiParams = new URLSearchParams(params);
  apiParams.delete('adv');
  const { data, loading, error } = useApi(`/items/search?${apiParams}`);

  const update = (mutate) => {
    const next = new URLSearchParams(params);
    mutate(next);
    next.delete('page');
    setParams(next);
  };
  const toggle = (key, value) => update((p) => {
    const vals = p.getAll(key);
    p.delete(key);
    (vals.includes(value) ? vals.filter((v) => v !== value) : [...vals, value]).forEach((v) => p.append(key, v));
  });

  const q = params.get('q') ?? '';
  const field = params.get('field') ?? 'all';
  const collection = meta.collections?.find((c) => c.id === params.get('collection'));
  const active = [
    q && `“${q}”${field !== 'all' ? ` in ${field}` : ''}`,
    collection && `Collection: ${collection.name}`,
    params.get('department') && `Program: ${params.get('department')}`,
    params.get('author') && `Author: ${params.get('author')}`,
    params.get('subject') && `Subject: ${params.get('subject')}`,
    (params.get('yearFrom') || params.get('yearTo')) && `Year: ${params.get('yearFrom') || '…'}–${params.get('yearTo') || '…'}`,
  ].filter(Boolean);
  const facetCount = ['access', 'type', 'college'].reduce((n, k) => n + params.getAll(k).length, 0);
  const anyFilter = [...params.keys()].some((k) => !['page', 'sort', 'adv'].includes(k));

  function applyAdvanced(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    update((p) => ADV_KEYS.forEach((k) => (fd.get(k) ? p.set(k, fd.get(k)) : p.delete(k))));
  }

  const facet = (title, key, options, labelFor = (o) => o.label) => (
    <div className="facet">
      <h4>{title}</h4>
      {options.length === 0 && <div className="muted small">None</div>}
      {options.map((o) => (
        <label key={o.value}>
          <input type="checkbox" checked={params.getAll(key).includes(o.value)} onChange={() => toggle(key, o.value)} />
          {labelFor(o)}<span className="c">{o.count}</span>
        </label>
      ))}
    </div>
  );

  const page = data?.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const goPage = (n) => { const next = new URLSearchParams(params); next.set('page', n); setParams(next); window.scrollTo(0, 0); };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div><div className="eyebrow">Search</div><h1 className="h-page">Find research and records</h1></div>
      <div>
        <SearchBar key={`${q}|${field}`} initialQ={q} initialField={field} />
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={() => setShowAdv((s) => !s)}>{showAdv ? 'Hide' : 'Show'} advanced search</button>
          {anyFilter && <button type="button" className="btn ghost" onClick={() => setParams({})}>Clear all filters</button>}
        </div>
        {showAdv && (
          <form className="adv panel" onSubmit={applyAdvanced} key={ADV_KEYS.map((k) => params.get(k)).join('|')}>
            <Field label="Author"><input type="text" name="author" defaultValue={params.get('author') ?? ''} placeholder="e.g. Santos" /></Field>
            <Field label="Subject"><input type="text" name="subject" defaultValue={params.get('subject') ?? ''} placeholder="e.g. Artificial Intelligence" /></Field>
            <Field label="Year from"><input type="number" name="yearFrom" defaultValue={params.get('yearFrom') ?? ''} placeholder="2024" /></Field>
            <Field label="Year to"><input type="number" name="yearTo" defaultValue={params.get('yearTo') ?? ''} placeholder="2026" /></Field>
            <div className="field" style={{ justifyContent: 'flex-end' }}><button className="btn primary" type="submit">Apply</button></div>
          </form>
        )}
      </div>

      <div className="results-layout">
        <button type="button" className="btn filters-toggle" aria-expanded={showFilters} aria-controls="search-filters" onClick={() => setShowFilters((s) => !s)}>
          {showFilters ? 'Hide filters' : 'Filters'}{facetCount ? ` (${facetCount})` : ''}
        </button>
        <aside className={`facets${showFilters ? ' open' : ''}`} id="search-filters" aria-label="Filters">
          {data && facet('Access', 'access', data.facets.access, (o) => meta.accessLevels?.[o.value]?.label ?? o.value)}
          {data && facet('Document type', 'type', data.facets.type)}
          {data && facet('College / office', 'college', data.facets.college)}
        </aside>
        <section style={{ minWidth: 0 }}>
          <div className="row between small">
            <span className="muted">{data ? `${data.total} result${data.total === 1 ? '' : 's'}` : ''}{active.length ? ` for ${active.join(' · ')}` : ''}</span>
            <label className="row small">Sort
              <select id="search-sort" style={{ width: 'auto' }} value={params.get('sort') ?? ''} onChange={(e) => update((p) => (e.target.value ? p.set('sort', e.target.value) : p.delete('sort')))}>
                <option value="">{q ? 'Relevance' : 'Newest first'}</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
          <ErrorBox error={error} />
          {loading && !data ? <Loading what="Searching" /> : data?.items.length ? data.items.map((it) => <ResultRow key={it.id} item={it} />) : data && (
            <div className="empty">No items match. Remove a filter or search all fields.</div>
          )}
          {pages > 1 && (
            <div className="pager">
              <button type="button" className="btn small" disabled={page <= 1} onClick={() => goPage(page - 1)}>Previous</button>
              <span className="small muted">Page {page} of {pages}</span>
              <button type="button" className="btn small" disabled={page >= pages} onClick={() => goPage(page + 1)}>Next</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
