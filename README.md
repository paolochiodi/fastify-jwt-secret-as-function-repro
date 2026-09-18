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

The default dependency is the published `@fastify/jwt` package (`^10.2.2`).
No sibling checkout is needed for the published reproduction.

```bash
npm install
npm start
```

The server starts on `http://localhost:3000`.

Run `npm run repro-jwks` for the separate JWKS reproduction on
`http://localhost:3001`.

## Type checking

```bash
npm test
```

This runs `npm run typecheck` (`tsc --noEmit`) with strict checking for both
TypeScript scripts and [jwt.types.test.ts](jwt.types.test.ts). The compile-time
tests cover callback and async secret functions, verification return types,
and invalid API usage that must be rejected by the compiler. They are not
executed as runtime tests.

The default type tests target the published API, including its
`(request, token, callback)` secret signature. Local-only type tests are
excluded from this command. The main repro inspects secret arguments at
runtime to support both released and unified `SecretContext` call shapes.

## Testing

A static JWT token is hardcoded in [server.ts](server.ts) for convenience (HS256, no
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
- 1st argument: the Fastify request object (`has request?: true`)
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
  — **not** a Fastify request (`has request?: false`)
- 2nd argument: a **callback function** from `fast-jwt` — **not** the decoded token
- Only **2 arguments** received instead of the expected 3

## Testing the local version

Place the `fastify-jwt` checkout at `../fastify-jwt` and select the branch
implementing the unified `SecretContext` API. Then, from this project:

```bash
npm install ../fastify-jwt
npm run test:local
npm start
```

The [.npmrc](.npmrc) setting installs a packaged snapshot instead of a live
symlink. This avoids resolving a second copy of Fastify's types from the
sibling checkout.

`npm run test:local` checks both repro scripts and
[test/local.types.test.ts](test/local.types.test.ts), using the local
`SecretContext` and `SecretProvider` declarations. It checks operation
narrowing, optional request access, and rejection of the old three-argument
secret signature. Use this command instead of `npm test` while the local
version is installed.

Repeat the two curl requests above. Both endpoints should return `200` and
log `SecretContext (unified API)` with **2 arguments**. The request path has
`context.request`; the instance path does not. Both receive the decoded
header and payload.

Passing these checks does not establish complete type safety: the tested
local declarations still allow instance calls with a function-valued `key`
without the callback required at runtime, and verification callback payloads
are inferred as `any` even when a payload type argument is supplied.

To restore the published version:

```bash
npm install '@fastify/jwt@^10.2.2'
npm test
```

Specify the package explicitly when switching back: a plain `npm install`
can retain the local snapshot if it has the same version number as the release.

