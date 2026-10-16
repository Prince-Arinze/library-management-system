# Library Management System API

This is a Node.js and Express API for a library management system with health, book, member, and staff authentication endpoints.

## Requirements

- Node.js (with npm)
- A MongoDB database, local or hosted

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root, beside `server.js`:

   ```env
   MONGO_URI=mongodb://127.0.0.1:27017/library-management-system
   PORT=5000
   JWT_SECRET=replace-with-a-long-random-secret
   JWT_EXPIRES_IN=1d
   ```

   If your database is hosted, put its connection string in `MONGO_URI` and make sure its user and network access are set up. Keep `.env` private; don’t commit real credentials.

3. Start the API:

   ```bash
   npm run dev
   ```

   `npm run dev` restarts the server when you change a file. To start it without watch mode, run `npm start`.

The server connects to MongoDB before it starts accepting requests. It listens on port `5000` unless you set `PORT` to another value.

## Check the server

Once the server is running, open this URL or make a request to it:

```bash
curl http://localhost:5000/health
```

You should get:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## Current API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Confirms the API process is responding |
| `POST` | `/api/auth/login` | Sign in with an email and password |
| `GET` | `/api/auth/me` | Return the signed-in staff account; requires a bearer token |
| `POST` | `/api/members` | Register a member; admin or librarian |
| `GET`, `PATCH` | `/api/members/:id` | Retrieve or update a member; admin or librarian |
| `GET` | `/api/members/:id/borrowings` | List a member's borrowing history; admin or librarian |
| `PATCH` | `/api/members/:id/deactivate` | Deactivate a member; admin only |
| `POST` | `/api/borrowings` | Issue a book to a member; admin or librarian |
| `GET` | `/api/dashboard/summary` | View inventory, member, and borrowing totals; admin or librarian |
| `GET` | `/api/reports/inventory` | View paginated inventory; admin or librarian |
| `GET` | `/api/reports/overdue` | View overdue borrowings; admin or librarian |
| `GET` | `/api/reports/borrowings` | View borrowing history; admin or librarian |
| `GET` | `/api/reports/members` | View paginated member activity; admin or librarian |
| `GET` | `/api/reports/returns` | View returned-book history; admin or librarian |
| `GET` | `/api/books` | List books; public |
| `POST` | `/api/books` | Create a book; admin or librarian |
| `GET` | `/api/books/:id` | Retrieve a book; public |
| `PATCH` | `/api/books/:id` | Update a book; admin or librarian |
| `PATCH` | `/api/books/:id/deactivate` | Deactivate a book; admin or librarian |
| `GET`, `POST` | `/users` | List or create staff users; admin only |
| `GET`, `PATCH` | `/users/:id` | Retrieve or update a staff user; admin only |
| `PATCH` | `/users/:id/activate` | Activate a staff user; admin only |
| `PATCH` | `/users/:id/deactivate` | Deactivate a staff user; admin only |

The API accepts JSON request bodies and allows requests from localhost and `https://test-app.app`. See `/api-docs` for request schemas, authentication requirements, and endpoint responses.

### Authentication

Send `POST /api/auth/login` with an email and password. A successful response contains a JWT and the staff user under `data`. Send that token as `Authorization: Bearer <token>` to `GET /api/auth/me`. The API returns errors using `{ "success": false, "error": { "message": "..." } }`; login rejects missing fields with `400` and invalid credentials or inactive accounts with `401`.

To create the first administrator, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`, then run `node createAdmin.js`. The script does not use a default password.

Member routes require `Authorization: Bearer <token>` from an active staff account. Admins and librarians can register, view, and update member records; only admins can deactivate a member. Deactivation retains the record and its borrowing history. Empty borrowing histories return `200` with an empty `data` array.

Creating, updating, or deactivating books, issuing borrowings, and viewing dashboard or report data requires an active admin or librarian bearer token. Book catalog reads and the health check are public. Public catalog reads show active books only; an active admin or librarian token is required to view inactive books. Staff-user management requires an active admin token.

## Using the shared helpers

There are three small helpers in `src/utils` that make route code easier to write. The examples below show how to use them when adding routes. They’re examples only; those routes aren’t part of the app yet.

### `asyncHandler`

Use `asyncHandler` around an async route. If the route throws an error or a database call fails, the helper passes the error to Express so the app’s error handler can respond. That saves you from writing a `try/catch` in every route.

```js
import { asyncHandler } from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";

router.get("/:id", asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) throw httpError(404, "Book not found");

  res.json({ success: true, data: book });
}));
```

### `httpError`

Use `httpError` when you need to stop a request with a particular HTTP status and message. The error handler in `src/app.js` reads the status and sends it back in the response.

```js
import httpError from "../utils/httpError.js";

if (!req.body.title) {
  throw httpError(400, "Book title is required");
}
```

Throw it inside an `asyncHandler` route, or pass it to `next`. If an error has no status, the app responds with a generic `500 Internal server error`.

### `generateToken`

After a user signs in successfully, call `generateToken` with the user ID to create a signed JWT. It puts that ID in the token as `sub` and reads the signing secret and expiry from `.env`.

```js
import { generateToken } from "../utils/generateToken.js";

const token = generateToken(user._id);
res.json({ success: true, data: { token } });
```

Keep `JWT_SECRET` private. Protected routes verify the token and re-check that its user account is still active.

## Project structure

```text
server.js                 Application entry point and database startup
src/app.js                Express app, middleware, health route, and errors
src/config/dbConnection.js MongoDB connection
src/utils/                Shared token, async-handler, and HTTP-error helpers
```

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWTs |
| `PORT` | No | HTTP port (defaults to `5000`) |
| `JWT_EXPIRES_IN` | No | How long a JWT lasts (for example, `1d`) |
| `ADMIN_NAME` | Only for `node createAdmin.js` | Name for the initial administrator |
| `ADMIN_EMAIL` | Only for `node createAdmin.js` | Email for the initial administrator |
| `ADMIN_PASSWORD` | Only for `node createAdmin.js` | Password for the initial administrator |

