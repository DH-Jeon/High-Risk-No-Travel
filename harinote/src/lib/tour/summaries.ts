/**
 * AI 3줄 요약 — scripts/seed-summaries.ts가 Groq로 배치 생성한 내장 데이터.
 * 원문(detailCommon2) 기반 요약이며 화면에 "AI 요약"을 표기한다.
 */
import summariesJson from "@/data/summaries.json";

const SUMMARIES = summariesJson as Record<string, string[]>;

export function summaryOf(contentId: number): string[] | undefined {
  const lines = SUMMARIES[String(contentId)];
  return lines && lines.length > 0 ? lines : undefined;
}
