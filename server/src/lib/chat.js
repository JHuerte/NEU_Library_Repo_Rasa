import { config } from '../config.js';

const CONFIDENT = 0.6;
const SMALL_TALK_CONFIDENT = 0.8;
const SUGGEST = 0.1;
const SMALL_TALK = { greet: 'hello', thank: 'thanks', goodbye: 'bye' };

export function keywordMatch(text, faqs) {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ')} `;
  let best = null;
  let score = 0;
  for (const f of faqs) {
    const s = (f.keywords ?? []).reduce((n, k) => n + (t.includes(` ${k}`) ? (k.trim().includes(' ') ? 3 : 2) : 0), 0);
    if (s > score) { score = s; best = f; }
  }
  return best;
}

function keywordSmallTalk(text) {
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|kumusta|magandang)\b/i.test(text)) return 'hello';
  if (/^(thanks|thank you|salamat|ty)\b/i.test(text)) return 'thanks';
  if (/^(bye|goodbye|paalam)\b/i.test(text)) return 'bye';
  return null;
}

export async function rasaParse(text) {
  if (!config.rasaUrl) return null;
  try {
    const res = await fetch(`${config.rasaUrl}/model/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function classify(text, faqs) {
  const slugs = new Set(faqs.map((f) => f.slug));
  const parsed = await rasaParse(text);

  if (parsed?.intent) {
    const { name, confidence } = parsed.intent;
    const rasa = { engine: 'rasa', intent: name, confidence: Math.round(confidence * 100) / 100 };
    if (SMALL_TALK[name] && confidence >= SMALL_TALK_CONFIDENT) return { ...rasa, kind: SMALL_TALK[name] };
    const slug = name.startsWith('faq_') && name.slice(4);
    if (slug && slugs.has(slug) && confidence >= CONFIDENT) return { ...rasa, kind: 'faq', slug };

    const kw = keywordMatch(text, faqs);
    if (kw) return { engine: 'keywords', kind: 'faq', slug: kw.slug };
    const suggestions = (parsed.intent_ranking ?? [])
      .filter((r) => r.name.startsWith('faq_') && slugs.has(r.name.slice(4)) && r.confidence >= SUGGEST)
      .slice(0, 3)
      .map((r) => r.name.slice(4));
    return { ...rasa, kind: 'unknown', suggestions };
  }

  const talk = keywordSmallTalk(text);
  if (talk) return { engine: 'keywords', kind: talk };
  const kw = keywordMatch(text, faqs);
  return kw ? { engine: 'keywords', kind: 'faq', slug: kw.slug } : { engine: 'keywords', kind: 'unknown', suggestions: [] };
}
