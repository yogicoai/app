import type { FastifyPluginAsync } from 'fastify'
import mongoose from 'mongoose'
import { z } from 'zod'
import { ProgressModel } from '../models/Progress'
import { QuestionModel } from '../models/Question'
import { scheduleNext } from '../lib/srs'

const progressRoutes: FastifyPluginAsync = async (app) => {
  // 문제 풀이 결과 기록 + SRS 재스케줄
  app.post('/attempt', { preHandler: [app.authenticate] }, async (req) => {
    const body = z.object({ questionId: z.string(), correct: z.boolean() }).parse(req.body)
    const userId = req.user.sub
    const now = new Date()

    const existing = await ProgressModel.findOne({ userId, questionId: body.questionId })
    const prev = existing
      ? { reps: existing.reps, interval: existing.interval, ease: existing.ease }
      : { reps: 0, interval: 0, ease: 2.5 }
    const next = scheduleNext(prev, body.correct, now)

    const progress = await ProgressModel.findOneAndUpdate(
      { userId, questionId: body.questionId },
      {
        status: body.correct ? 'correct' : 'wrong',
        reps: next.reps,
        interval: next.interval,
        ease: next.ease,
        nextReviewAt: next.nextReviewAt,
        lastAttemptedAt: now,
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
}

export default progressRoutes
