# 디자인 시스템 — 토스풍 네이비 미니멀

9급 공무원 시험대비 앱. 절제된 네이비 + 토스풍 블루 CTA, 높은 정보 가독성.
`tokens.ts`(코드) / `tokens.json`(툴·Figma)이 **단일 소스**. Expo 테마와 Figma 라이브러리가 공유.

## 컬러
| 토큰 | 값 | 용도 |
|---|---|---|
| navy | `#0F172A` | 제목·다크 앵커 |
| primary | `#2563EB` | CTA·강조 (토스 블루) |
| primaryDark | `#1D4ED8` | 버튼 눌림 |
| primarySoft | `#EFF4FF` | 선택·하이라이트 배경 |
| bg / surface | `#FFFFFF` / `#F8FAFC` | 화면·카드 배경 |
| border | `#E2E8F0` | 구분선·카드 테두리 |
| textPrimary / Secondary / Muted | `#0F172A` / `#475569` / `#94A3B8` | 본문·보조·흐림 |
| success / error | `#16A34A` / `#DC2626` | 정답 / 오답 |

## 타이포 (Pretendard)
| 스타일 | 크기/행간/굵기 |
|---|---|
| display | 28 / 36 / 700 |
| h1 | 22 / 30 / 700 |
| h2 | 18 / 26 / 600 |
| body | 16 / 24 / 400 |
| caption | 13 / 18 / 400 |

## 간격·반경
- space: 4 · 8 · 12 · 16 · 20 · 24 · 32 (4pt 베이스)
- radius: sm8 · md12 · lg16 · xl20 · pill999
- shadow: 카드만 아주 옅게 (opacity 0.06)

## 컴포넌트
- **Button / Primary**: 채움 `#2563EB`, 흰 글자, radius 12, 높이 52, 텍스트 16/600
- **Button / Secondary**: surface 배경 + border, 텍스트 primary
- **Card**: 흰 배경, border `#E2E8F0`, radius 16, padding 16, 옅은 그림자
- **Choice(보기)**: default(테두리) → selected(primarySoft+primary 테두리) → correct(successSoft+success) / wrong(errorSoft+error)
- **ProgressBar**: track `#E2E8F0`, fill `#2563EB`, 높이 8, pill
- **StatCard**: 큰 숫자(h1) + 라벨(caption)
- **StreakBadge / D-day**: caption + 아이콘

## 핵심 화면
1. **온보딩** — 직렬 선택, 시험일 입력 (가입 없이 시작)
2. **홈(오늘의 학습)** — 진도율 바 + 과목별 세트 리스트 + D-day
3. **문제풀이** — 문제 + 보기(Choice) + 진행 점
4. **결과/해설** — 정답/오답 + 해설 카드
5. **진도율** — 전체/과목별 정답률
