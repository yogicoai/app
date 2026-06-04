# 문제 콘텐츠 (questions 적재용)

이 폴더의 `*.json` 을 `npm run import` 가 검증·적재한다. 한 파일 = 한 시험(또는 큐레이션) 묶음.

## 포맷
```jsonc
{
  "meta": {
    "source": "기출",        // 기출 | curated (생략 시 examType 으로 추론)
    "examType": "국가직",     // 국가직 | 지방직 | 서울시 | curated
    "year": 2024,
    "grade": "9급",
    "track": "일반행정"
  },
  "questions": [
    {
      "subject": "한국사",          // 국어 | 영어 | 한국사 | 행정법 | 행정학
      "number": 7,                  // 문항 번호(기출 멱등키에 사용, 선택)
      "questionText": "...",
      "choices": ["...", "...", "...", "..."],
      "answerIndex": 2,             // 0-based 정답
      "explanation": "...",         // 해설(선택)
      "tags": ["통일신라"],
      "difficulty": 3               // 1~5 (선택)
    }
  ]
}
```

## 멱등 적재 (key)
- 기출(examType≠curated, year·number 있음): `examType:year:subject:number`
- 그 외: `source:subject:sha1(questionText)`

같은 key 는 덮어쓰기 → 여러 번 import 해도 중복 안 생김.

## 운영 명령
```bash
npm run import   # content/*.json → questions 적재(검증 포함)
npm run daily    # 뱅크에서 오늘의 세트 구성(과목별 2문항, 날짜 회전)
npm run setup    # seed(dev계정) + import + daily 한 번에
```

## 기출 → JSON 파이프라인 (실데이터)
1. **출처**: 사이버국가고시센터(gosi.kr)가 9급 기출 PDF를 공개. 문제 자체는 공공 자료라 활용 가능.
   - ⚠️ 시중 문제집의 **해설**은 저작권 대상 → 해설은 직접 작성하거나 AI로 생성(별도 검수).
2. **변환**: PDF → 위 JSON 포맷으로 정리. (PDF가 준비되면 파서 스크립트를 붙일 수 있음 — 요청 시 작성.)
3. **검수**: 정답/보기 오탈자 확인 후 `npm run import`.

> `curated-starter.json` 은 앱 동작 확인용으로 직접 검수한 15문항(5과목)이며, 실제 기출의 정확한 복제가 아니다. 운영 전 공식 기출로 교체·보강할 것.
