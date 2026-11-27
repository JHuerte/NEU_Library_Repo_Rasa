# Authentication and Authorization

Files: `server/src/middleware/auth.js`, `server/src/routes/auth.js`, `server/src/models/User.js`.

## Sessions

Sign-in issues a signed JSON Web Token (JWT) stored in a cookie named `neu_token`.

| Property | Value | Reason |
| --- | --- | --- |
| `httpOnly` | true | JavaScript on the page cannot read the token, limiting damage from script injection |
| `sameSite` | `lax` | The browser does not send the cookie on cross-site POSTs, which protects against cross-site request forgery for state-changing calls |
| `secure` | true when `NODE_ENV=production` | The cookie travels only over HTTPS in production |
| Lifetime | 7 days | Both the JWT `expiresIn` and the cookie `maxAge` |
| Payload | `{ sub: <user id> }` | Only the id. Role and name are always read fresh from the database |

Because the role is read from the database on every request, changing a user's role or deactivating them takes effect immediately; there is no stale token to wait out.

## Middleware

| Function | Behaviour |
| --- | --- |
| `loadUser` | Runs on every request. If a valid cookie is present and the user exists and is `active`, sets `req.user`. A bad or expired token clears the cookie. It never rejects the request, so public pages work for guests |
| `requireAuth` | Throws 401 when there is no `req.user` |
| `requireRole(...roles)` | 401 when signed out, 403 when the role is not in the list |

Routers apply guards at the top (`router.use(requireRole(...))`) so a whole area is protected by one line. Which area needs which role is listed in [api-reference.md](api-reference.md).

## Registration and sign-in

`POST /api/auth/register`

- Validates name, email format and a password of at least 8 characters.
- Accepts only the roles `student` and `faculty`. Librarian and admin accounts cannot be created through this endpoint; an administrator assigns them.
- Rejects an email that already exists (compared lower-case).
- Hashes the password with bcrypt (cost 10) and signs the user in.

`POST /api/auth/login`

- Looks the user up by lower-cased email and checks the password with `bcrypt.compare`.
- The same message ("Email or password is incorrect.") is returned whether the email is unknown, the account is inactive, or the password is wrong, so the response does not reveal which emails are registered.
- **Lockout:** after 5 failed attempts for an email, further attempts are refused for 10 minutes. The counter is held in memory, so it resets when the server restarts and is per instance on serverless hosting. It slows guessing but is not a substitute for a shared rate limiter in a large deployment.

`POST /api/auth/logout` clears the cookie. `GET /api/auth/me` returns the current user, or `null`.

`User.toPublic()` is the only way a user is sent to the browser; it omits the password hash.

## Production requirements

- `JWT_SECRET` must be set when `NODE_ENV=production`. `config.js` throws at startup otherwise, so the app can never run in production with the built-in development secret.
- Serve over HTTPS so the `secure` cookie flag works.
- Demo accounts created by the seed script must be removed or given private passwords. See [configuration.md](configuration.md) for `SEED_PASSWORD`.
