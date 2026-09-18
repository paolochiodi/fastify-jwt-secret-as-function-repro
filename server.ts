import Fastify from 'fastify'
import fjwt from '@fastify/jwt'

type Payload = { sub: string; name: string }

const SECRET = 'my-super-secret'

// Static HS256 JWT signed with SECRET, with no expiry.
const STATIC_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciJ9.YAc1OSiA4EWX1uLjAtnYUFJSYM_W6EHpobnVQjDCPss'

const fastify = Fastify({ logger: true })

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

await fastify.register(fjwt, {
  secret: function getSecret(...args: unknown[]): void | Promise<string> {
    const last = args[args.length - 1]
    const callback = typeof last === 'function' ? last : null
    const first = args[0]

    let via: string
    let hasRequest: boolean
    let header: unknown
    let payload: unknown
    if (isRecord(first) && 'operation' in first) {
      via = 'SecretContext (unified API)'
      hasRequest = !!first.request
      header = first.header
      payload = first.payload
    } else if (isRecord(first) && typeof first.jwtVerify === 'function') {
      via = 'request.jwtVerify() - first arg is Fastify request'
      hasRequest = true
      const decodedToken = args[1]
      header = isRecord(decodedToken) ? decodedToken.header : undefined
      payload = isRecord(decodedToken) && 'payload' in decodedToken ? decodedToken.payload : decodedToken
    } else if (isRecord(first) && ('header' in first || 'payload' in first)) {
      via = 'fastify.jwt.verify() - first arg is decoded token sections (fast-jwt)'
      hasRequest = false
      header = first.header
      payload = first.payload
    } else {
      via = 'unknown call shape'
      hasRequest = false
    }

    console.log('\n--- getSecret called ---')
    console.log('  via            :', via)
    console.log('  arg count      :', args.length)
    console.log('  has request?   :', hasRequest)
    console.log('  header         :', header)
    console.log('  payload        :', payload)
    console.log('--- end getSecret ---\n')

    if (callback) {
      callback(null, SECRET)
      return
    }
    return Promise.resolve(SECRET)
  }
})

fastify.get('/verify-request', async (request, reply) => {
  try {
    const payload = await request.jwtVerify<Payload>()
    return { ok: true, source: 'request.jwtVerify()', payload }
  } catch (err) {
    reply.code(401)
    return { ok: false, source: 'request.jwtVerify()', error: err instanceof Error ? err.message : String(err) }
  }
})

fastify.get('/verify-instance', async (request, reply) => {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.code(401)
    return { ok: false, source: 'fastify.jwt.verify()', error: 'Missing Bearer token' }
  }

  const token = auth.slice(7)
  try {
    const payload = await new Promise<Payload>((resolve, reject) => {
      fastify.jwt.verify<Payload>(token, (err, result) => err ? reject(err) : resolve(result))
    })
    return { ok: true, source: 'fastify.jwt.verify()', payload }
  } catch (err) {
    reply.code(500)
    return { ok: false, source: 'fastify.jwt.verify()', error: err instanceof Error ? err.message : String(err) }
  }
})

await fastify.listen({ port: 3000 })
console.log(`\nTest with:\n  curl -H "Authorization: Bearer ${STATIC_TOKEN}" http://localhost:3000/verify-request\n`)