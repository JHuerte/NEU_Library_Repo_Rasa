import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import http from 'node:http';
import request from 'supertest';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'neu-repo-test-'));
process.env.DATA_DIR = tmp;
process.env.RASA_URL = '';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { User, College, RepoCollection, Item, Faq } = await import('../src/models/index.js');
const { makePdf } = await import('../src/seed/pdf.js');
const { config } = await import('../src/config.js');

let mongo;
let app;
let collegeId;
let collectionId;
const PASSWORD = 'test-password-1';

async function makeUser(email, role) {
  const u = new User({ name: `${role} user`, email, role });
  await u.setPassword(PASSWORD);
  return u.save();
}

async function agentFor(email) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  assert.equal(res.status, 200, res.text);
  return agent;
}

const pdf = makePdf(['Test Thesis', 'Body text']);
const abstract = 'This study tests the repository workflow from submission to publication with a short abstract.';

function submitThesis(agent, { file = pdf, ...overrides } = {}) {
  const fields = {
    title: 'Automated Testing of an Institutional Repository',
    authors: 'Student, Test',
    year: '2026',
    documentType: 'Thesis',
    collectionId,
    collegeId,
    department: 'BS Information Technology',
    keywords: 'testing, repository, workflow',
    abstract,
    accessLevel: 'open',
    license: 'true',
    ...overrides,
  };
  let req = agent.post('/api/submissions');
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  return req.attach('file', file, 'thesis.pdf');
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri('neu_test'));
  await Item.syncIndexes();
  app = createApp();
  collegeId = String((await College.create({ name: 'College of Informatics and Computing Studies', departments: ['BS Information Technology'] }))._id);
  collectionId = String((await RepoCollection.create({ name: 'Undergraduate Research', slug: 'undergraduate-research' }))._id);
  await makeUser('student@test.local', 'student');
  await makeUser('librarian@test.local', 'librarian');
  await makeUser('admin@test.local', 'admin');
  await makeUser('other@test.local', 'student');
});

after(async () => {
  await disconnectDb();
  await mongo.stop();
  await fs.rm(tmp, { recursive: true, force: true });
});

test('sign-in rejects a wrong password and accepts the right one', async () => {
  const bad = await request(app).post('/api/auth/login').send({ email: 'student@test.local', password: 'nope' });
  assert.equal(bad.status, 401);
  const agent = await agentFor('student@test.local');
  const me = await agent.get('/api/auth/me');
  assert.equal(me.body.user.role, 'student');
});

test('self-registration cannot create staff accounts', async () => {
  const res = await request(app).post('/api/auth/register').send({ name: 'Sneaky', email: 'sneaky@test.local', password: 'password123', role: 'admin' });
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.role);
});

test('guests cannot submit or open the review queue', async () => {
  assert.equal((await request(app).post('/api/submissions')).status, 401);
  assert.equal((await request(app).get('/api/review/queue')).status, 401);
  const student = await agentFor('student@test.local');
  assert.equal((await student.get('/api/review/queue')).status, 403);
});

