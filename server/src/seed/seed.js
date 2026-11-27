import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../db.js';
import { config } from '../config.js';
import { STAGES } from '../constants.js';
import { User, College, RepoCollection, Item, Faq, Counter, AccessLog, AccessRequest } from '../models/index.js';
import { saveBuffer } from '../lib/storage.js';
import { makePdf } from './pdf.js';
import { USERS, DEMO_PASSWORD, COLLEGES, COLLECTIONS, ITEMS, FAQS } from './data.js';

const reset = process.argv.includes('--reset');
const DAY = 864e5;

const isLocal = /\/\/(127\.0\.0\.1|localhost)[:/]/.test(config.mongoUri);
const password = process.env.SEED_PASSWORD || (isLocal ? DEMO_PASSWORD : null);
if (!password) {
  console.error('This database is not on this computer, so the demo accounts need a private password.');
  console.error('Add SEED_PASSWORD=<at least 10 characters> to .env, then run the seed again.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('SEED_PASSWORD must be at least 10 characters.');
  process.exit(1);
}

await connectDb();

if (await Item.estimatedDocumentCount()) {
  if (!reset) {
    console.log('The database already has items. Run `npm run seed -- --reset` to delete everything and reload the sample data.');
    await disconnectDb();
    process.exit(0);
  }
}
if (reset) {
  await mongoose.connection.dropDatabase();
  console.log('Deleted existing data, including uploaded files.');
}
await Promise.all([Item, User, College, RepoCollection, Faq].map((m) => m.syncIndexes()));

const colleges = await College.insertMany(COLLEGES);
const collegeId = Object.fromEntries(colleges.map((c) => [c.name, c._id]));
const collections = await RepoCollection.insertMany(COLLECTIONS.map((c, i) => ({ ...c, order: i + 1 })));
const collectionId = Object.fromEntries(collections.map((c) => [c.slug, c._id]));

const users = {};
for (const u of USERS) {
  const user = new User({ ...u, college: collegeId[u.college] });
  await user.setPassword(password);
  await user.save();
  users[u.email] = user;
}
const admin = users['admin@demo.neu.local'];
const librarian = users['librarian@demo.neu.local'];

await Counter.create({ _id: 'handle', seq: 4800 });
let handleSeq = 4800;

const stageIdx = (k) => STAGES.findIndex((s) => s.key === k);
const now = Date.now();

for (const [i, d] of ITEMS.entries()) {
  const pdf = makePdf([
    d.title,
    d.authors.join('; '),
    `${d.documentType} - ${d.department ?? ''} - ${d.year}`,
    'NEU Library Repository (sample file for development)',
    '',
    d.abstract,
  ]);
  const fileName = `${d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.pdf`;
  const file = await saveBuffer(pdf, fileName, 'application/pdf');

  const isQueue = Boolean(d.stage);
  const submittedAt = isQueue ? new Date(now - (i % 6 + 1) * DAY) : new Date(now - (20 + i * 21) * DAY);
  const publishedAt = isQueue ? undefined : new Date(submittedAt.getTime() + (3 + (i % 8)) * DAY);
  const submitter = d.submitter ? users[d.submitter] : admin;

  const history = [
    { stage: 'submitted', action: 'submitted', by: submitter._id, byName: submitter.name, at: submittedAt },
    { stage: 'validation', action: 'validated', byName: 'System', note: 'Automatic checks passed.', at: submittedAt },
  ];
  const lastStage = isQueue ? stageIdx(d.stage) : stageIdx('admin_approval') + 1;
  for (let s = stageIdx('metadata_review'); s < lastStage && s <= stageIdx('admin_approval'); s += 1) {
    const by = STAGES[s].key === 'admin_approval' ? admin : librarian;
    history.push({ stage: STAGES[s].key, action: 'approved', by: by._id, byName: by.name, note: `${STAGES[s].label} complete.`, at: new Date(Math.min(now, submittedAt.getTime() + (s - 1) * 0.2 * DAY)) });
  }
  let handle;
  if (!isQueue) {
    handle = `${config.handlePrefix}/${++handleSeq}`;
    history.push(
      { stage: 'indexing', action: 'indexed', byName: 'System', note: 'Added to the search index.', at: publishedAt },
      { stage: 'preservation', action: 'preserved', byName: 'System', note: 'File checksums verified and stored.', at: publishedAt },
      { stage: 'published', action: 'published', byName: 'System', note: `Published as hdl:${handle}`, at: publishedAt },
    );
  }
  if (d.returned) history.push({ stage: d.stage, action: 'returned', by: librarian._id, byName: librarian.name, note: d.returned, at: new Date(now - 0.5 * DAY) });

  await Item.create({
    title: d.title,
    abstract: d.abstract,
    authors: d.authors.map((name) => ({ name })),
    adviser: d.adviser,
    year: d.year,
    documentType: d.documentType,
    subject: d.subject,
    keywords: d.keywords,
    repoCollection: collectionId[d.collection],
    college: collegeId[d.college],
    department: d.department,
    accessLevel: d.accessLevel,
    embargoUntil: d.embargoUntil ? new Date(d.embargoUntil) : undefined,
    rights: d.accessLevel === 'open' ? 'CC BY-NC 4.0' : `© ${d.year} the author(s). All rights reserved.`,
    files: [{ ...file, lastFixityCheck: publishedAt, fixityOk: isQueue ? undefined : true }],
    handle,
    status: d.returned ? 'returned' : isQueue ? 'in_review' : 'published',
    stage: isQueue ? d.stage : 'published',
    history,
    submittedBy: submitter._id,
    submittedAt,
    publishedAt,
    views: d.views ?? 0,
    downloads: d.downloads ?? 0,
  });
}
await Counter.updateOne({ _id: 'handle' }, { seq: handleSeq });

await Faq.insertMany(FAQS.map((f, i) => ({ ...f, order: i + 1 })));

const searches = ['artificial intelligence', 'flood', 'thesis', 'santos', 'artificial intelligence', 'library', 'nursing', 'flood', 'artificial intelligence', 'accreditation'];
await AccessLog.insertMany(searches.map((query, i) => ({ action: 'search', query, at: new Date(now - i * DAY) })));
const restricted = await Item.findOne({ accessLevel: 'restricted', status: 'published' });
await AccessRequest.create({ item: restricted._id, user: users['student@demo.neu.local']._id, reason: 'I am reviewing related literature on student retention for my capstone project.' });

console.log(`Loaded ${colleges.length} colleges, ${collections.length} collections, ${USERS.length} demo accounts, ${ITEMS.length} items and ${FAQS.length} FAQ answers.`);
console.log(`Demo accounts are listed in server/src/seed/data.js${process.env.SEED_PASSWORD ? ' (password: your SEED_PASSWORD)' : ''}.`);
await disconnectDb();
