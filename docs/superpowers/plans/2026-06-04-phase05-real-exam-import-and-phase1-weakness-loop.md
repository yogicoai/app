# Phase 0.5 + 1 — 실기출 PDF 적재 파이프라인 + 약점 루프 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) 사이버국가고시센터(gosi.kr) 공개 기출 PDF를 JSON으로 구조화·적재·태깅하는 멱등 파이프라인을 만들어 placeholder 27문항을 실기출로 교체한다. (B) 그 위에 풀이 신호(정오답·소요시간)를 단원(unit)별로 집계하는 약점 엔진과, 데이터가 적은 신규 유저를 위한 콜드스타트 AI 진단, 약점 단원을 드립에 우선 주입하는 로직을 붙여 핵심 루프를 완성한다.

**Architecture:** 기존 Fastify+Mongoose 코드와 Phase 0의 AI 인프라(`lib/ai/openai.ts` 래퍼, `tagger.ts` 패턴)를 확장한다. 새 로직은 (1) PDF→JSON은 **순수 파싱/검증 로직**(외부 호출 없음, vitest)과 **AI 추출 호출**(주입)을 분리, (2) 약점 점수는 **순수 함수**(TDD)로 만들고 DB 집계 쿼리와 합성, (3) 콜드스타트 AI 진단은 프롬프트 생성·응답 파싱을 순수 로직으로 분리해 테스트. 동작 중인 전역 `DailySet`·인증·스모크는 깨지 않는다(설계 원칙: 동작 중 백엔드를 크게 흔들지 않음).

**Tech Stack:** Node (ESM) · TypeScript · tsx · Fastify · Mongoose · Zod · OpenAI SDK · vitest · pdf 텍스트 추출(`pdfjs-dist` 또는 `pdf-parse`)

> **상위 설계 문서:** `docs/superpowers/specs/2026-06-04-9geup-haengjeong-exam-app-design.md` (Phase 0 잔여 = 기출 적재, Phase 1 = 핵심 루프)
> **선행 Phase:** `docs/superpowers/plans/2026-06-04-phase0-baseline-and-ai-tagging.md` (완료 — 태깅 인프라 존재)
>
> **작업 디렉터리:** `C:\Users\Yogibo Design\Desktop\appData`. 모든 명령은 별도 표기 없으면 `server/`에서 실행.
>
> **사용자 진행 방식:** 묶음마다 **로컬 실행 → 출력/화면 확인 → 다음**. PDF 원본 확보·태깅 품질·드립 화면에 명시적 ✋ 체크포인트가 있다.

---

## 확정된 설계 결정 (착수 전 합의)

| # | 결정 | 근거 / 대안 |
|---|---|---|
| D1 | **PDF→JSON은 AI 보조 추출**(`openai.ts` 재사용)을 1차로 하고, 순수 검증 로직으로 결과를 강제. | 한글 기출 PDF는 보기 표기(①②③④/㉠㉡)·표·한자·2단 레이아웃이 회차마다 달라 정규식 단독은 취약. AI는 일회성 비용이라 캐싱 불필요. 대안(순수 정규식 파서)은 게이트로 남김. |
| D2 | **드립 개인화는 전역 `DailySet` 유지 + fetch 시점 약점 보충.** `GET /content/today`가 전역 세트 + (인증 유저면) 약점 단원 보충 N문항을 함께 반환. | 설계 원칙 "동작 중 백엔드를 크게 흔들지 않음". `DailySet`을 per-user(date+userId)로 바꾸면 배치·스모크·앱이 연쇄 변경됨. 보충은 읽기 시점 계산이라 격리적. |
| D3 | **약점 저장은 `users.weakProfile` 캐시**(설계 §3과 동일). 별도 컬렉션 없음. | 신규 컬렉션 최소화. `basis:'ai'|'aggregate'`로 출처 추적. |
| D4 | **콜드/웜 경계는 누적 시도수 임계값**(기본 `COLD_ATTEMPTS=20`, 환경변수로 조정). 콜드=AI 1회 진단, 웜=DB 집계. | 설계 §2 하이브리드. 임계값은 실데이터 보고 튜닝(체크포인트). |

> PDF 원본(gosi.kr) 확보는 **사장님 선행 작업**이다. Task A1의 ✋ 체크포인트에서 샘플 PDF 1개를 받아 형식을 확인한 뒤에야 A2 파서를 확정한다.

---

