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
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('환경변수 설정 오류:\n', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
