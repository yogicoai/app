// 용어 사전 생성(키워드형): 각 기출 문제(지문/발문/보기)에서 수험생 핵심 키워드를 뽑아 설명을 단다.
// concept 주제 구문이 아니라, 시험 출제 포인트가 되는 개념어/법률용어/문법용어 단위로 정리.
// 멱등: key=subject:term(키워드). 과목 내 같은 키워드는 한 번만. 옵션: SUBJECT · TERMS_MODEL(기본 gpt-4o) · RESET(1이면 기존 AI 용어 삭제 후 재생성)
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { TermModel } from '../models/Term'
import { chatJson } from '../lib/ai/openai'

const MODEL = process.env.TERMS_MODEL ?? 'gpt-4o'
const ONLY = process.env.SUBJECT
const RESET = process.env.RESET === '1'

const SYSTEM =
  '너는 9급 공무원 시험 대비 용어 사전 편집자다. 주어진 한 문제(지문·발문·보기)에서 ' +
  '수험생이 반드시 알아야 할 핵심 용어(키워드)를 뽑아 각각 설명한다.\n' +
  '규칙:\n' +
  '1) 일반 단어가 아니라 그 과목의 출제 포인트가 되는 개념어/법률용어/문법용어/제도명/인물·사건 위주로 고른다.\n' +
  '2) term 은 간결한 명사형 키워드(예: "공정력", "불가쟁력", "비례원칙", "갑오개혁", "형태소"). 긴 설명 문장 금지.\n' +
  '3) definition 은 그 키워드의 핵심을 2~3문장으로(의미 + 시험 포인트). 정확하고 사실 오류 없이.\n' +
  '4) example 은 한 줄(없으면 ""). \n' +
  '5) 한 문제에서 3~6개. 문제 풀이와 무관한 잡다한 단어는 넣지 마라.\n' +
  '반드시 {"terms":[{"term":"","definition":"","example":""}]} JSON 만 출력한다.'

function buildUser(q: { subject: string; unit?: string; passage?: string; questionText: string; choices: string[] }): string {
  return [
    `과목: ${q.subject}`,
    q.unit ? `단원: ${q.unit}` : '',
    q.passage ? `지문: ${q.passage}` : '',
    `발문: ${q.questionText}`,
    `보기: ${q.choices.join(' / ')}`,
  ]
    .filter(Boolean)
    .join('\n')
}

interface ParsedTerm {
  term: string
  definition: string
  example?: string
}
function parseTerms(raw: string): ParsedTerm[] {
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return []
  }
  const arr = Array.isArray((o as { terms?: unknown })?.terms) ? (o as { terms: unknown[] }).terms : []
  const out: ParsedTerm[] = []
  for (const t of arr) {
    if (!t || typeof t !== 'object') continue
    const r = t as Record<string, unknown>
    const term = typeof r.term === 'string' ? r.term.trim() : ''
    const definition = typeof r.definition === 'string' ? r.definition.trim() : ''
    if (!term || !definition || term.length > 30) continue // 키워드는 짧아야
    const example = typeof r.example === 'string' && r.example.trim() ? r.example.trim() : undefined
    out.push({ term, definition, example })
  }
  return out
}

async function main() {
  await connectDb()
  const filter: Record<string, unknown> = { source: '기출' }
  if (ONLY) filter.subject = ONLY

  if (RESET) {
    const del = await TermModel.deleteMany(ONLY ? { source: 'ai', subject: ONLY } : { source: 'ai' })
    console.log(`기존 AI 용어 ${del.deletedCount}개 삭제(RESET)`)
  }

  const questions = await QuestionModel.find(filter).sort({ subject: 1, number: 1 }).lean()
  let created = 0
  let dup = 0
  let failed = 0
  for (const raw of questions) {
    const q = raw as unknown as { subject: string; unit?: string; passage?: string; questionText: string; choices: string[]; number: number }
    try {
      const res = await chatJson(SYSTEM, buildUser(q), { model: MODEL })
      const terms = parseTerms(res)
      for (const t of terms) {
        const key = `${q.subject}:${t.term}`
        const exists = await TermModel.exists({ key })
        if (exists) {
          dup++
          continue
        }
        await TermModel.create({
          key,
          subject: q.subject,
          unit: q.unit,
          term: t.term,
          definition: t.definition,
          example: t.example,
          source: 'ai',
          model: MODEL,
        })
        created++
      }
      console.log(`✓ [${q.subject} ${q.number}] ${terms.length}개 (+${terms.length})`)
    } catch (e) {
      failed++
      console.warn(`✗ [${q.subject} ${q.number}]:`, (e as Error).message)
    }
  }
  console.log(`\n키워드 용어 생성: 신규 ${created} · 중복스킵 ${dup} · 실패 ${failed}`)
  console.log(`terms 총: ${await TermModel.estimatedDocumentCount()}개`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('용어 생성 실패:', e)
  process.exit(1)
})
