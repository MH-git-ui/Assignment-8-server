# BookNook API

Express and MongoDB backend for [BookNook](https://github.com/MH-git-ui/Assignment-8). Requires Node.js 22+ and a MongoDB replica set (MongoDB Atlas is suitable).

## Features

- Newest-first public catalogue with an optional six-book limit.
- BetterAuth JWT verification using remote JWKS, issuer, audience, and expiration.
- Owner-only updates and deletion; identity is derived from the verified token.
- Transactional borrowing and returning with atomic `$inc` inventory updates.
- A unique user/book borrow index prevents concurrent duplicate loans.
- Input validation, rate limiting, security headers, and restricted browser CORS.
- Ten integration tests using an isolated temporary MongoDB replica set.

## Run

```sh
pnpm install
```

Copy `.env.example` to `.env` and configure MongoDB, then run:

```sh
pnpm dev
```

For production use `pnpm start`. The client and API use the same database name. `AUTH_ISSUER` must exactly match the client's `BETTER_AUTH_URL`; `JWKS_URL` points to its `/api/auth/jwks`. Do not expose the MongoDB URI or BetterAuth secret to browsers. Google OAuth and image uploading are handled in Next.js, not here.

## Routes

| Method | Path           | Access                           | Purpose                                     |
| ------ | -------------- | -------------------------------- | ------------------------------------------- |
| GET    | `/books`       | Public; `mine=true` requires JWT | Catalogue; optional `limit=6`; newest first |
| GET    | `/books/:id`   | JWT                              | Book details                                |
| POST   | `/books`       | JWT                              | Add a book                                  |
| PATCH  | `/books/:id`   | Owner                            | Replace editable book fields                |
| DELETE | `/books/:id`   | Owner                            | Remove a book with no active loans          |
| POST   | `/borrows`     | JWT                              | Borrow `{ "bookId": "…" }` for 14 days      |
| GET    | `/borrows`     | JWT                              | Current user's active borrows               |
| DELETE | `/borrows/:id` | Borrower                         | Return a book                               |

Protected requests use `Authorization: Bearer <token>`. Obtain a short-lived token from the logged-in client's BetterAuth `/api/auth/token` endpoint. The API never trusts submitted user names, email addresses, or ownership IDs.

Create and update bodies accept only `title`, `author`, `category`, `image` (HTTPS URL), `description`, and `totalCopies`. Categories: Fiction, Science, History, Kids, Others. Updating total copies cannot reduce the count below active loans. All list and mutation errors are JSON with a `message`.

## Verify

```sh
pnpm test
```

Tests download a MongoDB binary on first use, start a temporary replica set, and clean it up afterward. They never connect to the database in `.env`. Tests cover invalid/expired JWTs, user isolation, input validation, newest-six queries, simultaneous last-copy requests, duplicate borrows, and one-time returns.

## Deployment

On Vercel, import this repository using the Express preset. The root `app.js` exports the application and opens its MongoDB connection lazily on the first request; concurrent requests share the connection pool. Configure all variables from `.env.example` before using the API. The local `pnpm start` command continues to run a normal HTTP listener.

Alternatively, deploy to a Node-compatible service such as Render with `pnpm install --frozen-lockfile` and `pnpm start`. Supply environment variables from `.env.example`, use HTTPS production client URLs, and use a MongoDB replica set. If deploying behind a proxy, configure Express trust-proxy only for the host's verified proxy topology before relying on per-IP rate limits. The public `/books` endpoint can be used as a readiness probe.

**Live API URL:** Not deployed yet. MongoDB configuration and hosting remain required. See the client repository's SETUP.md for the coordinated service setup.

Rate limits are per running instance; distributed deployments should also use host-level rate limiting.
