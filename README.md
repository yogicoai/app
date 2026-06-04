# 9급 일반행정직 시험대비 앱 (gongmuwon9)

> 9급 일반행정직 수험생이 **매일 5분 드립**으로 학습 습관을 들이고, **주기적 과목별 모의고사**로 약점을 진단받아, 그 약점이 자동으로 다음 문제·용어로 **재출제**되어 합격까지 가는 안드로이드 앱.

이 문서는 Claude Code와 함께 브레인스토밍·설계·구현하며 정한 내용을 정리한 프로젝트 개요다.
상세 설계/계획은 [`docs/`](docs/) 참고.

---

## 핵심 목적

고객(수험생)이 9급 일반행정직 시험을 **통과**하게 만드는 것. 수단은 (1) 매일 드립으로 리텐션 확보, (2) 약점 진단·집중 보강.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 백엔드/DB | MongoDB Atlas + 자체 Node API (**Fastify + Mongoose + Zod + JWT**) — `server/` |
| 프론트 | **Expo (React Native)** + expo-notifications — `app/` |
| AI | OpenAI (백엔드 프록시로만, 키 노출 금지). 태깅=`gpt-4o-mini`(저렴), 해설=상위 모델 |
| 배포 | Android 우선 (Play 스토어). iOS는 추후 |

> Next/TWA 대신 **RN 확정**: 매일 알림이 드립 리텐션의 핵심이고, iOS 확장 여지와 기존 코드 재활용 때문.

## 제품 핵심

- **중심 흐름**: 메인 = 매일 5문제 드립(습관), 주기 점검 = 과목별 모의고사(약점 재측정). 5과목 = 국어·영어·한국사·행정법·행정학.
- **핵심 루프**: 풀이 → 패턴 분석(정오답·소요시간) → 약점 진단 → 약점 영역 재출제 + AI 해설 (SRS 1d/3d/7d/14d).
- **AI 하이브리드 (비용 통제)**: 평소 약점 계산은 **DB 집계(비용 0)**. AI는 3군데만 — ①문제 적재 시 태깅 1회(unit/concept/난이도, 영구 캐싱) ②신규 유저 콜드스타트 진단(온보딩) ③모의고사 직후 재측정. "매 풀이마다 AI" ❌.
- **디자인 방향**: **다크모드 + 네온 액센트 + 게이미피케이션**(streak·배지). 20대 타깃.
- **회원가입은 맨 마지막**: 베타는 익명 deviceId 인증, 이후 이메일 승격(진도 보존).

## 데이터 자산

**사이버국가고시센터(gosi.kr) 공개 기출이 핵심 자산.** 현재 `server/content/`의 문제 27개는 검수용 placeholder(실기출 아님) → 운영 전 실기출 5년치로 교체. 해설은 저작권상 직접/AI 작성.

---

## 폴더 구조

```
appData/                  ← 프로젝트 루트 (독립 git repo)
├── server/               ← 백엔드 (Fastify + MongoDB). 모든 npm 명령은 여기서 실행
│   ├── .env              ← 시크릿 (git 제외). OPENAI_API_KEY 여기에
│   ├── src/lib/ai/       ← openai.ts(래퍼), tagger.ts(순수 로직)
│   ├── src/scripts/      ← import / build-daily-set / tag-questions / smoke ...
│   └── content/          ← 문제 JSON
├── app/                  ← Expo(RN) 앱 (홈/퀴즈/모의고사/진도)
├── design/               ← 디자인 토큰
└── docs/superpowers/     ← specs(설계) + plans(구현 계획)
```

## 로컬 실행

```bash
# 1) 백엔드 (server/)
cd server
npm install
npm run dev          # :4000 기동 (또는 npm run start)
npm run smoke        # 통합 검증 (현재 14/14)
npm run setup        # dev계정 + 문제 적재 + 오늘의 세트
npm run tag          # DB 미태깅 문제 AI 태깅(멱등). OPENAI_API_KEY 필요
npm test             # vitest 단위 테스트

# 2) 앱 (app/)
cd app
npm install
npx expo start --web   # 브라우저로 빠른 화면 확인 (localhost:8081)
# 안드로이드 에뮬레이터: app/src/lib/config.ts 의 API_BASE = http://10.0.2.2:4000
```

`server/.env`는 `.env.example`을 복사해 채운다(`MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`). **시크릿은 절대 커밋 금지** — `.gitignore`로 차단됨.

---

## 진행 상황 — Phase 0 (로컬 베이스라인 + AI 태깅)

계획서: [`docs/superpowers/plans/2026-06-04-phase0-baseline-and-ai-tagging.md`](docs/superpowers/plans/2026-06-04-phase0-baseline-and-ai-tagging.md)

- [x] **Task 1** 로컬 베이스라인 — 서버+앱 기동, 스모크 14/14, 문제 27/오늘세트 10, 화면 확인
- [x] **Task 2** vitest 단위 테스트 인프라
- [x] **Task 3** Question 스키마에 `unit`/`concept`/`tagSource` 추가
- [x] **Task 4** OpenAI 환경변수 + 클라이언트 래퍼(`src/lib/ai/openai.ts`)
- [x] **Task 5** 태깅 순수 로직(`src/lib/ai/tagger.ts`) + 단위 테스트 9/9
- [x] **Task 6** 태깅 배치 스크립트(`src/scripts/tag-questions.ts`, 멱등) — 코드 완성 + 실행검증(3건 시범 → 멱등성 확인)
- [x] **Task 7** 전체 태깅 — 27/27 문제 `unit`/`concept`/`tagSource:'ai'` 채움(실패 0). 검토 후 프롬프트 튜닝(과목명 unit 금지·일관 표기)으로 재태깅

> ✅ **Phase 0 완료.** 분류 품질 검토 결과 unit이 교과서 중단원 수준(예: `조선 후기 실학`, `행정행위`)으로 일관 분류됨.

### 다음 단계
1. **Phase 1** 약점 루프(DB 집계 엔진 + 콜드스타트 AI 진단), 그 전 실기출 적재
2. 이후 모의고사 → AI 해설 → 푸시 알림 → 회원가입/결제 (각 Phase 별도 계획서)

---

## 설계 문서

- 전체 설계: [`docs/superpowers/specs/2026-06-04-9geup-haengjeong-exam-app-design.md`](docs/superpowers/specs/2026-06-04-9geup-haengjeong-exam-app-design.md)
- Phase 0 계획: [`docs/superpowers/plans/2026-06-04-phase0-baseline-and-ai-tagging.md`](docs/superpowers/plans/2026-06-04-phase0-baseline-and-ai-tagging.md)
