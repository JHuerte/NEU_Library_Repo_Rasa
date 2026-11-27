# Search and Browse

Files: `server/src/routes/items.js` (search), `server/src/routes/browse.js` (browse), `server/src/models/Item.js` (indexes), `client/src/pages/Search.jsx`, `client/src/pages/Browse.jsx`.

Only items with `status: 'published'` are ever searchable or browsable by the public.

## Full-text search

`GET /api/items/search` accepts these query parameters:

| Parameter | Effect |
| --- | --- |
| `q` | Search text |
| `field` | `all` (default), `title`, `author`, `keyword` or `subject` |
| `author`, `subject` | Advanced search: case-insensitive "contains" on that field |
| `department` | Exact program name |
| `yearFrom`, `yearTo` | Inclusive year range |
| `collection` | Collection id |
| `type`, `access`, `college` | Facet filters. May be repeated for several values |
| `sort` | `newest`, `oldest`, or omitted for relevance when `q` is present |
| `page` | 1-based page number. Page size is 20 |

### How the query is built

`buildFilters()` returns two filters from the same request:

- `base`: published status, the search text, and the non-facet filters.
- `full`: `base` plus the facet checkboxes (type, access level, college).

**Searching all fields** uses MongoDB's `$text` operator against the weighted text index on the `Item` model:

| Field | Weight |
| --- | --- |
| `title` | 10 |
| `keywords`, `authors.name` | 6 |
| `subject` | 4 |
| `abstract` | 1 |

A title match therefore ranks far above an abstract match, and results are sorted by `textScore` when `q` is present.

**Searching one field** uses a case-insensitive regular expression. The user's text goes through `escapeRegex()` first so characters such as `.` or `(` are treated literally and cannot break the query or cause pathological patterns.

### Facet counts

The counts beside each filter checkbox come from one aggregation with `$facet` over `base`, not `full`. Counting against `base` means each count shows how many results that checkbox would produce on its own, even while other facet boxes are ticked. The three facets (document type, access level, college) are computed in a single database round trip, together with the page of results and the total, using `Promise.all`.

### Search logging

When a search has text and the user is on page 1, a lower-cased `AccessLog` entry with `action: 'search'` is written without blocking the response. The Reports page uses these to show the most common searches.

## Other item lookups

| Endpoint | Purpose |
| --- | --- |
| `GET /api/items/recent` | The six most recently published items for the home page |
| `GET /api/items/by-handle/:prefix/:number` | Resolves a permanent handle to an item id. The client route `/handle/:prefix/:number` uses it to redirect to the item page |
| `GET /api/items/:id` | One record plus the caller's download access |

## Browse

`GET /api/browse/tree` builds the hierarchy **college, program, collection, year** from a single aggregation that groups published items by those four fields. The code folds the groups into nested maps, adds counts at every level, sorts colleges and programs by name and years newest first, and labels items with no program as "General".

`GET /api/browse/:by` lists the distinct values, with counts, for one way of browsing. `GROUPINGS` in `browse.js` defines them:

| `:by` | Groups by |
| --- | --- |
| `author` | Each author name (the authors array is unwound first) |
| `subject` | Subject heading, ignoring empty values |
| `year` | Publication year, newest first |
| `type` | Document type |
| `program` | Department or program, ignoring empty values |
| `collection`, `college` | Id, joined with `$lookup` to show the name |

An unknown `:by` returns a 400 that lists the valid values. Each entry links to `/search` with the matching filter, so browsing and searching share one results page.
