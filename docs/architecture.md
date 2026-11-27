# Architecture

## Overview

NEU Library Repository is a three-tier web application with a separate AI service for the help chatbot.

```
 Browser (React + Vite)
        |  /api/...
        v
 Express API (Node.js) -----------> Rasa server (Python, port 5005)
        |                           "which help topic is this question about?"
        v
 MongoDB / Atlas
 (records, users, help answers, and uploaded PDFs in GridFS)
```

| Tier | Technology | Location |
| --- | --- | --- |
| Presentation | React 18, React Router 6, Vite 6 | `client/` |
| Application | Node.js 20+, Express 5 | `server/src/`, `api/index.js` |
| Data | MongoDB with Mongoose 8, GridFS for files | `server/src/models/`, `server/src/lib/storage.js` |
| AI service | Rasa Open Source 3.6 (NLU only) | `rasa/`, `scripts/rasa.js` |

The project is an npm workspace with two packages, `server` and `client`. The root `package.json` holds the scripts that run both.

## Request lifecycle

1. The browser calls `/api/...`. In development, Vite proxies `/api` to `http://localhost:4000`. On Vercel, a rewrite in `vercel.json` sends `/api/*` to the serverless function in `api/index.js`.
2. `createApp()` in `server/src/app.js` builds the Express app. Every request passes through three middleware functions in order:
   - `express.json({ limit: '1mb' })` parses JSON bodies. File uploads are handled by multer inside the routes that accept them.
   - `cookieParser()` reads cookies.
   - `loadUser` (`server/src/middleware/auth.js`) attaches `req.user` when a valid session cookie is present. It never rejects a request.
3. The request reaches a router under `/api/<area>`. Guard middleware (`requireAuth`, `requireRole`) is applied per router or per route.
4. The handler calls into `server/src/lib/` for the actual rules and reads or writes MongoDB through Mongoose models.
5. Anything thrown reaches the error handler at the bottom of `createApp()`.
6. Unknown `/api/*` paths return a JSON 404. In production, any other path serves the built React app (`client/dist/index.html`) so client-side routes work on refresh.

## Error handling

The central handler in `app.js` converts failures into consistent JSON of the form `{ "error": "message", "fields": { ... } }`.

| Thrown | Response |
| --- | --- |
| `HttpError` (`badRequest`, `unauthorized`, `forbidden`, `notFound` from `lib/http.js`) | The error's own status and message; `fields` carries per-field validation text |
| `mongoose.Error.ValidationError` | 400 with each invalid field's message |
| Duplicate key (`code 11000`) | 409 "That record already exists." |
| Malformed JSON body | 400 |
| Anything else | Logged to the server console; the user sees a generic 500 message with no internals |

Express 5 forwards rejected promises from `async` handlers to this handler automatically, so route code can simply `throw`.

## Folder map

```
api/index.js                 Vercel serverless entry point
client/                      React single-page application
  src/api.js                 fetch wrapper, useApi hook, query-string helper
  src/context.jsx            sign-in, reference data and toast providers
  src/components/            Layout (header, menu), Chatbot, shared pieces
  src/pages/                 one file per screen
  src/styles.css             all styling, including responsive rules
rasa/                        Rasa NLU model: config.yml and data/nlu.yml
scripts/rasa.js              installs, trains and runs Rasa
server/
  scripts/                   dev-db.js (local MongoDB), backup.js
  src/app.js                 Express app factory and error handler
  src/config.js              environment-driven settings
  src/constants.js           roles, access levels, workflow stages, document types
  src/db.js                  cached MongoDB connection
  src/index.js               local server startup
  src/lib/                   workflow, access, storage, chat, itemFields, serialize, http
  src/middleware/auth.js     session cookie and role guards
  src/models/                Mongoose schemas
  src/routes/                HTTP endpoints, one file per area
  src/seed/                  sample data and the seed script
  test/api.test.js           end-to-end API tests
vercel.json                  build, routing and function settings for Vercel
```

## Design decisions

- **No state on disk.** Uploaded PDFs live in MongoDB GridFS and sessions are stateless signed cookies. The same code therefore runs on a laptop and on a serverless host that discards its filesystem between requests. See [file-storage-and-preservation.md](file-storage-and-preservation.md).
- **Embedded sub-documents.** Authors, files and the approval history are stored inside the item document. An item page needs all of them at once and they are never shared between items, so a single read returns everything. See [data-model.md](data-model.md).
- **Business rules in `lib/`, not in routes.** The workflow, access decisions, file handling and chatbot classification are plain functions. Routes stay short and the rules are covered by the test suite.
- **One vocabulary, shared with the client.** `server/src/constants.js` defines roles, access levels, stages and document types. The client reads them from `GET /api/meta` instead of duplicating them.
- **The AI is optional.** If Rasa is off or unreachable, the chatbot still answers through keyword matching. See [chatbot-rasa.md](chatbot-rasa.md).

## Key modules

| Module | Responsibility |
| --- | --- |
| `server/src/db.js` | Opens one shared Mongoose connection. It returns immediately when already connected and caches the in-flight connection promise, so concurrent requests on a warm serverless instance do not open several connections. Credentials are masked in the error log. |
| `server/src/config.js` | Loads `.env` and exposes typed settings. In production it refuses to start without `JWT_SECRET`. |
| `server/src/lib/http.js` | `HttpError` and helpers `badRequest`, `unauthorized`, `forbidden`, `notFound`, plus `escapeRegex` (safe user input in regular expressions) and `toArray` (normalises a query value that may be a string or an array). |
| `server/src/lib/serialize.js` | Shapes database documents into API responses. `itemSummary` is used in lists; `itemDetail` adds metadata and files; with `includeWorkflow` it also returns the issues list, history and submitter, which only staff and the item's owner may see. |
