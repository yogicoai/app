export interface Question {
  _id: string
  subject: string
  questionText: string
  choices: string[]
  answerIndex: number
  explanation?: string
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
  count: number
  subjects: string[]
}
