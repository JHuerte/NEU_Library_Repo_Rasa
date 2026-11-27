# NEU Library Repository

An institutional repository for NEU Library: students and faculty deposit theses and research, librarians review and catalog them, and the public searches, browses and downloads them according to each item's access level. It includes reporting, digital preservation checks and a library help chatbot.

Built with **Node.js (Express) + React (Vite) + MongoDB (Mongoose)**.

## Documentation

The source code has no inline comments; explanations live in [docs/](docs/README.md): architecture, the Rasa chatbot, the submission workflow and access rules, file preservation, search, data model, API reference, front end, configuration, deployment and testing.

## Quick start

Requirements: Node.js 20 or newer. MongoDB does not need to be installed for development.

```bash
npm install
npm run db        # terminal 1: starts a local MongoDB (first run downloads it, about 100 MB)
npm run seed      # terminal 2: loads sample colleges, collections, accounts and records (once)
npm run dev:nodb  # terminal 2: starts the API (port 4000) and the website (port 5173)
```

Open http://localhost:5173. `npm run dev` starts all three (database, API, website) in one terminal.

The demo sign-in accounts (admin, librarian, faculty, student) and their shared password are in [server/src/seed/data.js](server/src/seed/data.js). They are for development only.

To start over with fresh sample data: `npm run seed -- --reset` (this deletes everything in the database and all uploaded files).

### Using a real MongoDB or MongoDB Atlas

Copy `.env.example` to `.env` and set `MONGODB_URI` to your connection string. Then skip `npm run db`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Database, API and website together, with auto-reload |
| `npm run dev:nodb` | API and website only (when MongoDB is already running) |
| `npm run seed` | Load sample data into an empty database |
| `npm test` | Run the API tests (uses its own throwaway database) |
| `npm run rasa:install`, `rasa:train`, `rasa` | Install, train and run the Rasa chatbot model (see below) |
| `npm run backup` | Export the database, including all uploaded files, to `backups/<date>/` |
| `npm run build` then `npm start` | Production: the API serves the built website on port 4000 |

## How the system maps to the proposal

| Proposal section | Where it lives |
| --- | --- |
| 1A User interface: home, search, advanced search, browse, item view, download, accounts | `client/src/pages/` (Home, Search, Browse, Item, Auth) |
| 1B Repository collections | `RepoCollection` model; managed under Admin → Collections |
| 2 Metadata (Dublin Core + institutional fields) | `Item` model; shown on the item's "Full metadata" tab with `dc.*` and `local.*` names |
| 3 Roles: admin, librarian, faculty, student, general user | `User.role`; checks in `server/src/middleware/auth.js` and `server/src/lib/access.js` |
| 4 Submission and approval workflow | `server/src/lib/workflow.js`; Submit, My submissions and Review queue pages |
| 5 Search and discovery | `GET /api/items/search` (MongoDB text index, filters, facet counts), `GET /api/browse/*` |
| 6 Digital preservation | Files stored in MongoDB GridFS with SHA-256 checksums, fixity check before publishing and on demand, `npm run backup`, versioned files, persistent handles |
| 7 Access levels: open, institutional, restricted, embargoed, metadata only | `server/src/lib/access.js`; restricted items use access requests approved by librarians |
| 8 Reports and analytics | `GET /api/reports/summary`; Reports page (admin) |
| 10 Database structure | See below |

### Workflow

Submitted → Initial validation (automatic) → Metadata review → Content verification → Librarian approval → Admin approval → Metadata indexing → Digital preservation → Published.

Automatic validation checks for required fields, abstract length (300 words), at least 3 keywords and a real PDF file. If anything fails, or a librarian returns the item, the author sees the notes under **My submissions**, fixes the record and resubmits. Each new file upload is kept as a new version. On publication the item gets a permanent handle such as `hdl:20.500.12345/4817`, which resolves at `/handle/20.500.12345/4817`.

### Database structure (MongoDB)

The proposal's tables become these collections:

| Proposal table | MongoDB |
| --- | --- |
| USER | `users` |
| COLLEGE, DEPARTMENT | `colleges` (departments/programs are a list inside each college) |
| COLLECTION | `collections` |
| ITEM, AUTHOR, ITEM_AUTHOR | `items` (authors are a list inside each item) |
| METADATA | `items.extra` (field name → value) plus the item's Dublin Core fields |
| DIGITAL_FILE | `items.files` (with checksum, size, version); the file contents are in GridFS (`files.files`, `files.chunks`) |
| SUBMISSION, APPROVAL | `items.history` (every submit, approval, return and edit with who, when and note) plus `items.stage` / `items.status` |
| ACCESS_LOG | `accesslogs` (views, downloads, searches) |
| (added) | `accessrequests` for restricted items, `faqs` for the help chatbot, `counters` for handle numbers |

Embedding authors, files and history inside the item fits MongoDB well: an item page needs all of them at once, and they are never shared between items.

## Library help chatbot

The chatbot (bottom-right on every page) answers from the list under **Admin → Help answers**, which librarians can edit. It never makes up an answer; questions it can't match point to the circulation desk.

To decide which answer a question is asking for, `POST /api/chat` uses:

