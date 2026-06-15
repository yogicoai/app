import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { DailySetModel } from '../models/DailySet'
import { QuestionModel } from '../models/Question'
import { TermModel } from '../models/Term'
import { todayKST } from '../lib/date'
import { classifyChapter } from '../lib/termChapter'

const contentRoutes: FastifyPluginAsync = async (app) => {
  // 오늘의 세트 (없으면 가장 최근 세트로 폴백)
  app.get('/today', async () => {
    const date = todayKST()
    let set = await DailySetModel.findOne({ date }).populate('questionIds')
    if (!set) set = await DailySetModel.findOne().sort({ date: -1 }).populate('questionIds')
    return { date: set?.date ?? date, theme: set?.theme ?? null, questions: set?.questionIds ?? [] }
  })

  // 오늘의 기출 — 과목별 5문제(요일 기반 회전). subject 주면 그 과목 5문제, 없으면 과목별 개수 요약.
  app.get('/daily', async (req) => {
    const q = z.object({ subject: z.string().optional() }).parse(req.query)
    const SUBJECTS = ['국어', '영어', '한국사', '행정법총론', '행정학개론']
    const PER = 5
    const date = todayKST()
    const dayNum = Math.floor(Date.parse(date) / 86400000)

    const pick = async (subject: string) => {
      const pool = await QuestionModel.find({ subject, source: '기출' }).sort({ year: -1, number: 1 })
      if (pool.length === 0) return []
      const start = (dayNum * PER) % pool.length
      const out = []
      for (let i = 0; i < Math.min(PER, pool.length); i++) out.push(pool[(start + i) % pool.length])
      return out
    }

    if (q.subject) {
      return { date, subject: q.subject, questions: await pick(q.subject) }
    }
    const subjects = []
    for (const s of SUBJECTS) {
      const c = await QuestionModel.countDocuments({ subject: s, source: '기출' })
      if (c > 0) subjects.push({ subject: s, count: Math.min(PER, c) })
    }
    return { date, subjects }
  })

  // 콜드스타트 진단 세트 — 5과목에서 무작위로 골고루(과목당 2문제). 비용 0(DB 샘플).
  app.get('/diagnostic', async () => {
    const SUBJECTS = ['국어', '영어', '한국사', '행정법총론', '행정학개론']
    const PER = 2
    const questions: unknown[] = []
    for (const s of SUBJECTS) {
      const qs = await QuestionModel.aggregate([
        { $match: { subject: s, source: '기출' } },
        { $sample: { size: PER } },
      ])
      questions.push(...qs)
    }
    return { questions }
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

  // 용어 사전 (과목 필터 선택). 단원(AI)→대단원으로 묶고, 과목→대단원순→단원→용어로 정렬해 반환.
  app.get('/terms', async (req) => {
    const q = z.object({ subject: z.string().optional() }).parse(req.query)
    const filter = q.subject ? { subject: q.subject } : {}
    const raw = await TermModel.find(filter).lean()
    const terms = raw
      .map((t) => {
        const info = classifyChapter(t.subject, t.unit ?? undefined)
        let chapter = info?.chapter
        let order = info?.order ?? 999
        if (t.subject === '영어') {
          if (t.chapter) {
            // 단어장(빈출도 등급 저장형) — 등급 순서로
            chapter = t.chapter
            order = t.chapter.includes('최빈출') ? 0 : t.chapter.includes('빈출') ? 1 : 2
          } else {
            chapter = undefined // 기출 추출 단어집 → 앱에서 '단어집'(맨 뒤)
            order = 9
          }
        }
        return { ...t, chapter, _order: order }
      })
      .sort((a, b) => {
        if (a.subject !== b.subject) return a.subject < b.subject ? -1 : 1
        if (a._order !== b._order) return a._order - b._order
        if ((a.unit ?? '') !== (b.unit ?? '')) return (a.unit ?? '') < (b.unit ?? '') ? -1 : 1
        return a.term < b.term ? -1 : 1
      })
      .map(({ _order, ...t }) => t) // 정렬용 필드 제거
    const subjects = await TermModel.distinct('subject')
    return { subjects: (subjects as string[]).sort(), terms }
  })

  // Day 코스: 오늘의 단어(영어 단어장) / 오늘의 용어(개념). day 번호로 분량만큼 슬라이스해 반환.
  app.get('/cards', async (req) => {
    const q = z.object({ track: z.enum(['word', 'term']), day: z.coerce.number().int().min(1).default(1) }).parse(req.query)
    const SIZE = q.track === 'word' ? 20 : 15
    let ordered: { _id: unknown; subject: string; unit?: string; term: string; definition: string; example?: string }[]
    if (q.track === 'word') {
      // 영어 단어장 — 빈출도(★★★→★) 순, 같은 등급은 알파벳
      const tierOrder = (c?: string) => (c?.includes('최빈출') ? 0 : c?.includes('빈출') ? 1 : 2)
      const raw = await TermModel.find({ source: '단어장', subject: '영어' }).lean()
      ordered = raw.sort((a, b) => tierOrder(a.chapter ?? undefined) - tierOrder(b.chapter ?? undefined) || (a.term < b.term ? -1 : 1)) as never
    } else {
      // 개념 용어(영어 제외) — 과목→대단원순→단원→용어
      const SUBJ = ['국어', '한국사', '행정법총론', '행정학개론']
      const raw = await TermModel.find({ source: 'ai', subject: { $in: SUBJ } }).lean()
      ordered = raw
        .map((t) => ({ t, order: classifyChapter(t.subject, t.unit ?? undefined)?.order ?? 999 }))
        .sort((a, b) => {
          if (a.t.subject !== b.t.subject) return SUBJ.indexOf(a.t.subject) - SUBJ.indexOf(b.t.subject)
          if (a.order !== b.order) return a.order - b.order
          if ((a.t.unit ?? '') !== (b.t.unit ?? '')) return (a.t.unit ?? '') < (b.t.unit ?? '') ? -1 : 1
          return a.t.term < b.t.term ? -1 : 1
        })
        .map((x) => x.t) as never
    }
    const total = ordered.length
    const totalDays = Math.max(1, Math.ceil(total / SIZE))
    const start = (q.day - 1) * SIZE
    const items = ordered.slice(start, start + SIZE)
    return { track: q.track, day: q.day, size: SIZE, total, totalDays, items }
  })
}

export default contentRoutes
