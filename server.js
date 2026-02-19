import Fastify from 'fastify'
import fjwt from '@fastify/jwt'

const SECRET = 'my-super-secret'

// Static HS256 JWT token, signed with SECRET above, no expiry.
// Payload: { "sub": "1234567890", "name": "Test User" }
const STATIC_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciJ9.YAc1OSiA4EWX1uLjAtnYUFJSYM_W6EHpobnVQjDCPss'

const fastify = Fastify({ logger: true })

// Register @fastify/jwt with a *function* as the secret option.
// The documented signature is: (request, decodedToken) => secret
//
// However, when verify is called on the fastify instance (fastify.jwt.verify),
// @fastify/jwt does NOT invoke this function itself. Instead it passes the raw
// function to fast-jwt as the `key` option. fast-jwt then calls it with its own
// signature: (decodedToken) — no request object at all.
//
// This means the first argument changes depending on the call context:
//   - request.jwtVerify()     → secretFn(request, decodedToken)  ✅ correct
//   - fastify.jwt.verify(tok) → secretFn(decodedToken)           ❌ inconsistent
await fastify.register(fjwt, {
  secret: function getSecret(requestOrToken, tokenOrCallback, maybeCallback) {
    console.log('\n--- getSecret called ---')
    console.log('  number of args :', getSecret.length, '(actual:', arguments.length, ')')
    console.log('  typeof 1st arg :', typeof requestOrToken)
    console.log('  1st arg keys   :', Object.keys(requestOrToken ?? {}))

    const isRequest = typeof requestOrToken?.jwtVerify === 'function'
    console.log('  is Fastify req?:', isRequest)

    if (isRequest) {
      // Called by @fastify/jwt via request.jwtVerify()
      // Signature: getSecret(request, decodedToken, callback)  ✅ correct
      console.log('  context        : request.jwtVerify()')
      console.log('  2nd arg (token):', tokenOrCallback)
      console.log('  3rd arg (cb)   :', typeof maybeCallback)
      console.log('--- end getSecret ---\n')
      maybeCallback(null, SECRET)
    } else {
      // Called by fast-jwt (NOT @fastify/jwt) via fastify.jwt.verify()
      // Signature: getSecret(decodedToken, callback)  ❌ inconsistent
      // The 1st arg is the decoded JWT sections, NOT a request.
      // The 2nd arg is a fast-jwt callback, NOT the decoded token.
      console.log('  context        : fastify.jwt.verify() — called by fast-jwt, not @fastify/jwt!')
      console.log('  1st arg IS the decoded token (no request!)')
      console.log('  2nd arg type   :', typeof tokenOrCallback, '(fast-jwt callback)')
      console.log('--- end getSecret ---\n')
      tokenOrCallback(null, SECRET)
    }
  }
})

// Route 1 — Verify via the request object (correct behavior)
fastify.get('/verify-request', async (request, reply) => {
  try {
    const payload = await request.jwtVerify()
    return { ok: true, source: 'request.jwtVerify()', payload }
  } catch (err) {
    reply.code(401)
    return { ok: false, source: 'request.jwtVerify()', error: err.message }
  }
})

// Route 2 — Verify via the fastify instance (demonstrates the bug)
fastify.get('/verify-instance', async (request, reply) => {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.code(401)
    return { ok: false, source: 'fastify.jwt.verify()', error: 'Missing Bearer token' }
  }

  const token = auth.slice(7)
  try {
    const payload = await fastify.jwt.verify(token)
    return { ok: true, source: 'fastify.jwt.verify()', payload }
  } catch (err) {
    reply.code(500)
    return { ok: false, source: 'fastify.jwt.verify()', error: err.message }
  }
})

await fastify.listen({ port: 3000 })
