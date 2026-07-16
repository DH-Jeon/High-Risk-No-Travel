/**
 * 시군별 안전점수 집계 — /map 시군 위험 지도의 데이터 소스.
 *
 * 대표값은 평균이 아니라 **중앙값**을 쓴다: 시군 안에 극단 점수(고립 산악지 등)가
 * 섞여도 "이 시군의 오늘 분위기"가 덜 왜곡되도록.
 * 등급 판정은 새 임계값 없이 기존 gradeForScore(weights.ts)를 그대로 재사용한다.
 *
 * getRegionSummaries는 datasource(서버 전용)를 호출하므로 이 모듈도 서버 전용.
 * 순수 함수 summarizeRegions는 테스트에서 직접 호출한다.
 */
import type { Profile, RiskLevel } from "@/lib/safety/types";
import { gradeForScore } from "@/lib/safety/weights";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import {
  getPlacesWithSafety,
  getPlacesWithSafetyOnDate,
  getPlacesWithSafetyOnRange,
  type PlaceWithSafety,
} from "@/lib/datasource";

export interface RegionSummary {
  sigunguCode: number;
  name: string;
  lat: number;
  lng: number;
  /** 시군 내 관광지 안전점수 중앙값 — 관광지 0곳이면 null ("데이터 없음") */
  medianScore: number | null;
  /** 중앙값의 등급(gradeForScore) — 관광지 0곳이면 null */
  grade: RiskLevel | null;
  placeCount: number;
}

/** 정렬된 배열의 중앙값 — 짝수 개면 가운데 두 값 평균을 반올림 */
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * 관광지 배열 → 강원 18개 시군 요약 (sigunguCode 오름차순).
 * sigunguCode가 없거나 SIGUNGU_SEATS에 없는 관광지는 제외.
 * 관광지 0곳인 시군도 SIGUNGU_SEATS 기준으로 포함한다 (medianScore/grade = null).
 */
export function summarizeRegions(places: PlaceWithSafety[]): RegionSummary[] {
  const scoresByCode = new Map<number, number[]>();
  for (const place of places) {
    const code = place.sigunguCode;
    if (code === undefined || !(code in SIGUNGU_SEATS)) continue;
    const scores = scoresByCode.get(code) ?? [];
    scores.push(place.safety.score);
    scoresByCode.set(code, scores);
  }

  return Object.keys(SIGUNGU_SEATS)
    .map(Number)
    .sort((a, b) => a - b)
    .map((code) => {
      const seat = SIGUNGU_SEATS[code];
      const scores = (scoresByCode.get(code) ?? []).sort((a, b) => a - b);
      const medianScore = scores.length > 0 ? median(scores) : null;
      return {
        sigunguCode: code,
        name: seat.name,
        lat: seat.lat,
        lng: seat.lng,
        medianScore,
        grade: medianScore === null ? null : gradeForScore(medianScore),
        placeCount: scores.length,
      };
    });
}

/**
 * 전체 관광지의 점수를 시군별로 요약 — 서버 전용.
 * profile·dateISO를 주면 그 조건의 점수로 지도가 반응한다 (홈 온보딩).
 * endISO까지 주면 기간 모드 — 기간 중 최악일 대표점수 기준.
 */
export async function getRegionSummaries(
  profile: Profile = "default",
  dateISO?: string,
  endISO?: string,
): Promise<RegionSummary[]> {
  const places = dateISO
    ? endISO
      ? await getPlacesWithSafetyOnRange(profile, dateISO, endISO)
      : await getPlacesWithSafetyOnDate(profile, dateISO)
    : await getPlacesWithSafety(undefined, profile);
  return summarizeRegions(places);
}
