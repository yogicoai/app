// content/raw/ 의 (문제 PDF, 정답표 PDF) → AI 추출·정답병합 → 멱등 적재.
// 여러 연도·시험(국가직/지방직)이 섞여 있어도 파일명에서 연도·시험종류를 읽어 각 시험의 정답표와 정확히 병합한다.
// 정답표 파일명: {연도}_{시험}_정답.pdf (전 과목 통합표). 문제: {연도}_{시험}_{과목}_문제.pdf
// 멱등: key='연도-시험-과목-번호'. 옵션: SUBJECT · YEARS(예 2021,2022) · EXAM(국가직/지방직) · PDF_DIR
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { extractPdfPages } from '../lib/pdf/extract'
import { extractQuestionsFromDoc } from '../lib/pdf/aiExtract'
import { parseAnswerTable, mergeAnswerKey, parseFileMeta } from '../lib/pdf/parse'

const RAW_DIR = process.env.PDF_DIR ?? 'content/raw'
const ONLY_SUBJECT = process.env.SUBJECT
const ONLY_EXAM = process.env.EXAM
const ONLY_YEARS = (process.env.YEARS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => n > 0)
const SUBJECTS = ['국어', '영어', '한국사', '행정법총론', '행정학개론']

// {연도}|{시험} → { 과목: [정답 20개] }
async function buildAnswerTables(files: string[]): Promise<Map<string, Record<string, number[]>>> {
  const tables = new Map<string, Record<string, number[]>>()
  for (const f of files) {
    const meta = parseFileMeta(f, SUBJECTS)
    if (meta.kind !== '정답' || !meta.examType || !meta.year) continue
    const table = parseAnswerTable((await extractPdfPages(path.join(RAW_DIR, f))).join(' '))
    tables.set(`${meta.year}|${meta.examType}`, table)
  }
  return tables
}

async function main() {
  await connectDb()
  const files = (await readdir(RAW_DIR)).filter((f) => /\.pdf$/i.test(f))
  const tables = await buildAnswerTables(files)
  console.log(`정답표: ${[...tables.keys()].join(', ') || '없음'}`)

  const problems = files.filter((f) => parseFileMeta(f, SUBJECTS).kind === '문제')
  let total = 0
  for (const pf of problems) {
    const meta = parseFileMeta(pf, SUBJECTS)
    if (!meta.subject || !meta.examType || !meta.year) {
      console.warn(`· 메타 불명, 건너뜀: ${pf} (subject=${meta.subject} exam=${meta.examType} year=${meta.year})`)
      continue
    }
    if (ONLY_SUBJECT && meta.subject !== ONLY_SUBJECT) continue
    if (ONLY_EXAM && meta.examType !== ONLY_EXAM) continue
    if (ONLY_YEARS.length && !ONLY_YEARS.includes(meta.year)) continue

    // 정답표 과목명이 부연(예: "행정학개론 (지방행정 포함)" → pdfjs가 괄호 제거 시 "행정학개론 지방행정 포함")로
    // 정확매칭 실패할 수 있어, 없으면 접두어로 매칭한다.
    const table = tables.get(`${meta.year}|${meta.examType}`)
    const answers = table?.[meta.subject] ?? (table ? table[Object.keys(table).find((k) => k.startsWith(meta.subject!)) ?? ''] : undefined)
    if (!answers) {
      console.warn(`· 정답표 없음(${meta.year} ${meta.examType} ${meta.subject}), 건너뜀: ${pf}`)
      continue
    }

    const pages = await extractPdfPages(path.join(RAW_DIR, pf))
    const items = await extractQuestionsFromDoc(pages, answers.length)
    const merged = mergeAnswerKey(items, answers)
    console.log(`[${meta.year} ${meta.examType} ${meta.subject}] 추출 ${items.length} → 정답병합 ${merged.length} (기대 ${answers.length})`)
    if (merged.length < answers.length) {
      const got = new Set(merged.map((m) => m.number))
      const miss = Array.from({ length: answers.length }, (_, i) => i + 1).filter((n) => !got.has(n))
      console.warn(`  ⚠ 누락: ${miss.join(', ')}`)
    }

    for (const q of merged) {
      const key = `${meta.year}-${meta.examType}-${meta.subject}-${q.number}`
      await QuestionModel.findOneAndUpdate(
        { key },
        {
          key,
          subject: meta.subject,
          year: meta.year,
          examType: meta.examType,
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
  console.log(`\n적재 완료: ${total}문항. 다음: npm run tag, npm run terms, npm run explain.`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('적재 실패:', e)
  process.exit(1)
})
