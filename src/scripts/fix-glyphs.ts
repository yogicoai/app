// 기존 DB 데이터의 추출 깨짐(U+F000 → 『』, 기타 사설영역/치환문자 제거)을 정정한다.
// 멱등: 정화 결과가 원본과 같으면 건드리지 않는다. DB 가 살아 있어야 한다.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { TermModel } from '../models/Term'
import { sanitizeGlyphs } from '../lib/pdf/parse'

const DRY = process.argv.includes('--dry')

// 사설영역/치환문자가 들어있는지(=정정 대상) 빠른 판별
function dirty(s: unknown): boolean {
  if (typeof s !== 'string') return false
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (cp === 0xfffd || (cp >= 0xe000 && cp <= 0xf8ff)) return true
  }
  return false
}
const cleanArr = (a: unknown): { changed: boolean; value: string[] } => {
  if (!Array.isArray(a)) return { changed: false, value: [] }
  let changed = false
  const value = a.map((x) => {
    if (typeof x !== 'string') return x
    if (dirty(x)) {
      changed = true
      return sanitizeGlyphs(x)
    }
    return x
  })
  return { changed, value }
}

async function main() {
  await connectDb()
  console.log(DRY ? '[DRY RUN] 변경 없이 대상만 집계' : '정정 시작')

  // ---- 문제(questions) ----
  let qScanned = 0
  let qFixed = 0
  const qCur = QuestionModel.find({}).cursor()
  for await (const q of qCur) {
    qScanned++
    let touched = false
    for (const f of ['questionText', 'passage', 'explanation'] as const) {
      if (dirty(q[f])) {
        if (!DRY) (q as any)[f] = sanitizeGlyphs(q[f] as string)
        touched = true
      }
    }
    const ch = cleanArr(q.choices)
    if (ch.changed) {
      if (!DRY) q.choices = ch.value
      touched = true
    }
    if (touched) {
      qFixed++
      if (!DRY) await q.save()
      if (qFixed <= 12) console.log(`  ✓ Q ${q.year ?? '∅'} ${q.examType ?? ''} ${q.subject} #${q.number ?? '?'}`)
    }
  }
  console.log(`문제: ${qScanned}건 중 ${qFixed}건 정정${DRY ? '(예정)' : ''}`)

  // ---- 용어(terms) ----
  let tScanned = 0
  let tFixed = 0
  const tCur = TermModel.find({}).cursor()
  for await (const t of tCur) {
    tScanned++
    let touched = false
    for (const f of ['term', 'definition', 'example'] as const) {
      if (dirty(t[f])) {
        if (!DRY) (t as any)[f] = sanitizeGlyphs(t[f] as string)
        touched = true
      }
    }
    const rc = cleanArr(t.relatedConcepts)
    if (rc.changed) {
      if (!DRY) t.relatedConcepts = rc.value
      touched = true
    }
    if (touched) {
      tFixed++
      if (!DRY) await t.save()
    }
  }
  console.log(`용어: ${tScanned}건 중 ${tFixed}건 정정${DRY ? '(예정)' : ''}`)

  await mongoose.disconnect()
  console.log('완료.')
}

main().catch((e) => {
  console.error('정정 실패:', e)
  process.exit(1)
})
