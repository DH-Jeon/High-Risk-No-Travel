/**
 * 목록 카드용 소개문 요약 — scripts/seed-overviews.ts가 배치 수집한 내장 데이터.
 * (상세 페이지는 detailCommon2 실시간 조회를 쓴다 — lib/tour/overview.ts)
 * 아직 수집 안 된 관광지는 undefined → 카드는 요약 줄을 숨긴다.
 */
import overviewsJson from "@/data/overviews.json";

const CARD_SUMMARIES = overviewsJson as Record<string, string>;

export function cardSummary(contentId: number): string | undefined {
  return CARD_SUMMARIES[String(contentId)];
}
