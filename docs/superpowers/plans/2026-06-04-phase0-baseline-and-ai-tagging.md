# Phase 0 — 로컬 베이스라인 + 기출 AI 태깅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 서버+Expo 앱을 로컬에서 띄워 화면을 확인하고, 약점 진단의 버킷이 될 `unit`/`concept` 태그 필드를 추가한 뒤, OpenAI로 문제를 자동 태깅하는 멱등 스크립트를 만든다.

**Architecture:** 기존 Fastify+Mongoose 코드를 확장한다. 새 작업은 (1) Question 스키마에 태그 필드 추가, (2) OpenAI 클라이언트 래퍼와 순수 태깅 로직(`tagger.ts`)을 분리, (3) DB의 미태깅 문제를 찾아 태깅·저장하는 배치 스크립트. 순수 로직은 vitest로 단위 테스트하고(외부 API 미호출), OpenAI 호출 부분은 주입(injection)으로 분리해 테스트 가능하게 한다.

**Tech Stack:** Node (ESM) · TypeScript · tsx · Fastify · Mongoose · Zod · OpenAI SDK · vitest

> **상위 설계 문서:** `docs/superpowers/specs/2026-06-04-9geup-haengjeong-exam-app-design.md` (Phase 0)
>
> **작업 디렉터리:** `C:\Users\Yogibo Design\Desktop\appData` (server / app). 모든 명령은 별도 표기 없으면 `server/`에서 실행.
>
> **사용자 진행 방식:** Phase의 각 묶음이 끝날 때마다 **로컬 실행 → 화면/출력 확인 → 다음 진행**. Task 1, Task 7에 명시적 "같이 확인" 체크포인트가 있다.

---

## File Structure (이번 Phase에서 생성/수정하는 파일)

| 파일 | 책임 | 생성/수정 |
|---|---|---|
| `server/src/models/Question.ts` | 문제 스키마에 `unit`/`concept`/`tagSource` 필드 추가 | 수정 |
| `server/src/config/env.ts` | `OPENAI_API_KEY`(선택)·`OPENAI_MODEL` 환경변수 | 수정 |
| `server/.env.example` | OpenAI 키 문서화 | 수정 |
| `server/package.json` | `openai`·`vitest` 의존성, `test`·`tag` 스크립트 | 수정 |
| `server/vitest.config.ts` | vitest 설정(ESM) | 생성 |
| `server/src/lib/ai/openai.ts` | OpenAI Chat 호출 래퍼(JSON 응답) | 생성 |
| `server/src/lib/ai/tagger.ts` | 순수 로직: 프롬프트 생성·응답 파싱/검증·태그 병합·미태깅 판별 | 생성 |
| `server/src/lib/ai/tagger.test.ts` | tagger 단위 테스트 | 생성 |
| `server/src/scripts/tag-questions.ts` | DB 미태깅 문제 → 태깅 → 저장(멱등) 배치 | 생성 |
| `server/content/README.md` | 태깅 명령 문서 추가 | 수정 |

**범위 밖(다음 Phase / 게이트):** 실제 기출 PDF→JSON 파서는 PDF 원본이 준비되면 별도 작업으로 추가한다. 본 Phase의 태깅은 이미 DB에 적재된 문제(샘플 포함)를 대상으로 동작하므로 PDF 없이도 완결된다.

---

## Task 1: 로컬 베이스라인 — 서버+앱 실행, 화면 같이 확인

기존 코드가 로컬에서 도는지부터 확인한다. 새 코드 없음. 사장님과 **화면을 같이 보는** 첫 체크포인트.

**Files:** 없음(실행/검증만)

- [ ] **Step 1: 서버 의존성 설치 확인 후 타입체크**

Run (`server/`):
```bash
npm install
npm run typecheck
```
Expected: 타입 에러 없이 종료(exit 0).

- [ ] **Step 2: 스모크 테스트로 백엔드+DB 동작 확인**

Run (`server/`):
```bash
npm run smoke
```
Expected: 통합 시나리오 통과 출력(예: `14/14`). 실패 시 `.env`의 `MONGODB_URI`/`JWT_SECRET` 먼저 점검(Atlas 연결).

- [ ] **Step 3: 콘텐츠 적재 + 오늘의 세트 구성**

Run (`server/`):
```bash
npm run setup
```
Expected: `import 완료 …`, `questions 컬렉션 총 N건`, `오늘의 세트(YYYY-MM-DD) 구성: M문제` 출력.

