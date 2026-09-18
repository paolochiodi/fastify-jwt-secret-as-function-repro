import Fastify from 'fastify'
import { fastifyJwtJwks } from 'fastify-jwt-jwks'

type Payload = { sub: string; name: string }

const SECRET = 'my-super-secret'

// Reproduction of https://github.com/nearform/fastify-jwt-jwks/issues/54.
const STATIC_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciJ9.YAc1OSiA4EWX1uLjAtnYUFJSYM_W6EHpobnVQjDCPss'

const fastify = Fastify({ logger: true })

await fastify.register(fastifyJwtJwks, {
  secret: SECRET
})

fastify.get('/verify-instance', async (request, reply) => {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.code(401)
    return { ok: false, error: 'Missing Bearer token' }
  }

  const token = auth.slice(7)
  try {
    const payload = await new Promise<Payload>((resolve, reject) => {
      fastify.jwt.verify<Payload>(token, (err, result) => (err ? reject(err) : resolve(result)))
    })
    return { ok: true, source: 'fastify.jwt.verify()', payload }
  } catch (err) {
    reply.code(500)
    return { ok: false, source: 'fastify.jwt.verify()', error: err instanceof Error ? err.message : String(err) }
  }
})

await fastify.listen({ port: 3001 })
console.log(`\nTest with:\n  curl -H "Authorization: Bearer ${STATIC_TOKEN}" http://localhost:3001/verify-instance\n`)