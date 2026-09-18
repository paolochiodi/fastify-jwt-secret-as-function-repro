import fjwt from '@fastify/jwt'
import type { FastifyJWTOptions, JwtHeader, SecretContext, SecretProvider } from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest } from 'fastify'

type Payload = { sub: string; name: string }

declare const fastify: FastifyInstance
declare const request: FastifyRequest
declare const token: string

function expectType<Expected>(value: Expected): void {
  void value
}

const callbackOptions = {
  secret(context, callback) {
    expectType<SecretContext>(context)
    expectType<FastifyRequest | undefined>(context.request)
    if (context.request) {
      expectType<string | undefined>(context.request.headers.authorization)
    }
    if (context.operation === 'verify') {
      expectType<JwtHeader>(context.header)
      expectType<string>(context.signature)
    } else {
      expectType<'sign'>(context.operation)
      // @ts-expect-error Signing contexts do not include a header.
      void context.header
    }
    // @ts-expect-error Instance operations have no request.
    void context.request.headers
    // @ts-expect-error The callback cannot supply a numeric key.
    callback(null, 123)
    callback(null, 'my-super-secret')
  }
} satisfies FastifyJWTOptions

const asyncOptions = {
  async secret(context) {
    expectType<SecretContext>(context)
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

// @ts-expect-error Secret providers no longer receive three positional arguments.
const legacySecret: SecretProvider = (_request: FastifyRequest, _token: unknown, callback: (err: Error | null, secret: string) => void) => callback(null, 'my-super-secret')
void legacySecret

// @ts-expect-error Async secret providers cannot return a numeric key.
const invalidAsyncSecret: SecretProvider = async () => 123
void invalidAsyncSecret

// @ts-expect-error Instance verification requires a token.
fastify.jwt.verify()

// @ts-expect-error Tokens cannot be numbers.
fastify.jwt.verify(123)

// @ts-expect-error Request verification returns a promise, not the payload.
expectType<Payload>(request.jwtVerify<Payload>())

// @ts-expect-error The declared payload has no email field.
fastify.jwt.verify<Payload>(token).email