import fjwt from '@fastify/jwt'
import type { FastifyJWTOptions, TokenOrHeader } from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest } from 'fastify'

type Payload = { sub: string; name: string }

declare const fastify: FastifyInstance
declare const request: FastifyRequest
declare const token: string

function expectType<Expected>(value: Expected): void {
  void value
}

const callbackOptions = {
  secret(request: FastifyRequest, _token: TokenOrHeader, callback: (err: Error | null, secret: string | Buffer | undefined) => void) {
    expectType<string | undefined>(request.headers.authorization)
    // @ts-expect-error The callback cannot supply a numeric key.
    callback(null, 123)
    callback(null, 'my-super-secret')
  }
} satisfies FastifyJWTOptions

const asyncOptions = {
  async secret(request: FastifyRequest, _token: TokenOrHeader) {
    expectType<string | undefined>(request.headers.authorization)
    return 'my-super-secret'
  }
} satisfies FastifyJWTOptions

fastify.register(fjwt, callbackOptions)
fastify.register(fjwt, asyncOptions)
expectType<Promise<Payload>>(request.jwtVerify<Payload>())
expectType<Payload>(fastify.jwt.verify<Payload>(token))
expectType<void>(fastify.jwt.verify<Payload>(token, (err, decoded: Payload) => {
  expectType<Error | null>(err)
  expectType<string>(decoded.sub)
}))

// @ts-expect-error A numeric secret is not supported.
const invalidOptions: FastifyJWTOptions = { secret: 123 }
void invalidOptions

// @ts-expect-error Instance verification requires a token.
fastify.jwt.verify()

// @ts-expect-error Tokens cannot be numbers.
fastify.jwt.verify(123)

// @ts-expect-error Request verification returns a promise, not the payload.
expectType<Payload>(request.jwtVerify<Payload>())

// @ts-expect-error The declared payload has no email field.
fastify.jwt.verify<Payload>(token).email