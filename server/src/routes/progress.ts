import type { FastifyPluginAsync } from 'fastify'
import mongoose from 'mongoose'
import { z } from 'zod'
import { ProgressModel } from '../models/Progress'
import { QuestionModel } from '../models/Question'
import { RecommendationModel } from '../models/Recommendation'
import { scheduleNext } from '../lib/srs'
import { rankWeakUnits, topWeakUnits, type UnitStat } from '../lib/weakness'
import { todayKST } from '../lib/date'
import { chatJson } from '../lib/ai/openai'
import { DIAGNOSE_SYSTEM, buildDiagnosePrompt, parseDiagnoseResponse, fallbackDiagnosis, type DiagnoseInput } from '../lib/ai/diagnose'

// 유저의 단원별 풀이 집계(약점 진단 입력). AI 호출 없음 — 순수 DB 집계(비용 0).
async function aggregateUnitStats(userId: mongoose.Types.ObjectId): Promise<UnitStat[]> {
  return ProgressModel.aggregate<UnitStat>([
    { $match: { userId } },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'q' } },
    { $unwind: '$q' },
    { $match: { 'q.unit': { $nin: [null, ''] } } },
    {
      $group: {
        _id: { subject: '$q.subject', unit: '$q.unit' },
        attempted: { $sum: 1 },
        correct: { $sum: { $cond: [{ $eq: ['$status', 'correct'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, subject: '$_id.subject', unit: '$_id.unit', attempted: 1, correct: 1 } },
  ])
}

// 유저의 과목별 풀이 집계.
async function aggregateSubjectStats(
  userId: mongoose.Types.ObjectId,
): Promise<{ subject: string; attempted: number; correct: number }[]> {
  return ProgressModel.aggregate([
    { $match: { userId } },
    { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'q' } },
    { $unwind: '$q' },
    {
      $group: {
        _id: '$q.subject',
        attempted: { $sum: 1 },
        correct: { $sum: { $cond: [{ $eq: ['$status', 'correct'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, subject: '$_id', attempted: 1, correct: 1 } },
  ])
}

const progressRoutes: FastifyPluginAsync = async (app) => {
  // 문제 풀이 결과 기록 + SRS 재스케줄
  app.post('/attempt', { preHandler: [app.authenticate] }, async (req) => {
    const body = z
      .object({ questionId: z.string(), correct: z.boolean(), timeSpentMs: z.number().int().nonnegative().optional() })
      .parse(req.body)
    const userId = req.user.sub
    const now = new Date()

    const existing = await ProgressModel.findOne({ userId, questionId: body.questionId })
    const prev = existing
      ? { reps: existing.reps, interval: existing.interval, ease: existing.ease }
      : { reps: 0, interval: 0, ease: 2.5 }
    const next = scheduleNext(prev, body.correct, now)

    // 소요시간: 마지막 값 기록 + 누적 평균(이전 attempts 기반 이동평균)
    const t = body.timeSpentMs ?? 0
    const n = existing?.attempts ?? 0
    const prevAvg = existing?.avgTimeMs ?? 0
    const avgTimeMs = t > 0 ? (n > 0 ? Math.round((prevAvg * n + t) / (n + 1)) : t) : prevAvg

    const progress = await ProgressModel.findOneAndUpdate(
      { userId, questionId: body.questionId },
      {
        status: body.correct ? 'correct' : 'wrong',
        reps: next.reps,
        interval: next.interval,
        ease: next.ease,
        nextReviewAt: next.nextReviewAt,
        lastAttemptedAt: now,
        timeSpentMs: t,
        avgTimeMs,
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    return { progress }
  })

  // 오답노트: 현재 '틀림' 상태인 문제 + 해설
  app.get('/wrong', { preHandler: [app.authenticate] }, async (req) => {
    const items = await ProgressModel.find({ userId: req.user.sub, status: 'wrong' })
      .sort({ lastAttemptedAt: -1 })
      .populate('questionId')
      .limit(200)
    const out = items
      .filter((p) => p.questionId)
      .map((p) => ({
        question: p.questionId,
        attempts: p.attempts,
        lastAttemptedAt: p.lastAttemptedAt,
      }))
    return { count: out.length, items: out }
  })

  // 복습 예정(due) 문제 목록
  app.get('/due', { preHandler: [app.authenticate] }, async (req) => {
    const items = await ProgressModel.find({
      userId: req.user.sub,
      nextReviewAt: { $lte: new Date() },
    })
      .populate('questionId')
      .limit(50)
    return { items }
  })

  // 진도율 요약 (전체 + 과목별 정답률)
  app.get('/summary', { preHandler: [app.authenticate] }, async (req) => {
    const userId = new mongoose.Types.ObjectId(req.user.sub)
    const bySubject = await ProgressModel.aggregate([
      { $match: { userId } },
      { $lookup: { from: 'questions', localField: 'questionId', foreignField: '_id', as: 'q' } },
      { $unwind: '$q' },
      {
        $group: {
          _id: '$q.subject',
          attempted: { $sum: 1 },
          correct: { $sum: { $cond: [{ $eq: ['$status', 'correct'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, subject: '$_id', attempted: 1, correct: 1 } },
      { $sort: { subject: 1 } },
    ])

    const totalQuestions = await QuestionModel.estimatedDocumentCount()
    const attempted = bySubject.reduce((a, s) => a + s.attempted, 0)
    const correct = bySubject.reduce((a, s) => a + s.correct, 0)

    return {
      overall: {
        totalQuestions,
        attempted,
        correct,
        accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
        progressRate: totalQuestions ? Math.round((attempted / totalQuestions) * 100) : 0,
      },
      bySubject,
    }
  })

  // 약점 진단: 단원별 정답률 집계 → 약점 점수 랭킹(AI 비용 0, 순수 DB 집계).
  app.get('/weakness', { preHandler: [app.authenticate] }, async (req) => {
    const userId = new mongoose.Types.ObjectId(req.user.sub)
    const stats = await aggregateUnitStats(userId)
    const weakUnits = topWeakUnits(stats, 8) // 약점 정의(score>0)는 lib/weakness.ts 단일 출처
    const weakKeys = new Set(weakUnits.map((u) => `${u.subject}:${u.unit}`))
    // 강점은 약점과 상호배타: 약점에 든 단원은 제외하고 정답률 높은 순.
    const strongUnits = rankWeakUnits(stats)
      .filter((u) => u.accuracy >= 0.8 && !weakKeys.has(`${u.subject}:${u.unit}`))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5)
    return { attemptedUnits: stats.length, weakUnits, strongUnits }
  })

  // 약점 재출제: 약점 상위 단원에서 틀린 문제 우선 → 부족하면 미시도 문제로 무작위 보충.
  app.get('/review', { preHandler: [app.authenticate] }, async (req) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(30).default(10) }).parse(req.query)
    const userId = new mongoose.Types.ObjectId(req.user.sub)

    const stats = await aggregateUnitStats(userId)
    const weak = topWeakUnits(stats, 5)
    if (weak.length === 0) return { units: [], weakUnits: [], questions: [], reason: 'no-weakness' }
    // 약점은 (과목,단원) 쌍으로 식별 — 같은 단원명이 다른 과목에 있어도 섞이지 않게 AND 매칭.
    const weakOr = weak.map((u) => ({ subject: u.subject, unit: u.unit }))
    const units = weak.map((u) => u.unit)

    // 1) 약점 단원에서 '틀림' 상태인 문제 우선(재연습 대상)
    const wrongIds = (await ProgressModel.find({ userId: req.user.sub, status: 'wrong' }).distinct(
      'questionId',
    )) as mongoose.Types.ObjectId[]
    const wrongInWeak = await QuestionModel.find({ $or: weakOr, _id: { $in: wrongIds } }).limit(q.limit).lean()

    let picks: unknown[] = wrongInWeak
    // 2) 부족하면 약점 단원의 '미시도' 문제로 보충(회차마다 다르도록 무작위 샘플)
    if (picks.length < q.limit) {
      const attemptedIds = (await ProgressModel.find({ userId: req.user.sub }).distinct(
        'questionId',
      )) as mongoose.Types.ObjectId[]
      const fresh = await QuestionModel.aggregate([
        { $match: { $or: weakOr, _id: { $nin: attemptedIds } } },
        { $sample: { size: q.limit - picks.length } },
      ])
      picks = [...picks, ...fresh]
    }

    return { units, weakUnits: weak, questions: picks }
  })

  // 콜드스타트 AI 진단(AI 3접점 중 ②). 1일 1회 캐싱(Recommendation), AI 실패/무키 시 DB 폴백.
  app.post('/diagnose', { preHandler: [app.authenticate] }, async (req) => {
    const userId = new mongoose.Types.ObjectId(req.user.sub)
    const date = todayKST()

    const unitStats = await aggregateUnitStats(userId)
    const weak = topWeakUnits(unitStats, 6)

    // 캐시: 오늘 진단이 이미 있으면 그대로 반환(AI 비용 0). 약점 단원은 매번 최신으로 함께 반환.
    const cached = await RecommendationModel.findOne({ userId, date })
    if (cached) {
      return {
        cached: true,
        diagnosis: { summary: cached.aiSummary ?? '', focusAreas: cached.focusAreas ?? [], encouragement: cached.encouragement ?? '' },
        weakUnits: weak,
      }
    }

    const subjectStats = await aggregateSubjectStats(userId)
    const input: DiagnoseInput = {
      subjectStats,
      weakUnits: weak.map((u) => ({ subject: u.subject, unit: u.unit, accuracy: u.accuracy })),
    }

    // 아직 푼 문제가 없으면 AI 호출 없이 진단 권유만(캐시도 남기지 않음 → 진단 후 재계산).
    const attemptedTotal = subjectStats.reduce((a, s) => a + s.attempted, 0)
    if (attemptedTotal === 0) {
      return { cached: false, diagnosis: fallbackDiagnosis(input), weakUnits: [] }
    }

    let diagnosis
    let aiOk = false
    try {
      const raw = await chatJson(DIAGNOSE_SYSTEM, buildDiagnosePrompt(input))
      const parsed = parseDiagnoseResponse(raw)
      if (parsed) {
        diagnosis = parsed
        aiOk = true
      } else {
        diagnosis = fallbackDiagnosis(input) // 빈/이상 응답 → 폴백(캐시하지 않음 → 다음에 재시도)
      }
    } catch {
      diagnosis = fallbackDiagnosis(input) // 무키/호출 실패 → 비용 0 폴백(캐시하지 않음)
    }

    // 약점 과목: 정답률 낮은 순 상위 2
    const weakSubjects = [...subjectStats]
      .sort((a, b) => (a.attempted ? a.correct / a.attempted : 0) - (b.attempted ? b.correct / b.attempted : 0))
      .slice(0, 2)
      .map((s) => s.subject)

    // AI 진단이 성공한 경우에만 1일 캐시(일시적 폴백이 당일 고정되지 않도록).
    // 동시요청 레이스로 unique(userId+date) 충돌 시 먼저 저장된 것을 인정($setOnInsert).
    if (aiOk) {
      try {
        await RecommendationModel.findOneAndUpdate(
          { userId, date },
          { $setOnInsert: { userId, date, weakSubjects, aiSummary: diagnosis.summary, focusAreas: diagnosis.focusAreas, encouragement: diagnosis.encouragement } },
          { upsert: true, setDefaultsOnInsert: true },
        )
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e // 중복키는 레이스 → 무시
      }
    }

    return { cached: false, diagnosis, weakUnits: weak }
  })
}

export default progressRoutes
