# Testing

The suite is `server/test/api.test.js`. It uses Node's built-in test runner (`node:test`) and Supertest, so there is no extra test framework.

```bash
npm test
```

## Isolation

The tests never touch your real data:

- **Throwaway database.** `mongodb-memory-server-core` starts an in-memory MongoDB for the run, and `DATA_DIR` points to a temporary folder. Uploaded PDFs go into that database's GridFS and disappear with it.
- **No dependency on Rasa.** The test file sets `RASA_URL` to empty before loading the app, so a Rasa server running on your machine cannot change the results.
- **One file at a time.** The script passes `--test-concurrency=1` because the tests share one in-memory database.

`before()` creates a college, a collection and one user per role (admin, librarian, faculty, student). `agentFor(email)` returns a Supertest agent that has signed in, so cookies persist between calls just like a browser. `submitThesis()` posts a valid multipart submission and accepts overrides to produce invalid ones.

## What is covered

| Test | Verifies |
| --- | --- |
| Sign-in rejects a wrong password and accepts the right one | Authentication basics |
| Self-registration cannot create staff accounts | Role escalation is blocked |
| Guests cannot submit or open the review queue | Route guards |
| A submission goes through every review stage and is published with a handle | The full 9-stage workflow, including admin-only final approval and handle assignment |
| Automatic checks return a bad submission and the author can fix and resubmit it | Validation, the returned state, file versioning |
| A librarian can return a submission with a note | Return flow |
| Institutional items need sign-in; embargoed items stay locked | Access levels |
| Restricted items need an approved access request | The request, approve, download sequence |
| Search filters by facet and reports facet counts | Search and faceting |
| Reports are for administrators and the fixity check passes | Report authorization and file integrity |
| Librarians can manage help answers; others cannot | Help-answer permissions |
| Chatbot uses Rasa when it is confident and falls back to keywords | Keyword matching, a fake Rasa server (confident answer, small talk, unsure with suggestions, unknown slug ignored), and the fallback when Rasa is unreachable |

The workflow test also checks the review edit log: only fields that really changed are recorded, even though stored values are ObjectIds or populated documents and submitted values are plain strings (`comparable()` in `routes/review.js` normalises both before comparing).

## The fake Rasa server

The chatbot test starts a small `http` server on a random port that answers `POST /model/parse` with canned intents, then points `config.rasaUrl` at it. This tests the real HTTP path in `rasaParse()` and the decision rules in `classify()` without installing Python or training a model. `config.rasaUrl` is restored in a `finally` block so one test cannot affect another.

To check the *quality* of the trained model (does it understand real questions?), run Rasa and ask it directly through `POST /api/chat`, as described in [chatbot-rasa.md](chatbot-rasa.md).

## Adding a test

1. Use `agentFor()` for the role you need.
2. Create the data with the models or the API itself.
3. Assert on status codes and response fields, not on message wording where avoidable.
4. Keep each test independent of the order of the others, or build on the data it creates itself.
