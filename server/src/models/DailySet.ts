import { Schema, model, InferSchemaType } from 'mongoose'

// 하루 1회 생성되어 전 유저가 공유하는 '오늘의 세트'
const dailySetSchema = new Schema(
  {
    date: { type: String, required: true, unique: true }, // 'YYYY-MM-DD' (KST)
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    theme: { type: String },
  },
  { timestamps: true },
)

export type DailySet = InferSchemaType<typeof dailySetSchema>
export const DailySetModel = model('DailySet', dailySetSchema)