- [ ] **Step 4: 서버 dev 모드 기동**

Run (`server/`, 별도 터미널 유지):
```bash
npm run dev
```
Expected: Fastify가 `:4000`에서 리슨. 종료하지 말고 둘 것.

- [ ] **Step 5: Expo 앱 기동(웹으로 빠르게 화면 확인)**

Run (`app/`, 또 다른 터미널):
```bash
npm install
npx expo start --web
```
Expected: 브라우저에 홈/퀴즈/진도율 탭이 뜨고, 익명 디바이스 로그인 후 "오늘의 세트" 문제가 보임. (안드로이드 에뮬레이터로 보려면 `app/src/lib/config.ts`의 `API_BASE`를 `http://10.0.2.2:4000`로.)

- [ ] **체크포인트 ✋ Step 6: 사장님과 화면 확인**

홈에 오늘의 문제가 뜨고 퀴즈 풀이가 동작하는지 함께 확인한다. 베이스라인 OK면 다음 Task로. (이 단계는 커밋 없음 — 코드 변경이 없으므로.)

---

## Task 2: vitest 단위 테스트 인프라 추가

순수 로직(tagger)을 TDD하기 위한 테스트 러너를 붙인다. 기존 `smoke`(통합)는 그대로 두고, 순수 함수용 단위 테스트만 vitest로.

**Files:**
- Modify: `server/package.json`
- Create: `server/vitest.config.ts`

- [ ] **Step 1: vitest 의존성 설치**

Run (`server/`):
```bash
npm install -D vitest@^2.1.0
```
Expected: 설치 성공, `package.json` devDependencies에 `vitest` 추가됨.

- [ ] **Step 2: `package.json`에 test 스크립트 추가**

`server/package.json`의 `scripts`에 아래 줄을 추가(기존 줄 유지):
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: `vitest.config.ts` 생성**

Create `server/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 4: 빈 실행으로 러너 동작 확인**

Run (`server/`):
```bash
npm test
```
Expected: "No test files found" 또는 0 tests 통과(에러 없이 종료). 러너가 동작하면 OK.

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/package-lock.json server/vitest.config.ts
git commit -m "test: add vitest unit test runner to server"
```

---

## Task 3: Question 스키마에 태그 필드(unit/concept/tagSource) 추가

약점을 과목보다 잘게(단원·개념) 묶기 위한 필드를 추가한다. 기존 필드는 유지.

**Files:**
- Modify: `server/src/models/Question.ts`

- [ ] **Step 1: 스키마에 필드 3개 추가**

`server/src/models/Question.ts`의 `questionSchema` 정의에서 `difficulty` 줄 **다음**에 아래 3줄을 추가:
```ts
    unit: { type: String, index: true }, // 단원 (예: 통일신라, 행정행위)
    concept: { type: String }, // 핵심개념 (예: 무효와 취소의 구별)
    tagSource: { type: String, enum: ['ai', 'manual', null], default: null }, // 태그 출처
```
변경 후 해당 부분은 다음과 같아야 한다:
```ts
    difficulty: { type: Number, default: 3, min: 1, max: 5 },
    unit: { type: String, index: true },
    concept: { type: String },
    tagSource: { type: String, enum: ['ai', 'manual', null], default: null },
    examType: { type: String },
```

- [ ] **Step 2: 타입체크로 모델 정합성 확인**

Run (`server/`):
```bash
npm run typecheck
```
Expected: 에러 없음. (`InferSchemaType`이 새 필드를 자동 반영.)

- [ ] **Step 3: Commit**

```bash
git add server/src/models/Question.ts
git commit -m "feat: add unit/concept/tagSource fields to Question schema"
```

---

## Task 4: OpenAI 환경변수 + 클라이언트 래퍼

키를 백엔드에만 두고(앱 직접 호출 금지), Chat 호출을 한 곳으로 감싼다. 키가 없으면 명확히 실패하도록.

**Files:**
- Modify: `server/src/config/env.ts`
- Modify: `server/.env.example`
- Modify: `server/package.json` (openai 의존성)
- Create: `server/src/lib/ai/openai.ts`

- [ ] **Step 1: openai SDK 설치**

Run (`server/`):
```bash
npm install openai@^4.67.0
```
Expected: 설치 성공.

- [ ] **Step 2: env 스키마에 OpenAI 변수 추가**

