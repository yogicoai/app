# 9급 공무원 시험대비 앱 — 백엔드 API

Fastify + MongoDB(Mongoose) + JWT 인증. 회원가입 / 진도율(SRS) / 오늘의 세트 API.

## 스택
- **Fastify 5** — HTTP 서버
- **Mongoose 8** — MongoDB Atlas 연결/모델
- **@fastify/jwt** — JWT 인증
- **Zod** — 입력 검증
- **bcryptjs** — 비밀번호 해시 (순수 JS, Windows 빌드 이슈 없음)
- **tsx** — TypeScript 직접 실행 (별도 빌드 단계 없음)

## 시작하기
```bash
cd server
npm install
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# .env 에서 MONGODB_URI, JWT_SECRET 채우기
npm run seed              # 샘플 문제 3개 + 오늘의 세트 적재
npm run dev               # http://localhost:4000
```

> MongoDB Atlas: 무료 M0 클러스터 생성 → Database Access 에서 유저 → Network Access 에서 내 IP(또는 0.0.0.0/0 개발용) 허용 → Connect > Drivers 의 문자열을 `MONGODB_URI`에 붙여넣기.

## 데이터 모델
| 컬렉션 | 용도 |
|---|---|
| `users` | 회원가입/로그인 |
| `questions` | 문제(기출) — 과목/보기/정답/해설 |
| `dailySets` | 날짜별 '오늘의 세트' (전 유저 공유) |
| `progress` | 유저별 풀이 기록 + SRS 복습 스케줄 |
| `recommendations` | 유저별 AI 추천 (다음 단계) |

## API
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/health` | - | 헬스체크 |
| POST | `/auth/signup` | - | 회원가입 → `{ token, user }` |
| POST | `/auth/login` | - | 로그인 → `{ token, user }` |
| GET | `/auth/me` | ✅ | 내 정보 |
| GET | `/content/today` | - | 오늘의 세트(문제 포함) |
| GET | `/content/questions?subject=&limit=` | - | 문제 목록 |
| POST | `/progress/attempt` | ✅ | 풀이 기록 `{ questionId, correct }` |
| GET | `/progress/due` | ✅ | 복습 예정 문제 |
| GET | `/progress/summary` | ✅ | 진도율 요약(전체+과목별) |

인증 라우트는 헤더 `Authorization: Bearer <token>` 필요.

## 빠른 테스트 (curl)
```bash
# 회원가입
curl -s -X POST localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}'

# 위 응답의 token 으로 풀이 기록 (questionId 는 /content/today 에서 확인)
curl -s -X POST localhost:4000/progress/attempt \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"questionId":"<ID>","correct":true}'

# 진도율
curl -s localhost:4000/progress/summary -H "Authorization: Bearer <TOKEN>"
```
