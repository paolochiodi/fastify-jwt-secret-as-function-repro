# @fastify/jwt secret-as-function inconsistency reproduction

This project reproduces an inconsistency in `@fastify/jwt` where the `secret`
option, when provided as a function, receives **different arguments** depending
on whether `verify` is called on the **request** object or on the **Fastify
instance**.

Related issue: [nearform/fastify-jwt-jwks#54](https://github.com/nearform/fastify-jwt-jwks/issues/54)

**Disclaimer**: this project was generated fully generated via AI agents

## The problem

When registering `@fastify/jwt` with a function as the `secret` option, the
documented signature is:

```js
function getSecret(request, decodedToken, callback) { /* ... */ }
```

- **`request.jwtVerify()`** — `@fastify/jwt` calls
  `getSecret(request, decodedToken, callback)` ✅
- **`fastify.jwt.verify(token)`** — `@fastify/jwt` does **not** call
  `getSecret` itself. Instead it passes the raw function to `fast-jwt` as the
  `key` option. `fast-jwt` then calls it with its own signature:
  `getSecret(decodedToken, callback)` — **no request object, different arity** ❌

This means any `secret` function that relies on the request (e.g. to look up
JWKS keys, inspect headers, etc.) will break or receive unexpected input when
`verify` is called on the Fastify instance.

## Setup

Requires Node.js >= 22 (LTS).

```bash
npm install
node server.js
```

The server starts on `http://localhost:3000`.

## Testing

A static JWT token is hardcoded in `server.js` for convenience (HS256, no
expiry, signed with the secret `my-super-secret`):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciJ9.YAc1OSiA4EWX1uLjAtnYUFJSYM_W6EHpobnVQjDCPss
```

### 1. Verify via request (correct behavior)

```bash
curl http://localhost:3000/verify-request \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciJ9.YAc1OSiA4EWX1uLjAtnYUFJSYM_W6EHpobnVQjDCPss"
```

**Expected response:** `200 OK` with the decoded payload.

**Server logs** will show `getSecret` called with:
- 1st argument: the Fastify request object (`is Fastify req?: true`)
- 2nd argument: the decoded token

### 2. Verify via Fastify instance (demonstrates the bug)

```bash
curl http://localhost:3000/verify-instance \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciJ9.YAc1OSiA4EWX1uLjAtnYUFJSYM_W6EHpobnVQjDCPss"
```

**Expected response:** `200 OK` (verification still succeeds because our
function returns a static secret regardless), but the **server logs** reveal the
inconsistency:

- 1st argument: the **decoded token sections** (`{ header, payload, signature }`)
  — **not** a Fastify request (`is Fastify req?: false`)
- 2nd argument: a **callback function** from `fast-jwt` — **not** the decoded token
- Only **2 arguments** received instead of the expected 3

