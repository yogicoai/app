import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { DailySetModel } from '../models/DailySet'
import { QuestionModel } from '../models/Question'
import { TermModel } from '../models/Term'
import { todayKST } from '../lib/date'

const contentRoutes: FastifyPluginAsync = async (app) => {
  // 오늘의 세트 (없으면 가장 최근 세트로 폴백)
  app.get('/today', async () => {
    const date = todayKST()
    let set = await DailySetModel.findOne({ date }).populate('questionIds')
    if (!set) set = await DailySetModel.findOne().sort({ date: -1 }).populate('questionIds')
    return { date: set?.date ?? date, theme: set?.theme ?? null, questions: set?.questionIds ?? [] }
  })

  // 문제 목록 (과목 필터)
  app.get('/questions', async (req) => {
    const q = z
      .object({
        subject: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query)
    const filter = q.subject ? { subject: q.subject } : {}
    const items = await QuestionModel.find(filter).limit(q.limit)
    return { items }
  })

  // 기출 시험 목록 (년도 + 시험유형 + 과목별 집계)
  app.get('/exams', async () => {
    const exams = await QuestionModel.aggregate([
      { $match: { year: { $ne: null } } },
      {
        $group: {
          _id: { year: '$year', examType: '$examType', subject: '$subject' },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, year: '$_id.year', examType: '$_id.examType', subject: '$_id.subject', count: 1 } },
      { $sort: { year: -1, examType: 1, subject: 1 } },
    ])
    return { exams }
  })

  // 특정 기출의 문제 목록 (과목 필터 선택)
  app.get('/exam', async (req) => {
    const q = z
      .object({ year: z.coerce.number().int(), examType: z.string().min(1), subject: z.string().optional() })
      .parse(req.query)
    const filter: Record<string, unknown> = { year: q.year, examType: q.examType }
    if (q.subject) filter.subject = q.subject
    const questions = await QuestionModel.find(filter).sort({ subject: 1, number: 1 })
    return { year: q.year, examType: q.examType, subject: q.subject ?? null, questions }
  })

  // 용어 사전 (과목 필터 선택). 과목 → 단원 → 용어 순으로 정렬해 반환.
  app.get('/terms', async (req) => {
    const q = z.object({ subject: z.string().optional() }).parse(req.query)
    const filter = q.subject ? { subject: q.subject } : {}
    const terms = await TermModel.find(filter).sort({ subject: 1, unit: 1, term: 1 })
    const subjects = await TermModel.distinct('subject')
    return { subjects: (subjects as string[]).sort(), terms }
  })
}

export default contentRoutes
