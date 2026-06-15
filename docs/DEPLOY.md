# 배포 가이드 — 백엔드 호스팅 + 앱 빌드(EAS)

테스트(Expo Go/Safari)에서 **진짜 앱(스토어)** 으로 가는 전 과정. 순서대로 따라가면 된다.

> 큰 그림: **① 백엔드를 공개 HTTPS로** → **② eas.json에 그 주소 박기** → **③ EAS로 앱 빌드** → **④ 스토어 등록·심사**.

---

## ① 백엔드 배포 (Railway 추천 · Render 대안)

백엔드는 `server/`. **`Dockerfile` 이 이미 있어** 어디서나 동일하게 빌드된다. 런타임에 PDF·로컬스크립트는 필요 없다(`.dockerignore`로 제외됨).

### 준비 — MongoDB Atlas
1. Atlas 콘솔 → **Network Access** → `0.0.0.0/0`(어디서나) 허용 추가. (호스트 IP가 고정이 아니라 보통 0.0.0.0/0을 쓴다.)
2. 클러스터는 **Resume 상태 유지**(중단되면 앱 전체가 멈춤).

### Railway (가장 쉬움)
1. https://railway.app 가입 → **New Project → Deploy from GitHub repo** (이 repo 연결).
2. 서비스 설정 → **Root Directory = `server`** (중요: 모노레포라 server/만 빌드).
3. Railway가 `server/Dockerfile`을 자동 감지해 빌드한다.
4. **Variables** 탭에 환경변수 입력(아래 표).
5. 배포되면 **Settings → Networking → Generate Domain** 으로 공개 URL 생성 → `https://xxxx.up.railway.app`.
6. 확인: 브라우저로 `https://xxxx.up.railway.app/health` → `{"ok":true}` 나오면 성공.

### Render (대안)
1. https://render.com → **New → Web Service** → repo 연결.
2. **Root Directory = `server`**, **Runtime = Docker**.
3. Environment에 환경변수 입력(아래 표). **Health Check Path = `/health`**.
4. 배포되면 `https://xxxx.onrender.com` 발급. (무료 플랜은 유휴 시 슬립 → 첫 요청이 느릴 수 있음.)

### 필요한 환경변수 (둘 다 공통)
| 키 | 값 | 비고 |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://...` | Atlas 연결 문자열(현재 `server/.env` 값 그대로) |
| `JWT_SECRET` | 16자 이상 임의 문자열 | 토큰 서명 키 |
| `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY` | AI 키 | 태깅·진단·해설용. Claude면 `ANTHROPIC_API_KEY` |
| `AI_PROVIDER` | `anthropic` 또는 `openai` | (선택) 미지정 시 키 형태로 자동 판별 |
| `CORS_ORIGIN` | `*` | 모바일 앱은 origin이 없어 `*`로 충분 |
| `NODE_ENV` | `production` | |

> `PORT`는 플랫폼이 자동 주입한다(서버가 `env.PORT`를 읽음). 직접 설정 불필요.
> **시크릿은 절대 코드/깃에 올리지 말 것** — 반드시 플랫폼 Variables에만.

---

## ② eas.json에 백엔드 주소 반영

`app/eas.json`의 `preview`·`production` 프로파일에서 `EXPO_PUBLIC_API_URL`의
`https://CHANGE-ME-backend-url` 를 ①에서 받은 **실제 HTTPS 주소**로 교체한다.

```json
"preview":    { "env": { "EXPO_PUBLIC_API_URL": "https://xxxx.up.railway.app" } },
"production": { "env": { "EXPO_PUBLIC_API_URL": "https://xxxx.up.railway.app" } }
```
(`development`는 로컬 테스트용 LAN IP 유지.)

---

## ③ EAS로 앱 빌드

```bash
npm install -g eas-cli      # 또는 npx eas-cli@latest
cd app
eas login                   # 무료 Expo 계정
eas init                    # 프로젝트 생성 → app.json에 projectId 자동 추가
```

### 안드로이드 — 무료·즉시 (실기기 테스트용 APK)
```bash
eas build -p android --profile preview
```
- 클라우드 빌드(5~15분) → **.apk 다운로드 링크** 발급.
- 폰에 APK 설치(출처 불명 앱 허용) → **푸시 알림까지 완전 테스트**. 스토어·결제 불필요.

### iOS — Apple 계정 필요
```bash
eas build -p ios --profile preview     # ad-hoc(등록 기기) / 또는 production
```
- **Apple Developer Program($99/년)** 필요. EAS가 인증서·프로비저닝을 대신 관리(`eas credentials`).
- TestFlight 업로드: `eas submit -p ios --profile production`.

---

## ④ 스토어 등록·심사 (앱이 충분히 다듬어진 뒤)

- **Google Play**: 개발자 등록 $25(1회) → Play Console에서 앱 생성 → `eas build -p android --profile production`(.aab) → `eas submit -p android` → 내부테스트 → 공개.
- **App Store**: App Store Connect에서 앱 생성 → `eas build -p ios --profile production` → `eas submit -p ios` → TestFlight → 심사 제출.
- **공통 필수물**: 개인정보처리방침 URL, 스크린샷(기기 사이즈별), 앱 설명, 카테고리, 연령등급, (Apple) 개인정보 수집 라벨.

---

## 체크리스트 (출시 전)
- [ ] 백엔드 HTTPS 배포 + `/health` 200 확인
- [ ] Atlas Network Access 0.0.0.0/0
- [ ] `eas.json`의 `EXPO_PUBLIC_API_URL` 실주소로 교체
- [ ] `app.json` 번들ID/패키지 확정(`com.gongmuwon9.app`) — **스토어 등록 후 변경 불가**
- [ ] `npm run fix:glyphs` 로 DB 깨진 글자 정정
- [ ] 안드로이드 APK로 실기기 검증(특히 푸시 알림)
- [ ] 개인정보처리방침 URL 준비
- [ ] (유료) Apple $99 / Google $25 결제

## 참고
- 번들ID/패키지는 현재 `com.gongmuwon9.app`(placeholder). 도메인 소유 시 그에 맞게(예: `kr.회사.gongmuwon9`) 바꾸고, **스토어 첫 업로드 전에 확정**할 것.
- `EXPO_PUBLIC_` 접두 환경변수는 빌드 시 앱에 인라인된다 → 백엔드 주소가 바뀌면 **재빌드** 필요.
- 로컬 백엔드 구동 시 c-ares SRV 문제가 나면 `npm run dev` 대신 `tsx src/scripts/_run-server.ts`(공용 DNS 강제, 깃 제외)로 우회 — 클라우드 호스트에선 불필요.
