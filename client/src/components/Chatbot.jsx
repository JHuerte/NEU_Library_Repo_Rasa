import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const START = ['borrow', 'return', 'renew', 'fines', 'hours', 'thesis'];

function AnswerText({ text }) {
  const blocks = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) {
      const last = blocks.at(-1);
      if (last?.type === 'ul') last.items.push(line.slice(2));
      else blocks.push({ type: 'ul', items: [line.slice(2)] });
    } else if (line.trim()) blocks.push({ type: 'p', text: line });
  }
  return blocks.map((b, i) => (b.type === 'ul'
    ? <ul key={i}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>
    : <p key={i}>{b.text}</p>));
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [faqs, setFaqs] = useState(null);
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && !faqs) {
      api('/faq').then((d) => {
        setFaqs(d.faqs);
        setLog([{ who: 'bot', kind: 'welcome' }]);
      }).catch(() => setLog([{ who: 'bot', kind: 'error' }]));
    }
    if (open) inputRef.current?.focus();
  }, [open, faqs]);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [log, typing]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const bySlug = (slug) => faqs?.find((f) => f.slug === slug);

  function reply(entry) {
    setTyping(true);
    setTimeout(() => { setTyping(false); setLog((l) => [...l, entry]); }, 400);
  }

  async function ask(text) {
    const q = text.trim();
    if (!q || !faqs) return;
    setLog((l) => [...l, { who: 'me', text: q }]);
    setTyping(true);
    let entry;
    try {
      entry = { who: 'bot', ...(await api('/chat', { method: 'POST', body: { message: q } })) };
    } catch {
      entry = { who: 'bot', kind: 'error' };
    }
    setTyping(false);
    setLog((l) => [...l, entry]);
  }

  function choose(slug) {
    const f = bySlug(slug);
    if (!f) return;
    setLog((l) => [...l, { who: 'me', text: f.question }]);
    reply({ who: 'bot', kind: 'faq', slug });
  }

  const Chips = ({ slugs = [], links = [] }) => (
    <div className="chips">
      {links.map((l) => <Link key={l.to} to={l.to}>{l.label} →</Link>)}
      {slugs.map(bySlug).filter(Boolean).map((f) => <button key={f.slug} type="button" onClick={() => choose(f.slug)}>{f.question}</button>)}
    </div>
  );

  function renderBot(m) {
    switch (m.kind) {
      case 'welcome':
        return <><p>Hi! I'm the NEU Library help assistant. I can answer questions about borrowing, returns, renewals, fines, library hours and this repository.</p><Chips slugs={START} /></>;
      case 'hello':
        return <><p>Hello! What would you like to know?</p><Chips slugs={START} /></>;
      case 'thanks':
        return <><p>You're welcome. Anything else?</p><Chips slugs={START.slice(0, 3)} /></>;
      case 'bye':
        return <p>Goodbye! Come back anytime you have a library question.</p>;
      case 'unknown':
        return m.suggestions?.length
          ? <><p>I'm not sure what you mean. Did you mean one of these?</p><Chips slugs={[...m.suggestions, 'contact']} /></>
          : <><p>I don't have an answer for that yet. Try one of these topics, or ask a librarian at the circulation desk.</p><Chips slugs={['contact', ...START.slice(0, 4)]} /></>;
      case 'error':
        return <p>I can't reach the help service right now. Please ask at the circulation desk.</p>;
      default: {
        const f = bySlug(m.slug);
        if (!f) return null;
        return (
          <>
            <AnswerText text={f.answer} />
            {f.isSamplePolicy && <div className="src">Sample policy. Confirm with the circulation desk.</div>}
            {m.engine === 'rasa' && <div className="src">Understood by Rasa AI · {Math.round(m.confidence * 100)}% sure</div>}
            <Chips slugs={f.related} links={f.links} />
          </>
        );
      }
    }
  }

  return (
    <>
      <section className="chat" hidden={!open} aria-label="Library help assistant">
        <div className="chat-head">
          <div className="brand"><div className="mark">?</div></div>
          <div><b>Library Help</b><small>Answers to common questions</small></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close help">×</button>
        </div>
        <div className="chat-log" ref={logRef} aria-live="polite">
          {log.map((m, i) => (
            <div key={i} className={`msg ${m.who}`}>{m.who === 'me' ? m.text : renderBot(m)}</div>
          ))}
          {typing && <div className="msg bot"><span className="typing">Typing…</span></div>}
        </div>
        <form className="chat-form" onSubmit={(e) => { e.preventDefault(); ask(input); setInput(''); }}>
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about borrowing, returns, fines…" aria-label="Your question" autoComplete="off" />
          <button className="btn primary" type="submit">Send</button>
        </form>
      </section>
      <button className="chat-fab" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Library help">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
        <span className="label">Library help</span>
      </button>
    </>
  );
}