`server/src/config/env.ts`의 `schema` 객체에서 `CORS_ORIGIN` 줄 **다음**에 추가:
```ts
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
```
(선택값으로 둬서, 태깅을 안 쓰는 서버 기동/스모크는 키 없이도 동작.)

- [ ] **Step 3: `.env.example`에 키 문서화**

`server/.env.example` 맨 끝에 추가:
```bash

# OpenAI (문제 AI 태깅·해설 생성용). 태깅 스크립트 실행 시 필요.
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

- [ ] **Step 4: OpenAI 래퍼 작성**

Create `server/src/lib/ai/openai.ts`:
```ts
import OpenAI from 'openai'
import { env } from '../../config/env'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 가 설정되지 않았습니다. .env 를 확인하세요.')
  }
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
  return client
}

// 시스템+유저 프롬프트로 JSON 문자열 응답을 받아 그대로 반환한다(파싱은 호출측 책임).
export async function chatJson(system: string, user: string): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  return res.choices[0]?.message?.content ?? ''
}
```

- [ ] **Step 5: 타입체크**

Run (`server/`):
```bash
npm run typecheck
```
Expected: 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add server/src/config/env.ts server/.env.example server/src/lib/ai/openai.ts server/package.json server/package-lock.json
git commit -m "feat: add OpenAI env config and chat wrapper"
```

---

## Task 5: 태깅 순수 로직(tagger) — TDD

프롬프트 생성·AI 응답 파싱/검증·미태깅 판별을 **외부 호출 없는 순수 함수**로 만들고 단위 테스트한다.

**Files:**
- Create: `server/src/lib/ai/tagger.ts`
- Test: `server/src/lib/ai/tagger.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `server/src/lib/ai/tagger.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseTagResponse, needsTagging, buildTagUserPrompt } from './tagger'

describe('parseTagResponse', () => {
  it('정상 JSON 을 파싱한다', () => {
    const raw = JSON.stringify({ unit: '통일신라', concept: '신라 삼국통일', difficulty: 3 })
    expect(parseTagResponse(raw)).toEqual({ unit: '통일신라', concept: '신라 삼국통일', difficulty: 3 })
  })

  it('difficulty 가 없으면 3 으로 기본값', () => {
    const raw = JSON.stringify({ unit: '행정행위', concept: '무효와 취소' })
    expect(parseTagResponse(raw).difficulty).toBe(3)
  })

  it('잘못된 JSON 이면 null', () => {
    expect(parseTagResponse('not json')).toBeNull()
  })

  it('unit 이 비면 null', () => {
    const raw = JSON.stringify({ unit: '', concept: 'x' })
    expect(parseTagResponse(raw)).toBeNull()
  })

  it('difficulty 범위를 벗어나면 1~5 로 클램프', () => {
    const raw = JSON.stringify({ unit: 'a', concept: 'b', difficulty: 9 })
    expect(parseTagResponse(raw).difficulty).toBe(5)
  })
})

describe('needsTagging', () => {
  it('unit 이 없으면 태깅 필요', () => {
    expect(needsTagging({ unit: undefined, tagSource: null })).toBe(true)
  })
  it('수동 태그는 건드리지 않는다', () => {
    expect(needsTagging({ unit: '통일신라', tagSource: 'manual' })).toBe(false)
  })
  it('이미 ai 태깅됐고 unit 있으면 스킵', () => {
    expect(needsTagging({ unit: '통일신라', tagSource: 'ai' })).toBe(false)
  })
})

