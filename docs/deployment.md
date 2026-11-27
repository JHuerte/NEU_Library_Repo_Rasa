# Deployment

The recommended setup for sharing with a group is **Vercel** (website and API) with **MongoDB Atlas** (database and uploaded files) and **GitHub** (source). Step-by-step instructions are in the root [README.md](../README.md#deploy-to-vercel-for-sharing-with-your-group); this document explains how it works.

## How the pieces fit

```
Browser --> Vercel
              |-- static files from client/dist   (the React app)
              |-- /api/*  --> api/index.js        (one serverless function running Express)
                                  |
                                  v
                            MongoDB Atlas (records + GridFS files)
```

## Vercel configuration (`vercel.json`)

| Setting | Value | Why |
| --- | --- | --- |
| `framework` | `null` | The project is not a single framework preset; the build is defined explicitly |
| `buildCommand` | `npm run build` | Builds the React app |
| `outputDirectory` | `client/dist` | What Vercel serves as static files |
| `regions` | `["sin1"]` | Singapore, next to an Atlas cluster in Singapore, which keeps database latency low |
| `functions."api/index.js".maxDuration` | 30 | Seconds a request may run (uploads and fixity checks can be slow) |
| Rewrite `/api/:path*` to `/api` | | Sends every API call to the single function |
| Rewrite `/((?!api/).*)` to `/index.html` | | Lets client-side routes such as `/search` load on refresh |

## The serverless entry point (`api/index.js`)

It builds the same Express app used locally, once per warm instance. For each request it first awaits `connectDb()`. If the database cannot be reached it answers 503 with a plain-language JSON message instead of letting the request hang or crash; otherwise it hands the request to Express.

`connectDb()` in `server/src/db.js` makes this cheap: it returns immediately when a connection is already open, and caches the in-flight promise so simultaneous requests share one connection attempt. Without that, each invocation could open its own connection and exhaust the Atlas free tier's connection limit.

## Required Vercel environment variables

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | The Atlas connection string, including `/neu_library` before the `?` |
| `JWT_SECRET` | A long random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MAX_UPLOAD_MB` | `4` |

Atlas must allow connections from anywhere (`0.0.0.0/0` under Network Access), because Vercel's servers do not have fixed IP addresses. Protect the database with a strong user password instead.

## Limits to be aware of

- **4.5 MB request cap on Vercel.** PDFs larger than about 4 MB cannot be uploaded to the hosted site. Locally the limit is 200 MB.
- **Rasa does not run on Vercel.** The hosted chatbot uses keyword matching. To use Rasa online, host it separately (at least 2 GB of memory) and set `RASA_URL`. See [chatbot-rasa.md](chatbot-rasa.md).
- **Sign-in lockout counters are per instance.** See [authentication.md](authentication.md).

## Before a real launch

- Set `NODE_ENV=production` and a strong `JWT_SECRET`, and serve only over HTTPS.
- Use a managed MongoDB with scheduled backups kept off-site.
- Replace the sample colleges, collections and help-answer policies, and remove the demo accounts.
- Register a real handle prefix (or switch to DOIs) and set `HANDLE_PREFIX`.
- Restrict self-registration to NEU email addresses and add email verification and password reset.

## Running as a single server (no Vercel)

`npm run build` then `npm start` runs the API on `PORT` and serves the built website from `client/dist` on the same port, so one process serves everything. The catch-all route in `app.js` returns `index.html` for any non-API path.
