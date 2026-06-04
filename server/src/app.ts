import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { env } from './config/env'
import authPlugin from './plugins/auth'
import authRoutes from './routes/auth'
import progressRoutes from './routes/progress'
import contentRoutes from './routes/content'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  })
  await app.register(authPlugin)

  // 공통 에러 핸들러 (Zod 검증 실패 → 400)
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'ValidationError', details: err.flatten() })
    }
    req.log.error(err)
    const e = err as { statusCode?: number; message?: string }
    return reply.code(e.statusCode ?? 500).send({ error: e.message ?? 'Internal Server Error' })
  })

  app.get('/', async () => ({
    name: 'gongmuwon9-api',
    status: 'ok',
    beta: '회원가입 없이 POST /auth/device 로 시작',
    endpoints: [
      'GET /health',
      'POST /auth/device',
      'POST /auth/link',
      'POST /auth/signup',
      'POST /auth/login',
      'GET /auth/me',
      'GET /content/today',
      'GET /content/questions',
      'POST /progress/attempt',
      'GET /progress/due',
      'GET /progress/summary',
    ],
  }))

  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(progressRoutes, { prefix: '/progress' })
  await app.register(contentRoutes, { prefix: '/content' })

  return app
}
