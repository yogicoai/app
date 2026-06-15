import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { UserModel } from '../models/User'
import { hashPassword, verifyPassword } from '../lib/password'
import { publicUser } from '../lib/serialize'

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  displayName: z.string().min(1).optional(),
  track: z.string().optional(),
})
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
const deviceSchema = z.object({ deviceId: z.string().min(8, 'deviceId(8자 이상)가 필요합니다.') })

const authRoutes: FastifyPluginAsync = async (app) => {
  // [베타] 회원가입 없이 디바이스로 익명 토큰 발급. 같은 deviceId 면 동일 유저 반환.
  app.post('/device', async (req, reply) => {
    const { deviceId } = deviceSchema.parse(req.body)
    let user = await UserModel.findOne({ deviceId })
    let created = false
    if (!user) {
      user = await UserModel.create({ deviceId, anonymous: true })
      created = true
    }
    const token = app.jwt.sign({ sub: user.id })
    return reply.code(created ? 201 : 200).send({ token, user: publicUser(user) })
  })

  // [베타] 익명 유저를 이메일 계정으로 승격 — 같은 userId 유지라 진도율 그대로 이어짐.
  app.post('/link', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = credsSchema.parse(req.body)
    const user = await UserModel.findById(req.user.sub)
    if (!user) return reply.code(404).send({ error: '사용자를 찾을 수 없습니다.' })
    if (user.email) return reply.code(409).send({ error: '이미 계정이 연결돼 있습니다.' })

    const email = body.email.toLowerCase()
    if (await UserModel.findOne({ email })) {
      return reply.code(409).send({ error: '이미 가입된 이메일입니다.' })
    }
    user.email = email
    user.passwordHash = await hashPassword(body.password)
    user.anonymous = false
    if (body.displayName) user.displayName = body.displayName
    await user.save()

    const token = app.jwt.sign({ sub: user.id, email: user.email ?? undefined })
    return { token, user: publicUser(user) }
  })

  // (선택) 이메일 회원가입
  app.post('/signup', async (req, reply) => {
    const body = credsSchema.parse(req.body)
    const email = body.email.toLowerCase()
    if (await UserModel.findOne({ email })) {
      return reply.code(409).send({ error: '이미 가입된 이메일입니다.' })
    }
    const user = await UserModel.create({
      email,
      passwordHash: await hashPassword(body.password),
      displayName: body.displayName,
      track: body.track ?? '일반행정',
    })
    const token = app.jwt.sign({ sub: user.id, email: user.email ?? undefined })
    return reply.code(201).send({ token, user: publicUser(user) })
  })

  // 로그인
  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body)
    const user = await UserModel.findOne({ email: body.email.toLowerCase() })
    if (!user || !user.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })
    }
    const token = app.jwt.sign({ sub: user.id, email: user.email ?? undefined })
    return { token, user: publicUser(user) }
  })

  // 내 정보 (보호 라우트)
  app.get('/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await UserModel.findById(req.user.sub)
    if (!user) return reply.code(404).send({ error: '사용자를 찾을 수 없습니다.' })
    return { user: publicUser(user) }
  })
}

export default authRoutes
