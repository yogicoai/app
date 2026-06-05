// 각 기출 문제에 AI 해설을 생성해 Question.explanation 에 저장한다(오답노트·풀이집용).
// 정답 번호를 함께 주어 정확도↑. 멱등: 이미 해설이 있으면 스킵. 옵션: SUBJECT · EXPLAIN_MODEL(기본 gpt-4o) · FORCE(1이면 재생성)
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { chatJson } from '../lib/ai/openai'

const MODEL = process.env.EXPLAIN_MODEL ?? 'gpt-4o'
const ONLY = process.env.SUBJECT
const FORCE = process.env.FORCE === '1'
// KEYS=키1,키2 지정 시 해당 문항만(FORCE처럼 기존 해설도 재생성). 예: 2022-지방직-한국사-11
const KEYS = (process.env.KEYS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

const SYSTEM =
  '너는 9급 공무원 시험 해설 강사다. 주어진 문제와 정답 번호를 보고 수험생용 해설을 쓴다.\n' +
  '규칙:\n' +
  '1) 정답이 왜 정답인지 핵심 근거를 먼저 설명한다.\n' +
  '2) 이어서 각 보기 ①②③④(있으면 ⑤)가 왜 맞고/틀린지 한 줄씩 짚는다(오답 이유 포함).\n' +
  '3) 정확하고 사실 오류 없이. 주어진 정답 번호와 모순되지 않게.\n' +
  '4) 형식 예: "정답 ③\\n\\n[근거] …\\n\\n[보기 해설]\\n① …\\n② …\\n③ …(정답)\\n④ …"\n' +
  '반드시 {"explanation":"...(\\n 포함 가능)"} JSON 만 출력한다.'

function buildUser(q: { subject: string; passage?: string; questionText: string; choices: string[]; answerIndex: number }): string {
  const choiceLines = q.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')
  return [
    `과목: ${q.subject}`,
    q.passage ? `지문: ${q.passage}` : '',
    `발문: ${q.questionText}`,
    `보기:\n${choiceLines}`,
    `정답: ${q.answerIndex + 1}번`,
  ]
    .filter(Boolean)
    .join('\n')
}

function parseExplanation(raw: string): string | null {
  try {
    const o = JSON.parse(raw) as { explanation?: unknown }
    return typeof o.explanation === 'string' && o.explanation.trim() ? o.explanation.trim() : null
  } catch {
    return null
  }
}

async function main() {
  await connectDb()
  const filter: Record<string, unknown> = { source: '기출' }
  if (ONLY) filter.subject = ONLY
  if (KEYS.length) filter.key = { $in: KEYS } // 지정 키만 재생성(FORCE 무시하고 항상 덮어씀)
  else if (!FORCE) filter.$or = [{ explanation: { $exists: false } }, { explanation: null }, { explanation: '' }]

  const questions = await QuestionModel.find(filter).sort({ subject: 1, number: 1 })
  console.log(`해설 생성 대상: ${questions.length}문항`)
  let done = 0
  let failed = 0
  for (const q of questions) {
    const doc = q as unknown as { subject: string; passage?: string; questionText: string; choices: string[]; answerIndex: number; number: number; explanation?: string }
    try {
      const raw = await chatJson(SYSTEM, buildUser(doc), { model: MODEL })
      const exp = parseExplanation(raw)
      if (!exp) {
        failed++
        console.warn(`✗ 파싱 실패 (${doc.subject} ${doc.number})`)
        continue
      }
      q.set('explanation', exp)
      await q.save()
      done++
      console.log(`✓ ${doc.subject} ${doc.number}`)
    } catch (e) {
      failed++
      console.warn(`✗ (${doc.subject} ${doc.number}):`, (e as Error).message)
    }
  }
  console.log(`\n해설 생성: 성공 ${done} · 실패 ${failed}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('해설 생성 실패:', e)
  process.exit(1)
})