1. **Rasa** (AI language understanding), when its server is running. A model trained on example questions in English, Filipino and Taglish recognises the topic even when the wording is new ("pwede ba humiram ng libro?", "my dog tore the book"). Rasa only picks the topic. The answer text still comes from the database, so librarians keep control of the wording.
2. **Keywords**, when Rasa is off, not running, or less than 60% sure. Each help answer has keywords, and a question matches the answer whose keywords it contains.

If Rasa is unsure and no keyword matches, the bot offers Rasa's closest guesses ("Did you mean…").

**The circulation policies in the sample answers (loan limits, fines, hours, fees) are placeholders.** They are marked "Sample policy" until a librarian replaces them with NEU Library's actual rules.

### Running Rasa locally

Rasa needs **Python 3.8, 3.9 or 3.10** (not 3.11 or newer) and about 2 GB of disk space.

```bash
npm run rasa:install   # once: creates rasa/.venv and installs Rasa Open Source 3.6
npm run rasa:train     # trains the model from rasa/data/nlu.yml (about a minute)
npm run rasa           # serves it on http://localhost:5005; keep this terminal open
```

Then start the site as usual (`npm run dev`). The API uses Rasa automatically at `http://localhost:5005`; set `RASA_URL` in `.env` to use a different address, or leave it empty to turn Rasa off. Answers understood by Rasa show "Understood by Rasa AI · N% sure" under them.

**On Vercel**, Rasa is off and the chatbot uses keywords, because Vercel can't run a Python server like Rasa. To use Rasa online, host it on a server with at least 2 GB of memory and set `RASA_URL` in Vercel to its address.

**Adding a help answer:** keywords work right away. To teach Rasa the new topic, add an intent named `faq_<slug>` (the answer's slug) with 10 or more example questions to [rasa/data/nlu.yml](rasa/data/nlu.yml), then run `npm run rasa:train` and restart `npm run rasa`.

## Project layout

```
server/
  src/
    app.js, index.js       Express app and startup
    config.js, constants.js
    models/                Mongoose schemas
    lib/                   workflow, access rules, file storage, validation
    routes/                API endpoints (auth, items, browse, submissions, review, reports, admin, faq)
    seed/                  sample data and the seed script
  scripts/                 dev database, backup
  test/                    API tests
client/
  src/
    pages/                 one file per screen
    components/            layout, chatbot, shared pieces
    api.js, context.jsx    API calls, sign-in state, shared reference data
rasa/                      Rasa chatbot model: config.yml, data/nlu.yml (training examples)
scripts/rasa.js            installs, trains and runs Rasa
api/index.js               Vercel serverless entry point (wraps the Express app)
vercel.json                Vercel build and routing settings
data/                      local dev database (not committed)
backups/                   output of npm run backup (not committed)
```

## Deploy to Vercel (for sharing with your group)

The website is served as static files and the API runs as one serverless function. The database and uploaded files live in MongoDB Atlas, since Vercel keeps nothing on disk between requests.

**Upload limit:** Vercel accepts requests up to 4.5 MB, so on Vercel each uploaded PDF must be under 4 MB. Locally the limit is 200 MB.

### 1. Create the database (MongoDB Atlas, free)

1. Sign up at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster. Choose **AWS, Singapore (ap-southeast-1)**: the Vercel function also runs in Singapore.
2. **Database Access:** add a database user with a password.
3. **Network Access:** add `0.0.0.0/0` (allow from anywhere). Vercel's servers don't have fixed IP addresses.
4. **Connect → Drivers:** copy the connection string and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/neu_library?retryWrites=true&w=majority`

### 2. Load the sample data into Atlas

In your `.env` (never commit this file), set `MONGODB_URI` to the Atlas string and `SEED_PASSWORD` to a private password for the demo accounts. Then:

```bash
npm run seed
```

Share the demo password with your group privately. Afterwards, change `MONGODB_URI` in `.env` back to `mongodb://127.0.0.1:27017/neu_library` for local work.

### 3. Push the code to GitHub

Create an empty repository on GitHub (private is safer), then:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 4. Import into Vercel

1. At https://vercel.com, choose **Add New → Project** and import the GitHub repository. Keep the root directory as the repository root; `vercel.json` sets the build.
2. Under **Environment Variables**, add:
   - `MONGODB_URI`: the Atlas connection string
   - `JWT_SECRET`: a long random string. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `MAX_UPLOAD_MB`: `4`
3. Select **Deploy**. Every push to `main` redeploys automatically.

If pages load but data doesn't, open the deployment's **Logs** in Vercel. A database error usually means the connection string is wrong or Atlas Network Access is missing `0.0.0.0/0`.

## Before a real deployment

This build is set up for development and demonstration. For live use, at minimum:

- Set `NODE_ENV=production` and a long random `JWT_SECRET` in `.env`, and serve it over HTTPS.
- Use a managed MongoDB (or a MongoDB server with authentication) and schedule `npm run backup` or `mongodump`, with copies stored off the server.
- Replace the sample colleges, collections and FAQ policies, and remove the demo accounts.
- Register a real handle prefix (or switch to DOIs) and set `HANDLE_PREFIX`.
- Restrict self-registration to NEU email addresses and add email verification and password reset.
