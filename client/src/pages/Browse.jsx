import { Link, useSearchParams } from 'react-router-dom';
import { useApi, qs } from '../api.js';
import { Loading, ErrorBox } from '../components/common.jsx';

const TABS = [
  ['college', 'College / department'],
  ['author', 'Author'],
  ['subject', 'Subject'],
  ['year', 'Year'],
  ['type', 'Document type'],
  ['program', 'Program'],
  ['collection', 'Collection'],
];

const searchLink = {
  author: (v) => qs({ author: v }),
  subject: (v) => qs({ subject: v }),
  year: (v) => qs({ yearFrom: v, yearTo: v }),
  type: (v) => qs({ type: v }),
  program: (v) => qs({ department: v }),
  collection: (v) => qs({ collection: v }),
};

function CollegeTree() {
  const { data, loading, error } = useApi('/browse/tree');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>Communities → programs → collections → years</p>
      <ul className="tree">
        {data.tree.map((c) => (
          <li key={c.id}>
            <Link to={`/search${qs({ college: c.id })}`}><b>{c.name}</b></Link><span className="c">{c.count}</span>
            <ul>
              {c.departments.map((d) => (
                <li key={d.name}>
                  <span className="lvl">Program</span>
                  <Link to={`/search${qs({ college: c.id, department: d.name })}`}>{d.name}</Link><span className="c">{d.count}</span>
                  <ul>
                    {d.collections.map((col) => (
                      <li key={col.id}>
                        <span className="lvl">Collection</span>
                        <Link to={`/search${qs({ college: c.id, department: d.name, collection: col.id })}`}>{col.name}</Link><span className="c">{col.count}</span>
                        <ul>
                          {col.years.map((y) => (
                            <li key={y.year}>
                              <Link to={`/search${qs({ college: c.id, department: d.name, collection: col.id, yearFrom: y.year, yearTo: y.year })}`}>{y.year}</Link>
                              <span className="c">{y.count} item{y.count > 1 ? 's' : ''}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

function FlatList({ by }) {
  const { data, loading, error } = useApi(`/browse/${by}`);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data.entries.length) return <div className="empty">Nothing to browse yet.</div>;
  return (
    <div className="list-grid">
      {data.entries.map((e) => (
        <Link key={e.value} to={`/search${searchLink[by](e.value)}`}><span>{e.label}</span><span className="muted">{e.count}</span></Link>
      ))}
    </div>
  );
}

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const by = TABS.some(([k]) => k === params.get('by')) ? params.get('by') : 'college';
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div><div className="eyebrow">Browse</div><h1 className="h-page">Browse the repository</h1></div>
      <div className="browse-layout">
        <div className="vtabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={by === k} onClick={() => setParams({ by: k })}>{l}</button>)}
        </div>
        <section className="panel">{by === 'college' ? <CollegeTree /> : <FlatList by={by} />}</section>
      </div>
    </div>
  );
}
