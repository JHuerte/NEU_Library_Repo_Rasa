# Configuration

Settings are read from environment variables, loaded from a `.env` file in the project root by `server/src/config.js`. Copy `.env.example` to `.env` and edit it. `.env` is ignored by git and must never be committed because it can contain database passwords.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/neu_library` | Database connection. The default matches `npm run db`. For MongoDB Atlas paste the connection string and include the database name before the `?`, for example `.../neu_library?retryWrites=true&w=majority` |
| `PORT` | `4000` | API port. The Vite dev server proxies `/api` here |
| `JWT_SECRET` | A development-only value | Signs session cookies. **Required when `NODE_ENV=production`**: the server refuses to start without it |
| `NODE_ENV` | unset | `production` turns on secure cookies and the `JWT_SECRET` requirement |
| `DATA_DIR` | `data` | Where the local development MongoDB (`npm run db`) keeps its files. Uploaded PDFs are not stored here; they live in the database |
| `MAX_UPLOAD_MB` | `200` | Largest upload in megabytes. Use `4` on Vercel, whose requests are capped at 4.5 MB |
| `SEED_PASSWORD` | unset | Password for the demo accounts. Needed when seeding a database that is not on this computer; at least 10 characters |
| `HANDLE_PREFIX` | `20.500.12345` | Prefix of permanent identifiers (`hdl:<prefix>/<number>`). Register a real prefix before going live |
| `RASA_URL` | `http://localhost:5005` locally; empty on Vercel | Address of the Rasa server. Empty disables Rasa and uses keyword matching only |

`VERCEL` is set automatically by Vercel and is only used to turn Rasa off by default there.

## Using Atlas for seeding, local for development

1. Put the Atlas URI in `MONGODB_URI` and set `SEED_PASSWORD`, then run `npm run seed` once.
2. Switch `MONGODB_URI` back to the local address for everyday work, so testing does not change the shared data.

## npm scripts

Run from the project root.

| Script | What it does |
| --- | --- |
| `npm run dev` | Local MongoDB, API and website together, with auto-reload |
| `npm run dev:nodb` | API and website only, when MongoDB is already running |
| `npm run db` | Start a local MongoDB (first run downloads it, about 100 MB) |
| `npm run server`, `npm run client` | API only, website only |
| `npm run seed` | Load sample data into an empty database. `npm run seed -- --reset` wipes and reloads |
| `npm test` | Run the API tests against a throwaway in-memory database |
| `npm run build` | Build the website into `client/dist` |
| `npm start` | Production: the API serves the built website on one port |
| `npm run backup` | Export the database, including uploaded files, to `backups/<date>/` |
| `npm run rasa:install` | Create `rasa/.venv` and install Rasa (once; Python 3.8 to 3.10) |
| `npm run rasa:train` | Train the chatbot's NLU model from `rasa/data/nlu.yml` |
| `npm run rasa` | Serve the trained model on port 5005 |
