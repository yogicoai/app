// 중간 서버(백엔드) 통합 스모크 테스트
// 회원가입 수작업 없이 임시 유저/디바이스를 자동 생성해 전 플로우를 검증한다.
// 사용: 서버를 띄운 뒤 `npm run smoke` (다른 서버 대상은 SMOKE_BASE 환경변수)
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4000'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++
    console.log('  ✓', name)
  } else {
    fail++
    console.error('  ✗', name, extra !== undefined ? JSON.stringify(extra) : '')
  }
}

async function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function main() {
  console.log(`[smoke] 대상: ${BASE}`)
  const stamp = Date.now()

  const root = await req('GET', '/')
  check('GET / → 200 (루트 안내)', root.status === 200 && root.body?.name === 'gongmuwon9-api', root.status)

  const health = await req('GET', '/health')
  check('GET /health → 200 ok', health.status === 200 && health.body?.ok === true, health)

  const today = await req('GET', '/content/today')
  const questions = today.body?.questions ?? []
  check('GET /content/today → 문제 1개 이상', today.status === 200 && questions.length >= 1, today.status)
  const qid = questions[0]?._id

  // ── 베타: 회원가입 없는 디바이스 플로우 ──────────────────────────────
  const deviceId = `device-${stamp}-smoke`
  const dev1 = await req('POST', '/auth/device', { body: { deviceId } })
  check(
    'POST /auth/device → 토큰 + anonymous=true',
    (dev1.status === 201 || dev1.status === 200) && typeof dev1.body?.token === 'string' && dev1.body?.user?.anonymous === true,
    dev1.status,
  )
  const dtoken = dev1.body?.token as string
  const anonId = dev1.body?.user?.id

  const dev2 = await req('POST', '/auth/device', { body: { deviceId } })
  check('같은 deviceId 재요청 → 동일 유저', dev2.body?.user?.id === anonId, { a: anonId, b: dev2.body?.user?.id })

  const dAttempt = await req('POST', '/progress/attempt', { token: dtoken, body: { questionId: qid, correct: true } })
  check('익명 유저도 진도 기록 → reps=1, interval=1', dAttempt.status === 200 && dAttempt.body?.progress?.reps === 1 && dAttempt.body?.progress?.interval === 1, dAttempt.body?.progress)

  const wrong = await req('POST', '/progress/attempt', { token: dtoken, body: { questionId: qid, correct: false } })
  check('오답 기록 → reps=0, interval=0', wrong.status === 200 && wrong.body?.progress?.reps === 0 && wrong.body?.progress?.interval === 0, wrong.body?.progress)

  const link = await req('POST', '/auth/link', { token: dtoken, body: { email: `linked_${stamp}@test.com`, password: 'test1234' } })
  check('POST /auth/link → anonymous=false + 같은 id 유지(진도 보존)', link.status === 200 && link.body?.user?.anonymous === false && link.body?.user?.id === anonId, link.body?.user)

  // ── 이메일 계정 플로우 ──────────────────────────────────────────────
  const email = `smoke_${stamp}@test.com`
  const signup = await req('POST', '/auth/signup', { body: { email, password: 'test1234' } })
  check('POST /auth/signup → 201 + token', signup.status === 201 && typeof signup.body?.token === 'string', signup.status)
  const token = signup.body?.token as string

  const dup = await req('POST', '/auth/signup', { body: { email, password: 'test1234' } })
  check('중복 가입 → 409', dup.status === 409, dup.status)

  const me = await req('GET', '/auth/me', { token })
  check('GET /auth/me → 200 + 이메일 일치', me.status === 200 && me.body?.user?.email === email, me.status)

  const noAuth = await req('GET', '/auth/me')
  check('GET /auth/me 무토큰 → 401', noAuth.status === 401, noAuth.status)

  const summary = await req('GET', '/progress/summary', { token: dtoken })
  check('GET /progress/summary → attempted ≥ 1', summary.status === 200 && summary.body?.overall?.attempted >= 1, summary.body?.overall)

  const due = await req('GET', '/progress/due', { token: dtoken })
  check('GET /progress/due → 배열 반환', due.status === 200 && Array.isArray(due.body?.items), due.status)

  console.log(`\n[smoke] 통과 ${pass} / 실패 ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('[smoke] 실행 오류:', e)
  process.exit(1)
})
