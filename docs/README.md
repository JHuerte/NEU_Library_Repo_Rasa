# NEU Library Repository: Developer Documentation

The source code in this project contains no inline comments. These documents are the explanation: what each important module does, why it is built that way, and how the parts connect.

## Reading order

| Document | Read it to understand |
| --- | --- |
| [architecture.md](architecture.md) | The three tiers, how a request travels through the system, folder map and error handling |
| [chatbot-rasa.md](chatbot-rasa.md) | The Rasa-powered help chatbot: NLU model, decision logic, fallback, API and maintenance |
| [workflow-and-access.md](workflow-and-access.md) | The 9-stage submission workflow, roles, and the five access levels |
| [authentication.md](authentication.md) | Sessions, roles, registration, sign-in lockout |
| [file-storage-and-preservation.md](file-storage-and-preservation.md) | GridFS storage, checksums, fixity checks, versioning, backups |
| [search-and-browse.md](search-and-browse.md) | Full-text search, facets, pagination and the browse tree |
| [data-model.md](data-model.md) | MongoDB collections, fields, indexes and how they map to the proposal |
| [api-reference.md](api-reference.md) | Every HTTP endpoint with its required role |
| [frontend.md](frontend.md) | React structure, shared providers, API client, responsive design |
| [configuration.md](configuration.md) | Every environment variable and npm script |
| [deployment.md](deployment.md) | Vercel + MongoDB Atlas deployment and the serverless entry point |
| [testing.md](testing.md) | The automated test suite and how it isolates the database and Rasa |

## Where to start for common tasks

| Task | Start here |
| --- | --- |
| Run the project for the first time | Root [README.md](../README.md) |
| Teach the chatbot a new question | [chatbot-rasa.md](chatbot-rasa.md), section "Maintaining the chatbot" |
| Change who can approve at a workflow stage | [workflow-and-access.md](workflow-and-access.md), section "Who can act at each stage" |
| Add a field to a thesis record | [data-model.md](data-model.md), then `server/src/lib/itemFields.js` |
| Deploy for your group | [deployment.md](deployment.md) |

## Conventions used in the code

- **ES modules everywhere.** The root `package.json` sets `"type": "module"`.
- **Thin routes, logic in `server/src/lib/`.** Route files parse the request and call a library function; the rules (workflow, access, storage, chat) live in `lib/` so they can be reasoned about and tested separately.
- **Errors are thrown, not returned.** Handlers throw an `HttpError`; Express 5 forwards the rejection to the central error handler in `server/src/app.js`.
- **Plain-language messages.** Every message that reaches a user is written for a student or librarian, not a developer.
