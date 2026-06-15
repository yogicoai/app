// content/*.json 의 문제를 검증(Zod) → 멱등 upsert(key 기준) 로 questions 에 적재.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { z } from 'zod'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'

const CONTENT_DIR = path.resolve(process.cwd(), 'content')

const qSchema = z
  .object({
    subject: z.string().min(1),
    questionText: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2),
    answerIndex: z.number().int().min(0),
    explanation: z.string().optional(),
    tags: z.array(z.string()).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    number: z.number().int().optional(),
  })
  .refine((q) => q.answerIndex < q.choices.length, {
    message: 'answerIndex 가 choices 범위를 벗어났습니다.',
  })

const fileSchema = z.object({
  meta: z
    .object({
      source: z.string().optional(),
      examType: z.string().optional(),
      year: z.number().int().optional(),
      grade: z.string().optional(),
      track: z.string().optional(),
    })
    .default({}),
  questions: z.array(qSchema).min(1),
})

const hash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)

async function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`content 폴더가 없습니다: ${CONTENT_DIR}`)
    process.exit(1)
  }
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'))
  if (files.length === 0) {
    // 실기출은 import-pdf 로 적재하므로 content/*.json 이 없어도 정상(setup 이 깨지지 않게).
    console.log('content/*.json 없음 — JSON 적재 건너뜀(실기출은 npm run import:pdf 사용).')
    return
  }

  await connectDb()

  // 레거시 샘플(source:'seed') 제거 → curated/기출 데이터로 일원화
  const legacy = await QuestionModel.deleteMany({ source: 'seed' })
  if (legacy.deletedCount) console.log(`레거시 seed 문제 ${legacy.deletedCount}건 제거`)

  const ops: Parameters<typeof QuestionModel.bulkWrite>[0] = []
  let total = 0

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'))
    const parsed = fileSchema.safeParse(raw)
    if (!parsed.success) {
      console.error(`✗ ${file} 형식 오류:`, JSON.stringify(parsed.error.issues[0]))
      continue
    }
    const { meta, questions } = parsed.data
    const examType = meta.examType ?? 'curated'
    const source = meta.source ?? (examType === 'curated' ? 'curated' : '기출')
    const round = meta.year ? `${meta.year} ${examType} ${meta.grade ?? '9급'}`.trim() : examType

    for (const q of questions) {
      const key =
        examType !== 'curated' && meta.year && q.number
          ? `${examType}:${meta.year}:${q.subject}:${q.number}`
          : `${source}:${q.subject}:${hash(q.questionText)}`
      ops.push({
        updateOne: {
          filter: { key },
          update: {
            $set: {
              subject: q.subject,
              questionText: q.questionText,
              choices: q.choices,
              answerIndex: q.answerIndex,
              explanation: q.explanation,
              tags: q.tags ?? [],
              difficulty: q.difficulty ?? 3,
              year: meta.year,
              examType,
              number: q.number,
              source,
              round,
              key,
            },
          },
          upsert: true,
        },
      })
      total++
    }
    console.log(`✓ ${file}: ${questions.length}문제`)
  }

  if (ops.length) {
    const res = await QuestionModel.bulkWrite(ops, { ordered: false })
    console.log(`\nimport 완료: 신규 ${res.upsertedCount} · 갱신 ${res.modifiedCount} · 총 처리 ${total}`)
  }
  console.log(`questions 컬렉션 총 ${await QuestionModel.estimatedDocumentCount()}건`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('import 실패:', e)
  process.exit(1)
})
