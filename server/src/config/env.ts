import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI 환경변수가 필요합니다.'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 은 최소 16자 이상이어야 합니다.'),
  CORS_ORIGIN: z.string().default('*'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  // Claude(Anthropic)로 전환용. 키는 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY(sk-ant- 로 시작)에 둘 수 있다.
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['openai', 'anthropic']).optional(), // 미지정 시 키 형태로 자동 판별
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5'), // 기본(태깅 등 저렴). 상위 호출은 model 로 지정
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('환경변수 설정 오류:\n', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
