// 충실도 감사·재추출(워크플로) 결과를 DB에 반영한다(passage/questionText/choices 갱신, answerIndex 보존).
// 입력: FIX_FILE(기본 .audit/fidelity-fixes.json) = {fixes:[{key,passage,questionText,choices,...}]} 또는 배열.
// passage가 새로 채워진(=실질 변경) 문항의 key 목록을 출력 → 이후 KEYS=... 로 해설 재생성.
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'

const FIX_FILE = process.env.FIX_FILE ?? '.audit/fidelity-fixes.json'

interface Fix {
  key: string
  passage?: string
  questionText?: string
  choices?: string[]
}

async function main() {
  await connectDb()
  const parsed = JSON.parse(await readFile(FIX_FILE, 'utf8'))
  const fixes: Fix[] = Array.isArray(parsed) ? parsed : parsed.fixes ?? []
  console.log(`정정 대상: ${fixes.length}문항`)
  let done = 0
  let failed = 0
  const passageChanged: string[] = []
  for (const f of fixes) {
    if (!f.key || !Array.isArray(f.choices) || f.choices.length < 2 || !f.questionText?.trim()) {
      console.warn(`✗ 불완전, 건너뜀: ${f.key}`)
      failed++
      continue
    }
    const before = await QuestionModel.findOne({ key: f.key }).lean()
    if (!before) {
      console.warn(`✗ 문항 없음: ${f.key}`)
      failed++
      continue
    }
    const set: Record<string, unknown> = {
      passage: f.passage ?? '',
      questionText: f.questionText.trim(),
      choices: f.choices,
    }
    await QuestionModel.updateOne({ key: f.key }, { $set: set })
    const hadPassage = !!(before as { passage?: string }).passage?.trim()
    const hasPassage = !!f.passage?.trim()
    if (hasPassage && !hadPassage) passageChanged.push(f.key)
    done++
    console.log(`✓ ${f.key} (보기 ${f.choices.length}개, 지문 ${hasPassage ? '있음' : '없음'})`)
  }
  console.log(`\n충실도 정정: 성공 ${done} · 실패 ${failed}`)
  if (passageChanged.length) {
    console.log(`\n지문 신규 추가(해설 재생성 권장) KEYS=${passageChanged.join(',')}`)
  }
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('충실도 정정 실패:', e)
  process.exit(1)
})