test('a submission goes through every review stage and is published with a handle', async () => {
  const student = await agentFor('student@test.local');
  const librarian = await agentFor('librarian@test.local');
  const admin = await agentFor('admin@test.local');

  const created = await submitThesis(student);
  assert.equal(created.status, 201, created.text);
  const id = created.body.item.id;
  assert.equal(created.body.item.stage, 'metadata_review');
  assert.equal(created.body.item.status, 'in_review');

  assert.equal((await request(app).get(`/api/items/${id}`)).status, 404);

  const edited = await librarian.patch(`/api/review/items/${id}`).send({
    subject: 'Software Testing', authors: 'Student, Test', collectionId, collegeId, keywords: 'testing, repository, workflow',
  });
  assert.equal(edited.body.item.subject, 'Software Testing');
  assert.equal(edited.body.item.history.at(-1).note, 'Updated subject.', 'only fields that really changed are logged');
  for (const expected of ['content_verification', 'librarian_approval', 'admin_approval']) {
    const r = await librarian.post(`/api/review/items/${id}/approve`).send({});
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.item.stage, expected);
  }

  assert.equal((await librarian.post(`/api/review/items/${id}/approve`).send({})).status, 403);
  const published = await admin.post(`/api/review/items/${id}/approve`).send({ note: 'Looks good' });
  assert.equal(published.status, 200, published.text);
  assert.equal(published.body.item.status, 'published');
  assert.match(published.body.item.handle, /^20\.500\.12345\/\d+$/);

  const pub = await request(app).get(`/api/items/${id}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.access.ok, true);
  assert.equal(pub.body.item.history, undefined, 'workflow history is hidden from the public');
  const search = await request(app).get('/api/items/search?q=repository');
  assert.ok(search.body.items.some((it) => it.id === id));
  const fileId = pub.body.item.files[0].id;
  const dl = await request(app).get(`/api/items/${id}/files/${fileId}`);
  assert.equal(dl.status, 200);
  assert.equal(dl.headers['content-type'], 'application/pdf');
  const byHandle = await request(app).get(`/api/items/by-handle/${published.body.item.handle}`);
  assert.equal(byHandle.body.id, id);
});

test('automatic checks return a bad submission, and the author can fix and resubmit it', async () => {
  const student = await agentFor('student@test.local');
  const res = await submitThesis(student, { keywords: 'only-one', file: Buffer.from('not a pdf') });
  assert.equal(res.status, 201);
  assert.equal(res.body.item.status, 'returned');
  assert.ok(res.body.item.issues.some((i) => i.includes('keywords')));
  assert.ok(res.body.item.issues.some((i) => i.includes('not a valid PDF')));

  const id = res.body.item.id;
  const other = await agentFor('other@test.local');
  assert.equal((await other.put(`/api/submissions/${id}`).field('keywords', 'a, b, c')).status, 403);

  const fixed = await student.put(`/api/submissions/${id}`).field('keywords', 'testing, validation, pdf').attach('file', pdf, 'fixed.pdf');
  assert.equal(fixed.status, 200, fixed.text);
  assert.equal(fixed.body.item.status, 'in_review');
  assert.equal(fixed.body.item.stage, 'metadata_review');
  assert.equal(fixed.body.item.files.length, 2);
});

test('a librarian can return a submission with a note', async () => {
  const student = await agentFor('student@test.local');
  const librarian = await agentFor('librarian@test.local');
  const { body } = await submitThesis(student, { title: 'Needs Changes' });
  const noNote = await librarian.post(`/api/review/items/${body.item.id}/return`).send({});
  assert.equal(noNote.status, 400);
  const r = await librarian.post(`/api/review/items/${body.item.id}/return`).send({ note: 'Upload the signed approval sheet.' });
  assert.equal(r.body.item.status, 'returned');
  const mine = await student.get('/api/submissions/mine');
  const it = mine.body.items.find((x) => x.id === body.item.id);
  assert.equal(it.history.at(-1).note, 'Upload the signed approval sheet.');
});

async function publishedItem(overrides) {
  const student = await agentFor('student@test.local');
  const admin = await agentFor('admin@test.local');
  const { body } = await submitThesis(student, overrides);
  for (let i = 0; i < 4; i += 1) await admin.post(`/api/review/items/${body.item.id}/approve`).send({});
  const item = await Item.findById(body.item.id);
  assert.equal(item.status, 'published');
  return item;
}

test('institutional items need sign-in; embargoed items stay locked', async () => {
  const inst = await publishedItem({ title: 'Institutional Item', accessLevel: 'institutional' });
  const guest = await request(app).get(`/api/items/${inst._id}`);
  assert.deepEqual(guest.body.access, { ok: false, reason: 'sign_in' });
  assert.equal((await request(app).get(`/api/items/${inst._id}/files/${inst.files[0]._id}`)).status, 401);
  const other = await agentFor('other@test.local');
  assert.equal((await other.get(`/api/items/${inst._id}`)).body.access.ok, true);

  const emb = await publishedItem({ title: 'Embargoed Item', accessLevel: 'embargo', embargoUntil: '2099-01-01' });
  const res = await other.get(`/api/items/${emb._id}`);
  assert.equal(res.body.access.reason, 'embargo');
  assert.equal((await other.get(`/api/items/${emb._id}/files/${emb.files[0]._id}`)).status, 403);
});

test('restricted items need an approved access request', async () => {
  const item = await publishedItem({ title: 'Restricted Item', accessLevel: 'restricted' });
  const other = await agentFor('other@test.local');
  const librarian = await agentFor('librarian@test.local');
  assert.equal((await other.get(`/api/items/${item._id}`)).body.access.reason, 'request');

  const req = await other.post(`/api/items/${item._id}/access-requests`).send({ reason: 'Related literature for my thesis.' });
  assert.equal(req.status, 201);
  assert.equal((await other.get(`/api/items/${item._id}`)).body.access.reason, 'pending');

  await librarian.post(`/api/review/access-requests/${req.body.request.id}`).send({ decision: 'approved' });
  assert.equal((await other.get(`/api/items/${item._id}`)).body.access.ok, true);
});

test('search filters by facet and reports facet counts', async () => {
  const res = await request(app).get('/api/items/search').query({ type: 'Thesis', access: 'open' });
  assert.equal(res.status, 200);
  assert.ok(res.body.items.every((it) => it.documentType === 'Thesis' && it.accessLevel === 'open'));
  assert.ok(res.body.facets.access.length >= 1);
});

test('reports are for administrators and the fixity check passes', async () => {
  const librarian = await agentFor('librarian@test.local');
  assert.equal((await librarian.get('/api/reports/summary')).status, 403);
  const admin = await agentFor('admin@test.local');
  const summary = await admin.get('/api/reports/summary');
  assert.equal(summary.status, 200, summary.text);
  assert.ok(summary.body.totals.items >= 1);
  const fixity = await admin.post('/api/reports/fixity');
  assert.equal(fixity.body.failed.length, 0);
});

test('librarians can manage help answers; others cannot', async () => {
  await Faq.create({ slug: 'hours', question: 'Hours?', keywords: ['hours'], answer: 'Mon-Fri' });
  const student = await agentFor('student@test.local');
  assert.equal((await student.post('/api/faq').send({ question: 'Q', keywords: 'q', answer: 'A' })).status, 403);
  const librarian = await agentFor('librarian@test.local');
  const created = await librarian.post('/api/faq').send({ question: 'Where is the printer?', keywords: 'printer, print', answer: 'Ground floor.' });
  assert.equal(created.status, 201, created.text);
  const list = await request(app).get('/api/faq');
  assert.ok(list.body.faqs.some((f) => f.keywords.includes('printer')));
});

test('chatbot uses Rasa when it is confident and falls back to keywords', async () => {
  let res = await request(app).post('/api/chat').send({ message: 'What are your opening hours?' });
  assert.equal(res.status, 200, res.text);
  assert.deepEqual([res.body.engine, res.body.kind, res.body.slug], ['keywords', 'faq', 'hours']);
  assert.equal((await request(app).post('/api/chat').send({ message: '  ' })).status, 400);

  const intents = {
    'anong oras kayo bukas': [{ name: 'faq_hours', confidence: 0.93 }],
    'salamat po': [{ name: 'thank', confidence: 0.97 }],
    'something vague': [{ name: 'nlu_fallback', confidence: 0.5 }, { name: 'faq_hours', confidence: 0.3 }, { name: 'faq_unknown_slug', confidence: 0.2 }],
  };
  const fake = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const ranking = intents[JSON.parse(body).text];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ intent: ranking[0], intent_ranking: ranking }));
    });
  });
  await new Promise((r) => fake.listen(0, r));
  config.rasaUrl = `http://127.0.0.1:${fake.address().port}`;
  try {
    res = await request(app).post('/api/chat').send({ message: 'anong oras kayo bukas' });
    assert.deepEqual([res.body.engine, res.body.kind, res.body.slug, res.body.confidence], ['rasa', 'faq', 'hours', 0.93]);
    res = await request(app).post('/api/chat').send({ message: 'salamat po' });
    assert.equal(res.body.kind, 'thanks');
    res = await request(app).post('/api/chat').send({ message: 'something vague' });
    assert.equal(res.body.kind, 'unknown');
    assert.deepEqual(res.body.suggestions, ['hours']);
  } finally {
    config.rasaUrl = '';
    fake.close();
  }

  config.rasaUrl = 'http://127.0.0.1:9';
  try {
    res = await request(app).post('/api/chat').send({ message: 'library hours please' });
    assert.deepEqual([res.body.engine, res.body.slug], ['keywords', 'hours']);
  } finally {
    config.rasaUrl = '';
  }
});
