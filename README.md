# Library Management System API

A small Node.js and Express API for a library management system. Right now, it has a health check at `GET /health`. The book, member, loan, and login features are still to come.

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

For now, `/health` is the only available route. Other paths return a `404` error. The API accepts JSON request bodies and allows requests from localhost and `https://test-app.app`.

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

After a user signs in successfully, call `generateToken` to create a signed JWT. It puts the user’s ID in the token as `sub` and reads the signing secret and expiry from `.env`.

```js
import { generateToken } from "../utils/generateToken.js";

const token = generateToken(user);
res.json({ success: true, data: { token } });
```

The user object needs an `_id` property. Keep `JWT_SECRET` private. This helper creates a token, but the login route and the middleware to verify tokens still need to be added.

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
| `JWT_EXPIRES_IN` | No | How long a JWT lasts (used by the helper; login is not implemented yet) |