## File Structure (이번 Phase에서 생성/수정하는 파일)

| 파일 | 책임 | 생성/수정 |
|---|---|---|
| `server/package.json` | pdf 추출 의존성, `import:pdf` 스크립트 | 수정 |
| `server/src/lib/pdf/extract.ts` | PDF 경로 → 페이지별 텍스트 추출(IO) | 생성 |
| `server/src/lib/pdf/parse.ts` | 순수: 추출 텍스트 정규화·문항 분할·AI 응답 검증·정답표 병합 | 생성 |
| `server/src/lib/pdf/parse.test.ts` | parse 단위 테스트 | 생성 |
| `server/src/lib/pdf/aiExtract.ts` | 페이지 텍스트 → 문항 JSON (OpenAI 호출, 주입형) | 생성 |
| `server/src/scripts/import-pdf.ts` | PDF 디렉터리 → JSON → 멱등 적재 배치 | 생성 |
| `server/src/models/Question.ts` | (필요시) `year`/`examType`/`number` 활용 확인 — 이미 존재 | 확인 |
| `server/src/models/Progress.ts` | `timeSpentMs` 필드 추가 | 수정 |
| `server/src/models/User.ts` | `weakProfile` 배열 필드 추가 | 수정 |
| `server/src/routes/progress.ts` | `/attempt`에 `timeSpentMs` 수용, `GET /weakness` 추가 | 수정 |
| `server/src/lib/weakness.ts` | 순수: 약점 점수 산출 · weakProfile 병합 | 생성 |
| `server/src/lib/weakness.test.ts` | weakness 단위 테스트 | 생성 |
| `server/src/lib/ai/diagnose.ts` | 순수: 콜드스타트 진단 프롬프트·응답 파싱 | 생성 |
| `server/src/lib/ai/diagnose.test.ts` | diagnose 단위 테스트 | 생성 |
| `server/src/routes/weakness.ts` 또는 progress.ts 내 | `GET /progress/weakness` (집계 또는 AI 진단 분기) | 생성/수정 |
| `server/src/scripts/build-daily-set.ts` | (D2) 보충 로직은 fetch 시점이므로 최소 변경/유지 | 확인 |
| `server/src/routes/content.ts` | `GET /content/today`에 약점 보충 합성 | 수정 |
| `server/src/lib/dripSelect.ts` | 순수: 약점 단원 우선 보충 문제 선택 | 생성 |
| `server/src/lib/dripSelect.test.ts` | dripSelect 단위 테스트 | 생성 |
| `server/src/scripts/smoke.ts` | timeSpentMs·weakness·today 보충 검증 추가 | 수정 |
| `server/content/README.md` · 루트 `README.md` | 명령·진행상황 갱신 | 수정 |

---

# PART A — Phase 0.5: 실기출 PDF → JSON 적재 파이프라인

## Task A1: PDF 원본 확보 + 텍스트 추출 도구 — 형식 같이 확인 ✋

PDF 한 개를 실제로 열어 형식을 봐야 파서를 확정할 수 있다. 코드 최소, 사장님과 보는 첫 체크포인트.

**Files:** `server/package.json`, `server/src/lib/pdf/extract.ts`

- [ ] **Step 1: PDF 텍스트 추출 의존성 설치**

Run (`server/`):
```bash
npm install pdfjs-dist@^4
```
(legacy 빌드의 `pdfjs-dist/legacy/build/pdf.mjs`를 Node에서 사용. `pdf-parse`는 구버전 의존성 이슈가 있어 `pdfjs-dist` 우선.)

- [ ] **Step 2: 추출 유틸 작성**

Create `server/src/lib/pdf/extract.ts`:
```ts
// PDF 파일 → 페이지별 텍스트 배열. IO 전용(파싱/검증은 parse.ts 책임).
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function extractPdfPages(path: string): Promise<string[]> {
  const data = new Uint8Array(await readFile(path))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ')
    pages.push(text)
  }
  return pages
}
```

- [ ] **체크포인트 ✋ Step 3: 샘플 PDF 1개로 덤프 확인**

사장님이 gosi.kr에서 **문제 PDF 1개 + 해당 정답표 PDF 1개**를 `server/content/raw/` 아래에 둔다(예: `2024-국가직-국어.pdf`, `2024-국가직-정답.pdf`). 그 뒤:

