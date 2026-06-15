// 9급 공무원 영어 빈출 단어장 생성(Claude). 빈출도 등급(tier 1~3) 부여.
// 옵션: WORDBOOK_TARGET(기본 80) · WORDBOOK_BATCH(기본 80) · STORE(1이면 DB 저장, 아니면 출력만) · WORDBOOK_MODEL
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { TermModel } from '../models/Term'
import { chatJson } from '../lib/ai/openai'

const TARGET = Number(process.env.WORDBOOK_TARGET ?? '80')
const BATCH = Number(process.env.WORDBOOK_BATCH ?? '80')
const STORE = process.env.STORE === '1'
const MODEL = process.env.WORDBOOK_MODEL ?? 'gpt-4o' // → Claude Sonnet 매핑

const SYSTEM =
  '너는 9급 공무원 영어 시험 대비 단어장 편집자다. 9급 공무원 영어 시험에 자주 나오는 **빈출 영단어·숙어**를 선별한다.\n' +
  '각 항목: word(표제어, 소문자 원형/숙어), pos(품사: v/n/a/ad/prep/conj/idiom 중), meaning(핵심 한국어 뜻 1~3개, 콤마로), ' +
  'tier(빈출도: 3=최빈출 2=빈출 1=기본), syn(빈출 동의어 0~2개, 콤마 / 없으면 ""), ant(반의어 0~1개 / 없으면 ""), example(짧고 자연스러운 영어 예문 1개).\n' +
  '규칙: ①실제 공무원 시험 빈출 어휘만. ②the/go/water/people 같은 너무 기초적인 기능어·기초어와 고유명사는 제외. ' +
  '③뜻은 정확하게(사실 오류 금지). ④중복 금지. ⑤동의어/예문은 시험에 도움되는 수준.\n' +
  '반드시 {"words":[{"word":"","pos":"","meaning":"","tier":3,"syn":"","ant":"","example":""}]} JSON 만 출력한다.'

interface W {
  word: string
  pos: string
  meaning: string
  tier: number
  syn?: string
  ant?: string
  example?: string
}

function parse(raw: string): W[] {
  try {
    const o = JSON.parse(raw) as { words?: unknown }
    const arr = Array.isArray(o.words) ? o.words : []
    const out: W[] = []
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const r = x as Record<string, unknown>
      const word = typeof r.word === 'string' ? r.word.trim().toLowerCase() : ''
      const meaning = typeof r.meaning === 'string' ? r.meaning.trim() : ''
      if (!word || !meaning || word.length > 40) continue
      out.push({
        word,
        pos: typeof r.pos === 'string' ? r.pos.trim() : '',
        meaning,
        tier: Number(r.tier) >= 1 && Number(r.tier) <= 3 ? Number(r.tier) : 2,
        syn: typeof r.syn === 'string' ? r.syn.trim() : '',
        ant: typeof r.ant === 'string' ? r.ant.trim() : '',
        example: typeof r.example === 'string' ? r.example.trim() : '',
      })
    }
    return out
  } catch {
    return []
  }
}

const tierLabel = (t: number) => (t >= 3 ? '★★★ 최빈출' : t === 2 ? '★★ 빈출' : '★ 기본')
function definitionOf(w: W): string {
  const pos = w.pos ? `${w.pos}. ` : ''
  let d = `${pos}${w.meaning}`
  if (w.syn) d += `\n≈ ${w.syn}`
  if (w.ant) d += `${w.syn ? '  ' : '\n'}↔ ${w.ant}`
  return d
}

async function main() {
  await connectDb() // 기존 단어장 로드(중복 방지)를 위해 항상 연결
  // 이미 저장된 단어장 단어를 제외 시드로(이어서 채움)
  const existing = await TermModel.find({ source: '단어장' }).select('term').lean()
  const seen = new Set<string>(existing.map((e) => String((e as { term?: string }).term ?? '').toLowerCase()).filter(Boolean))
  console.log(`기존 단어장 ${seen.size}개 로드 — 제외하고 ${TARGET}개까지 채움`)
  const collected: W[] = [] // 이번에 새로 생성한 것만

  // 알파벳 구간(A~Z) 분할 — 각 글자로 시작하는 빈출 단어를 소진까지(중복 없이 폭넓게 커버)
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('')
  for (const L of letters) {
    if (seen.size >= TARGET) break
    let dry = 0
    while (dry < 2 && seen.size < TARGET) {
      const excludeL = [...seen].filter((w) => w[0] === L).slice(-500).join(', ')
      const user =
        `9급 공무원 영어 시험에 나오는 빈출 단어·숙어 중 알파벳 '${L.toUpperCase()}'로 시작하는 것 ${BATCH}개를 생성하라.` +
        (excludeL ? `\n[이미 포함 — 제외]: ${excludeL}` : '')
      let got: W[] = []
      try {
        got = parse(await chatJson(SYSTEM, user, { model: MODEL }))
      } catch (e) {
        console.warn(`[${L}] 실패:`, (e as Error).message)
      }
      const fresh = got.filter((w) => w.word[0] === L && !seen.has(w.word))
      fresh.forEach((w) => seen.add(w.word))
      collected.push(...fresh)
      if (fresh.length < 4) dry++
      else dry = 0
      if (fresh.length) console.log(`[${L.toUpperCase()}] +${fresh.length} (총 ${seen.size}/${TARGET})`)
    }
  }

  // 등급별 분포
  const byTier: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  collected.forEach((w) => (byTier[w.tier] = (byTier[w.tier] ?? 0) + 1))
  console.log(`\n분포 — 최빈출 ${byTier[3]} · 빈출 ${byTier[2]} · 기본 ${byTier[1]} · 총 ${collected.length}`)

  if (!STORE) {
    console.log('\n=== 샘플(상위 24개) ===')
    for (const w of collected.slice(0, 24)) {
      console.log(`${'★'.repeat(w.tier)} ${w.word} (${w.pos}) — ${w.meaning}${w.syn ? ` | ≈${w.syn}` : ''}`)
      if (w.example) console.log(`     ex) ${w.example}`)
    }
    return
  }

  let created = 0
  for (const w of collected) {
    const key = `영어:단어장:${w.word}`
    await TermModel.findOneAndUpdate(
      { key },
      {
        key,
        subject: '영어',
        chapter: tierLabel(w.tier),
        unit: tierLabel(w.tier),
        term: w.word,
        definition: definitionOf(w),
        example: w.example || undefined,
        source: '단어장',
        model: MODEL,
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
    created++
  }
  console.log(`\n저장 완료: ${created}개 (source=단어장)`)
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
