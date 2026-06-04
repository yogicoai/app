# 9급 공무원 시험대비 앱 (Expo / React Native)

토스풍 네이비 미니멀 디자인. 회원가입 없이 디바이스 익명 로그인으로 바로 학습.

## 실행
```bash
cd app
npm install
# 백엔드 주소 설정 (실기기/에뮬레이터는 localhost 안 됨)
#  - 안드로이드 에뮬레이터: src/lib/config.ts 의 기본값을 http://10.0.2.2:4000
#  - 실기기(같은 와이파이): http://<PC LAN IP>:4000
npm run android   # 또는 npm run web (빠른 미리보기)
```
> 먼저 백엔드(`../server`)가 떠 있어야 합니다: `cd ../server && npm run dev`

## 구조
```
src/
  app/                 # expo-router 라우트
    _layout.tsx        # providers + 디바이스 세션 초기화
    (tabs)/index.tsx   # 홈(오늘의 학습)
    (tabs)/progress.tsx# 진도율
    quiz.tsx           # 문제풀이 + 결과
  components/          # Button/Card/Choice/ProgressBar/StatCard/Txt/Screen
  lib/                 # api · auth(디바이스 토큰) · types · config
  theme/tokens.ts      # 디자인 토큰 (design/tokens.ts 와 동기화)
```

## 인증 흐름 (베타)
앱 첫 실행 → `ensureSession()` → `POST /auth/device` (deviceId 생성·SecureStore 저장) → 토큰 발급.
회원가입은 선택. 나중에 `POST /auth/link` 로 이메일 계정 승격(진도율 유지).
