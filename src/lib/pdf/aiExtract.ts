import { chatJson } from '../ai/openai'
import { assembleDocItems, normalizePageText, type ExtractedItem } from './parse'

const EXTRACT_SYSTEM =
  '너는 한국 공무원 기출시험 PDF 텍스트를 구조화하는 파서다. 시험지 한 부의 전체 텍스트가 주어지면 ' +
  '지문과 객관식 문항을 분리해 구조화한다.\n' +
  '규칙:\n' +
  '1) 원본은 글자 사이에 불필요한 공백이 섞여 있다("국 어"→"국어", "‘ 굳다 ’"→"‘굳다’"). 자연스러운 한국어로 복원한다.\n' +
  '2) **지문 분리가 핵심이다.** "윗글", "다음 글", "제시문", 시(詩)/대화문/(가)~(라) 자료 등 여러 문항이 공유하거나 발문이 가리키는 본문은 passages 에 **한 번만** 싣고 고유 id(p1,p2…)를 준다. 그 지문을 쓰는 문항은 passageId 로 연결한다.\n' +
  '3) 지문이 필요 없는 독립 문항은 passageId 를 null 로 둔다.\n' +
  '4) 문항의 questionText 에는 발문과 **그 문항만의 자료를 모두** 담는다. 논리퀴즈·언어추론의 전제/조건(예: "A 부서에서는 갑·을·병이…", 동그라미(○) 조건 나열)처럼 한 문항에만 속한 자료는 passages 로 빼지 말고 questionText 에 반드시 포함한다. passages 는 **둘 이상의 문항이 공유**하는 지문에만 쓴다.\n' +
  '5) **questionText 와 choices 분리가 중요하다.** questionText 는 지문+발문(물음 문장)에서 끝낸다. 그 뒤에 오는 선택지 목록(①…②…③…④…)은 **절대 questionText 에 넣지 말고** 전부 choices 배열로 보낸다. choices 에는 각 선택지의 **내용**만 담는다(앞의 번호 기호 ①②③④ 만 떼고 내용은 보존). 선택지 내용이 기호 자체이면 그 기호를 그대로 넣는다 — 예: 발문이 "㉠~㉣ 중…"이면 choices=["㉠","㉡","㉢","㉣"]; "①②③④" 만 남기고 비우지 마라.\n' +
  '6) <보기> 조합형("적절한 것만을 모두 고르면"): 본문에 "ㄱ. …","ㄴ. …","ㄷ. …" 진술이 나열되고 선택지가 그 조합이면 — ㄱ/ㄴ/ㄷ 진술 전체는 questionText(또는 passage)에 포함하고, choices 에는 조합만 넣는다(예: choices=["ㄱ","ㄱ, ㄷ","ㄴ, ㄷ","ㄱ, ㄴ, ㄷ"]).\n' +
  '7) 지문·본문에서 단어/구절 앞에 붙은 표지 ㉠㉡㉢㉣(**특히 ㉠을 자주 빠뜨리니 주의**)·밑줄·(가)(나) 는 그 위치에 원문 그대로 유지한다(빠지면 발문이 가리킬 대상이 사라진다). 이 표지를 본문에 유지하는 것과, 선택지가 ㉠㉡㉢㉣일 때 choices 에 넣는 것은 별개이며 둘 다 해야 한다.\n' +
  '8) **원문 구조·순서를 절대 바꾸지 마라.** 지문/단락의 제시 순서를 정답 순서로 재배열하지 말고, 위치 표지·라벨을 임의로 제거·이동하지 마라.\n' +
  '9) 영어 **문장 삽입형**("주어진 문장이 들어갈 위치"): 지문 속 삽입 위치 표지 (①)(②)(③)(④) 를 원문 그대로 유지하고, 삽입할 "주어진 문장"은 questionText 의 발문 부분(지문 앞 또는 발문 직후)에 별도로 두어라 — 지문 끝에 본문처럼 이어 붙이지 마라.\n' +
  '10) 영어 **순서 배열형**("글의 순서로 가장 적절한 것"): (A)(B)(C)(D) 단락 라벨을 유지하고 **원문에 제시된 순서 그대로** 둔다(정답 순서로 재배열 금지). choices 는 "(B)-(A)-(C)" 같은 순서 조합으로 둔다.\n' +
  '11) 페이지 머리말("2026년도 국가공무원 9급 …쪽")·과목 머리글·안내문은 제외한다. 보기가 잘린 불완전 문항도 제외한다.\n' +
  '출력(JSON only): {"passages":[{"id":"p1","text":"지문 전문"}],"questions":[{"number":7,"passageId":"p1","questionText":"발문","choices":["c1","c2","c3","c4"]}]}'

