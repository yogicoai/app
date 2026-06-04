import OpenAI from 'openai'
import { env } from '../../config/env'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 가 설정되지 않았습니다. .env 를 확인하세요.')
  }
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  return client
}

// 시스템+유저 프롬프트로 JSON 문자열 응답을 받아 그대로 반환한다(파싱은 호출측 책임).
// model 미지정 시 env.OPENAI_MODEL(기본 태깅용 저렴 모델). 정확도 중요한 호출은 model 로 상위 모델 지정.
export async function chatJson(system: string, user: string, opts: { temperature?: number; model?: string } = {}): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: opts.model ?? env.OPENAI_MODEL,
    temperature: opts.temperature ?? 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  return res.choices[0]?.message?.content ?? ''
}