describe('buildTagUserPrompt', () => {
  it('문제 본문과 보기를 포함한다', () => {
    const p = buildTagUserPrompt({
      subject: '한국사',
      questionText: '삼국통일을 이룬 나라는?',
      choices: ['고구려', '백제', '신라', '가야'],
    })
    expect(p).toContain('삼국통일')
    expect(p).toContain('신라')
    expect(p).toContain('한국사')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run (`server/`):
```bash
npm test
```
Expected: FAIL — `./tagger` 모듈/함수 없음.

- [ ] **Step 3: tagger 구현**

Create `server/src/lib/ai/tagger.ts`:
```ts
// 외부 API 호출이 없는 순수 로직. OpenAI 호출은 호출측(스크립트)이 주입한다.

export interface TagInput {
  subject: string
  questionText: string
  choices: string[]
}

export interface TagResult {
  unit: string
  concept: string
  difficulty: number
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// AI 응답(JSON 문자열) → 검증된 TagResult. 실패 시 null.
export function parseTagResponse(raw: string): TagResult | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  const unit = typeof o.unit === 'string' ? o.unit.trim() : ''
  const concept = typeof o.concept === 'string' ? o.concept.trim() : ''
  if (!unit || !concept) return null
  const rawDiff = typeof o.difficulty === 'number' ? o.difficulty : 3
  const difficulty = clamp(Math.round(rawDiff), 1, 5)
  return { unit, concept, difficulty }
}

// 이미 태깅됐거나 수동 태그면 건너뛴다(멱등).
export function needsTagging(q: { unit?: string | null; tagSource?: string | null }): boolean {
  if (q.tagSource === 'manual') return false
  return !q.unit
}

export const TAG_SYSTEM_PROMPT =
  '너는 9급 공무원 시험 문제 분류 전문가다. 주어진 문제를 분석해 단원(unit), ' +
  '핵심개념(concept), 난이도(difficulty: 1~5 정수)를 정한다. ' +
  '반드시 {"unit":string,"concept":string,"difficulty":number} 형태의 JSON 만 출력한다.'

export function buildTagUserPrompt(q: TagInput): string {
  const choiceLines = q.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')
  return [
    `과목: ${q.subject}`,
    `문제: ${q.questionText}`,
    `보기:`,
    choiceLines,
  ].join('\n')
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (`server/`):
```bash
npm test
```
Expected: PASS — 위 모든 케이스 통과.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/ai/tagger.ts server/src/lib/ai/tagger.test.ts
git commit -m "feat: add pure tagging logic with unit tests"
```

---

## Task 6: 태깅 배치 스크립트(tag-questions) — DB 미태깅 문제 태깅·저장

래퍼(openai)+순수로직(tagger)+모델을 묶어, DB의 미태깅 문제를 찾아 태깅하고 저장한다. 멱등: 이미 태깅된 건 스킵.

**Files:**
- Create: `server/src/scripts/tag-questions.ts`
- Modify: `server/package.json` (tag 스크립트)
- Modify: `server/content/README.md` (명령 문서)

- [ ] **Step 1: 배치 스크립트 작성**

Create `server/src/scripts/tag-questions.ts`:
```ts
// DB 의 미태깅 문제를 OpenAI 로 태깅(unit/concept/difficulty)하고 저장한다.
// 멱등: tagSource==='manual' 또는 unit 이 이미 있는 문제는 건너뛴다.
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { chatJson } from '../lib/ai/openai'
import {
  TAG_SYSTEM_PROMPT,
  buildTagUserPrompt,
  parseTagResponse,
  needsTagging,
} from '../lib/ai/tagger'

const LIMIT = Number(process.env.TAG_LIMIT ?? '0') // 0 = 전체

async function main() {
  await connectDb()

  const query = QuestionModel.find({
    tagSource: { $ne: 'manual' },
    $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }],
  }).sort({ _id: 1 })
  if (LIMIT > 0) query.limit(LIMIT)
  const candidates = await query

  console.log(`미태깅 후보 ${candidates.length}건`)
  let tagged = 0
  let failed = 0

  for (const q of candidates) {
    if (!needsTagging({ unit: q.unit, tagSource: q.tagSource })) continue
    try {
      const raw = await chatJson(
        TAG_SYSTEM_PROMPT,
        buildTagUserPrompt({ subject: q.subject, questionText: q.questionText, choices: q.choices }),
      )
      const parsed = parseTagResponse(raw)
      if (!parsed) {
        failed++
        console.warn(`✗ 파싱 실패 (${q.subject} ${q._id})`)
        continue
      }
      q.unit = parsed.unit
      q.concept = parsed.concept
      q.difficulty = parsed.difficulty
      q.tagSource = 'ai'
      await q.save()
      tagged++
      console.log(`✓ ${q.subject} → ${parsed.unit} / ${parsed.concept} (난이도 ${parsed.difficulty})`)
    } catch (e) {
      failed++
      console.warn(`✗ 호출 실패 (${q.subject} ${q._id}):`, (e as Error).message)
    }
  }

  console.log(`\n태깅 완료: 성공 ${tagged} · 실패 ${failed}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('태깅 실패:', e)
  process.exit(1)
})
```

- [ ] **Step 2: `package.json`에 tag 스크립트 추가**

`server/package.json`의 `scripts`에 추가:
```json
    "tag": "tsx src/scripts/tag-questions.ts",
```

- [ ] **Step 3: 타입체크**

Run (`server/`):
```bash
npm run typecheck
```
Expected: 에러 없음.

- [ ] **Step 4: 소량 태깅 실행(검증)**

`.env`에 유효한 `OPENAI_API_KEY`가 있어야 한다. 먼저 3건만:

Run (`server/`):
```bash
TAG_LIMIT=3 npm run tag
```
Expected: `미태깅 후보 N건`, `✓ 한국사 → … / … (난이도 3)` 형태 3줄, `태깅 완료: 성공 3 · 실패 0`.

(PowerShell이면: `$env:TAG_LIMIT=3; npm run tag`)

- [ ] **Step 5: 멱등성 확인(재실행 시 스킵)**

Run (`server/`):
```bash
TAG_LIMIT=3 npm run tag
```
Expected: 같은 3건은 이제 `unit` 이 있으므로 후보에서 빠지고, 그 다음 미태깅 3건이 잡히거나 후보가 줄어듦. 이미 태깅된 문제가 다시 호출되지 않음(=멱등).

- [ ] **Step 6: content README에 명령 추가**

`server/content/README.md`의 "## 운영 명령" 코드블록에 추가:
```bash
npm run tag      # DB 미태깅 문제 → OpenAI 로 unit/concept/난이도 태깅(멱등)
```

- [ ] **Step 7: Commit**

```bash
git add server/src/scripts/tag-questions.ts server/package.json server/content/README.md
git commit -m "feat: add idempotent AI tagging batch script"
```

---

## Task 7: 전체 태깅 실행 + 결과 화면 같이 확인

**Files:** 없음(실행/검증만)

- [ ] **Step 1: 전체 미태깅 문제 태깅**

Run (`server/`):
```bash
npm run tag
```
Expected: 남은 미태깅 문제 전부 태깅, `태깅 완료: 성공 N · 실패 0`(소수 파싱 실패는 재실행으로 보완).

- [ ] **Step 2: DB에서 태깅 결과 표본 확인**

Run (`server/`):
```bash
tsx -e "import('./src/config/db.js').then(async()=>{}).catch(()=>{})" 2>/dev/null; node -e "console.log('use: npm run tag 출력 로그로 확인')"
```
대신 간단히 mongosh 또는 Atlas UI에서 `questions` 컬렉션 한 건을 열어 `unit`/`concept`/`tagSource:'ai'`가 채워졌는지 확인. (별도 조회 스크립트가 필요하면 다음 Phase에서 추가.)

- [ ] **체크포인트 ✋ Step 3: 사장님과 결과 확인**

태깅된 `unit`/`concept`가 과목 내용과 맞는지 표본 몇 건을 함께 본다. 분류 품질이 약점 진단의 토대이므로, 어색하면 `TAG_SYSTEM_PROMPT`(tagger.ts) 문구를 조정하고 Task 6 Step 4부터 재실행.

- [ ] **Step 4: Phase 0 종료 커밋(있는 경우)**

프롬프트 조정 등 변경이 있었다면:
```bash
git add server/src/lib/ai/tagger.ts
git commit -m "chore: tune tagging prompt after review"
```

---

## 다음 Phase 예고(게이트)

- **실제 기출 적재**: 사이버국가고시센터 PDF를 확보하면 → PDF→JSON 파서 스크립트를 추가하고 `npm run import` → `npm run tag` 순으로 적재·태깅. (PDF 원본 준비가 선행 조건.)
- **Phase 1(약점 루프)**: 이 태그(`unit`/`concept`)를 버킷으로 쓰는 약점 집계 엔진 + 콜드스타트 AI 진단. 별도 계획서로 작성.

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지**: 설계 Phase 0의 "토대 점검"(Task 1) · "AI 태깅"(Task 3~7) 충족. "실제 기출 적재"는 PDF 외부 의존이라 게이트로 분리(설계 §7 미해결 항목과 일치).
- **플레이스홀더**: 모든 코드 단계에 실제 코드 포함, TBD 없음.
- **타입 정합성**: `parseTagResponse`/`needsTagging`/`buildTagUserPrompt`/`TAG_SYSTEM_PROMPT`/`chatJson` 시그니처가 tagger.ts·openai.ts 정의와 스크립트 사용처에서 일치. Question 필드 `unit`/`concept`/`tagSource`가 Task 3 정의와 Task 6 사용처에서 일치.
- **주의**: Task 6 Step 4 환경변수 설정은 bash/PowerShell 문법이 다름 → 두 가지 모두 표기함.