Run (`server/`):
```bash
npx tsx -e "import('./src/lib/pdf/extract.ts').then(async m => { const p = await m.extractPdfPages('content/raw/2024-국가직-국어.pdf'); console.log('페이지', p.length); console.log(p[0].slice(0, 800)) })"
```
Expected: 페이지 수와 1페이지 텍스트 일부 출력. **함께 확인할 것**: 문항 번호(`1.` `문 1.`), 보기 기호(`①②③④` 또는 `㉠`), 한자/표 깨짐 여부. 이 형식이 A2 파서·프롬프트 설계를 결정한다. (커밋 없음 — 의존성+유틸만 별도 커밋)

- [ ] **Step 4: Commit (의존성+추출 유틸)**

```bash
git add server/package.json server/package-lock.json server/src/lib/pdf/extract.ts
git commit -m "feat: add PDF text extraction util (pdfjs-dist)"
```

> ⚠️ **게이트:** 샘플 PDF가 없으면 여기서 멈춘다. A2~A4는 실제 형식 확인 후 진행.

---

## Task A2: PDF 텍스트 → 문항 JSON (AI 보조 추출 + 순수 검증) — TDD

추출 텍스트를 문항 단위로 만든다. **AI 호출(aiExtract)**과 **검증/병합(parse, 순수)**을 분리해 테스트 가능하게.

**Files:** `server/src/lib/pdf/parse.ts`, `server/src/lib/pdf/parse.test.ts`, `server/src/lib/pdf/aiExtract.ts`

- [ ] **Step 1: 실패하는 테스트 작성 (parse 순수 로직)**

Create `server/src/lib/pdf/parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateExtracted, mergeAnswerKey, normalizePageText } from './parse'

describe('validateExtracted', () => {
  it('정상 문항을 통과시킨다', () => {
    const r = validateExtracted([
      { number: 1, questionText: '다음 중 옳은 것은?', choices: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].number).toBe(1)
  })
  it('보기 4개 미만이면 제외한다', () => {
    expect(validateExtracted([{ number: 2, questionText: 'x', choices: ['a', 'b'] }])).toHaveLength(0)
  })
  it('본문 비면 제외', () => {
    expect(validateExtracted([{ number: 3, questionText: '', choices: ['a', 'b', 'c', 'd'] }])).toHaveLength(0)
  })
})

describe('mergeAnswerKey', () => {
  it('번호로 정답 인덱스를 매칭한다(1-based → 0-based)', () => {
    const items = [{ number: 1, questionText: 'q', choices: ['a', 'b', 'c', 'd'] }]
    const merged = mergeAnswerKey(items, { 1: 3 }) // 정답표: 1번=③
    expect(merged[0].answerIndex).toBe(2)
  })
  it('정답 없는 문항은 제외', () => {
    const items = [{ number: 9, questionText: 'q', choices: ['a', 'b', 'c', 'd'] }]
    expect(mergeAnswerKey(items, { 1: 1 })).toHaveLength(0)
  })
})

describe('normalizePageText', () => {
  it('연속 공백·줄바꿈을 정리한다', () => {
    expect(normalizePageText('가   나\n\n다')).toBe('가 나 다')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인** — `npm test` → FAIL(모듈 없음).

- [ ] **Step 3: parse 순수 로직 구현**

Create `server/src/lib/pdf/parse.ts`:
```ts
// 외부 호출 없는 순수 로직: 정규화 · AI 추출 결과 검증 · 정답표 병합.
export interface ExtractedItem {
  number: number
  questionText: string
  choices: string[]
}
export interface ParsedQuestion extends ExtractedItem {
  answerIndex: number
}

