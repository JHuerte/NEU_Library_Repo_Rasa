const ref = (v) => (v && typeof v === 'object' && v.name ? { id: String(v._id), name: v.name, slug: v.slug } : v ? { id: String(v) } : null);

export function itemSummary(it) {
  return {
    id: String(it._id),
    title: it.title,
    authors: it.authors.map((a) => a.name),
    year: it.year,
    documentType: it.documentType,
    abstract: it.abstract,
    accessLevel: it.accessLevel,
    embargoUntil: it.embargoUntil,
    handle: it.handle,
    college: ref(it.college),
    collection: ref(it.repoCollection),
    department: it.department,
    status: it.status,
    stage: it.stage,
    views: it.views,
    downloads: it.downloads,
    submittedAt: it.submittedAt,
    publishedAt: it.publishedAt,
  };
}

export function itemDetail(it, { includeWorkflow = false } = {}) {
  const out = {
    ...itemSummary(it),
    adviser: it.adviser,
    subject: it.subject,
    keywords: it.keywords,
    language: it.language,
    publisher: it.publisher,
    rights: it.rights,
    extra: Object.fromEntries(it.extra ?? []),
    files: it.files.map((f) => ({
      id: String(f._id),
      name: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      version: f.version,
      uploadedAt: f.uploadedAt,
      sha256: f.sha256,
    })),
  };
  if (includeWorkflow) {
    out.issues = it.issues;
    out.history = it.history.map((h) => ({ stage: h.stage, action: h.action, byName: h.byName, note: h.note, at: h.at }));
    out.submittedBy = it.submittedBy?.name
      ? { id: String(it.submittedBy._id), name: it.submittedBy.name, role: it.submittedBy.role, email: it.submittedBy.email }
      : it.submittedBy ? { id: String(it.submittedBy) } : null;
  }
  return out;
}

export const ITEM_POPULATE = [
  { path: 'college', select: 'name' },
  { path: 'repoCollection', select: 'name slug' },
];
