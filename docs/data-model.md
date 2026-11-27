# Data Model

Mongoose schemas live in `server/src/models/`. The proposal's relational tables map onto MongoDB collections as follows.

| Proposal table | MongoDB |
| --- | --- |
| USER | `users` |
| COLLEGE, DEPARTMENT | `colleges` (programs are a list inside each college) |
| COLLECTION | `collections` (model `RepoCollection`) |
| ITEM, AUTHOR, ITEM_AUTHOR | `items` (authors are a list inside each item) |
| METADATA | `items.extra` plus the Dublin Core fields on the item |
| DIGITAL_FILE | `items.files`, with file contents in GridFS (`files.files`, `files.chunks`) |
| SUBMISSION, APPROVAL | `items.history`, plus `items.stage` and `items.status` |
| ACCESS_LOG | `accesslogs` |
| (added) | `accessrequests`, `faqs`, `counters` |

**Why embed.** Authors, files and history sit inside the item document. An item page needs all of them at once, they are never shared between items, and they are small, so one read returns everything and updates to an item are a single atomic write.

## `User` (`User.js`)

| Field | Notes |
| --- | --- |
| `name`, `email` | Email is unique, lower-cased and trimmed |
| `passwordHash` | bcrypt hash. Never sent to the client |
| `role` | One of `student`, `faculty`, `librarian`, `admin` (`ROLES`). Default `student` |
| `college`, `department` | Optional affiliation |
| `active` | False blocks sign-in and invalidates existing sessions |

Methods: `setPassword()`, `checkPassword()`, `toPublic()` (the safe shape sent to the browser).

## `College` (`College.js`)

A college or office with a `name`, a `code` and an embedded `departments` list of programs. Programs are embedded because they are always read together with their college.

## `RepoCollection` (`Collection.js`)

A repository collection such as "Undergraduate Research" (proposal section 1B): `name`, `slug`, `description`, `subtypes` (the document types it holds) and `order`. The model is named `RepoCollection` because `collection` is a reserved key in Mongoose documents; items refer to it through the field `repoCollection`.

## `Item` (`Item.js`)

The central record.

| Group | Fields |
| --- | --- |
| Dublin Core | `title`, `abstract`, `authors[{ name, user }]`, `adviser`, `year`, `documentType`, `subject`, `keywords[]`, `language`, `publisher`, `rights` |
| Institutional | `repoCollection`, `college`, `department`, `extra` (a map of extra field name to value for institution-specific metadata) |
| Access | `accessLevel` (default `open`), `embargoUntil` |
| Files | `files[]` (see [file-storage-and-preservation.md](file-storage-and-preservation.md)) |
| Identity | `handle`, unique and sparse so unpublished items can leave it empty |
| Workflow | `status`, `stage`, `issues[]`, `history[]`, `submittedBy`, `submittedAt`, `publishedAt` |
| Statistics | `views`, `downloads` |

`history` entries are sub-documents without their own `_id`: `{ stage, action, by, byName, note, at }`.

Indexes:

| Index | Used for |
| --- | --- |
| Text index `item_text` over title, abstract, keywords, subject and author names, with weights 10, 1, 6, 4, 6 | Full-text search |
| `{ status, publishedAt: -1 }` | Recent items, published listings |
| `{ status, stage }` | The librarian review queue and stage counts |
| `{ submittedBy }` | "My submissions" |

## Supporting collections (`index.js`)

| Model | Purpose |
| --- | --- |
| `AccessLog` | One row per view, download or search (`action`, optional `item` and `user`, `query`, `at`). Feeds the reports. Indexed on `{ action, at }` |
| `AccessRequest` | A user's request for a restricted item: `item`, `user`, `reason`, `status` (`pending`, `approved`, `denied`), `decidedBy`, `decidedAt` |
| `Faq` | Help chatbot answers: `slug` (unique, matches the Rasa intent `faq_<slug>`), `question`, `keywords`, `answer`, `related` (slugs of follow-up questions), `links` (`{ label, to }`), `isSamplePolicy`, `order`. `answer` is plain text; blank lines separate paragraphs and lines beginning with `- ` become bullets |
| `Counter` | A document per named sequence. `_id: 'handle'` holds the last handle number |

## Seed data (`server/src/seed/`)

`npm run seed` loads colleges, collections, four demo accounts (admin, librarian, faculty, student), 21 sample items at different workflow stages and 13 help answers, with generated PDFs stored in GridFS.

- It refuses to run on a database that already has items unless `--reset` is passed, which drops the whole database first.
- The default demo password is public in the repository, so it is accepted only for a local database. For any other database (for example Atlas) `SEED_PASSWORD` must be set to a private value of at least 10 characters, otherwise the script exits with an explanation.
- Indexes are synchronised after a reset so the text index exists before searching.
