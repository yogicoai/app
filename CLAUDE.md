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

## 현재 상태 (2026-06-04)
Phase 0 진행 중. Task 1~6 완료(코드). **블로커: `server/.env`에 `OPENAI_API_KEY` 추가하면** → 시범 태깅 → 전체 태깅 → Phase 0 완료. 다음은 Phase 1(약점 루프) + 실기출 적재.