// 완성도(미완성 < 완성)를 우선, 같은 완성도면 더 긴(완전한) 버전을 보존하며 병합.
function quality(it: ExtractedItem): number {
  return (isIncomplete(it) ? 0 : 1_000_000) + it.questionText.length + it.choices.join('').length
}
function mergeInto(byNumber: Map<number, ExtractedItem>, items: ExtractedItem[]): void {
  for (const it of items) {
    const prev = byNumber.get(it.number)
    if (!prev || quality(it) > quality(prev)) byNumber.set(it.number, it)
  }
}

// 추출은 일회성·정확도 중요 → 상위 모델 사용(기본 gpt-4o). 태깅/해설은 env.OPENAI_MODEL(mini) 유지.
const EXTRACT_MODEL = process.env.EXTRACT_MODEL ?? 'gpt-4o'

async function callAndAssemble(user: string, temperature?: number): Promise<ExtractedItem[]> {
  const raw = await chatJson(EXTRACT_SYSTEM, user, { model: EXTRACT_MODEL, ...(temperature !== undefined ? { temperature } : {}) })
  try {
    return assembleDocItems(JSON.parse(raw))
  } catch {
    return []
  }
}

// 시험지 전체 → 지문이 부착된 문항 배열.
// 선택지가 ㄱ/ㄴ/ㄷ 조합("ㄱ","ㄱ, ㄷ"…)인 <보기>형인데, 본문에 ㄱ./ㄴ./ㄷ. 진술이 없으면 미완성.
function isComboChoices(choices: string[]): boolean {
  return choices.length > 0 && choices.every((c) => /^[ㄱ-ㅎ](\s*,\s*[ㄱ-ㅎ])*$/.test(c.trim()))
}
function lacksStatements(text: string): boolean {
  return !(/ㄱ\s*\./.test(text) && /ㄴ\s*\./.test(text) && /ㄷ\s*\./.test(text))
}
function isIncomplete(it: ExtractedItem | undefined): boolean {
  if (!it) return true // 누락
  return isComboChoices(it.choices) && lacksStatements(it.questionText)
}

// 1차: 2페이지 겹침 창으로 나눠 호출(출력 truncation 방지 + 지문·문항이 한 창에 같이).
// 보완: 정답표로 아는 총 문항수(expected) 대비 누락 또는 미완성(<보기>형인데 ㄱㄴㄷ 진술 빠짐) 번호를
//       전체 문서에서 타겟 재추출(최대 5라운드). 더 완전한(긴) 버전이 자동 우선 병합된다.
export async function extractQuestionsFromDoc(pages: string[], expected?: number): Promise<ExtractedItem[]> {
  const full = pages.map(normalizePageText).join('\n\n')
  const windows: string[] =
    pages.length <= 2 ? [full] : pages.slice(0, -1).map((_, i) => [pages[i]!, pages[i + 1]!].map(normalizePageText).join('\n\n'))

  const byNumber = new Map<number, ExtractedItem>()
  for (const w of windows) mergeInto(byNumber, await callAndAssemble(w))

  if (expected && expected > 0) {
    for (let round = 0; round < 5; round++) {
      const need: number[] = []
      for (let n = 1; n <= expected; n++) if (isIncomplete(byNumber.get(n))) need.push(n)
      if (need.length === 0) break
      const targeted =
        `${full}\n\n[지시] 위 시험지에서 오직 ${need.join(', ')}번 문항만 추출하라. ` +
        `<보기> ㄱ/ㄴ/ㄷ 형 문항이면 ㄱ. ㄴ. ㄷ. 진술 전문을 questionText 에 반드시 포함하고 choices 는 조합("ㄱ","ㄱ, ㄷ"…)으로 한다. ` +
        `각 문항의 지문/전제를 규칙대로 포함하라.`
      mergeInto(byNumber, (await callAndAssemble(targeted, 0.3)).filter((it) => need.includes(it.number)))
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

// 특정 번호만 타겟 재추출(감사가 짚은 문항만 고칠 때). 좋은 문항은 건드리지 않는다.
export async function extractQuestionsByNumbers(pages: string[], numbers: number[]): Promise<ExtractedItem[]> {
  const full = pages.map(normalizePageText).join('\n\n')
  const targeted =
    `${full}\n\n[지시] 위 시험지에서 오직 ${numbers.join(', ')}번 문항만 추출하라. ` +
    `해당 문항의 지문/전제(<보기>ㄱㄴㄷ 진술, 영어 삽입형 (①)(②)(③)(④)·순서배열형 (A)(B)(C) 포함)를 규칙대로 빠짐없이 담아라.`
  return (await callAndAssemble(targeted, 0.2)).filter((it) => numbers.includes(it.number))
}
