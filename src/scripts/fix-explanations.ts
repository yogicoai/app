// 감사가 도출한 정정 사실(correction)을 주입해 해당 문항 해설을 재생성한다(자기일관성+사실 강제).
// 입력: CORR_FILE(기본 .audit/corrections.json) = [{idx, correction}], .audit/explanations.json(덤프, idx 기준).
// 덤프 항목의 year/examType/subject/number 로 Question.key 를 만들어 타겟 갱신.
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { chatJson } from '../lib/ai/openai'

const MODEL = process.env.EXPLAIN_MODEL ?? 'gpt-4o'
const CORR_FILE = process.env.CORR_FILE ?? '.audit/corrections.json'
const DUMP_FILE = process.env.DUMP_FILE ?? '.audit/explanations.json'

const SYSTEM =
  '너는 9급 공무원 시험 해설 강사다. 문제·정답·[검증된 사실]을 보고 해설을 다시 쓴다.\n' +
  '[중요] 제시된 [검증된 사실]을 반드시 그대로 반영하고, [근거]·[보기 해설]·정답이 서로 모순되지 않게 일관되게 작성하라. 사실에 확신이 없으면 단정하지 마라.\n' +
  '형식: "정답 ③\\n\\n[근거] …\\n\\n[보기 해설]\\n① …\\n② …(정답)\\n③ …\\n④ …"\n' +
  '반드시 {"explanation":"..."} JSON 만 출력한다.'

interface DumpItem {
  year: number
  examType: string
  subject: string
  number: number
  passage?: string
  questionText: string
  choices: string[]
  answerNo: number
}

function buildUser(q: DumpItem, hint: string): string {
  const choiceLines = q.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')
  return [
    `과목: ${q.subject}`,
    q.passage ? `지문: ${q.passage}` : '',
    `발문: ${q.questionText}`,
    `보기:\n${choiceLines}`,
    `정답: ${q.answerNo}번`,
    `[검증된 사실]\n${hint}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function main() {
  await connectDb()
  const corrections: { idx: number; correction: string }[] = JSON.parse(await readFile(CORR_FILE, 'utf8'))
  const dump: DumpItem[] = JSON.parse(await readFile(DUMP_FILE, 'utf8'))
  console.log(`정정 대상: ${corrections.length}건`)
  let done = 0
  let failed = 0
  for (const c of corrections) {
    const q = dump[c.idx]
    if (!q || !c.correction?.trim()) {
      failed++
      continue
    }
    const key = `${q.year}-${q.examType}-${q.subject}-${q.number}`
    try {
      const raw = await chatJson(SYSTEM, buildUser(q, c.correction), { model: MODEL })
      const o = JSON.parse(raw) as { explanation?: string }
      if (!o.explanation?.trim()) {
        failed++
        console.warn(`✗ 파싱 실패: ${key}`)
        continue
      }
      const res = await QuestionModel.updateOne({ key }, { $set: { explanation: o.explanation.trim() } })
      if (res.matchedCount === 0) {
        failed++
        console.warn(`✗ 문항 없음: ${key}`)
        continue
      }
      done++
      console.log(`✓ ${key}`)
    } catch (e) {
      failed++
      console.warn(`✗ ${key}:`, (e as Error).message)
    }
  }
  console.log(`\n해설 정정: 성공 ${done} · 실패 ${failed}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('해설 정정 실패:', e)
  process.exit(1)
})
