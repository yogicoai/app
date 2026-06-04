// 감사가 짚은 특정 문항만 고친다(전체 재적재 없이 → 좋은 문항 보존).
// 입력 두 가지(둘 다/하나만 가능):
//   1) NUMBERS=20,21  → 해당 번호만 타겟 재추출(텍스트 지문 누락·뒤섞임 등 수정).
//   2) content/manual/<YEAR>_<SUBJECT>.json → 수동 작성 오버라이드(이미지 지문 등 추출 불가 문항).
//      형식: [{ "number": 6, "questionText": "...", "choices": ["..","..","..",".."] }]  (answerIndex 는 정답표에서 자동)
// 옵션: SUBJECT(필수) · YEAR(기본 2026) · NUMBERS · EXAM_TYPE(기본 국가직) · PDF_DIR(기본 content/raw)
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { extractPdfPages } from '../lib/pdf/extract'
import { extractQuestionsByNumbers } from '../lib/pdf/aiExtract'
import { parseAnswerTable, parseFileMeta, mergeAnswerKey, type ParsedQuestion } from '../lib/pdf/parse'

const SUBJECT = process.env.SUBJECT
const YEAR = Number(process.env.YEAR ?? '2026')
const EXAM_TYPE = process.env.EXAM_TYPE ?? '국가직'
const RAW_DIR = process.env.PDF_DIR ?? 'content/raw'
const SUBJECTS = ['국어', '영어', '한국사', '행정법총론', '행정학개론']

async function answersFor(subject: string): Promise<number[]> {
  const files = await readdir(RAW_DIR)
  for (const f of files.filter((x) => /\.pdf$/i.test(x) && /정답/.test(x))) {
    const t = parseAnswerTable((await extractPdfPages(path.join(RAW_DIR, f))).join(' '))
    if (t[subject]) return t[subject]!
  }
  return []
}

async function upsert(subject: string, q: ParsedQuestion): Promise<void> {
  const key = `${YEAR}-${EXAM_TYPE}-${subject}-${q.number}`
  await QuestionModel.findOneAndUpdate(
    { key },
    { key, subject, year: YEAR, examType: EXAM_TYPE, number: q.number, questionText: q.questionText, choices: q.choices, answerIndex: q.answerIndex, source: '기출' },
    { upsert: true, setDefaultsOnInsert: true },
  )
}

async function main() {
  if (!SUBJECT) throw new Error('SUBJECT 환경변수가 필요합니다 (예: SUBJECT=영어)')
  await connectDb()
  const answers = await answersFor(SUBJECT)
  if (!answers.length) throw new Error(`정답표에 ${SUBJECT} 없음`)

  // 1) 타겟 재추출
  const nums = (process.env.NUMBERS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => n > 0)
  if (nums.length) {
    const files = await readdir(RAW_DIR)
    const pf = files.find((f) => /\.pdf$/i.test(f) && !/정답/.test(f) && parseFileMeta(f, SUBJECTS).subject === SUBJECT)
    if (!pf) throw new Error(`${SUBJECT} 문제 PDF 못 찾음`)
    const items = await extractQuestionsByNumbers(await extractPdfPages(path.join(RAW_DIR, pf)), nums)
    const merged = mergeAnswerKey(items, answers)
    for (const q of merged) await upsert(SUBJECT, q)
    const got = merged.map((m) => m.number)
    console.log(`타겟 재추출: ${got.join(', ') || '없음'} 수정 (요청 ${nums.join(', ')})`)
    const miss = nums.filter((n) => !got.includes(n))
    if (miss.length) console.warn(`  ⚠ 재추출 실패: ${miss.join(', ')} — 수동 오버라이드 필요`)
  }

  // 2) 수동 오버라이드
  const manualPath = `content/manual/${YEAR}_${SUBJECT}.json`
  const raw = await readFile(manualPath, 'utf8').catch(() => null)
  if (raw) {
    const overrides: { number: number; questionText: string; choices: string[]; answerIndex?: number }[] = JSON.parse(raw)
    for (const o of overrides) {
      const ai = o.answerIndex ?? (answers[o.number - 1] ?? 1) - 1
      await upsert(SUBJECT, { number: o.number, questionText: o.questionText, choices: o.choices, answerIndex: ai })
    }
    console.log(`수동 오버라이드 적용: ${overrides.map((o) => o.number).join(', ')} (${manualPath})`)
  }

  await mongoose.disconnect()
  console.log('완료. 태깅이 필요하면 npm run tag.')
}

main().catch((e) => { console.error('수정 실패:', e); process.exit(1) })
