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
const ONLY_EXAM = process.env.EXAM // 국가직/지방직 (특정 시험만 — 기존 적재분 재처리 방지)
const RESET = process.env.RESET === '1'
const YEARS = (process.env.YEARS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => n > 0)

const SYSTEM =
  '너는 9급 공무원 시험 대비 학습 사전 편집자다. 주어진 한 문제(지문·발문·보기)에서 학습 항목을 뽑아 정리한다. 과목에 따라 방식이 다르다.\n' +
  '■ 영어 과목 = 단어집: 지문·발문·보기에 **실제로 나오는** 영단어·숙어만 뽑는다(본문에 없는 단어를 지어내지 말 것). term=그 단어/숙어의 기본형(원형), definition=한국어 뜻만 간결하게(여러 뜻은 콤마로, 설명 문장 금지). 완전한 문장(대화 보기 등)은 통째로 넣지 말고 그 안의 핵심 단어만. 어휘 문제의 보기 단어는 모두 포함. ' +
  '**단, who/what/when/why/how/the/is/go/do/get/make/help/finish/sleep/health 처럼 너무 기초적인(중학 수준 이하) 기본어·기능어·대명사·전치사는 제외하고, 학습 가치가 있는 중급 이상 어휘·숙어·시험 빈출어만 담는다.** example 에는 간단한 쓰임(선택).\n' +
  '■ 그 외 과목(국어·한국사·행정법총론·행정학개론) = 용어 정리: 출제 포인트가 되는 개념어/법률용어/문법용어/제도/인물·사건을 뽑는다. term=간결한 명사형 키워드(예: "공정력", "비례원칙", "갑오개혁", "형태소"), definition=2~3문장 설명(의미 + 시험 포인트).\n' +
  '공통: term 은 짧게(설명 문장 금지), definition 은 정확하게(사실 오류 금지), example 은 한 줄(없으면 ""). 한 문제에서 3~8개. 문제와 무관한 잡다한 항목은 넣지 마라.\n' +
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
    if (!term || !definition || term.length > 40) continue // 키워드/단어는 짧아야(숙어 허용)
    const example = typeof r.example === 'string' && r.example.trim() ? r.example.trim() : undefined
    out.push({ term, definition, example })
  }
  return out
}

async function main() {
  await connectDb()
  const filter: Record<string, unknown> = { source: '기출' }
  if (ONLY) filter.subject = ONLY
  if (ONLY_EXAM) filter.examType = ONLY_EXAM
  if (YEARS.length) filter.year = { $in: YEARS }

  if (RESET) {
    const del = await TermModel.deleteMany(ONLY ? { source: 'ai', subject: ONLY } : { source: 'ai' })
    console.log(`기존 AI 용어 ${del.deletedCount}개 삭제(RESET)`)
  }

  const questions = await QuestionModel.find(filter).sort({ subject: 1, number: 1 }).lean()
  let created = 0
  let dup = 0
  let failed = 0
  for (const raw of questions) {
    const q = raw as unknown as { subject: string; unit?: string; passage?: string; questionText: string; choices: string[]; number: number; year?: number; examType?: string }
    try {
      const res = await chatJson(SYSTEM, buildUser(q), { model: MODEL })
      const terms = parseTerms(res)
      for (const t of terms) {
        const key = `${q.subject}:${t.term}`
        const origin = q.year && q.number ? { year: q.year, examType: q.examType, number: q.number } : null
        const exists = await TermModel.exists({ key })
        if (exists) {
          // 이미 있는 용어면 출처(연도·시험·문항)만 누적
          const add: Record<string, unknown> = { years: q.year, examTypes: q.examType }
          if (origin) add.origins = origin
          await TermModel.updateOne({ key }, { $addToSet: add })
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
          years: q.year ? [q.year] : [],
          examTypes: q.examType ? [q.examType] : [],
          origins: origin ? [origin] : [],
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
