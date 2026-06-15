// PDF 파일 → 페이지별 텍스트 배열. IO 전용(파싱/검증은 parse.ts 책임).
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function extractPdfPages(path: string): Promise<string[]> {
  const data = new Uint8Array(await readFile(path))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ')
    pages.push(text)
  }
  return pages
}
