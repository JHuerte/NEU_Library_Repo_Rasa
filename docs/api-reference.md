# API Reference

All endpoints are under `/api` and exchange JSON, except file uploads (`multipart/form-data`) and file downloads. Errors use the shape `{ "error": "message", "fields": { "fieldName": "message" } }`; see [architecture.md](architecture.md).

**Access** column: *Public* needs no sign-in. *Signed in* is any role. Otherwise the listed roles are required (401 when signed out, 403 for the wrong role).

## Auth (`routes/auth.js`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Create a student or faculty account and sign in |
| POST | `/auth/login` | Public | Sign in. Locks an email for 10 minutes after 5 failures |
| POST | `/auth/logout` | Public | Clear the session cookie |
| GET | `/auth/me` | Public | Current user, or `null` |

## Reference data (`routes/meta.js`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/meta` | Public | Vocabularies the client needs: repository name, handle prefix, abstract word limit, `maxUploadMb`, access levels, workflow stages, document types, colleges, collections with counts |
| GET | `/meta/stats` | Public | Home-page figures: published items, open-access items, distinct contributors, collections |

## Discovery (`routes/items.js`, `routes/browse.js`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/items/search` | Public | Search with filters, facets, sorting and pagination. See [search-and-browse.md](search-and-browse.md) |
| GET | `/items/recent` | Public | Six newest published items |
| GET | `/items/by-handle/:prefix/:number` | Public | Resolve a handle to an item id |
| GET | `/items/:id` | Public | One record and the caller's download access. Unpublished records are visible only to staff and the owner (otherwise 404) |
| GET | `/items/:id/files/:fileId` | Public, subject to the item's access level | Stream a file. `?inline=1` shows a PDF in the browser |
| POST | `/items/:id/access-requests` | Signed in | Ask for a restricted file. Body `{ reason }`, at least 10 characters |
| GET | `/browse/tree` | Public | College, program, collection, year hierarchy with counts |
| GET | `/browse/:by` | Public | Values and counts for `author`, `subject`, `year`, `type`, `program`, `collection` or `college` |

## Submissions (`routes/submissions.js`)

Every role that can sign in may submit (`SUBMITTER_ROLES`).

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/submissions/mine` | Signed in | The caller's submissions with workflow history |
| POST | `/submissions` | Signed in | New submission. Multipart: metadata fields, `license=true`, and `file` (PDF) |
| PUT | `/submissions/:id` | Owner | Fix a returned submission, optionally with a new file, and resubmit |

## Review (`routes/review.js`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/review/queue` | Librarian, admin | Items in review or returned, with per-stage counts. Filters: `status`, `stage` |
| GET | `/review/items/:id` | Librarian, admin | One item with `canApprove` and `canReturn` flags |
| PATCH | `/review/items/:id` | Librarian, admin | Correct metadata or assign a subject. Only fields that really changed are logged in the history |
| POST | `/review/items/:id/approve` | Librarian, admin (admin only at final approval) | Advance one stage; at admin approval, publish |
| POST | `/review/items/:id/return` | Librarian, admin | Return to the author. Body `{ note }`, at least 5 characters |
| GET | `/review/access-requests` | Librarian, admin | Pending access requests |
| POST | `/review/access-requests/:id` | Librarian, admin | Decide a request. Body `{ decision: "approved" \| "denied" }`; records who decided and when |

## Reports (`routes/reports.js`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/reports/summary` | Admin | Totals, items by access level, collection and college, submissions per year, publication growth, top downloaded and viewed items, top searches, contributors, review turnaround, preservation health, last backup |
| POST | `/reports/fixity` | Admin | Re-verify every stored file; returns `{ checked, ok, failed }` |

## Administration (`routes/admin.js`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/users` | Admin | List users (up to 200). Filters: `q` (name or email), `role` |
| PATCH | `/admin/users/:id` | Admin | Change a user's `role` or `active` flag. An administrator cannot remove their own admin role or deactivate their own account |
| POST | `/admin/collections` | Admin | Create a collection |
| PATCH | `/admin/collections/:id` | Admin | Edit a collection |
| POST | `/admin/colleges` | Admin | Create a college or office |
| PATCH | `/admin/colleges/:id` | Admin | Edit a college or office |
| GET | `/admin/activity` | Admin | The 40 latest workflow events across all items and the 20 latest downloads |

## Help chatbot (`routes/faq.js`, `routes/chat.js`)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/faq` | Public | All help answers, ordered |
| POST | `/faq` | Librarian, admin | Create a help answer. Requires `question`, `answer` and at least one keyword. A URL-safe `slug` is generated from the question |
| PUT | `/faq/:id` | Librarian, admin | Update a help answer |
| DELETE | `/faq/:id` | Librarian, admin | Delete a help answer |
| POST | `/chat` | Public | Decide which help answer a message asks for. See [chatbot-rasa.md](chatbot-rasa.md) |
