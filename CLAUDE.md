# CLAUDE.md — 9급 일반행정직 시험대비 앱 (gongmuwon9)

이 파일은 세션 시작 시 자동 로드된다. 작업 전 아래를 따른다.

## 이 프로젝트가 뭔지
9급 일반행정직 수험생용 안드로이드 앱. **매일 5분 드립(메인)** + **과목별 모의고사(주기 점검)** + **약점 진단 → 약점 재출제 + AI 해설(SRS)**. 목적 = 합격.

자세한 맥락은 먼저 이 순서로 읽을 것:
1. [`README.md`](README.md) — 개요·스택·진행 상황
2. [`docs/superpowers/specs/2026-06-04-9geup-haengjeong-exam-app-design.md`](docs/superpowers/specs/2026-06-04-9geup-haengjeong-exam-app-design.md) — 전체 설계
3. [`docs/superpowers/plans/2026-06-04-phase0-baseline-and-ai-tagging.md`](docs/superpowers/plans/2026-06-04-phase0-baseline-and-ai-tagging.md) — Phase 0 계획·진행 체크박스
4. `git log --oneline` — 커밋 히스토리

## 스택
- 백엔드: `server/` — Fastify + Mongoose + Zod + JWT, MongoDB Atlas
- 앱: `app/` — Expo (React Native) + expo-notifications
- AI: OpenAI 백엔드 프록시. **태깅=gpt-4o-mini(저렴), 해설=상위 모델**
- 디자인: **다크모드 + 네온 액센트 + 게이미피케이션**

## 작업 규칙
- **superpowers 스킬을 적극 사용**한다: 기능 설계 전 `brainstorming`, 계획은 `writing-plans`, 실행은 `executing-plans`, 구현은 `test-driven-development`, 막히면 `systematic-debugging`, 완료 주장 전 `verification-before-completion`.
- **AI 비용 원칙**: 평소 약점 계산은 DB 집계(비용 0). AI는 ①문제 태깅 1회 ②콜드스타트 진단 ③모의고사 직후 재측정 — 3군데만.
- **시크릿은 `server/.env`에만**(git 제외). 앱에서 OpenAI 직접 호출 금지.
- **커밋은 항상 명시적 파일 경로 지정**으로(`git add <경로>`). `git add -A`/`.` 지양.
- 회원가입/로그인 UI는 **맨 마지막**. 베타는 익명 deviceId 인증.

## 명령 (server/ 에서)
```bash
npm run dev      # 서버 :4000
npm run smoke    # 통합 검증 (14/14)
npm run setup    # 계정+문제적재+오늘세트
npm run tag      # AI 태깅(멱등). OPENAI_API_KEY 필요
npm test         # vitest 단위 테스트
```
앱: `app/` 에서 `npx expo start --web`.

## 현재 상태 (2026-06-05)
- **Phase 0 완료.** 실기출 760문제(2021~2026 국가직·지방직) 적재 + Claude AI 태깅(unit/concept) 완료, 용어 1348개 생성.
- **Phase 1(약점 루프) 구현(코드).** DB 집계 기반(AI 비용 0): 단원별 약점 랭킹(`src/lib/weakness.ts`), `GET /progress/weakness`·`/review`(약점 재출제), 앱 진도율 탭 약점 단원 카드 + 약점 재출제.
- **콜드스타트 AI 진단(AI 3접점 중 ②).** `src/lib/ai/diagnose.ts`(순수: 프롬프트/파싱/폴백), `GET /content/diagnostic`(진단세트 비용0), `POST /progress/diagnose`(AI 1일1회 캐싱, 무키/실패 시 DB 폴백). 앱: 홈 온보딩 카드 → 진단 퀴즈 → `diagnose` 결과 화면.
- **푸시 알림(매일 드립).** expo-notifications(~56.0.15) 로컬 일일 알림(`app/src/lib/notifications.ts` + 진도율 탭 토글). 웹 미지원(no-op), **기기 테스트 필요**.
- **데이터 품질 수정.** pdfjs 가 책표지 괄호 『 』를 사설영역 U+F000 으로 깨뜨리던 버그 → `sanitizeGlyphs()`(짝 토글) 추가·파이프라인 연결. 기존 DB 정정: `npm run fix:glyphs`(멱등, `--dry` 지원).
- 검증: 서버 vitest 65/65, 앱·서버 typecheck 클린(기존 `_*.ts` 디버그 제외), 앱 웹 번들 export 성공. 멀티에이전트 리뷰 2회로 발견 결함 보완 완료.

### 🔴 블로커 (사장님 액션 필요)
**MongoDB Atlas 클러스터(`yogico.dmz6oro`)가 중단(paused) 상태** — SRV 레코드가 비어 서버/앱이 DB에 못 붙음(일반 DNS·HTTPS는 정상). 서버는 DB 연결 단계에서만 멈추고 코드는 정상 로드됨. **Atlas 콘솔에서 Resume** 필요. 복구 후: `npm run fix:glyphs`(깨진 괄호 정정) → `npm run smoke` → 앱에서 진단·약점 루프 확인.

### 다음 단계
1. Atlas 복구 → `fix:glyphs` 적용 → 진단·약점 루프 실데이터 검증, 푸시 알림 기기 테스트
2. 모의고사 직후 재측정(AI 3접점 중 ③) · 해설 고도화 · 회원가입/결제
3. 2025 지방직 행정학개론은 이미 적재됨(접두어 매칭). 2026 지방직은 원본 PDF 부재.
