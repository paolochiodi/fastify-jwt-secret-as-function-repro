import Fastify from 'fastify'
import fjwt from '@fastify/jwt'

const SECRET = 'my-super-secret'

// Static HS256 JWT token, signed with SECRET above, no expiry.
// Payload: { "sub": "1234567890", "name": "Test User" }
const STATIC_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciJ9.YAc1OSiA4EWX1uLjAtnYUFJSYM_W6EHpobnVQjDCPss'

const fastify = Fastify({ logger: true })

// Register @fastify/jwt with a *function* as the secret option.
//
// With the fixed version of @fastify/jwt, the secret function uses a unified
// SecretContext-based signature regardless of the call context:
//   (context, callback) => void   OR   (context) => Promise<string>
//
// The context object always contains: { operation, header, payload, signature }
// When called from a request context, it also includes: { request }
// When called from the fastify instance, `request` is undefined.
//
// This is consistent and predictable, unlike the original behavior where:
//   - request.jwtVerify()     → secretFn(request, decodedToken, callback)
//   - fastify.jwt.verify(tok) → secretFn(decodedToken, callback)  (called by fast-jwt directly)
await fastify.register(fjwt, {
  secret: function getSecret(context, callback) {
    console.log('\n--- getSecret called ---')
    console.log('  operation      :', context.operation)
    console.log('  has request?   :', !!context.request)
    console.log('  header         :', context.header)
    console.log('  payload        :', context.payload)

    if (context.request) {
      console.log('  context        : called from request.jwtVerify()')
    } else {
      console.log('  context        : called from fastify.jwt.verify()')
    }

    console.log('--- end getSecret ---\n')
    callback(null, SECRET)
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
    const payload = await new Promise((resolve, reject) => {
      fastify.jwt.verify(token, (err, result) => err ? reject(err) : resolve(result))
    })
    return { ok: true, source: 'fastify.jwt.verify()', payload }
  } catch (err) {
    reply.code(500)
    return { ok: false, source: 'fastify.jwt.verify()', error: err.message }
  }
})

await fastify.listen({ port: 3000 })
