export interface Question {
  _id: string
  subject: string
  number?: number
  year?: number
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

export interface Term {
  _id: string
  subject: string
  unit?: string
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
