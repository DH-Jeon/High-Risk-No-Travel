/**
 * 안전 대체지 추천 v1 — 거리·카테고리·안전점수·실내외 적합도 기반 (제안서 핵심 기능)
 *
 * 규칙:
 * - 자기 자신 제외, Haversine 거리 30km 이내
 * - 의미 있는 개선만: candidate.score >= target.score + 5
 * - 카테고리 유사도(TourAPI 분류체계): cat3 일치 3점 > cat2 일치 2점 > contentTypeId 일치 1점
 * - 실내 보정: target의 기상 감점이 클 때(weatherRisk >= 15) 실내 후보 +2점
 * - 정렬: (유사도+보정) 내림차순 → 안전점수 내림차순 → 거리 오름차순
 */
import type { PlaceWithSafety } from "@/lib/datasource";
import { haversineKm } from "@/lib/reco/distance";

export interface Alternative extends PlaceWithSafety {
  distanceKm: number;
}

const MAX_DISTANCE_KM = 30;
const MIN_SCORE_GAIN = 5;
const WEATHER_RISK_INDOOR_THRESHOLD = 15;
const INDOOR_BONUS = 2;
const DEFAULT_LIMIT = 4;

/** TourAPI 카테고리 유사도: cat3(소분류) > cat2(중분류) > contentTypeId(콘텐츠 유형) */
function categorySimilarity(
  target: PlaceWithSafety,
  candidate: PlaceWithSafety,
): number {
  if (target.cat3 && candidate.cat3 === target.cat3) return 3;
  if (target.cat2 && candidate.cat2 === target.cat2) return 2;
  if (candidate.contentTypeId === target.contentTypeId) return 1;
  return 0;
}

export function recommendAlternatives(
  target: PlaceWithSafety,
  candidates: PlaceWithSafety[],
  limit: number = DEFAULT_LIMIT,
): Alternative[] {
  const preferIndoor = target.safety.weatherRisk >= WEATHER_RISK_INDOOR_THRESHOLD;

  const ranked: { alt: Alternative; rankScore: number }[] = [];
  for (const candidate of candidates) {
    if (candidate.contentId === target.contentId) continue;
    if (candidate.safety.score < target.safety.score + MIN_SCORE_GAIN) continue;

    const distanceKm = haversineKm(
      target.lat,
      target.lng,
      candidate.lat,
      candidate.lng,
    );
    if (distanceKm > MAX_DISTANCE_KM) continue;

    let rankScore = categorySimilarity(target, candidate);
    if (preferIndoor && candidate.envType === "indoor") rankScore += INDOOR_BONUS;

    ranked.push({ alt: { ...candidate, distanceKm }, rankScore });
  }

  ranked.sort(
    (a, b) =>
      b.rankScore - a.rankScore ||
      b.alt.safety.score - a.alt.safety.score ||
      a.alt.distanceKm - b.alt.distanceKm,
  );

  return ranked.slice(0, limit).map((r) => r.alt);
}
