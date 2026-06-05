// '오늘의 기출' = 하루 한 과목 5문제(요일별 과목 로테이션). 설계의 '매일 5문제 드립'.
// 날짜 기반 회전으로 매일 과목·문항이 바뀐다. 실기출(source:'기출') 우선, 없으면 전체에서.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { DailySetModel } from '../models/DailySet'
import { todayKST } from '../lib/date'

const SUBJECTS = ['국어', '영어', '한국사', '행정법총론', '행정학개론']
const PER_DAY = 5

async function main() {
  await connectDb()
  const date = todayKST()
  const dayNum = Math.floor(Date.parse(date) / 86400000)

  // 요일별 과목 로테이션
  const subject = SUBJECTS[dayNum % SUBJECTS.length]!

  // 해당 과목 문제 풀(기출 우선)
  let pool = await QuestionModel.find({ subject, source: '기출' }).sort({ year: -1, number: 1 }).select('_id')
  if (pool.length === 0) pool = await QuestionModel.find({ subject }).sort({ _id: 1 }).select('_id')

  const picked: mongoose.Types.ObjectId[] = []
  if (pool.length > 0) {
    // 같은 과목이 다시 도는 회차마다 다른 5문제 노출
    const cycle = Math.floor(dayNum / SUBJECTS.length)
    const start = (cycle * PER_DAY) % pool.length
    for (let i = 0; i < Math.min(PER_DAY, pool.length); i++) {
      const doc = pool[(start + i) % pool.length]
      if (doc) picked.push(doc._id)
    }
  }

  const theme = `오늘의 기출 — ${subject} ${picked.length}선`
  await DailySetModel.findOneAndUpdate({ date }, { date, theme, questionIds: picked }, { upsert: true })
  console.log(`오늘의 세트(${date}) 구성: ${subject} ${picked.length}문제`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('세트 구성 실패:', e)
  process.exit(1)
})
