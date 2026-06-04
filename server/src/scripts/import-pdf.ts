// content/raw/ 의 (문제 PDF, 정답표 PDF) → AI 추출·정답병합 → 멱등 적재.
// 정답은 통합 정답표(*정답*.pdf)들을 합쳐 과목별로 조회한다(국가직 통합표에 우리 5과목이 모두 있음).
// 멱등: key = 'YYYY-시험-과목-번호'. 재실행 시 본문/보기/정답을 최신 추출로 갱신(unit/태그는 보존).
//
// 옵션(환경변수): SUBJECT=국어(특정 과목만) · PDF_DIR(기본 content/raw) · EXAM_TYPE(기본 국가직)
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { extractPdfPages } from '../lib/pdf/extract'
import { extractQuestionsFromDoc } from '../lib/pdf/aiExtract'
import { parseAnswerTable, mergeAnswerKey, parseFileMeta } from '../lib/pdf/parse'

const RAW_DIR = process.env.PDF_DIR ?? 'content/raw'
const ONLY = process.env.SUBJECT
const EXAM_TYPE = process.env.EXAM_TYPE ?? '국가직'
const SUBJECTS = ['국어', '영어', '한국사', '행정법총론', '행정학개론']

// 모든 정답표 PDF 를 합쳐 { 과목명: [정답 20개] } 마스터 테이블 구성.
async function buildAnswerTable(files: string[]): Promise<Record<string, number[]>> {
  const master: Record<string, number[]> = {}
  for (const f of files.filter((x) => /\.pdf$/i.test(x) && /정답/.test(x))) {
    const pages = await extractPdfPages(path.join(RAW_DIR, f))
    const table = parseAnswerTable(pages.join(' '))
    for (const [subj, arr] of Object.entries(table)) if (!master[subj]) master[subj] = arr
  }
  return master
}

async function main() {
  await connectDb()
  const files = await readdir(RAW_DIR)
  const answerTable = await buildAnswerTable(files)
  console.log(`정답표 적재: ${Object.keys(answerTable).length}과목`)

  const problemFiles = files.filter((f) => /\.pdf$/i.test(f) && !/정답/.test(f))
  let total = 0
  for (const pf of problemFiles) {
    const meta = parseFileMeta(pf, SUBJECTS)
    if (!meta.subject) {
      console.warn(`· 과목 불명, 건너뜀: ${pf}`)
      continue
    }
    if (ONLY && meta.subject !== ONLY) continue
    const answers = answerTable[meta.subject]
    if (!answers) {
      console.warn(`· 정답표에 ${meta.subject} 없음, 건너뜀: ${pf}`)
      continue
    }

    const pages = await extractPdfPages(path.join(RAW_DIR, pf))
    const items = await extractQuestionsFromDoc(pages, answers.length)
    const merged = mergeAnswerKey(items, answers)
    console.log(`[${meta.subject}] 추출 ${items.length} → 정답병합 ${merged.length} (기대 ${answers.length})`)
    if (merged.length < answers.length) {
      const got = new Set(merged.map((m) => m.number))
      const miss = Array.from({ length: answers.length }, (_, i) => i + 1).filter((n) => !got.has(n))
      console.warn(`  ⚠ 누락 번호: ${miss.join(', ')} — 재실행으로 보완 가능`)
    }

    for (const q of merged) {
      const key = `${meta.year}-${EXAM_TYPE}-${meta.subject}-${q.number}`
      await QuestionModel.findOneAndUpdate(
        { key },
        {
          key,
          subject: meta.subject,
          year: meta.year,
          examType: EXAM_TYPE,
          number: q.number,
          questionText: q.questionText,
          choices: q.choices,
          answerIndex: q.answerIndex,
          source: '기출',
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      total++
    }
  }
  console.log(`\n적재 완료: ${total}문항 (멱등 upsert). 다음: npm run tag 로 태깅.`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('적재 실패:', e)
  process.exit(1)
})
