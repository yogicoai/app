// 마이그레이션: questionText("지문\n\n발문")를 passage(지문)+questionText(발문)로 분리하고
// 구조적 줄바꿈(structurePassage)을 보강한다. 재추출 없이 가독성만 개선(내용 보존).
// 멱등: structurePassage 는 재적용해도 동일. 분리(\n\n)는 1회만 일어난 뒤 사라진다. source:'기출' 대상.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { structurePassage } from '../lib/pdf/parse'

async function main() {
  await connectDb()
  const qs = await QuestionModel.find({ source: '기출' })
  let split = 0
  let changed = 0
  for (const q of qs) {
    const doc = q as unknown as { passage?: string | null; questionText: string }
    let body = doc.questionText
    let passage: string | null = doc.passage ?? null
    const i = body.indexOf('\n\n')
    if (i >= 0) {
      passage = structurePassage(body.slice(0, i))
      body = body.slice(i + 2)
      split++
    }
    const questionText = structurePassage(body)
    if (questionText !== doc.questionText || passage !== (doc.passage ?? null)) {
      await QuestionModel.updateOne({ _id: q._id }, { $set: { passage, questionText } })
      changed++
    }
  }
  console.log(`마이그레이션: 지문분리 ${split}건 · 변경 ${changed}건 (총 ${qs.length})`)
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
