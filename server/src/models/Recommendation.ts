import { Schema, model, InferSchemaType } from 'mongoose'

// 유저별 AI 추천 결과 (1일 1회 캐싱)
const recommendationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    weakSubjects: { type: [String], default: [] }, // 약점 과목
    recommendedQuestionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    aiSummary: { type: String }, // GPT 코멘트
  },
  { timestamps: true },
)

recommendationSchema.index({ userId: 1, date: 1 }, { unique: true })

export type Recommendation = InferSchemaType<typeof recommendationSchema>
export const RecommendationModel = model('Recommendation', recommendationSchema)
