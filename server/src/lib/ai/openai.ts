import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { env } from '../../config/env'

// ── 제공자 판별 ────────────────────────────────────────────────
// Claude 키는 ANTHROPIC_API_KEY, 또는 OPENAI_API_KEY 에 sk-ant- 형태로 넣어도 인식한다.
function anthropicKey(): string | undefined {
  if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY
  if (env.OPENAI_API_KEY?.startsWith('sk-ant-')) return env.OPENAI_API_KEY
  return undefined
}
function useAnthropic(): boolean {
  if (env.AI_PROVIDER === 'anthropic') return true
  if (env.AI_PROVIDER === 'openai') return false
  return !!anthropicKey() // 키 형태로 자동 판별
}

// OpenAI 모델명 → Claude 모델 매핑(스크립트는 기존 gpt-4o/gpt-4o-mini 를 그대로 넘겨도 됨)
function toClaudeModel(reqModel?: string): string {
  if (!reqModel) return env.ANTHROPIC_MODEL // 기본(태깅 등): haiku
  if (reqModel.startsWith('claude-')) return reqModel
  if (/mini|haiku/i.test(reqModel)) return 'claude-haiku-4-5'
  if (/gpt-4o|sonnet|gpt-4/i.test(reqModel)) return 'claude-sonnet-4-6' // 해설·용어·추출
  return env.ANTHROPIC_MODEL
}

// 응답 텍스트에서 첫 번째 균형 잡힌 JSON 객체만 추출(코드펜스/잡담 제거).
function extractJson(text: string): string {
  const t = text.replace(/```(?:json)?/gi, '').trim()
  const start = t.indexOf('{')
  if (start < 0) return t
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < t.length; i++) {
    const c = t[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return t.slice(start, i + 1)
    }
  }
  return t.slice(start)
}

let openaiClient: OpenAI | null = null
let anthropicClient: Anthropic | null = null

function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY 가 설정되지 않았습니다. .env 를 확인하세요.')
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  return openaiClient
}
function getAnthropic(): Anthropic {
  const key = anthropicKey()
  if (!key) throw new Error('ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env 를 확인하세요.')
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: key })
  return anthropicClient
}

// 시스템+유저 프롬프트로 JSON 문자열 응답을 받아 그대로 반환한다(파싱은 호출측 책임).
// AI_PROVIDER=anthropic(또는 Claude 키 감지) 시 Claude로, 아니면 OpenAI로 호출한다.
export async function chatJson(system: string, user: string, opts: { temperature?: number; model?: string } = {}): Promise<string> {
  if (useAnthropic()) {
    const res = await getAnthropic().messages.create({
      model: toClaudeModel(opts.model),
      max_tokens: 8192,
      temperature: opts.temperature ?? 0,
      // Sonnet 4.6 등은 프리필 미지원 → 프롬프트로 JSON 강제 후 응답에서 추출.
      system: system + '\n\n[출력] 마크다운/설명 없이 JSON 객체만 출력하라.',
      messages: [{ role: 'user', content: user }],
    })
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    return extractJson(text)
  }
  const res = await getOpenAI().chat.completions.create({
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
