# Front End

React 18 single-page app built with Vite 6, in `client/`. There is no state-management library; shared state lives in three small context providers.

## Structure

```
client/
  index.html            page shell, fonts, icon, viewport meta
  vite.config.js        dev server on 5173, proxies /api to http://localhost:4000
  src/main.jsx          routes
  src/context.jsx       AppProviders: sign-in, reference data, toast
  src/api.js            fetch wrapper, useApi hook, qs helper
  src/components/       Layout, Chatbot, common
  src/pages/            one file per screen
  src/styles.css        all styling
```

## Routing (`main.jsx`)

All pages render inside `Layout` (header, menu, footer, chatbot).

| Path | Page | Who |
| --- | --- | --- |
| `/` | Home | Everyone |
| `/search`, `/browse` | Search, Browse | Everyone |
| `/items/:id`, `/handle/:prefix/:number` | Item page, handle redirect | Everyone |
| `/login`, `/register` | Auth | Everyone |
| `/submit`, `/submit/:id`, `/my-submissions` | Submit (new or fix a returned one), My submissions | Signed in |
| `/review`, `/review/:id` | Review queue, Review item | Librarian, admin |
| `/admin` | Users, help answers, collections, activity | Librarian, admin (admin-only tabs are enforced by the API) |
| `/reports` | Reports dashboard | Admin |

`RequireRole` (`components/common.jsx`) guards the signed-in and staff routes. Guests are redirected to `/login?next=<page>` so they return to where they were after signing in; a signed-in user with the wrong role sees a short "your account does not have access" notice. It is a convenience for the interface only; **the API enforces every permission** regardless of what the client shows.

## Shared state (`context.jsx`)

`AppProviders` wraps the app and exposes three hooks:

| Hook | Provides |
| --- | --- |
| `useAuth()` | `user` (undefined while loading, `null` for a guest), `loading`, `login`, `register`, `logout`. It calls `/auth/me` once on load |
| `useMeta()` | The reference data from `GET /api/meta` (access levels, stages, document types, colleges, collections) plus `refreshMeta()`. Loaded once so forms and filters never hard-code vocabularies |
| `useToast()` | A function that shows a short status message that disappears after about 3 seconds |

If `/api/meta` cannot be reached, the providers render a single clear message telling the user to start the API instead of a broken page.

`isStaff(user)` is exported for components that show staff-only links.

## API client (`api.js`)

- `api(path, { method, body, form })` calls `/api/<path>` with `credentials: 'same-origin'` so the session cookie is sent. JSON bodies are serialised for you; pass `form` for `FormData` uploads. Network failures and HTTP errors both become an `ApiError` carrying `status`, a readable message and per-field `fields`. A 413 (the platform rejecting an oversized upload) gets a specific message.
- `useApi(path)` loads a path and reloads when it changes. It returns `{ data, error, loading, reload, setData }`. Passing `null` skips the request.
- `qs(params)` builds a query string, repeating array values and omitting empty ones.

## Pages worth knowing

| Page | Notes |
| --- | --- |
| `Search.jsx` | State lives in the URL (`useSearchParams`), so results can be bookmarked and the back button works. Advanced search and facets update the same parameters. On phones the facets collapse behind a **Filters** button that shows how many are selected |
| `Submit.jsx` | Three-step form with a stepper and per-step validation. Checks the file against `meta.maxUploadMb` before uploading so users get an instant message instead of a failed request |
| `ReviewItem.jsx` | Per-stage checklists, a catalog-record editor for librarians, approve and return actions driven by the server's `canApprove` and `canReturn` flags |
| `Reports.jsx` | Dashboard of the figures returned by `/api/reports/summary`, plus the fixity check |
| `Admin.jsx` | Tabs for users, help answers (the chatbot's content), collections and activity |

The chat window is documented in [chatbot-rasa.md](chatbot-rasa.md).

## Styling and responsive design (`styles.css`)

One stylesheet, no framework. Design tokens are CSS custom properties on `:root` (colours, fonts), with a `prefers-color-scheme: dark` block that redefines the same names.

Sections in order: tokens and base, header and navigation, page furniture, buttons and pills, forms, home, search results, item page, browse, submission, workflow and tables, dashboard, toast, auth, chatbot, then the responsive rules.

### Breakpoints

| Rule | Applies when | What changes |
| --- | --- | --- |
| `max-width: 1080px` | Tablets, phones, small laptops | The link row collapses into a **Menu** button that opens a vertical list. `Layout.jsx` keeps `menuOpen` state and closes the menu on navigation |
| `max-width: 960px` | Tablets and below | Two-column pages (results, item, browse, review) stack to one column. Facets and browse tabs become horizontal or collapsible |
| `max-width: 640px` | Phones in portrait | Larger type for form fields (16 px stops iOS from zooming on focus), stacked search bar, collapsible facets, metadata tables turned into label-above-value, chat becomes a full-screen sheet, floating button shrinks to an icon |
| `max-height: 520px` and landscape | Phones on their side | Header stops sticking to the top so it does not eat half the screen, navigation lays out in a row, chat opens as a right-hand panel |
| `pointer: coarse` | Touch screens | Larger tap targets for buttons, checkboxes, chips and tabs |

Other techniques used throughout:

- Grids use `minmax(min(Npx, 100%), 1fr)` so a column never forces horizontal scrolling on a narrow screen.
- Wide tables (`.table-wrap`) and the workflow strip scroll inside their own box instead of widening the page.
- Safe-area insets (`env(safe-area-inset-*)`) keep the chat button and toast clear of phone notches and home bars.
- `100dvh` is used for the full-screen chat so mobile browser toolbars do not cut it off.
- Colour and motion respect user preferences (`prefers-color-scheme`, `prefers-reduced-motion`).
