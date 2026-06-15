import { Schema, model, InferSchemaType } from 'mongoose'

// 용어 사전. concept/unit 태그를 씨앗으로 AI가 정의를 생성, 약점 단원 재출제 자원.
const termSchema = new Schema(
  {
    subject: { type: String, required: true, index: true }, // 과목
    unit: { type: String, index: true }, // 단원
    chapter: { type: String }, // 대단원(단어장 등급 등 저장형). 없으면 라우트에서 단원→대단원 분류
    term: { type: String, required: true }, // 용어/개념
    definition: { type: String, required: true }, // 정의(2~3문장)
    example: { type: String }, // 기출 맥락 예시(선택)
    relatedConcepts: { type: [String], default: [] },
    years: { type: [Number], default: [] }, // 출처 연도(여러 시험에 나오면 누적)
    examTypes: { type: [String], default: [] }, // 출처 시험유형(국가직 등)
    // 어느 문제(지문)에서 발췌했는지
    origins: {
      type: [new Schema({ year: Number, examType: String, number: Number }, { _id: false })],
      default: [],
    },
    source: { type: String, enum: ['ai', 'manual', '단어장'], default: 'ai' },
    model: { type: String }, // 생성 모델
    key: { type: String, unique: true, sparse: true, index: true }, // 멱등: `${subject}:${term}`
  },
  { timestamps: true },
)

export type Term = InferSchemaType<typeof termSchema>
export const TermModel = model('Term', termSchema)
