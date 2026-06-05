// 용어 사전 생성: 기출 문제의 (subject, unit, concept) 태그를 씨앗으로 AI가 정의를 작성한다.
// 단원(subject+unit)별로 배치 호출(비용↓). 멱등: 이미 있는 용어(key=subject:term)는 건너뜀.
// 옵션: SUBJECT(특정 과목만) · TERMS_MODEL(기본 gpt-4o)
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { TermModel } from '../models/Term'
import { chatJson } from '../lib/ai/openai'

const MODEL = process.env.TERMS_MODEL ?? 'gpt-4o'
const ONLY = process.env.SUBJECT

const SYSTEM =
  '너는 9급 공무원 시험 대비 용어 사전 편집자다. 주어진 과목·단원의 핵심 개념들에 대해 ' +
  '수험생이 이해할 정의를 작성한다. 각 항목: {"term":개념명(주어진 그대로 유지),' +
  '"definition":2~3문장 정의(핵심 의미 + 시험 포인트),"example":한 줄 예시(없으면 "")}. ' +
  '정확하고 간결하게, 사실 오류 없이. 반드시 {"terms":[...]} JSON 만 출력한다.'

function buildUser(subject: string, unit: string, concepts: string[]): string {
  return `과목: ${subject}\n단원: ${unit}\n개념 목록:\n${concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
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
    if (!term || !definition) continue
    const example = typeof r.example === 'string' && r.example.trim() ? r.example.trim() : undefined
    out.push({ term, definition, example })
  }
  return out
}

async function main() {
  await connectDb()
  const match: Record<string, unknown> = { source: '기출', concept: { $ne: null } }
  if (ONLY) match.subject = ONLY

  const rows = await QuestionModel.aggregate([
    { $match: match },
    { $group: { _id: { subject: '$subject', unit: '$unit', concept: '$concept' } } },
  ])

  // (subject, unit) 단위로 concept 묶기
  const groups = new Map<string, { subject: string; unit: string; concepts: string[] }>()
  for (const r of rows) {
    const subject = r._id.subject as string
    const unit = (r._id.unit as string) ?? '기타'
    const concept = r._id.concept as string
    if (!concept) continue
    const k = `${subject}::${unit}`
    if (!groups.has(k)) groups.set(k, { subject, unit, concepts: [] })
    groups.get(k)!.concepts.push(concept)
  }

  let created = 0
  let skipped = 0
  let failed = 0
  for (const g of groups.values()) {
    const existing = new Set(
      (await TermModel.find({ subject: g.subject, term: { $in: g.concepts } }).select('term')).map(
        (t) => (t as unknown as { term: string }).term,
      ),
    )
    const todo = [...new Set(g.concepts)].filter((c) => !existing.has(c))
    if (todo.length === 0) {
      skipped += g.concepts.length
      continue
    }
    try {
      const raw = await chatJson(SYSTEM, buildUser(g.subject, g.unit, todo), { model: MODEL })
      const terms = parseTerms(raw)
      for (const t of terms) {
        const key = `${g.subject}:${t.term}`
        await TermModel.findOneAndUpdate(
          { key },
          { key, subject: g.subject, unit: g.unit, term: t.term, definition: t.definition, example: t.example, source: 'ai', model: MODEL },
          { upsert: true, setDefaultsOnInsert: true },
        )
        created++
      }
      console.log(`✓ [${g.subject}] ${g.unit}: ${terms.length}개`)
    } catch (e) {
      failed++
      console.warn(`✗ [${g.subject}] ${g.unit}:`, (e as Error).message)
    }
  }

  console.log(`\n용어 생성: ${created}개 · 스킵(기존) ${skipped} · 실패 ${failed}`)
  console.log(`terms 총: ${await TermModel.estimatedDocumentCount()}개`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('용어 생성 실패:', e)
  process.exit(1)
})
