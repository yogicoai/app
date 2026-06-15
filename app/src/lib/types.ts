export interface Question {
  _id: string
  subject: string
  number?: number
  year?: number
  examType?: string // 국가직/지방직 (출처 표기용)
  passage?: string // 지문(있을 때만). 발문은 questionText.
  questionText: string
  choices: string[]
  answerIndex: number
  explanation?: string
}

export interface WrongItem {
  question: Question
  attempts: number
  lastAttemptedAt?: string
}

export interface WrongResponse {
  count: number
  items: WrongItem[]
}

export interface TodayResponse {
  date: string
  theme: string | null
  questions: Question[]
}

export interface DailySubjectsResponse {
  date: string
  subjects: { subject: string; count: number }[]
}

export interface SummaryResponse {
  overall: {
    totalQuestions: number
    attempted: number
    correct: number
    accuracy: number
    progressRate: number
  }
  bySubject: { subject: string; attempted: number; correct: number }[]
}

export interface ExamSummary {
  year: number
  examType: string
  subject: string
  count: number
}

export interface WeakUnit {
  subject: string
  unit: string
  attempted: number
  correct: number
  accuracy: number // 0~1
  score: number
}

export interface WeaknessResponse {
  attemptedUnits: number
  weakUnits: WeakUnit[]
  strongUnits: WeakUnit[]
}

export interface ReviewResponse {
  units: string[]
  weakUnits?: WeakUnit[]
  questions: Question[]
  reason?: string
}

export interface Diagnosis {
  summary: string
  focusAreas: string[]
  encouragement: string
}

export interface DiagnoseResponse {
  cached: boolean
  diagnosis: Diagnosis
  weakUnits?: WeakUnit[]
}

export interface Term {
  _id: string
  subject: string
  unit?: string
  chapter?: string // 대단원(서버에서 단원→대단원 분류). 영어는 없음(단어집)
  term: string
  definition: string
  example?: string
  years?: number[]
  examTypes?: string[]
  origins?: { year?: number; examType?: string; number?: number }[]
}

export interface TermsResponse {
  subjects: string[]
  terms: Term[]
}

export interface CardsResponse {
  track: 'word' | 'term'
  day: number
  size: number
  total: number
  totalDays: number
  items: Term[]
}
