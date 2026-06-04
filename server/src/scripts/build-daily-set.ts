// 문제 뱅크에서 '오늘의 세트'를 구성한다. 날짜 기반 회전으로 매일 다른 문제 노출.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { DailySetModel } from '../models/DailySet'
import { todayKST } from '../lib/date'

const SUBJECTS = ['국어', '영어', '한국사', '행정법', '행정학']
const PER_SUBJECT = 2

async function main() {
  await connectDb()
  const date = todayKST()
  const dayNum = Math.floor(Date.parse(date) / 86400000)

  const picked: mongoose.Types.ObjectId[] = []
  for (const subject of SUBJECTS) {
    const all = await QuestionModel.find({ subject }).sort({ _id: 1 }).select('_id')
    if (all.length === 0) continue
    const start = (dayNum * PER_SUBJECT) % all.length
    for (let i = 0; i < Math.min(PER_SUBJECT, all.length); i++) {
      const doc = all[(start + i) % all.length]
      if (doc) picked.push(doc._id)
    }
  }

  // 과목 매칭이 안 되면(데이터가 다른 과목명일 때) 아무 문제로 채움
  if (picked.length === 0) {
    const fallback = await QuestionModel.find().limit(10).select('_id')
    for (const f of fallback) picked.push(f._id)
  }

  await DailySetModel.findOneAndUpdate(
    { date },
    { date, theme: `오늘의 기출 ${picked.length}선`, questionIds: picked },
    { upsert: true },
  )
  console.log(`오늘의 세트(${date}) 구성: ${picked.length}문제`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('세트 구성 실패:', e)
  process.exit(1)
})
