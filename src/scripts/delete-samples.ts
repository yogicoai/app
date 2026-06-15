// 샘플/placeholder 삭제: 실제 2026 국가직 기출(20문항×5과목=100)만 남기고 나머지 모두 제거.
// 샘플은 examType 이 '국가직(샘플)'·'지방직(샘플)'·'curated' 등으로, source 로는 구분이 안 되므로
// "year=2026 AND examType='국가직' 이 아닌 것" 을 삭제 기준으로 한다.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'

const KEEP = { year: 2026, examType: '국가직' }
const DELETE_FILTER = { $or: [{ year: { $ne: 2026 } }, { examType: { $ne: '국가직' } }] }

async function main() {
  await connectDb()
  console.log('=== 현재 분포 (year · examType · source · 수) ===')
  const dist = await QuestionModel.aggregate([
    { $group: { _id: { year: '$year', examType: '$examType', source: '$source' }, count: { $sum: 1 } } },
    { $sort: { '_id.year': -1 } },
  ])
  for (const d of dist) console.log(`${d._id.year ?? 'null'} · ${d._id.examType ?? 'null'} · ${d._id.source ?? 'null'} → ${d.count}`)

  const toDelete = await QuestionModel.countDocuments(DELETE_FILTER)
  const toKeep = await QuestionModel.countDocuments(KEEP)
  console.log(`\n삭제 대상(샘플): ${toDelete} · 유지(2026 국가직): ${toKeep}`)

  const res = await QuestionModel.deleteMany(DELETE_FILTER)
  console.log(`삭제 완료: ${res.deletedCount}건 제거`)
  console.log(`남은 questions 총: ${await QuestionModel.estimatedDocumentCount()}건`)
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
