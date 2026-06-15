// DB 의 미태깅 문제를 OpenAI 로 태깅(unit/concept/difficulty)하고 저장한다.
// 멱등: tagSource==='manual' 또는 unit 이 이미 있는 문제는 건너뛴다.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { chatJson } from '../lib/ai/openai'
import {
  TAG_SYSTEM_PROMPT,
  buildTagUserPrompt,
  parseTagResponse,
  needsTagging,
} from '../lib/ai/tagger'

const LIMIT = Number(process.env.TAG_LIMIT ?? '0') // 0 = 전체

async function main() {
  await connectDb()

  const query = QuestionModel.find({
    tagSource: { $ne: 'manual' },
    $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }],
  }).sort({ _id: 1 })
  if (LIMIT > 0) query.limit(LIMIT)
  const candidates = await query

  console.log(`미태깅 후보 ${candidates.length}건`)
  let tagged = 0
  let failed = 0

  for (const q of candidates) {
    if (!needsTagging({ unit: q.unit, tagSource: q.tagSource })) continue
    try {
      const raw = await chatJson(
        TAG_SYSTEM_PROMPT,
        buildTagUserPrompt({ subject: q.subject, questionText: q.questionText, choices: q.choices }),
      )
      const parsed = parseTagResponse(raw)
      if (!parsed) {
        failed++
        console.warn(`✗ 파싱 실패 (${q.subject} ${q._id})`)
        continue
      }
      q.unit = parsed.unit
      q.concept = parsed.concept
      q.difficulty = parsed.difficulty
      q.tagSource = 'ai'
      await q.save()
      tagged++
      console.log(`✓ ${q.subject} → ${parsed.unit} / ${parsed.concept} (난이도 ${parsed.difficulty})`)
    } catch (e) {
      failed++
      console.warn(`✗ 호출 실패 (${q.subject} ${q._id}):`, (e as Error).message)
    }
  }

  console.log(`\n태깅 완료: 성공 ${tagged} · 실패 ${failed}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('태깅 실패:', e)
  process.exit(1)
})
