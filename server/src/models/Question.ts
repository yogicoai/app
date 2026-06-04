import { Schema, model, InferSchemaType } from 'mongoose'

const questionSchema = new Schema(
  {
    subject: { type: String, required: true, index: true }, // 과목: 국어/영어/한국사/행정법/행정학
    year: { type: Number },
    round: { type: String }, // 회차
    source: { type: String, default: '기출' }, // 기출 | AI | seed
    questionText: { type: String, required: true },
    choices: { type: [String], required: true }, // 보기
    answerIndex: { type: Number, required: true }, // 정답 (0-based)
    explanation: { type: String }, // 해설
    tags: { type: [String], default: [] },
    difficulty: { type: Number, default: 3, min: 1, max: 5 },
    examType: { type: String }, // 국가직 | 지방직 | 서울시 | curated
    number: { type: Number }, // 문항 번호
    key: { type: String, unique: true, sparse: true, index: true }, // 멱등 import 키
  },
  { timestamps: true },
)

export type Question = InferSchemaType<typeof questionSchema>
export const QuestionModel = model('Question', questionSchema)