export function normalizePageText(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// AI 가 뱉은 문항 후보 중 형식이 온전한 것만 남긴다(보기 4개·본문 존재).
export function validateExtracted(items: unknown): ExtractedItem[] {
  if (!Array.isArray(items)) return []
  const out: ExtractedItem[] = []
  for (const it of items) {
    if (typeof it !== 'object' || it === null) continue
    const o = it as Record<string, unknown>
    const number = typeof o.number === 'number' ? o.number : NaN
    const questionText = typeof o.questionText === 'string' ? o.questionText.trim() : ''
    const choices = Array.isArray(o.choices) ? o.choices.filter((c) => typeof c === 'string').map((c) => (c as string).trim()) : []
    if (!Number.isFinite(number) || !questionText || choices.length < 4) continue
    out.push({ number, questionText, choices })
  }
  return out
}

// 정답표(번호→1-based 보기번호) 를 병합. 정답 없는 문항은 버린다.
export function mergeAnswerKey(items: ExtractedItem[], key: Record<number, number>): ParsedQuestion[] {
  const out: ParsedQuestion[] = []
  for (const it of items) {
    const oneBased = key[it.number]
    if (!oneBased || oneBased < 1 || oneBased > it.choices.length) continue
    out.push({ ...it, answerIndex: oneBased - 1 })
  }
  return out
}
```

- [ ] **Step 4: AI 추출 호출 작성 (주입형, openai 재사용)**

Create `server/src/lib/pdf/aiExtract.ts`:
```ts
import { chatJson } from '../ai/openai'
import { validateExtracted, normalizePageText, type ExtractedItem } from './parse'

const EXTRACT_SYSTEM =
  '너는 한국 공무원 기출시험 PDF 텍스트를 구조화하는 파서다. 주어진 페이지 텍스트에서 ' +
  '객관식 문항만 뽑아 배열로 만든다. 각 항목은 {"number":정수 문항번호,"questionText":본문,' +
  '"choices":[보기1,보기2,보기3,보기4(또는5)]}. 보기 기호(①②③④/㉠㉡)는 제거하고 내용만. ' +
  '해설·머리말·지시문은 제외. 반드시 {"items":[...]} JSON 만 출력한다.'

// 페이지 텍스트 → 검증된 문항 후보. 정답표 병합은 호출측(parse.mergeAnswerKey).
export async function extractQuestionsFromPage(pageText: string): Promise<ExtractedItem[]> {
  const raw = await chatJson(EXTRACT_SYSTEM, normalizePageText(pageText))
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const items = (parsed as { items?: unknown })?.items
  return validateExtracted(items)
}
```

- [ ] **Step 5: 테스트 통과 확인** — `npm test` → parse 전부 PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/pdf/parse.ts server/src/lib/pdf/parse.test.ts server/src/lib/pdf/aiExtract.ts
git commit -m "feat: add PDF question extraction (AI-assisted) with pure validation"
```

---

## Task A3: 적재 배치(import-pdf) — JSON → 멱등 import

추출·병합 결과를 `key`(연도+시험+번호) 기반 멱등 upsert로 DB에 적재한다. 기존 import 패턴(멱등 키) 재사용.

**Files:** `server/src/scripts/import-pdf.ts`, `server/package.json`

- [ ] **Step 1: 정답표 파싱 규칙 결정 (샘플 기반)**

정답표 PDF 형식을 Task A1 덤프로 확인 후, `번호→정답번호` 맵을 만드는 작은 순수 함수 `parseAnswerKey(text): Record<number,number>`를 `parse.ts`에 추가하고 테스트 1~2개 보강. (형식: 보통 `1 ③ 2 ① 3 ④ …` 또는 표. 실제 형식 확인 후 정규식 확정 — 게이트.)

- [ ] **Step 2: 배치 스크립트 작성**

Create `server/src/scripts/import-pdf.ts`:
```ts
// content/raw/ 의 (문제 PDF, 정답 PDF) 쌍 → 추출·병합 → 멱등 적재.
// 메타(연도/시험종류/과목)는 파일명 규칙 'YYYY-시험-과목.pdf' 에서 파싱.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { extractPdfPages } from '../lib/pdf/extract'
import { extractQuestionsFromPage } from '../lib/pdf/aiExtract'
import { mergeAnswerKey, parseAnswerKey } from '../lib/pdf/parse'

const RAW_DIR = process.env.PDF_DIR ?? 'content/raw'

function parseMeta(file: string) {
  const m = file.replace(/\.pdf$/i, '').split('-')
  return { year: Number(m[0]), examType: m[1] ?? '', subject: m[2] ?? '' }
}

async function main() {
  await connectDb()
  const files = (await readdir(RAW_DIR)).filter((f) => /\.pdf$/i.test(f) && !/정답/.test(f))
  let imported = 0
  for (const qFile of files) {
    const meta = parseMeta(qFile)
    const answerFile = qFile.replace(meta.subject, '정답') // 규칙은 A1 확인 후 확정
    const qPages = await extractPdfPages(path.join(RAW_DIR, qFile))
    const aPages = await extractPdfPages(path.join(RAW_DIR, answerFile)).catch(() => [])
    const key = parseAnswerKey(aPages.join(' '))

    const items = (await Promise.all(qPages.map(extractQuestionsFromPage))).flat()
    const merged = mergeAnswerKey(items, key)
    for (const q of merged) {
      const docKey = `${meta.year}-${meta.examType}-${meta.subject}-${q.number}`
      await QuestionModel.findOneAndUpdate(
        { key: docKey },
        {
          key: docKey, subject: meta.subject, year: meta.year, examType: meta.examType,
          number: q.number, questionText: q.questionText, choices: q.choices,
          answerIndex: q.answerIndex, source: '기출',
        },
        { upsert: true, setDefaultsOnInsert: true },
      )
      imported++
    }
    console.log(`✓ ${qFile} → ${merged.length}문항`)
  }
  console.log(`\n적재 완료: ${imported}문항 (멱등)`)
  await mongoose.disconnect()
}

main().catch((e) => { console.error('적재 실패:', e); process.exit(1) })
```

`package.json` scripts에 추가:
```json
    "import:pdf": "tsx src/scripts/import-pdf.ts",
```

- [ ] **Step 3: 타입체크** — `npm run typecheck` → 에러 없음.

- [ ] **Step 4: 1과목 적재 실행(검증)** — `npm run import:pdf` → `✓ … → N문항`, `적재 완료`. Atlas/조회로 한 건 열어 본문·보기·정답이 맞는지 확인.

- [ ] **Step 5: Commit**

```bash
git add server/src/scripts/import-pdf.ts server/src/lib/pdf/parse.ts server/src/lib/pdf/parse.test.ts server/package.json
git commit -m "feat: add idempotent PDF exam import batch"
```

---

## Task A4: 적재분 태깅 + 표본 검증 ✋

Phase 0 태깅 스크립트를 그대로 재사용(멱등). 신규 적재 문항은 `unit` 없으므로 후보로 잡힘.

- [ ] **Step 1: 태깅** — `npm run tag` → `미태깅 후보 N건`, `태깅 완료: 성공 N · 실패 0`.

- [ ] **체크포인트 ✋ Step 2: 사장님과 적재·태깅 품질 확인** — 표본 몇 건의 본문/정답/`unit`·`concept`가 맞는지 함께 본다. 추출 오류(보기 누락·정답 어긋남) 발견 시 A2 프롬프트/검증 또는 A3 정답표 규칙을 보정하고 재실행. **이 게이트를 통과해야 placeholder를 폐기**한다.

- [ ] **Step 3: placeholder 폐기(선택)** — 실기출이 충분히 적재되면 seed/placeholder 문제를 정리(예: `source:'seed'` 삭제 스크립트). 별도 커밋.

---

# PART B — Phase 1: 약점 루프 (드립 + 약점)

## Task B1: 풀이 소요시간 신호 — Progress.timeSpentMs

약점 엔진의 '소요시간' 입력을 확보한다. 앱이 `/attempt`에 풀이 시간을 보낸다.

**Files:** `server/src/models/Progress.ts`, `server/src/routes/progress.ts`

- [ ] **Step 1: 스키마 필드 추가** — `progressSchema`의 `attempts` 줄 다음에:
```ts
    timeSpentMs: { type: Number, default: 0 }, // 마지막 풀이 소요시간(ms)
    avgTimeMs: { type: Number, default: 0 }, // 누적 평균 소요시간(ms)
```

- [ ] **Step 2: `/attempt`가 timeSpentMs 수용 + 평균 갱신**

`routes/progress.ts`의 body 스키마에 `timeSpentMs: z.number().int().nonnegative().optional()` 추가. 저장 시 `timeSpentMs`를 기록하고 `avgTimeMs`를 이동평균으로 갱신(이전 `attempts`·`avgTimeMs` 기반). 누적 평균:
```ts
const t = body.timeSpentMs ?? 0
const n = existing?.attempts ?? 0
const prevAvg = existing?.avgTimeMs ?? 0
const avgTimeMs = n > 0 ? Math.round((prevAvg * n + t) / (n + 1)) : t
```
update 객체에 `timeSpentMs: t, avgTimeMs` 추가.

- [ ] **Step 3: 타입체크 + 스모크** — 서버 dev 띄운 뒤 `npm run smoke` (기존 14개 그대로 통과해야 함). 

- [ ] **Step 4: Commit**
```bash
git add server/src/models/Progress.ts server/src/routes/progress.ts
git commit -m "feat: capture per-attempt time on progress"
```

---

## Task B2: 약점 점수 순수 로직(weakness) — TDD

(정답률·평균시간·시도수) → 약점 점수(0~100, 높을수록 약함)와 weakProfile 병합을 순수 함수로.

**Files:** `server/src/lib/weakness.ts`, `server/src/lib/weakness.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `server/src/lib/weakness.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { weaknessScore, mergeWeakProfile } from './weakness'

describe('weaknessScore', () => {
  it('시도 없으면 중립 50', () => {
    expect(weaknessScore({ attempted: 0, correct: 0, avgTimeMs: 0 })).toBe(50)
  })
  it('정답률 낮을수록 점수 높다', () => {
    const low = weaknessScore({ attempted: 10, correct: 9, avgTimeMs: 10000 })
    const high = weaknessScore({ attempted: 10, correct: 2, avgTimeMs: 10000 })
    expect(high).toBeGreaterThan(low)
  })
  it('느린 풀이는 가중된다', () => {
    const fast = weaknessScore({ attempted: 10, correct: 5, avgTimeMs: 10000 })
    const slow = weaknessScore({ attempted: 10, correct: 5, avgTimeMs: 60000 })
    expect(slow).toBeGreaterThan(fast)
  })
  it('0~100 범위로 클램프', () => {
    const s = weaknessScore({ attempted: 5, correct: 0, avgTimeMs: 120000 })
    expect(s).toBeLessThanOrEqual(100)
    expect(s).toBeGreaterThanOrEqual(0)
  })
})

describe('mergeWeakProfile', () => {
  it('집계 결과를 weakProfile 항목으로 변환한다', () => {
    const p = mergeWeakProfile([{ subject: '한국사', unit: '조선 후기 실학', attempted: 4, correct: 1, avgTimeMs: 20000 }], 'aggregate')
    expect(p[0]).toMatchObject({ subject: '한국사', unit: '조선 후기 실학', basis: 'aggregate' })
    expect(p[0].score).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 2: 실패 확인** — `npm test` → FAIL.

- [ ] **Step 3: 구현**

Create `server/src/lib/weakness.ts`:
```ts
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export interface UnitStat {
  subject: string
  unit: string
  attempted: number
  correct: number
  avgTimeMs: number
}
export interface WeakEntry {
  subject: string
  unit: string
  score: number
  basis: 'ai' | 'aggregate'
  attempted: number
  updatedAt: Date
}

const SLOW_MS = 30000 // 이 이상이면 느린 풀이로 가중

// 0~100, 높을수록 약함. 시도 없으면 중립 50.
export function weaknessScore(s: { attempted: number; correct: number; avgTimeMs: number }): number {
  if (s.attempted <= 0) return 50
  const wrongRate = 1 - s.correct / s.attempted
  let score = wrongRate * 100
  if (s.avgTimeMs > SLOW_MS) score += Math.min(15, ((s.avgTimeMs - SLOW_MS) / SLOW_MS) * 15)
  return clamp(Math.round(score), 0, 100)
}

export function mergeWeakProfile(stats: UnitStat[], basis: 'ai' | 'aggregate', now: Date = new Date()): WeakEntry[] {
  return stats.map((s) => ({
    subject: s.subject,
    unit: s.unit,
    score: weaknessScore(s),
    basis,
    attempted: s.attempted,
    updatedAt: now,
  }))
}
```

- [ ] **Step 4: 통과 확인** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add server/src/lib/weakness.ts server/src/lib/weakness.test.ts
git commit -m "feat: add pure weakness scoring logic with tests"
```

---

## Task B3: 단원별 집계 + weakProfile 저장 — GET /progress/weakness (웜)

DB 집계로 (subject, unit)별 정답률·평균시간을 내고, 점수화해 `users.weakProfile`에 캐시.

**Files:** `server/src/models/User.ts`, `server/src/routes/progress.ts`

- [ ] **Step 1: User에 weakProfile 추가** — `userSchema`에:
```ts
    weakProfile: {
      type: [
        new Schema(
          {
            subject: String, unit: String, score: Number,
            basis: { type: String, enum: ['ai', 'aggregate'] },
            attempted: Number, updatedAt: Date,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    weakProfileUpdatedAt: { type: Date },
```

- [ ] **Step 2: 집계 + 라우트** — `routes/progress.ts`에 `GET /weakness` 추가:
  - `ProgressModel.aggregate`로 `$lookup`→`q.unit` 기준 group: `attempted`, `correct`, `avgTimeMs:{$avg:'$avgTimeMs'}`, `subject:{$first:'$q.subject'}`.
  - `unit`이 null인 그룹 제외.
  - `mergeWeakProfile(stats, 'aggregate')`로 변환 → 점수 내림차순 정렬 → `UserModel.updateOne({_id}, {weakProfile, weakProfileUpdatedAt: now})`.
  - 응답: `{ basis:'aggregate', weakProfile, topWeak: weakProfile.slice(0,5) }`.

- [ ] **Step 3: 스모크 보강** — `smoke.ts`에 `GET /progress/weakness → 200 + weakProfile 배열` 1줄 추가.

- [ ] **Step 4: 타입체크 + 스모크** — 통과 확인.

- [ ] **Step 5: Commit**
```bash
git add server/src/models/User.ts server/src/routes/progress.ts server/src/scripts/smoke.ts
git commit -m "feat: aggregate per-unit weakness into users.weakProfile"
```

---

## Task B4: 콜드스타트 AI 진단(diagnose) — 데이터 적은 유저 — TDD

누적 시도수 < `COLD_ATTEMPTS`면, 틀린 문제+태그를 AI에 보내 약점 단원을 추론(basis:'ai'). 프롬프트/파싱은 순수 로직.

**Files:** `server/src/lib/ai/diagnose.ts`, `server/src/lib/ai/diagnose.test.ts`, `server/src/config/env.ts`, `routes/progress.ts`

- [ ] **Step 1: 실패 테스트** — `diagnose.test.ts`:
  - `buildDiagnosePrompt(wrongItems)`가 과목·unit·문제요약을 포함.
  - `parseDiagnoseResponse(raw)`가 `{weak:[{subject,unit,score}]}`를 검증된 배열로(점수 0~100 클램프, 잘못된 JSON→[]).

- [ ] **Step 2: 실패 확인** — `npm test`.

- [ ] **Step 3: 구현** — `diagnose.ts`:
  - `DIAGNOSE_SYSTEM` 프롬프트(약점 단원 추론, JSON `{"weak":[...]}` 강제).
  - `buildDiagnosePrompt(items: {subject;unit?;concept?;questionText}[]): string`.
  - `parseDiagnoseResponse(raw): {subject;unit;score}[]` (검증·클램프).
  `env.ts`에 `COLD_ATTEMPTS: z.coerce.number().default(20)` 추가.

- [ ] **Step 4: 라우트 분기** — `GET /progress/weakness`에서 유저 누적 `attempts` 합이 `COLD_ATTEMPTS` 미만이면:
  - 최근 오답 progress + 해당 question(subject/unit/concept/questionText) 조회 → `buildDiagnosePrompt` → `chatJson(DIAGNOSE_SYSTEM, ...)` → `parseDiagnoseResponse` → `mergeWeakProfile`는 이미 점수 포함 형태가 다르므로 `basis:'ai'`로 직접 WeakEntry 구성 → 저장. 응답 `basis:'ai'`.
  - 오답이 0건이면 빈 진단 + `basis:'aggregate'` 폴백.

- [ ] **Step 5: 통과 + 타입체크 + 스모크** — 콜드 유저(스모크의 신규 디바이스)는 `basis:'ai'` 또는 폴백 경로가 200으로 동작.

- [ ] **Step 6: Commit**
```bash
git add server/src/lib/ai/diagnose.ts server/src/lib/ai/diagnose.test.ts server/src/config/env.ts server/src/routes/progress.ts
git commit -m "feat: add cold-start AI weakness diagnosis"
```

---

## Task B5: 약점 우선 드립 보충 (D2) — GET /content/today 합성 — TDD

전역 세트는 그대로. 인증 유저면 약점 상위 단원의 미풀이 문제를 보충으로 덧붙인다.

**Files:** `server/src/lib/dripSelect.ts`, `server/src/lib/dripSelect.test.ts`, `server/src/routes/content.ts`

- [ ] **Step 1: 실패 테스트** — `dripSelect.test.ts`:
  - `pickWeakUnits(weakProfile, n)`이 score 내림차순 상위 n개 unit을 반환(중립 50 이하 제외).
  - `dedupeQuestionIds(baseIds, supplementIds)`가 전역 세트와 중복 제거.

- [ ] **Step 2: 실패 확인.**

- [ ] **Step 3: 구현** — `dripSelect.ts`에 두 순수 함수. (실제 문제 조회는 라우트에서.)

- [ ] **Step 4: content 라우트 합성** — `GET /content/today`:
  - 기존 전역 세트 로드(유지).
  - `Authorization` 있으면(authenticate optional) 유저 `weakProfile`에서 `pickWeakUnits` → 그 unit의 미풀이(progress 없는) 문제 최대 `WEAK_SUPPLEMENT=3`개 조회 → `dedupeQuestionIds`로 합성 → 응답에 `supplement:[...]` 분리 반환(앱이 "약점 보충"으로 표시).
  - 비인증/약점 없음이면 기존과 동일(보충 빈 배열).

- [ ] **Step 5: 통과 + 스모크 보강** — `GET /content/today`(토큰 포함)가 `questions`+`supplement` 형태로 200.

- [ ] **Step 6: Commit**
```bash
git add server/src/lib/dripSelect.ts server/src/lib/dripSelect.test.ts server/src/routes/content.ts server/src/scripts/smoke.ts
git commit -m "feat: supplement daily set with weak-unit questions per user"
```

---

## Task B6: 통합 검증 + 화면 같이 확인 ✋

**Files:** 없음(실행/검증) + 문서 갱신

- [ ] **Step 1: 전체 단위테스트 + 스모크** — `npm test`(전부 green), 서버 dev + `npm run smoke`(확장분 포함 전부 통과).

- [ ] **Step 2: 앱에서 흐름 확인** — `app/`에서 `npx expo start --web`. 풀이 → (소요시간 기록) → `/progress/weakness` 호출 화면(약점 상위 단원) → 홈 "오늘의 세트 + 약점 보충" 노출 확인.

- [ ] **체크포인트 ✋ Step 3: 사장님과 약점 루프 확인** — 약점 단원이 실제 틀린 영역과 맞는지, 보충 문제가 그 단원에서 오는지 표본 확인. 어긋나면 `weaknessScore` 가중치·`COLD_ATTEMPTS`·진단 프롬프트 조정.

- [ ] **Step 4: 문서 갱신 + 종료 커밋** — 루트 `README.md` 진행상황(Phase 0.5/1 완료), `server/content/README.md`에 `import:pdf` 명령 추가.
```bash
git add README.md server/content/README.md
git commit -m "docs: mark Phase 0.5 + Phase 1 complete"
```

---

## 다음 Phase 예고(게이트)

- **Phase 2 — 과목별 모의고사**: `examResults` 컬렉션 + 응시·채점 화면 + 약점 재측정(가중치↑). 본 Phase의 `weakProfile`·`weakness.ts`를 입력으로 재사용.
- **Phase 3 — AI 해설**: `explanations` 공용 캐시 + 프록시 라우트. 본 Phase의 `openai.ts` 재사용.

---

## Self-Review (작성자 점검)

- **스펙 커버리지**: 설계 Phase 0 잔여(실기출 적재)=Part A, Phase 1(약점 엔진+콜드스타트 진단+약점 드립)=Part B. weakProfile 캐시(§3)·하이브리드 콜드/웜(§2)·전역 세트 보존(설계 원칙) 반영.
- **결정 명시**: D1(AI 보조 PDF 파싱)·D2(fetch 시점 보충)·D3(weakProfile 캐시)·D4(콜드 임계값) 근거와 함께 상단 표에 고정.
- **게이트**: PDF 원본 확보(A1 ✋), 정답표 형식 확정(A3 Step1), 태깅 품질(A4 ✋)을 명시적 체크포인트로 분리 — 외부 의존(PDF)이 코드 진척을 막지 않도록 Part A/B 독립.
- **타입/시그니처 정합성**: `chatJson`(openai.ts) 재사용, `validateExtracted`/`mergeAnswerKey`/`weaknessScore`/`mergeWeakProfile`/`parseDiagnoseResponse` 시그니처가 정의처·사용처에서 일치. Progress 신규 필드(timeSpentMs/avgTimeMs)·User.weakProfile이 집계·드립 사용처와 일치.
- **테스트 우선**: parse·weakness·diagnose·dripSelect 모두 순수 로직 TDD. AI 호출은 주입으로 분리해 단위테스트에서 미호출.
- **미해결(다음 Phase로)**: 정답표 정규식은 실제 PDF 형식 확인 후 확정(A3 Step1). placeholder 폐기 시점은 실기출 충분 적재 후(A4 Step3).
