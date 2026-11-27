export const ROLES = ['student', 'faculty', 'librarian', 'admin'];
export const STAFF_ROLES = ['librarian', 'admin'];
export const SUBMITTER_ROLES = ['student', 'faculty', 'librarian', 'admin'];

export const ACCESS_LEVELS = {
  open: { label: 'Open access', description: 'Anyone can view and download' },
  institutional: { label: 'Institutional', description: 'Signed-in NEU members' },
  restricted: { label: 'Restricted', description: 'Authorized users only' },
  embargo: { label: 'Embargoed', description: 'Full text locked until a set date' },
  metadata_only: { label: 'Metadata only', description: 'Record visible, no full text' },
};

export const STAGES = [
  { key: 'submitted', label: 'Submitted', who: 'author' },
  { key: 'validation', label: 'Initial validation', who: 'system' },
  { key: 'metadata_review', label: 'Metadata review', who: 'librarian' },
  { key: 'content_verification', label: 'Content verification', who: 'librarian' },
  { key: 'librarian_approval', label: 'Librarian approval', who: 'librarian' },
  { key: 'admin_approval', label: 'Admin approval', who: 'admin' },
  { key: 'indexing', label: 'Metadata indexing', who: 'system' },
  { key: 'preservation', label: 'Digital preservation', who: 'system' },
  { key: 'published', label: 'Published', who: 'system' },
];
export const STAGE_KEYS = STAGES.map((s) => s.key);

export const ITEM_STATUSES = ['in_review', 'returned', 'published', 'withdrawn'];

export const DOC_TYPES = [
  'Thesis', 'Capstone Project', 'Research Paper', 'Feasibility Study',
  "Master's Thesis", 'Doctoral Dissertation', 'Graduate Research Paper',
  'Research Article', 'Conference Paper', 'Technical Report', 'Research Project',
  'Annual Report', 'Institutional Research', 'Strategic Plan', 'Accreditation Document', 'Policy', 'Newsletter',
  'Teaching Material', 'Module', 'Learning Object', 'Open Educational Resource',
  'Historical Document', 'Archival Record', 'Photograph', 'Community Material',
  'Multimedia Project', 'Digital Art', 'Music', 'Video', 'Creative Writing',
];

export const ABSTRACT_WORD_LIMIT = 300;
