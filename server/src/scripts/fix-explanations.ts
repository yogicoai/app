// 감사에서 사실/논리 오류로 확정된 해설을, 검증된 사실(hint)을 주입해 재생성한다.
// 정확도+자기일관성을 강제. 재감사로 검증 후 남으면 비우는 것이 안전(무해설 > 오해설).
import mongoose from 'mongoose'
import { connectDb } from '../config/db'
import { QuestionModel } from '../models/Question'
import { chatJson } from '../lib/ai/openai'

const MODEL = process.env.EXPLAIN_MODEL ?? 'gpt-4o'

// 감사(웹검증 포함)로 확인된 정확한 사실. 이 사실을 반드시 반영하고 모순 없이 해설.
const CORRECTIONS: { subject: string; number: number; hint: string }[] = [
  {
    subject: '국어',
    number: 1,
    hint:
      '정답 ③. 원문 "공공서비스의 효율적인 이용"은 자연스럽고 옳은 표현이다("효율적인"이 "이용"을 수식). ③의 수정안 "효율적인 공공서비스의 이용"은 "효율적인"이 "공공서비스"를 수식하게 되어 의미를 왜곡하므로 적절하지 않은 수정(=정답). ①②④는 적절한 수정이다. [근거]와 [보기 해설]이 서로 모순되지 않게.',
  },
  {
    subject: '국어',
    number: 11,
    hint:
      '정답 ②. 예측: (가)갑 출장, (나)을 휴가 그리고 갑 출장, (다)병 휴직 또는 갑 출장. 정확히 하나만 거짓. 갑 출장이 거짓이면 (가)와 (다)가 동시에 거짓이 되어 "하나만 거짓"에 위배 → 갑 출장은 반드시 참, 유일한 거짓은 (나) → "을은 휴가를 가지 않는다"가 반드시 참(②). 병의 휴직 여부는 알 수 없다.',
  },
  {
    subject: '한국사',
    number: 5,
    hint:
      '밑줄 친 왕은 6조 직계제를 폐지하고 의정부서사제를 시행한 세종이다(태종 아님). ①칠정산(1442)·②농사직설(1429)·③향약집성방(1433)은 모두 세종 대의 사실로 옳다. ④혼일강리역대국도지도는 1402년(태종 2년) 제작이라 세종 재위와 무관(=정답, 옳지 않은 것). "태조 제작"은 틀림.',
  },
  {
    subject: '행정법총론',
    number: 10,
    hint:
      '정답 ③. 행정심판위원회는 행정심판법 제50조에 따라 직접 처분 권한이 있다("권한 없다"고 쓰면 오류). ③이 옳지 않은 이유는 직접처분 요건이 "피청구인이 처분을 하지 아니하는 경우(부작위)"인데 ③은 "처분을 한 경우"로 서술해 요건이 불일치하기 때문이다. 보기 ④가 제50조를 인용하는 것과 모순되지 않게.',
  },
  {
    subject: '행정법총론',
    number: 15,
    hint:
      '대법원 2012두22799 판례상 대기오염물질배출시설 설치허가는 "재량행위"다(기속행위로 단정하면 오류). 정답은 ②이므로, ②가 옳지 않은 보기인 이유를 판례에 근거해 자기모순 없이 설명하라(설치허가를 기속행위라고 가르치지 마라).',
  },
  {
    subject: '행정학개론',
    number: 17,
    hint:
      '정답 ④. 현행 지방교부세법상 소방안전교부세 재원은 담배에 부과하는 개별소비세 총액의 45%다(20%는 도입 당시의 옛 비율). 따라서 ④의 "50%"가 틀려서 정답이다. 해설에서 올바른 수치는 45%로 제시하라(20%로 단정하지 마라).',
  },
  {
    subject: '행정학개론',
    number: 19,
    hint:
      '정답 ②(ㄱ,ㄴ). 루빈 실시간 예산운영 모형의 흐름별 정치: 세입=설득의 정치, 세출=선택의 정치, 균형=제약조건의 정치, 집행=책임성의 정치. ㄷ이 틀린 이유는 "제약조건의 정치"가 세입이 아니라 균형 흐름의 특징이기 때문이다("기회주의의 정치"라는 명칭은 존재하지 않으니 쓰지 마라).',
  },
]

const SYSTEM =
  '너는 9급 공무원 시험 해설 강사다. 문제·정답·[검증된 사실]을 보고 해설을 다시 쓴다.\n' +
  '[중요] 제시된 [검증된 사실]을 반드시 그대로 반영하고, [근거]·[보기 해설]·정답이 서로 모순되지 않게 일관되게 작성하라. 사실에 확신이 없으면 단정하지 마라.\n' +
  '형식: "정답 ③\\n\\n[근거] …\\n\\n[보기 해설]\\n① …\\n② …(정답)\\n③ …\\n④ …"\n' +
  '반드시 {"explanation":"..."} JSON 만 출력한다.'

function buildUser(q: { subject: string; passage?: string; questionText: string; choices: string[]; answerIndex: number }, hint: string): string {
  const choiceLines = q.choices.map((c, i) => `${i + 1}. ${c}`).join('\n')
  return [
    `과목: ${q.subject}`,
    q.passage ? `지문: ${q.passage}` : '',
    `발문: ${q.questionText}`,
    `보기:\n${choiceLines}`,
    `정답: ${q.answerIndex + 1}번`,
    `[검증된 사실]\n${hint}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function main() {
  await connectDb()
  let done = 0
  let failed = 0
  for (const c of CORRECTIONS) {
    const q = await QuestionModel.findOne({ source: '기출', subject: c.subject, number: c.number })
    if (!q) {
      console.warn(`✗ 문항 없음: ${c.subject} ${c.number}`)
      failed++
      continue
    }
    const doc = q as unknown as { subject: string; passage?: string; questionText: string; choices: string[]; answerIndex: number }
    try {
      const raw = await chatJson(SYSTEM, buildUser(doc, c.hint), { model: MODEL })
      const o = JSON.parse(raw) as { explanation?: string }
      if (!o.explanation || !o.explanation.trim()) {
        failed++
        console.warn(`✗ 파싱 실패: ${c.subject} ${c.number}`)
        continue
      }
      q.set('explanation', o.explanation.trim())
      await q.save()
      done++
      console.log(`✓ ${c.subject} ${c.number} 재생성`)
    } catch (e) {
      failed++
      console.warn(`✗ ${c.subject} ${c.number}:`, (e as Error).message)
    }
  }
  console.log(`\n해설 정정: 성공 ${done} · 실패 ${failed}`)
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error('해설 정정 실패:', e)
  process.exit(1)
})
