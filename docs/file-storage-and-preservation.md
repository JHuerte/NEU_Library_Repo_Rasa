# File Storage and Digital Preservation

File: `server/src/lib/storage.js`. Related: `server/scripts/backup.js`, `server/src/routes/reports.js`.

## Where files live

Uploaded PDFs are stored in **MongoDB GridFS**, in a bucket named `files` (collections `files.files` and `files.chunks`). Nothing is written to the server's disk.

This matters for deployment. Serverless hosts such as Vercel discard the filesystem between requests, so disk storage would lose every upload. With GridFS the database is the single place that holds data, and the same code runs locally and online.

An item's `files` array holds one record per stored file (the DIGITAL_FILE entity of the proposal):

| Field | Meaning |
| --- | --- |
| `originalName` | The name the author uploaded |
| `storedName` | The GridFS file id, as a string. It is converted back to an `ObjectId` when reading or deleting |
| `mimeType`, `size` | From the upload |
| `sha256` | Checksum computed from the uploaded bytes |
| `version` | 1 for the first upload, increasing with each replacement |
| `uploadedAt` | Upload time |
| `lastFixityCheck`, `fixityOk` | Result of the latest integrity check |

## Upload handling

`uploadSingle` is a multer middleware configured with `memoryStorage` and these limits: one file per request and `MAX_UPLOAD_MB` megabytes (default 200). The file is held in memory, then `saveBuffer()` writes it to GridFS with an upload stream and returns the record above, including its SHA-256.

Memory storage is deliberate: it avoids temporary files and works in a read-only serverless environment. The trade-off is that very large files consume memory, which is why the limit exists. **On Vercel, requests over 4.5 MB are rejected by the platform, so set `MAX_UPLOAD_MB=4`.**

The submissions routes wrap multer so a rejected upload becomes a readable 400 ("The file is larger than N MB.") and the client shows a matching message for the platform's 413.

## Functions

| Function | Purpose |
| --- | --- |
| `sha256(buffer)` | Hex SHA-256 digest |
| `looksLikePdf(buffer)` | True when the first five bytes are `%PDF-`. Used instead of trusting the file extension or the browser's MIME type |
| `saveBuffer(buffer, name, mime, version)` | Stores a buffer in GridFS and returns its record |
| `recordFromUpload(file, version)` | Same, from a multer file |
| `openFileStream(record)` | Readable stream for downloading |
| `readStart(record, bytes)` | Reads only the first bytes of a stored file, so validation can check the PDF signature without loading the whole file |
| `verifyFile(record)` | The fixity check (below) |
| `deleteStoredFile(record)` | Removes a stored file. Failures are ignored |

## Fixity checks

*Fixity* means proving a file has not changed since it was deposited. `verifyFile()` streams the stored file, recomputes its SHA-256 and compares it with the checksum saved at upload. It returns `{ ok, missing }`; a file that cannot be read at all returns `ok: false, missing: true`.

A fixity check runs:

- **At publication.** `publish()` in the workflow verifies every file and stops publication if one fails.
- **On demand.** `POST /api/reports/fixity` (admin only) checks every stored file of every item, updates `fixityOk` and `lastFixityCheck`, and returns `{ checked, ok, failed }`. Each failure names the item, the file and the problem ("File is missing" or "Checksum does not match"). The Reports page has a **Run fixity check now** button and shows the failure count and the time of the last check.

## Versioning

Files are never overwritten. When an author resubmits with a new file, it is stored as `version + 1` and appended to the item's `files`. The latest entry is the one validated and shown first.

## Cleaning up after failures

`submissions.js` stores the file before saving the item. If anything afterwards fails (validation, database error), the `catch` block calls `deleteStoredFile()` so no orphaned file stays behind.

## Serving downloads

The download route streams with `pipeline(openFileStream(file), res)`, which handles back-pressure and aborts cleanly if the client disconnects. It sets `Content-Type`, `Content-Length` and a `Content-Disposition` header using the RFC 5987 `filename*=UTF-8''` form so file names with spaces or non-ASCII characters download correctly.

## Backups

`npm run backup` runs `server/scripts/backup.js`, which exports **every** collection, including `files.files` and `files.chunks`, as Extended JSON into `backups/<timestamp>/db/`. Extended JSON keeps MongoDB types such as ObjectId, dates and binary chunks exactly. The Reports page shows the date of the most recent backup folder.

This is a basic safeguard for development. For real use, schedule `mongodump` or MongoDB Atlas backups and keep copies off the server.
