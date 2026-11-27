import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, qs } from '../api.js';
import { useMeta } from '../context.jsx';
import { ResultRow, fmt, Loading } from '../components/common.jsx';

export function SearchBar({ initialQ = '', initialField = 'all' }) {
  const [q, setQ] = useState(initialQ);
  const [field, setField] = useState(initialField);
  const navigate = useNavigate();
  return (
    <form className="searchbar" role="search" onSubmit={(e) => { e.preventDefault(); navigate(`/search${qs({ q, field: field === 'all' ? '' : field })}`); }}>
      <select id="search-field" aria-label="Search field" value={field} onChange={(e) => setField(e.target.value)}>
        <option value="all">All fields</option>
        <option value="title">Title</option>
        <option value="author">Author</option>
        <option value="keyword">Keyword</option>
        <option value="subject">Subject</option>
      </select>
      <input id="search-q" type="search" placeholder="Search titles, authors, keywords…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search terms" />
      <button type="submit">Search</button>
    </form>
  );
}

export default function Home() {
  const meta = useMeta();
  const stats = useApi('/meta/stats');
  const recent = useApi('/items/recent');
  const s = stats.data;

  return (
    <div className="stack">
      <section className="hero">
        <div className="eyebrow">NEU Library</div>
        <h1>Theses, research and records produced at NEU</h1>
        <p>Search work deposited by students, faculty and university offices. Open-access items can be downloaded by anyone; other records show their access rules.</p>
        <SearchBar />
        <div className="row small" style={{ marginTop: 10 }}>
          <Link className="btn ghost" to="/search?adv=1">Advanced search</Link>
          <span className="muted">Try: “flood”, “Santos”, “Artificial Intelligence”</span>
        </div>
        {s && (
          <div className="statline">
            <div><b>{fmt(s.total)}</b>items</div>
            <div><b>{fmt(s.open)}</b>open access</div>
            <div><b>{fmt(s.contributors)}</b>contributors</div>
            <div><b>{fmt(s.collections)}</b>collections</div>
          </div>
        )}
      </section>

      <section>
        <h2 className="h-sec">Collections</h2>
        <div className="colls">
          {(meta.collections ?? []).map((c) => (
            <Link key={c.id} className="coll" to={`/search?collection=${c.id}`}>
              <span className="n">{fmt(c.itemCount)} items</span>
              <h3>{c.name}</h3>
              <p>{c.subtypes.join(' · ')}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h-sec">Recently added</h2>
        {recent.loading ? <Loading /> : recent.data?.items.map((it) => <ResultRow key={it.id} item={it} />)}
      </section>
    </div>
  );
}
