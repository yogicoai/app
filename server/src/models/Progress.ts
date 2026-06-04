import { Schema, model, InferSchemaType } from 'mongoose'

// 유저별 문제 풀이 기록 + SRS(간격반복) 스케줄
const progressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    status: { type: String, enum: ['correct', 'wrong', 'skip'], required: true },
    // SRS (SM-2 lite)
    reps: { type: Number, default: 0 },
    interval: { type: Number, default: 0 }, // 다음 복습까지 일수
    ease: { type: Number, default: 2.5 },
    nextReviewAt: { type: Date },
    lastAttemptedAt: { type: Date },
    attempts: { type: Number, default: 0 }, // 누적 시도 횟수
  },
  { timestamps: true },
)

progressSchema.index({ userId: 1, questionId: 1 }, { unique: true })

export type Progress = InferSchemaType<typeof progressSchema>
export const ProgressModel = model('Progress', progressSchema)
